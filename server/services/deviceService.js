/*
 * Every device state change goes through this file, whether it comes from
 * the simulator, a REST call, or (later) a real Netmiko/Python collector.
 *
 * Pattern for each change:
 *   1. write to MongoDB atomically (the source of truth)
 *   2. emit the Socket.io event
 *   3. raise or clear the matching alarm
 *   4. recompute device health (UP / DEGRADED)
 */
const Device = require('../models/Device');
const alarmService = require('./alarmService');
const findDevice = require('../utils/findDevice');
const HttpError = require('../utils/httpError');
const { emitToDashboard } = require('../socket');
const { THRESHOLDS } = require('../config/constants');

const makeEvent = (kind, message) => ({ kind, message, at: new Date() });

function emitStatus(device, status, previous, lastEvent) {
  emitToDashboard('device:status', {
    deviceId: device._id,
    hostname: device.hostname,
    status,
    previous,
    lastEvent: lastEvent || null,
    at: new Date(),
  });
}

// Health rule: DOWN is set explicitly. Otherwise a reachable device is
// DEGRADED if it has any active alarm, and UP if it has none.
async function refreshHealth(device) {
  const current = await Device.findById(device._id).select('hostname status').lean();
  if (!current || current.status === 'DOWN') return current?.status;

  const next = (await alarmService.hasActive(device._id)) ? 'DEGRADED' : 'UP';
  if (next === current.status) return next;

  // Compare-and-set: only update if nobody changed the status meanwhile.
  const result = await Device.updateOne({ _id: device._id, status: current.status }, { $set: { status: next } });
  if (result.modifiedCount) emitStatus(current, next, current.status);
  return next;
}

async function raiseOrClear(device, isFault, { type, severity, resource, message }) {
  if (isFault) await alarmService.raise(device, { type, severity, resource, message });
  else await alarmService.clear(device._id, type, resource);
  await refreshHealth(device);
}

async function setDeviceStatus(ref, status, reason) {
  if (!['UP', 'DOWN'].includes(status)) throw new HttpError(400, 'status must be UP or DOWN');
  const device = await findDevice(ref, { lean: true });
  const isDown = device.status === 'DOWN';
  if ((status === 'DOWN') === isDown) return device; // already in that state: idempotent

  if (status === 'DOWN') {
    const message = reason || `${device.hostname} is unreachable`;
    const updated = await Device.findByIdAndUpdate(
      device._id,
      { $set: { status: 'DOWN', lastEvent: makeEvent('DEVICE_DOWN', message) } },
      { new: true }
    ).lean();
    emitStatus(updated, 'DOWN', device.status, updated.lastEvent);
    await alarmService.raise(updated, { type: 'DEVICE_DOWN', severity: 'critical', message });
    return updated;
  }

  // Coming back: clear DEVICE_DOWN first, then decide UP vs DEGRADED.
  await alarmService.clear(device._id, 'DEVICE_DOWN');
  const next = (await alarmService.hasActive(device._id)) ? 'DEGRADED' : 'UP';
  const message = reason || `${device.hostname} is reachable again`;
  const updated = await Device.findByIdAndUpdate(
    device._id,
    { $set: { status: next, lastSeen: new Date(), lastEvent: makeEvent('DEVICE_UP', message) } },
    { new: true }
  ).lean();
  emitStatus(updated, next, 'DOWN', updated.lastEvent);
  return updated;
}

async function setInterfaceStatus(ref, ifName, operStatus, reason) {
  if (!['up', 'down'].includes(operStatus)) throw new HttpError(400, 'operStatus must be up or down');
  const device = await findDevice(ref, { lean: true });
  const iface = device.interfaces.find((i) => i.name === ifName);
  if (!iface) throw new HttpError(404, `Interface ${ifName} not found on ${device.hostname}`);
  if (iface.operStatus === operStatus) return device;

  const isDown = operStatus === 'down';
  const message = reason || `Interface ${ifName} on ${device.hostname} is ${operStatus.toUpperCase()}`;
  const set = {
    'interfaces.$.operStatus': operStatus,
    lastEvent: makeEvent(isDown ? 'INTERFACE_DOWN' : 'INTERFACE_UP', message),
  };
  if (isDown) {
    set['interfaces.$.inBps'] = 0;
    set['interfaces.$.outBps'] = 0;
  }

  // Positional update ($): changes just this interface, atomically.
  const updated = await Device.findOneAndUpdate(
    { _id: device._id, 'interfaces.name': ifName },
    { $set: set },
    { new: true }
  ).lean();

  emitToDashboard('device:interface', {
    deviceId: device._id,
    hostname: device.hostname,
    interface: updated.interfaces.find((i) => i.name === ifName),
    lastEvent: updated.lastEvent,
  });
  await raiseOrClear(device, isDown, { type: 'INTERFACE_DOWN', severity: 'major', resource: ifName, message });
  return updated;
}

