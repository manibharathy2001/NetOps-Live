const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const Alarm = require('../models/Alarm');
const User = require('../models/User');
const Counter = require('../models/Counter');
const HttpError = require('../utils/httpError');
const findDevice = require('../utils/findDevice');
const { emitToDashboard, emitToIncident } = require('../socket');
const { SEVERITY_RANK, STATUS_TRANSITIONS } = require('../config/constants');

const OPEN_STATUSES = ['Open', 'Investigating'];

const entry = (actor, action, extra = {}) => ({ at: new Date(), actor, action, ...extra });

async function nextNumber() {
  const seq = await Counter.next('incident');
  return `INC-${1000 + seq}`;
}

async function resolveAssignee(assigneeId) {
  if (!assigneeId) return { assignee: null, assigneeName: null };
  const user = await User.findById(assigneeId).lean();
  if (!user) throw new HttpError(400, 'Assignee not found');
  if (user.role === 'viewer') throw new HttpError(400, 'Viewers cannot be assigned incidents');
  return { assignee: user._id, assigneeName: user.name };
}

async function list({ status } = {}) {
  const filter = status ? { status: { $in: String(status).split(',') } } : {};
  return Incident.find(filter).sort({ updatedAt: -1 }).select('-comments -timeline').lean();
}

async function getById(id) {
  const incident = await Incident.findById(id).lean();
  if (!incident) throw new HttpError(404, 'Incident not found');
  return incident;
}

async function create({ title, description, device: deviceRef, severity, assigneeId }, actor) {
  if (!title) throw new HttpError(400, 'title is required');
  const device = await findDevice(deviceRef, { lean: true });
  const { assignee, assigneeName } = await resolveAssignee(assigneeId);

  // Attach any active alarms on this device that aren't already on an incident.
  const alarms = await Alarm.find({ device: device._id, active: true, incident: null }).select('_id').lean();

  const timeline = [entry(actor.name, 'created', { note: title })];
  if (assigneeName) timeline.push(entry(actor.name, 'assigned', { to: assigneeName }));

  const incident = await Incident.create({
    number: await nextNumber(),
    title,
    description,
    device: device._id,
    hostname: device.hostname,
    severity: severity || 'major',
    assignee,
    assigneeName,
    alarms: alarms.map((a) => a._id),
    createdBy: actor.id,
    source: 'manual',
    timeline,
  });

  if (alarms.length) await Alarm.updateMany({ _id: { $in: incident.alarms } }, { incident: incident._id });

  const payload = incident.toObject();
  emitToDashboard('incident:created', payload);
  return payload;
}

// Field edits (title/severity/status/assignee) are version-checked:
// if someone else changed the incident since you loaded it, you get a 409.
async function update(id, changes, version, actor) {
  if (version === undefined || Number.isNaN(Number(version))) {
    throw new HttpError(400, 'version is required (use the __v you last received)');
  }

  const incident = await Incident.findById(id);
  if (!incident) throw new HttpError(404, 'Incident not found');
  if (incident.__v !== Number(version)) {
    throw new HttpError(409, 'This incident was updated by someone else. Refresh and try again.');
  }

  const events = [];

  if (changes.title && changes.title !== incident.title) {
    events.push(entry(actor.name, 'title_changed', { from: incident.title, to: changes.title }));
    incident.title = changes.title;
  }

  if (changes.severity && changes.severity !== incident.severity) {
    events.push(entry(actor.name, 'severity_changed', { from: incident.severity, to: changes.severity }));
    incident.severity = changes.severity;
  }

  if (changes.status && changes.status !== incident.status) {
    const allowed = STATUS_TRANSITIONS[incident.status] || [];
    if (!allowed.includes(changes.status)) {
      throw new HttpError(400, `Cannot move incident from ${incident.status} to ${changes.status}`);
    }
    events.push(entry(actor.name, 'status_changed', { from: incident.status, to: changes.status }));
    incident.status = changes.status;
    incident.closedAt = changes.status === 'Closed' ? new Date() : null;
  }

  if ('assigneeId' in changes) {
    const { assignee, assigneeName } = await resolveAssignee(changes.assigneeId);
    if (String(assignee) !== String(incident.assignee)) {
      events.push(entry(actor.name, assignee ? 'assigned' : 'unassigned', { from: incident.assigneeName, to: assigneeName }));
      incident.assignee = assignee;
      incident.assigneeName = assigneeName;
    }
  }

  if (!events.length) return incident.toObject();

  incident.timeline.push(...events);
  await incident.save(); // optimisticConcurrency also guards the gap between findById and save

  const payload = incident.toObject();
  emitToDashboard('incident:updated', payload);
  return payload;
}

