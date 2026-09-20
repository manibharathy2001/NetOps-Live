const path = require('path');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const Incident = require('../models/Incident');
const HttpError = require('../utils/httpError');
const { emitToDashboard } = require('../socket');

const MAX_ATTACHMENTS = 10;

// Extension -> Cloudinary resource type. Images get thumbnails; everything else is stored as-is.
const ALLOWED = {
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image',
  '.pdf': 'raw', '.txt': 'raw', '.log': 'raw', '.cfg': 'raw', '.conf': 'raw',
};

let configured = false;
function ensureConfigured() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new HttpError(503, "File uploads aren't set up yet. Add the CLOUDINARY_* values to server/.env and restart the server.");
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
}

// multer keeps the file in memory; stream the buffer straight to Cloudinary.
function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => (err ? reject(err) : resolve(result)));
    stream.end(buffer);
  });
}

const entry = (actor, action, note) => ({ at: new Date(), actor, action, note });

async function addAttachment(incidentId, file, actor) {
  ensureConfigured();
  if (!file) throw new HttpError(400, 'No file received. Send it as multipart/form-data in a field named "file".');

  const ext = path.extname(file.originalname).toLowerCase();
  const resourceType = ALLOWED[ext];
  if (!resourceType) {
    throw new HttpError(415, 'Only images (png, jpg, gif, webp), PDFs and text files (txt, log, cfg, conf) can be attached.');
  }

  const incident = await Incident.findById(incidentId).select('number attachments').lean();
  if (!incident) throw new HttpError(404, 'Incident not found');
  if (incident.attachments.length >= MAX_ATTACHMENTS) {
    throw new HttpError(400, `An incident can have at most ${MAX_ATTACHMENTS} attachments. Remove one first.`);
  }

  const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^\w-]+/g, '_').slice(0, 60) || 'file';
  // Raw files need the extension in their id so the download keeps its type.
  const publicId = `${Date.now()}-${base}${resourceType === 'raw' ? ext : ''}`;

  let result;
  try {
    result = await uploadBuffer(file.buffer, {
      folder: `netops-live/${incident.number}`,
      public_id: publicId,
      resource_type: resourceType,
    });
  } catch (err) {
    console.error('[cloudinary] upload failed:', err.message);
    throw new HttpError(502, `Cloudinary rejected the upload: ${err.message}`);
  }

  const attachment = {
    _id: new mongoose.Types.ObjectId(),
    url: result.secure_url,
    publicId: result.public_id,
    resourceType,
    filename: file.originalname,
    mimeType: file.mimetype,
    bytes: result.bytes,
    uploadedBy: actor.name,
    uploadedById: actor.id,
    uploadedAt: new Date(),
  };

  // Append-only, like comments: no version bump, never conflicts with edits.
  const updated = await Incident.findByIdAndUpdate(
    incidentId,
    { $push: { attachments: attachment, timeline: entry(actor.name, 'attachment_added', file.originalname) } },
    { new: true }
  ).lean();

  if (!updated) {
    await cloudinary.uploader.destroy(result.public_id, { resource_type: resourceType }).catch(() => {});
    throw new HttpError(404, 'Incident not found');
  }

  emitToDashboard('incident:updated', updated);
  return attachment;
}

async function removeAttachment(incidentId, attachmentId, actor) {
  ensureConfigured();
  const incident = await Incident.findById(incidentId).select('attachments').lean();
  if (!incident) throw new HttpError(404, 'Incident not found');

  const attachment = incident.attachments.find((a) => String(a._id) === attachmentId);
  if (!attachment) throw new HttpError(404, 'Attachment not found');
  if (actor.role !== 'admin' && attachment.uploadedById !== actor.id) {
    throw new HttpError(403, 'Only the person who uploaded this file, or an admin, can remove it.');
  }

  const updated = await Incident.findByIdAndUpdate(
    incidentId,
    {
      $pull: { attachments: { _id: attachment._id } },
      $push: { timeline: entry(actor.name, 'attachment_removed', attachment.filename) },
    },
    { new: true }
  ).lean();

  // Remove from Cloudinary in the background; the incident is already updated.
  cloudinary.uploader
    .destroy(attachment.publicId, { resource_type: attachment.resourceType || 'image' })
    .catch((err) => console.error('[cloudinary] delete failed:', err.message));

  emitToDashboard('incident:updated', updated);
}

module.exports = { addAttachment, removeAttachment };