async function setBgpNeighborState(ref, address, up, reason) {
  const device = await findDevice(ref, { lean: true });
  const neighbor = device.bgpNeighbors.find((n) => n.address === address);
  if (!neighbor) throw new HttpError(404, `BGP neighbor ${address} not found on ${device.hostname}`);

  const state = up ? 'Established' : 'Idle';
  if (neighbor.state === state) return device;

  const message = reason
    ? `${reason} (BGP neighbor ${address} ${up ? 'Established' : 'DOWN'})`
    : `BGP neighbor ${address} (AS ${neighbor.remoteAs}) on ${device.hostname} is ${up ? 'Established' : 'DOWN'}`;

  const updated = await Device.findOneAndUpdate(
    { _id: device._id, 'bgpNeighbors.address': address },
    {
      $set: {
        'bgpNeighbors.$.state': state,
        'bgpNeighbors.$.stateSince': new Date(),
        lastEvent: makeEvent(up ? 'BGP_UP' : 'BGP_DOWN', message),
      },
    },
    { new: true }
  ).lean();

  emitToDashboard('device:bgp', {
    deviceId: device._id,
    hostname: device.hostname,
    neighbor: updated.bgpNeighbors.find((n) => n.address === address),
    lastEvent: updated.lastEvent,
  });
  await raiseOrClear(device, !up, { type: 'BGP_DOWN', severity: 'critical', resource: address, message });
  return updated;
}

async function setIsisNeighborState(ref, systemId, up, reason) {
  const device = await findDevice(ref, { lean: true });
  const neighbor = device.isisNeighbors.find((n) => n.systemId === systemId);
  if (!neighbor) throw new HttpError(404, `ISIS neighbor ${systemId} not found on ${device.hostname}`);

  const state = up ? 'Up' : 'Down';
  if (neighbor.state === state) return device;

  const message = reason
    ? `${reason} (ISIS adjacency to ${systemId} ${state.toUpperCase()})`
    : `ISIS adjacency ${device.hostname} -> ${systemId} on ${neighbor.interface} is ${state.toUpperCase()}`;

  const updated = await Device.findOneAndUpdate(
    { _id: device._id, 'isisNeighbors.systemId': systemId },
    {
      $set: {
        'isisNeighbors.$.state': state,
        'isisNeighbors.$.stateSince': new Date(),
        lastEvent: makeEvent(up ? 'ISIS_UP' : 'ISIS_DOWN', message),
      },
    },
    { new: true }
  ).lean();

  emitToDashboard('device:isis', {
    deviceId: device._id,
    hostname: device.hostname,
    neighbor: updated.isisNeighbors.find((n) => n.systemId === systemId),
    lastEvent: updated.lastEvent,
  });
  await raiseOrClear(device, !up, { type: 'ISIS_DOWN', severity: 'major', resource: systemId, message });
  return updated;
}

// CPU/memory threshold alarms with hysteresis (see config/constants.js).
async function evaluateThresholds(device) {
  const { cpu, memory } = THRESHOLDS;

  if (device.cpu >= cpu.raise) {
    await alarmService.raise(device, {
      type: 'HIGH_CPU',
      severity: 'major',
      message: `CPU utilisation ${device.cpu}% on ${device.hostname} (threshold ${cpu.raise}%)`,
    });
  } else if (device.cpu < cpu.clear) {
    await alarmService.clear(device._id, 'HIGH_CPU');
  }

  if (device.memory >= memory.raise) {
    await alarmService.raise(device, {
      type: 'HIGH_MEMORY',
      severity: 'minor',
      message: `Memory utilisation ${device.memory}% on ${device.hostname} (threshold ${memory.raise}%)`,
    });
  } else if (device.memory < memory.clear) {
    await alarmService.clear(device._id, 'HIGH_MEMORY');
  }

  await refreshHealth(device);
}

async function forceCpu(ref, cpu) {
  const device = await findDevice(ref, { lean: true });
  if (device.status === 'DOWN') throw new HttpError(409, `${device.hostname} is DOWN`);

  const updated = await Device.findByIdAndUpdate(
    device._id,
    { $set: { cpu, lastSeen: new Date() } },
    { new: true }
  ).lean();

  // Metrics payloads are partial: clients merge whatever fields are present.
  emitToDashboard('device:metrics', {
    at: new Date(),
    devices: [{ deviceId: updated._id, hostname: updated.hostname, cpu: updated.cpu, memory: updated.memory }],
  });
  await evaluateThresholds(updated);
  return updated;
}

module.exports = {
  setDeviceStatus,
  setInterfaceStatus,
  setBgpNeighborState,
  setIsisNeighborState,
  evaluateThresholds,
  forceCpu,
  refreshHealth,
};
