require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const ticker = require('./simulator/ticker');
const demoMode = require('./simulator/demoMode');
const errorHandler = require('./middleware/errorHandler');

for (const key of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env (see .env.example)`);
    process.exit(1);
  }
}

const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const simulatorEnabled = process.env.SIM_ENABLED !== 'false';
const demoEnabled = process.env.DEMO_MODE === 'true';

const app = express();

// Behind one proxy (Render, Railway, nginx) so rate limiting sees the real client IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Brute-force protection on the login and register endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Wait a few minutes and try again.' },
});

// A wide safety net for everything else.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Slow down a little.' },
});

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get('/api/config', (req, res) => res.json({ demoMode: demoEnabled, simulatorEnabled }));

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api', apiLimiter);
app.use('/api/users', require('./routes/users'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/alarms', require('./routes/alarms'));
app.use('/api/incidents/:id/attachments', require('./routes/attachments'));
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
  if (demoEnabled) demoMode.start(Number(process.env.DEMO_EVENT_MS) || 60000);
})().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});