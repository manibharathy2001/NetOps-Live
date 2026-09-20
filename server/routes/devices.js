const express = require('express');
const Device = require('../models/Device');
const Alarm = require('../models/Alarm');
const asyncHandler = require('../utils/asyncHandler');
const findDevice = require('../utils/findDevice');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Initial state for the dashboard. Socket events are applied on top of this.
router.get('/', asyncHandler(async (req, res) => {
  res.json(await Device.find().sort({ hostname: 1 }).lean());
}));

// Nodes + links for React Flow, derived from interface peer info.
router.get('/topology', asyncHandler(async (req, res) => {
  const devices = await Device.find().select('hostname mgmtIp platform role status interfaces').lean();
  const byHost = new Map(devices.map((d) => [d.hostname, d]));

  const nodes = devices.map(({ hostname, mgmtIp, platform, role, status }) => ({
    id: hostname, hostname, mgmtIp, platform, role, status,
  }));

  const seen = new Set();
  const links = [];
  for (const d of devices) {
    for (const i of d.interfaces) {
      if (!i.peerDevice) continue;
      const id = [`${d.hostname}:${i.name}`, `${i.peerDevice}:${i.peerInterface}`].sort().join('|');
      if (seen.has(id)) continue;
      seen.add(id);

      const peerIface = byHost.get(i.peerDevice)?.interfaces.find((p) => p.name === i.peerInterface);
      links.push({
        id,
        source: d.hostname,
        target: i.peerDevice,
        sourceInterface: i.name,
        targetInterface: i.peerInterface,
        speedMbps: i.speedMbps,
        status: i.operStatus === 'up' && peerIface?.operStatus === 'up' ? 'up' : 'down',
      });
    }
  }

  res.json({ nodes, links });
}));

router.get('/:ref', asyncHandler(async (req, res) => {
  const device = await findDevice(req.params.ref, { lean: true });
  const activeAlarms = await Alarm.find({ device: device._id, active: true }).sort({ raisedAt: -1 }).lean();
  res.json({ ...device, activeAlarms });
}));

module.exports = router;
