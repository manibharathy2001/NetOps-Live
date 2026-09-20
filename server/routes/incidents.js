const express = require('express');
const incidentService = require('../services/incidentService');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const canEdit = requireRole('engineer', 'admin');

// GET /api/incidents?status=Open,Investigating
router.get('/', asyncHandler(async (req, res) => {
  res.json(await incidentService.list(req.query));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await incidentService.getById(req.params.id));
}));

// Body: { title, description?, device (id or hostname), severity?, assigneeId? }
router.post('/', canEdit, asyncHandler(async (req, res) => {
  res.status(201).json(await incidentService.create(req.body || {}, req.user));
}));

// Body: { version, title?, severity?, status?, assigneeId? }
router.patch('/:id', canEdit, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const changes = { title: body.title, severity: body.severity, status: body.status };
  if ('assigneeId' in body) changes.assigneeId = body.assigneeId;
  res.json(await incidentService.update(req.params.id, changes, body.version, req.user));
}));

// Body: { text }
router.post('/:id/comments', canEdit, asyncHandler(async (req, res) => {
  res.status(201).json(await incidentService.addComment(req.params.id, req.body?.text, req.user));
}));

module.exports = router;
