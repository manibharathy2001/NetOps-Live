const mongoose = require('mongoose');

const { Schema } = mongoose;

const interfaceSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    adminStatus: { type: String, enum: ['up', 'down'], default: 'up' },
    operStatus: { type: String, enum: ['up', 'down'], default: 'up' },
    speedMbps: { type: Number, default: 10000 },
    inBps: { type: Number, default: 0 },
    outBps: { type: Number, default: 0 },
    // Where the other end of the cable is. Used to build the topology view.
    peerDevice: { type: String, default: null },
    peerInterface: { type: String, default: null },
  },
  { _id: false }
);

const bgpNeighborSchema = new Schema(
  {
    address: { type: String, required: true },
    remoteAs: { type: Number, required: true },
    peerDevice: { type: String, default: null },
    state: { type: String, enum: ['Established', 'Idle', 'Active', 'Connect'], default: 'Established' },
    stateSince: { type: Date, default: Date.now },
  },
  { _id: false }
);

const isisNeighborSchema = new Schema(
  {
    systemId: { type: String, required: true }, // neighbour hostname
    interface: { type: String, required: true },
    state: { type: String, enum: ['Up', 'Down', 'Init'], default: 'Up' },
    stateSince: { type: Date, default: Date.now },
  },
  { _id: false }
);

const deviceSchema = new Schema(
  {
    hostname: { type: String, required: true, unique: true, uppercase: true, trim: true },
    mgmtIp: { type: String, required: true },
    loopback: { type: String, default: null },
    platform: { type: String, required: true },
    role: { type: String, enum: ['core', 'aggregation', 'spine', 'leaf'], required: true },
    site: { type: String, default: 'DC1' },
    // UP = healthy, DEGRADED = reachable but has active alarms, DOWN = unreachable
    status: { type: String, enum: ['UP', 'DOWN', 'DEGRADED'], default: 'UP' },
    cpu: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    lastSeen: { type: Date, default: Date.now },
    interfaces: [interfaceSchema],
    bgpNeighbors: [bgpNeighborSchema],
    isisNeighbors: [isisNeighborSchema],
    lastEvent: {
      kind: { type: String, default: null },
      message: { type: String, default: null },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
