const Alarm = require('../models/Alarm');
const incidentService = require('./incidentService');
const { emitToDashboard } = require('../socket');

// Raise an alarm unless an identical one is already active.
// Returns the new alarm, or null if it already existed.
async function raise(device, { type, severity, message, resource = '' }) {
  const existing = await Alarm.exists({ device: device._id, type, resource, active: true });
  if (existing) return null;

  let alarm;
  try {
    alarm = await Alarm.create({ device: device._id, hostname: device.hostname, type, severity, message, resource });
  } catch (err) {
    if (err.code === 11000) return null; // lost a race with another raise(); the unique index saved us
    throw err;
  }

  emitToDashboard('alarm:raised', alarm.toObject());
  await incidentService.linkAlarm(alarm);
  return alarm;
}

// Clear active alarms of a type on a device (optionally one resource).
async function clear(deviceId, type, resource) {
  const filter = { device: deviceId, type, active: true };
  if (resource !== undefined) filter.resource = resource;

  const candidates = await Alarm.find(filter).select('_id').lean();
  let cleared = 0;

  for (const { _id } of candidates) {
    // Conditional update: only one caller can flip active -> false,
    // so the "cleared" event is never emitted twice.
    const alarm = await Alarm.findOneAndUpdate(
      { _id, active: true },
      { $set: { active: false, clearedAt: new Date() } },
      { new: true }
    ).lean();
    if (!alarm) continue;

    cleared += 1;
    emitToDashboard('alarm:cleared', alarm);
    await incidentService.noteAlarmCleared(alarm);
  }
  return cleared;
}

async function list({ active, device } = {}) {
  const filter = {};
  if (active !== undefined) filter.active = active === true || active === 'true';
  if (device) filter.device = device;
  return Alarm.find(filter).sort({ raisedAt: -1 }).limit(500).lean();
}

async function hasActive(deviceId) {
  return Boolean(await Alarm.exists({ device: deviceId, active: true }));
}

module.exports = { raise, clear, list, hasActive };