// Comments are append-only ($push), so they never conflict with anyone
// else's edits and don't bump the version.
async function addComment(id, text, actor) {
  if (!text || !String(text).trim()) throw new HttpError(400, 'Comment text is required');

  const comment = {
    _id: new mongoose.Types.ObjectId(),
    author: actor.id,
    authorName: actor.name,
    text: String(text).trim(),
    createdAt: new Date(),
  };

  const updated = await Incident.findByIdAndUpdate(
    id,
    { $push: { comments: comment, timeline: entry(actor.name, 'commented') } },
    { new: true, projection: { _id: 1 } }
  );
  if (!updated) throw new HttpError(404, 'Incident not found');

  emitToIncident(id, 'incident:comment', { incidentId: String(id), comment });
  return comment;
}

// Called for every new alarm. Correlation rule:
//   - device already has an open incident -> attach the alarm to it
//   - otherwise, if the alarm is critical  -> auto-create an incident
async function linkAlarm(alarm) {
  const open = await Incident.findOne({ device: alarm.device, status: { $in: OPEN_STATUSES } })
    .sort({ createdAt: -1 })
    .lean();

  if (open) {
    const events = [entry('system', 'alarm_linked', { note: alarm.message })];
    const update = { $addToSet: { alarms: alarm._id }, $push: { timeline: { $each: events } } };

    if (SEVERITY_RANK[alarm.severity] > SEVERITY_RANK[open.severity]) {
      events.push(entry('system', 'severity_changed', {
        from: open.severity,
        to: alarm.severity,
        note: 'Escalated by correlated alarm',
      }));
      update.$set = { severity: alarm.severity };
      update.$inc = { __v: 1 }; // a field changed, so anyone editing must refresh
    }

    const updated = await Incident.findByIdAndUpdate(open._id, update, { new: true }).lean();
    await Alarm.updateOne({ _id: alarm._id }, { incident: open._id });
    emitToDashboard('incident:updated', updated);
    return updated;
  }

  if (alarm.severity !== 'critical') return null;

  const related = await Alarm.find({ device: alarm.device, active: true, incident: null }).select('_id').lean();
  const incident = await Incident.create({
    number: await nextNumber(),
    title: alarm.message,
    device: alarm.device,
    hostname: alarm.hostname,
    severity: 'critical',
    alarms: related.map((a) => a._id),
    source: 'auto',
    timeline: [entry('system', 'created', { note: `Auto-created from ${alarm.type} alarm` })],
  });
  await Alarm.updateMany({ _id: { $in: incident.alarms } }, { incident: incident._id });

  const payload = incident.toObject();
  emitToDashboard('incident:created', payload);
  return payload;
}

// Alarms clearing doesn't close the incident; an engineer decides that.
// It is recorded on the timeline so everyone can see the recovery.
async function noteAlarmCleared(alarm) {
  if (!alarm.incident) return;
  const updated = await Incident.findByIdAndUpdate(
    alarm.incident,
    { $push: { timeline: entry('system', 'alarm_cleared', { note: alarm.message }) } },
    { new: true }
  ).lean();
  if (updated) emitToDashboard('incident:updated', updated);
}

module.exports = { list, getById, create, update, addComment, linkAlarm, noteAlarmCleared };
