const express = require('express');
const multer = require('multer');
const attachmentService = require('../services/attachmentService');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireRole } = require('../middleware/auth');

// Mounted at /api/incidents/:id/attachments, so we need the parent's :id.
const router = express.Router({ mergeParams: true });

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
}).single('file');

// Turn multer's errors into clear API errors.
const receiveFile = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'File is larger than 10 MB.'));
    if (err instanceof multer.MulterError) return next(new HttpError(400, err.message));
    return next(err);
  });

// Auth runs first, so unauthenticated uploads are rejected before any file is read.
router.use(requireAuth, requireRole('engineer', 'admin'));

// POST /api/incidents/:id/attachments   (multipart/form-data, field "file")
router.post('/', receiveFile, asyncHandler(async (req, res) => {
  res.status(201).json(await attachmentService.addAttachment(req.params.id, req.file, req.user));
}));

// DELETE /api/incidents/:id/attachments/:attachmentId
router.delete('/:attachmentId', asyncHandler(async (req, res) => {
  await attachmentService.removeAttachment(req.params.id, req.params.attachmentId, req.user);
  res.status(204).end();
}));

module.exports = router;