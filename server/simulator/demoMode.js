/*
 * Demo mode: keeps the deployed app alive for visitors.
 * Every ~1 minute it fires a random network event, and after a few events
 * it recovers the whole network so the demo never ends up permanently red.
 */
const Device = require('../models/Device');
const deviceService = require('../services/deviceService');
const scenarios = require('./scenarios');
const ticker = require('./ticker');

const EVENTS_BEFORE_RECOVERY = 4;

let timer = null;
let running = false;
let eventCount = 0;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function randomEvent() {
  const devices = await Device.find({ status: { $ne: 'DOWN' } }).lean();
  if (!devices.length) return;

  const device = pick(devices);
  const type = pick(['device-down', 'interface-down', 'high-cpu', 'fiber-cut', 'bgp-down']);

  switch (type) {
    case 'device-down':
      await deviceService.setDeviceStatus(device.hostname, 'DOWN', `${device.hostname} stopped responding to polling`);
      break;

    case 'interface-down': {
      const iface = pick(device.interfaces.filter((i) => i.operStatus === 'up'));
      if (iface) await deviceService.setInterfaceStatus(device.hostname, iface.name, 'down', 'Interface flap detected');
      break;
    }

    case 'high-cpu': {
      const cpu = randInt(88, 97);
      ticker.setCpuOverride(device.hostname, cpu, 90 * 1000);
      await deviceService.forceCpu(device.hostname, cpu);
      break;
    }

    case 'fiber-cut':
      await scenarios.fiberCut({ hostname: device.hostname });
      break;

    case 'bgp-down': {
      const neighbor = pick(device.bgpNeighbors.filter((n) => n.state === 'Established'));
      if (neighbor) await deviceService.setBgpNeighborState(device.hostname, neighbor.address, false, 'Hold timer expired');
      break;
    }

    default:
      break;
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    if (eventCount >= EVENTS_BEFORE_RECOVERY) {
      await scenarios.recoverAll();
      eventCount = 0;
    } else {
      await randomEvent();
      eventCount += 1;
    }
  } catch (err) {
    console.error('[demo]', err.message);
  } finally {
    running = false;
    schedule();
  }
}

// Random gap between events so the demo doesn't look scripted.
function schedule(baseMs = 60000) {
  timer = setTimeout(tick, Math.round(baseMs * (0.6 + Math.random() * 0.8)));
}

function start(baseMs = 60000) {
  if (timer) return;
  console.log(`[demo] random network events about every ${Math.round(baseMs / 1000)}s`);
  schedule(baseMs);
}

function stop() {
  clearTimeout(timer);
  timer = null;
}

module.exports = { start, stop };