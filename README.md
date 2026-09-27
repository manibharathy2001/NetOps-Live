# NetOps Live

Real-time network operations dashboard. Engineers watch device health, get alarms pushed to
their screen as they happen, and work the resulting incidents together: assign, comment,
attach evidence, and follow a shared timeline.

**Live demo:** https://netops-live.vercel.app (sign in with one click, no sign-up)
**Demo accounts:** `mani@netops.local / mani1234` (engineer), `guest@netops.local / guest1234` (read-only)

> First load may take ~30 seconds if the free backend instance is waking up.
> The demo runs against a simulated Cisco network (ASR 9000 core, NCS-540 aggregation,
> Nexus 9000 leaves). It generates its own events about once a minute, so the dashboard is
> never idle. You can also trigger events yourself from the simulator panel.

![Dashboard](docs/screenshots/dashboard.png)

---

## Why this project

Most network monitoring demos poll an API every few seconds. This one pushes: when a device
state changes, the server writes it to MongoDB and broadcasts it over Socket.io, and every open
dashboard updates instantly. The same event stream drives alarms, incident correlation, and the
topology view.

## Features

**Live device monitoring**
- Device status (UP / DEGRADED / DOWN), CPU, memory, interface state and traffic, last seen
- Rows flash in the new status colour the moment an event arrives
- Expand any device for interfaces, BGP neighbors and ISIS adjacencies

**Alarms with real logic**
- Raised and cleared automatically from device state and thresholds
- Hysteresis (raise at 85% CPU, clear below 75%) so alarms don't flap
- One active alarm per device, type and resource, enforced by a unique partial index

**Incident management**
- A critical alarm with no open incident opens one automatically; further alarms on the same
  device attach to it and escalate its severity instead of creating duplicates
- Assign, change status and severity, comment, and attach files
- Full timeline of every change, so the incident doubles as an audit log
- Live presence: "Priya is also viewing this incident"
- Optimistic concurrency: two engineers editing at once get a clear conflict message, not a
  silent overwrite

**Network topology**
- Live diagram built from interface peer data: links turn red and dashed when they fail
- Click a device or a link for full detail; drag to rearrange, layout is remembered

**Attachments**
- Screenshots and `show` command output, stored in Cloudinary
- Drag and drop, file picker, or paste a screenshot with Ctrl + V
- Type and size validation, and only the uploader (or an admin) can remove a file

**Network event simulator**
- `device-down`, `interface-down`, `bgp-down`, `isis-down`, `high-cpu`
- A `fiber-cut` scenario that plays out realistically: link down, then ISIS adjacency loss,
  then the BGP session, on both ends, a second apart
- `recover` puts the whole network back to green

## Screenshots

| Topology during a fiber cut | Incident detail |
|---|---|
| ![Topology](docs/screenshots/topology.png) | ![Incident](docs/screenshots/incident.png) |

![Real-time demo](docs/screenshots/demo.gif)

*Two browser windows, two engineers. One triggers a fiber cut; both screens update at the same moment.*

## Architecture

```
                 React (Vite, Tailwind, React Flow)
                          |
              REST: initial state      Socket.io: every change
                          |                    |
                    Express + Socket.io (one HTTP server)
                          |
        +-----------------+------------------+
        |                 |                  |
   Service layer      MongoDB Atlas      Cloudinary
  device / alarm /    devices, alarms,   attachments
  incident services   incidents, users
        |
   Network event simulator  ->  (later: Python/Netmiko collector)
```

Every state change goes through the service layer, which writes to MongoDB first and only then
emits. The simulator is just one caller, so it can be replaced by a real collector reading from
live Cisco devices without touching the rest of the app.

## Socket.io event contract

