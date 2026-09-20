/*
 * Multi-step scenarios that produce a realistic cascade of events.
 * The HTTP call returns immediately (202); the steps then play out
 * over a few seconds so the dashboard visibly changes step by step.
 */
const Device = require('../models/Device');
const Alarm = require('../models/Alarm');
const deviceService = require('../services/deviceService');
const alarmService = require('../services/alarmService');
const ticker = require('./ticker');
const findDevice = require('../utils/findDevice');
const HttpError = require('../utils/httpError');
const { emitToDashboard } = require('../socket');
const { THRESHOLDS } = require('../config/constants');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runSteps(scenario, steps, stepMs) {
  (async () => {
    for (const [i, step] of steps.entries()) {
      emitToDashboard('simulator:step', {
        scenario,
        step: i + 1,
        total: steps.length,
        description: step.description,
      });
      try {
        await step.run();
      } catch (err) {
        console.error(`[scenario ${scenario}] step ${i + 1} failed:`, err.message);
      }
      if (i < steps.length - 1) await sleep(stepMs);
    }
    emitToDashboard('simulator:done', { scenario });
  })();
  return steps.map((s) => s.description);
}

// Link failure -> ISIS adjacency loss -> BGP session loss, on both ends.
async function fiberCut({ hostname = 'NCS-540-03', interface: ifName, stepMs = 1500 } = {}) {
  const device = await findDevice(hostname, { lean: true });
  const iface = ifName
    ? device.interfaces.find((i) => i.name === ifName)
    : device.interfaces.find((i) => i.peerDevice && i.operStatus === 'up');
  if (!iface) throw new HttpError(400, `No usable interface on ${device.hostname}`);
  if (!iface.peerDevice) throw new HttpError(400, `${iface.name} has no connected peer`);

  const peer = await findDevice(iface.peerDevice, { lean: true });
  const reason = `Fiber cut ${device.hostname} ${iface.name} <-> ${peer.hostname} ${iface.peerInterface}`;
  const delay = Math.min(10000, Math.max(200, Number(stepMs) || 1500));

  const isisPairs = [
    [device, peer.hostname],
    [peer, device.hostname],
  ].filter(([d, neighbor]) => d.isisNeighbors.some((n) => n.systemId === neighbor));

  const bgpPairs = [
    ...device.bgpNeighbors.filter((n) => n.peerDevice === peer.hostname).map((n) => [device.hostname, n.address]),
    ...peer.bgpNeighbors.filter((n) => n.peerDevice === device.hostname).map((n) => [peer.hostname, n.address]),
  ];

  const steps = [
    {
      description: `Link down: ${device.hostname} ${iface.name} <-> ${peer.hostname} ${iface.peerInterface}`,
      run: async () => {
        await deviceService.setInterfaceStatus(device.hostname, iface.name, 'down', reason);
        await deviceService.setInterfaceStatus(peer.hostname, iface.peerInterface, 'down', reason);
      },
    },
  ];

  if (isisPairs.length) {
    steps.push({
      description: `ISIS adjacency lost between ${device.hostname} and ${peer.hostname}`,
      run: async () => {
        for (const [d, neighbor] of isisPairs) {
          await deviceService.setIsisNeighborState(d.hostname, neighbor, false, reason);
        }
      },
    });
  }

  if (bgpPairs.length) {
    steps.push({
      description: `BGP session(s) down between ${device.hostname} and ${peer.hostname}`,
      run: async () => {
        for (const [host, address] of bgpPairs) {
          await deviceService.setBgpNeighborState(host, address, false, reason);
        }
      },
    });
  }

  return { scenario: 'fiber-cut', steps: runSteps('fiber-cut', steps, delay) };
}

// Put the whole network back to green.
async function recoverAll() {
  ticker.clearOverrides();
  const reason = 'Recovered by simulator';
  const devices = await Device.find().lean();

  for (const d of devices) {
    if (d.status === 'DOWN') await deviceService.setDeviceStatus(d.hostname, 'UP', reason);
    for (const i of d.interfaces) {
      if (i.operStatus === 'down') await deviceService.setInterfaceStatus(d.hostname, i.name, 'up', reason);
    }
    for (const n of d.isisNeighbors) {
      if (n.state !== 'Up') await deviceService.setIsisNeighborState(d.hostname, n.systemId, true, reason);
    }
    for (const n of d.bgpNeighbors) {
      if (n.state !== 'Established') await deviceService.setBgpNeighborState(d.hostname, n.address, true, reason);
    }
    if (d.cpu >= THRESHOLDS.cpu.clear) await deviceService.forceCpu(d.hostname, 30);
  }

  // Anything left over (e.g. memory alarms)
  const leftovers = await Alarm.find({ active: true }).lean();
  for (const a of leftovers) await alarmService.clear(a.device, a.type, a.resource);
  for (const d of devices) await deviceService.refreshHealth(d);

  return { devices: devices.length };
}

module.exports = { fiberCut, recoverAll };
