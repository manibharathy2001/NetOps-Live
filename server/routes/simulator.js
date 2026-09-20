const express = require('express');
const deviceService = require('../services/deviceService');
const scenarios = require('../simulator/scenarios');
const ticker = require('../simulator/ticker');
const asyncHandler = require('../utils/asyncHandler');
const findDevice = require('../utils/findDevice');
const HttpError = require('../utils/httpError');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('engineer', 'admin'));

// Small helper: run a service call with the request body, reply { ok: true }.
const action = (fn) => asyncHandler(async (req, res) => {
  await fn(req.body || {});
  res.json({ ok: true });
});

// Body for all of these: { hostname, reason? } plus the field named below.
router.post('/device-down', action((b) => deviceService.setDeviceStatus(b.hostname, 'DOWN', b.reason)));
router.post('/device-up', action((b) => deviceService.setDeviceStatus(b.hostname, 'UP', b.reason)));

// + { interface: "HundredGigE0/0/1/0" }
router.post('/interface-down', action((b) => deviceService.setInterfaceStatus(b.hostname, b.interface, 'down', b.reason)));
router.post('/interface-up', action((b) => deviceService.setInterfaceStatus(b.hostname, b.interface, 'up', b.reason)));

// + { neighbor: "10.255.0.1" }
router.post('/bgp-down', action((b) => deviceService.setBgpNeighborState(b.hostname, b.neighbor, false, b.reason)));
router.post('/bgp-up', action((b) => deviceService.setBgpNeighborState(b.hostname, b.neighbor, true, b.reason)));

// + { neighbor: "CORE-01" }
router.post('/isis-down', action((b) => deviceService.setIsisNeighborState(b.hostname, b.neighbor, false, b.reason)));
router.post('/isis-up', action((b) => deviceService.setIsisNeighborState(b.hostname, b.neighbor, true, b.reason)));

// Body: { hostname, cpu = 95, durationSec = 60 }. CPU stays pinned, then drifts back down.
router.post('/high-cpu', asyncHandler(async (req, res) => {
  const { hostname, cpu = 95, durationSec = 60 } = req.body || {};
  const value = Number(cpu);
  const seconds = Number(durationSec);
  if (Number.isNaN(value) || value < 0 || value > 100) throw new HttpError(400, 'cpu must be 0-100');
  if (Number.isNaN(seconds) || seconds < 5 || seconds > 600) throw new HttpError(400, 'durationSec must be 5-600');

  const device = await findDevice(hostname, { lean: true });
  ticker.setCpuOverride(device.hostname, value, seconds * 1000);
  await deviceService.forceCpu(device.hostname, value);
  res.json({ ok: true, hostname: device.hostname, cpu: value, durationSec: seconds });
}));

// Body: { hostname = "NCS-540-03", interface?, stepMs = 1500 }
router.post('/scenario/fiber-cut', asyncHandler(async (req, res) => {
  res.status(202).json(await scenarios.fiberCut(req.body || {}));
}));

router.post('/recover', asyncHandler(async (req, res) => {
  res.json({ ok: true, ...(await scenarios.recoverAll()) });
}));

module.exports = router;