| Event | Payload | Meaning |
|---|---|---|
| `device:status` | `{ hostname, status, previous, lastEvent }` | Device went UP / DEGRADED / DOWN |
| `device:metrics` | `{ at, devices: [...] }` | Batched CPU, memory, interface traffic, one event per tick |
| `device:interface` / `device:bgp` / `device:isis` | `{ hostname, interface \| neighbor }` | Interface or neighbour state change |
| `alarm:raised` / `alarm:cleared` | alarm | Alarm lifecycle |
| `incident:created` / `incident:updated` | incident | Incident lifecycle, including auto-created ones |
| `incident:comment` | `{ incidentId, comment }` | New comment (incident room only) |
| `incident:presence` | `{ incidentId, viewers }` | Who is viewing this incident |
| `simulator:step` / `simulator:done` | `{ scenario, step, total, description }` | Scenario progress |
| `incident:join` / `incident:leave` (client to server) | incidentId | Join or leave an incident room |

Clients fetch initial state over REST, apply socket events on top, and refetch on reconnect so
nothing missed during a disconnect is lost.

## Tech stack

**Backend:** Node.js, Express, Socket.io, MongoDB (Mongoose), JWT auth with bcrypt, Cloudinary,
multer, helmet, express-rate-limit
**Frontend:** React 18, Vite, Tailwind CSS v4, React Router, Socket.io client, React Flow

## Engineering decisions worth a look

- **One service layer for all state changes** (`server/services/`): DB write, then emit, then
  alarm, then health recompute. No business logic in routes.
- **Atomic updates:** positional `$set` for the one interface or neighbour that changed, and
  compare-and-set for device health. No read-modify-write races.
- **Alarm de-duplication in the database**, not in application code: a unique partial index on
  `{ device, type, resource }` where `active: true`.
- **Optimistic concurrency on incidents** (`__v`), with comments and attachments as append-only
  operations that never conflict.
- **Batched metrics:** one `device:metrics` event per tick for all devices, not one per device.
- **Socket auth at the handshake:** no valid JWT, no connection.
- **Role-based access:** viewer, engineer, admin, enforced on the server, not just hidden in the UI.

## Run it locally

Requires Node 18+ and a MongoDB connection (local or Atlas).

```bash
# 1. Backend
cd server
npm install
cp .env.example .env        # set MONGO_URI, JWT_SECRET, and optionally CLOUDINARY_*
npm run seed                # 6 devices + demo users
npm run dev                 # http://localhost:5000

# 2. Frontend (second terminal)
cd client
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm run dev                 # http://localhost:5173
```

There's also a terminal event viewer, useful for seeing the raw event stream:

```bash
cd server
npm run listen              # prints every socket event as it arrives
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGO_URI`, `JWT_SECRET` | server | Required |
| `CLIENT_ORIGIN` | server | Allowed browser origin (CORS and Socket.io) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | server | Attachments |
| `SIM_ENABLED`, `SIM_TICK_MS` | server | Metrics simulator |
| `DEMO_MODE`, `DEMO_EVENT_MS` | server | Random events for a hosted demo |
| `VITE_API_URL` | client | Backend URL |

## Project structure

```
netops-live/
├── server/
│   ├── config/       db connection, constants (thresholds, status transitions)
│   ├── models/       Device, Alarm, Incident, User, Counter
│   ├── services/     device, alarm, incident, attachment  <- all business logic
│   ├── routes/       thin HTTP layer
│   ├── socket/       Socket.io setup, JWT middleware, rooms, presence
│   ├── simulator/    metrics ticker, scenarios, demo mode
│   ├── seed/         lab topology + demo users
│   └── scripts/      socket-listener.js (terminal event viewer)
└── client/
    └── src/
        ├── context/     auth, socket
        ├── hooks/       useDevices, useAlarms, useIncidents, useIncident
        ├── pages/       dashboard, topology, incidents, login
        └── components/  device table, alarm feed, simulator panel, topology, attachments
```

## Roadmap

- Replace the simulator with a Python/Netmiko collector polling real devices
- Push notifications to Slack or Microsoft Teams when a critical incident opens
- Historical metrics and alarm reporting

## Author

**Ayush Sharma** — network engineer building full-stack network tooling.
[GitHub](https://github.com/YOUR-USERNAME) · [LinkedIn](https://linkedin.com/in/YOUR-PROFILE)
