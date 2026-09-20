const mongoose = require('mongoose');
const { SEVERITIES } = require('../config/constants');

const ALARM_TYPES = ['DEVICE_DOWN', 'INTERFACE_DOWN', 'BGP_DOWN', 'ISIS_DOWN', 'HIGH_CPU', 'HIGH_MEMORY'];

const alarmSchema = new mongoose.Schema({
  device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  hostname: { type: String, required: true },
  type: { type: String, enum: ALARM_TYPES, required: true },
  severity: { type: String, enum: SEVERITIES, required: true },
  message: { type: String, required: true },
  // What the alarm is about on the device: interface name, neighbour IP, etc.
  resource: { type: String, default: '' },
  active: { type: Boolean, default: true },
  raisedAt: { type: Date, default: Date.now },
  clearedAt: { type: Date, default: null },
  incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
});

// At most ONE active alarm per (device, type, resource). If two code paths
// race to raise the same alarm, the database rejects the duplicate.
alarmSchema.index(
  { device: 1, type: 1, resource: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
alarmSchema.index({ active: 1, raisedAt: -1 });

module.exports = mongoose.model('Alarm', alarmSchema);
module.exports.ALARM_TYPES = ALARM_TYPES;
