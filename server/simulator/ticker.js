/*
 * Background metrics generator. Every tick it jitters CPU, memory and
 * interface traffic for all reachable devices, saves them in one bulkWrite,
 * and pushes ONE batched `device:metrics` event, not one event per device.
 */
const Device = require('../models/Device');
const deviceService = require('../services/deviceService');
const { emitToDashboard } = require('../socket');

const overrides = new Map(); // hostname -> { cpu, until } (set by /simulator/high-cpu)
let timer = null;
let running = false;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rand = (min, max) => Math.random() * (max - min) + min;

function nextCpu(device, now) {
  const override = overrides.get(device.hostname);
  if (override && override.until > now) return Math.round(clamp(override.cpu + rand(-2, 2), 0, 100));
  if (override) overrides.delete(device.hostname);

  // Drift back towards a ~30% baseline with some noise.
  const baseline = 30;
  return Math.round(clamp(device.cpu + (baseline - device.cpu) * 0.3 + rand(-6, 6), 3, 95));
}

const nextMemory = (memory) => Math.round(clamp(memory + rand(-1.5, 1.5), 35, 75));

function nextTraffic(prevBps, speedMbps) {
  const cap = speedMbps * 1e6;
  const start = prevBps > 0 ? prevBps : cap * rand(0.1, 0.4);
  return Math.round(clamp(start + cap * rand(-0.05, 0.05), cap * 0.05, cap * 0.7));
}

async function tick() {
  if (running) return; // never overlap ticks if the DB is slow
  running = true;
  try {
    const now = Date.now();
    const devices = await Device.find({ status: { $ne: 'DOWN' } }).lean();
    const ops = [];
    const batch = [];

    for (const device of devices) {
      device.cpu = nextCpu(device, now);
      device.memory = nextMemory(device.memory);
      const set = { cpu: device.cpu, memory: device.memory, lastSeen: new Date(now) };
      const interfaces = [];

      device.interfaces.forEach((iface, i) => {
        if (iface.operStatus !== 'up') return;
        const inBps = nextTraffic(iface.inBps, iface.speedMbps);
        const outBps = nextTraffic(iface.outBps, iface.speedMbps);
        set[`interfaces.${i}.inBps`] = inBps;
        set[`interfaces.${i}.outBps`] = outBps;
        interfaces.push({ name: iface.name, inBps, outBps });
      });

      // Only touches metric fields, so it can't overwrite a status change
      // the simulator makes between our read and this write.
      ops.push({ updateOne: { filter: { _id: device._id, status: { $ne: 'DOWN' } }, update: { $set: set } } });
      batch.push({
        deviceId: device._id,
        hostname: device.hostname,
        cpu: device.cpu,
        memory: device.memory,
        lastSeen: set.lastSeen,
        interfaces,
      });
    }

    if (ops.length) await Device.bulkWrite(ops, { ordered: false });
    emitToDashboard('device:metrics', { at: new Date(now), devices: batch });

    for (const device of devices) await deviceService.evaluateThresholds(device);
  } catch (err) {
    console.error('[ticker]', err.message);
  } finally {
    running = false;
  }
}

function start(intervalMs = 4000) {
  if (timer) return;
  timer = setInterval(tick, intervalMs);
  console.log(`[ticker] metrics every ${intervalMs} ms`);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

function setCpuOverride(hostname, cpu, durationMs) {
  overrides.set(hostname, { cpu, until: Date.now() + durationMs });
}

function clearOverrides() {
  overrides.clear();
}

module.exports = { start, stop, tick, setCpuOverride, clearOverrides };
