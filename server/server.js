require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const ticker = require('./simulator/ticker');
const errorHandler = require('./middleware/errorHandler');

for (const key of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env (see .env.example)`);
    process.exit(1);
  }
}

const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const simulatorEnabled = process.env.SIM_ENABLED !== 'false';

const app = express();
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/alarms', require('./routes/alarms'));
app.use('/api/incidents', require('./routes/incidents'));
if (simulatorEnabled) app.use('/api/simulator', require('./routes/simulator'));

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

// Express and Socket.io share one HTTP server (one port).
const server = http.createServer(app);
initSocket(server, { origin });

(async () => {
  await connectDB(process.env.MONGO_URI);
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, () => console.log(`NetOps Live API + Socket.io on http://localhost:${port}`));
  if (simulatorEnabled) ticker.start(Number(process.env.SIM_TICK_MS) || 4000);
})().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
