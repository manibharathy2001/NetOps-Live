const Device = require('../models/Device');
const HttpError = require('./httpError');

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Accepts either a Mongo _id or a hostname, so the simulator and API
// can be called with "NCS-540-03" instead of an opaque id.
async function findDevice(idOrHostname, { lean = false } = {}) {
  if (!idOrHostname) throw new HttpError(400, 'Device id or hostname is required');

  const value = String(idOrHostname).trim();
  const filter = OBJECT_ID.test(value) ? { _id: value } : { hostname: value.toUpperCase() };

  const query = Device.findOne(filter);
  const device = lean ? await query.lean() : await query;
  if (!device) throw new HttpError(404, `Device not found: ${value}`);
  return device;
}

module.exports = findDevice;
