/*
 * Terminal "dashboard": logs in, connects with the JWT, prints every event.
 *   npm run listen                              (as mani@netops.local)
 *   npm run listen -- priya@netops.local priya1234
 *   npm run listen -- --metrics                 (also print metric ticks)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { io } = require('socket.io-client');

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const showMetrics = process.argv.includes('--metrics');
const email = args[0] || 'mani@netops.local';
const password = args[1] || 'mani1234';

function summarise(event, p) {
  switch (event) {
    case 'device:status': return `${p.hostname}: ${p.previous} -> ${p.status}${p.lastEvent ? `  (${p.lastEvent.message})` : ''}`;
    case 'device:interface': return `${p.hostname} ${p.interface.name} is ${p.interface.operStatus.toUpperCase()}`;
    case 'device:bgp': return `${p.hostname} BGP ${p.neighbor.address} -> ${p.neighbor.state}`;
    case 'device:isis': return `${p.hostname} ISIS ${p.neighbor.systemId} -> ${p.neighbor.state}`;
    case 'alarm:raised': return `[${p.severity.toUpperCase()}] ${p.message}`;
    case 'alarm:cleared': return `CLEARED ${p.message}`;
    case 'incident:created': return `${p.number} "${p.title}" (${p.severity}, ${p.source})`;
    case 'incident:updated': return `${p.number} | ${p.status} | ${p.severity} | ${p.assigneeName || 'unassigned'} | v${p.__v}`;
    case 'incident:comment': return `${p.comment.authorName}: ${p.comment.text}`;
    case 'incident:presence': return `viewers: ${p.viewers.map((v) => v.name).join(', ') || 'none'}`;
    case 'simulator:step': return `(${p.step}/${p.total}) ${p.description}`;
    default: return JSON.stringify(p);
  }
}

(async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    console.error(`Login failed (${res.status}):`, await res.text());
    process.exit(1);
  }
  const { token, user } = await res.json();

  const socket = io(BASE, { auth: { token } });
  socket.on('connect', () => console.log(`Connected as ${user.name} (${socket.id}). Waiting for events...`));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));
  socket.on('disconnect', (reason) => console.log('Disconnected:', reason));

  socket.onAny((event, payload) => {
    const time = new Date().toLocaleTimeString();
    if (event === 'device:metrics') {
      if (!showMetrics) return;
      const line = payload.devices.map((d) => `${d.hostname} cpu=${d.cpu}%`).join('  ');
      console.log(`${time}  metrics  ${line}`);
      return;
    }
    console.log(`${time}  ${event.padEnd(18)} ${summarise(event, payload)}`);
  });
})();
