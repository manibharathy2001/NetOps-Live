const mongoose = require('mongoose');
const { SEVERITIES, INCIDENT_STATUSES } = require('../config/constants');

const { Schema } = mongoose;

const commentSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 5000 },
  createdAt: { type: Date, default: Date.now },
});

// Every change is recorded here, so the incident doubles as an audit log.
const timelineSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actor: { type: String, required: true }, // user name or "system"
    action: { type: String, required: true },
    from: { type: String, default: null },
    to: { type: String, default: null },
    note: { type: String, default: null },
  },
  { _id: false }
);

// Files stored in Cloudinary (screenshots, show-command output, etc.)
const attachmentSchema = new Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'raw'], default: 'image' },
  filename: { type: String, required: true },
  mimeType: String,
  bytes: Number,
  uploadedBy: String,
  uploadedById: String,
  uploadedAt: { type: Date, default: Date.now },
});

const incidentSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    device: { type: Schema.Types.ObjectId, ref: 'Device', required: true },
    hostname: { type: String, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    status: { type: String, enum: INCIDENT_STATUSES, default: 'Open' },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assigneeName: { type: String, default: null },
    alarms: [{ type: Schema.Types.ObjectId, ref: 'Alarm' }],
    comments: [commentSchema],
    attachments: [attachmentSchema],
    timeline: [timelineSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null = auto-created
    source: { type: String, enum: ['manual', 'auto'], default: 'manual' },
    closedAt: { type: Date, default: null },
  },
  // optimisticConcurrency: save() fails with VersionError if the document
  // changed after we loaded it. Clients also send the __v they last saw.
  { timestamps: true, optimisticConcurrency: true }
);

incidentSchema.index({ status: 1, updatedAt: -1 });
incidentSchema.index({ device: 1, status: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
