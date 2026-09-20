const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Device = require('../models/Device');
const Alarm = require('../models/Alarm');
const Incident = require('../models/Incident');
const Counter = require('../models/Counter');
const User = require('../models/User');
const { buildDevices } = require('./devices');

const DEMO_USERS = [
  { name: 'Admin', email: 'admin@netops.local', password: 'admin123', role: 'admin' },
  { name: 'Mani', email: 'mani@netops.local', password: 'mani1234', role: 'engineer' },
  { name: 'Priya', email: 'priya@netops.local', password: 'priya1234', role: 'engineer' },
];

(async () => {
  await connectDB(process.env.MONGO_URI);

  await Promise.all([Device.deleteMany({}), Alarm.deleteMany({}), Incident.deleteMany({}), Counter.deleteMany({})]);
  await Alarm.syncIndexes();

  const devices = await Device.insertMany(buildDevices());
  console.log(`Seeded ${devices.length} devices`);

  for (const u of DEMO_USERS) {
    if (!(await User.exists({ email: u.email }))) {
      await User.create(u);
      console.log(`Created user ${u.email} / ${u.password} (${u.role})`);
    }
  }

  await mongoose.disconnect();
  console.log('Done');
})().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
