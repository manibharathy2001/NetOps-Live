const express = require('express');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// For the "Assign to" dropdown.
router.get('/', asyncHandler(async (req, res) => {
  const users = await User.find({ role: { $ne: 'viewer' } }).select('name email role').sort({ name: 1 }).lean();
  res.json(users);
}));

module.exports = router;
