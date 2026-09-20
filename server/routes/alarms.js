const express = require('express');
const alarmService = require('../services/alarmService');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/alarms?active=true
router.get('/', asyncHandler(async (req, res) => {
  res.json(await alarmService.list(req.query));
}));

module.exports = router;
