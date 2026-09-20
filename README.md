# NetOps Live: Backend (Phase 2)

Express + MongoDB + Socket.io API with a network event simulator.
The server **pushes** device, alarm and incident changes to every connected
engineer the moment they happen. The dashboard never polls.

## Run it

Requires Node 18+ and MongoDB running locally (or an Atlas URI).

```bash
cd server
npm install
cp .env.example .env        # set JWT_SECRET to any long random string
npm run seed                # 6 devices + demo users
npm run dev                 # API + Socket.io on http://localhost:5000
```

Demo users: `admin@netops.local / admin123`, `mani@netops.local / mani1234`,
`priya@netops.local / priya1234`.

## Watch events without a frontend

In a second terminal:

```bash
npm run listen                     # connects as Mani, prints every event
npm run listen -- --metrics        # also print the metric ticks
```

Open a third terminal and trigger events (Git Bash / WSL / macOS / Linux):

```bash
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"mani@netops.local","password":"mani1234"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

sim() { curl -s -X POST "localhost:5000/api/simulator/$1" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$2"; echo; }

sim device-down '{"hostname":"NCS-540-03"}'
sim device-up   '{"hostname":"NCS-540-03"}'
sim high-cpu    '{"hostname":"N9K-LEAF-02","cpu":95,"durationSec":30}'
sim scenario/fiber-cut '{"hostname":"NCS-540-03"}'
sim recover '{}'
```

What `fiber-cut` prints in the listener terminal (abridged):

```
simulator:step     (1/3) Link down: NCS-540-03 HundredGigE0/0/1/0 <-> CORE-01 HundredGigE0/0/0/2
device:interface   NCS-540-03 HundredGigE0/0/1/0 is DOWN
alarm:raised       [MAJOR] Fiber cut NCS-540-03 ... 
device:status      NCS-540-03: UP -> DEGRADED
simulator:step     (2/3) ISIS adjacency lost between NCS-540-03 and CORE-01
device:isis        NCS-540-03 ISIS CORE-01 -> Down
simulator:step     (3/3) BGP session(s) down between NCS-540-03 and CORE-01
alarm:raised       [CRITICAL] ... BGP neighbor 10.255.0.1 DOWN
incident:created   INC-1001 "..." (critical, auto)
incident:updated   INC-1001 | Open | critical | unassigned | v0
```

Tip: run two listeners as different users to see multi-user broadcast.
Postman or Thunder Client work just as well as curl.

## REST API

All routes except `/api/auth/*` need `Authorization: Bearer <token>`.

| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/register` `/api/auth/login` | Returns `{ token, user }` |
| GET | `/api/auth/me`, `/api/users` | Current user; assignable users |
| GET | `/api/devices` | Initial dashboard state |
| GET | `/api/devices/topology` | `{ nodes, links }` for React Flow |
| GET | `/api/devices/:idOrHostname` | Device + active alarms |
| GET | `/api/alarms?active=true` | |
| GET/POST | `/api/incidents` | `?status=Open,Investigating` |
| GET/PATCH | `/api/incidents/:id` | PATCH needs `version` (the `__v` you last saw) |
| POST | `/api/incidents/:id/comments` | `{ text }` |
| POST | `/api/simulator/*` | engineer/admin only; see `routes/simulator.js` |

## Socket.io contract

Connect with `io(URL, { auth: { token } })`. Everyone joins the `dashboard` room.

| Direction | Event | Payload |
|---|---|---|
| server → client | `device:status` | `{ deviceId, hostname, status, previous, lastEvent }` |
| server → client | `device:metrics` | `{ at, devices: [{ hostname, cpu, memory, interfaces? }] }`, **partial**: merge fields present |
| server → client | `device:interface` / `device:bgp` / `device:isis` | `{ hostname, interface \| neighbor, lastEvent }` |
| server → client | `alarm:raised` / `alarm:cleared` | full alarm |
| server → client | `incident:created` / `incident:updated` | full incident |
| server → client | `incident:comment` | `{ incidentId, comment }` (incident room only) |
| server → client | `incident:presence` | `{ incidentId, viewers }` (incident room only) |
| server → client | `simulator:step` / `simulator:done` | scenario progress |
| client → server | `incident:join` / `incident:leave` | incidentId |

**Client rule:** fetch initial state over REST, then apply socket events on
top. On reconnect, refetch, so nothing missed while disconnected is lost.

## Design decisions (interview talking points)

- **One service layer for all state changes.** Simulator, REST and a future
  Netmiko collector all call `deviceService`, which writes to MongoDB first and
  only then emits. The simulator is replaceable without touching anything else.
- **Atomic updates.** Positional `$set` on the one interface / neighbour that
  changed; compare-and-set for device health. No read-modify-write races.
- **Alarm de-duplication in the database.** A unique partial index allows only
  one *active* alarm per device + type + resource.
- **Hysteresis.** HIGH_CPU raises at 85% and clears below 75%, so it doesn't flap.
- **Alarm → incident correlation.** Critical alarm with no open incident →
  auto-create. Any alarm on a device with an open incident → attach, and
  escalate severity if it's worse.
- **Optimistic concurrency.** Two engineers editing the same incident: the
  second save gets `409` and must refresh. Comments are append-only, so they
  never conflict.
- **Batched metrics.** One `device:metrics` event per tick for all devices,
  not one per device.
- **Socket auth at the handshake.** No valid JWT, no connection.

## Structure

```
server/
├── config/       db connection, constants (thresholds, status transitions)
├── models/       Device, Alarm, Incident, User, Counter
├── services/     deviceService, alarmService, incidentService  <- all business logic
├── routes/       thin HTTP layer
├── socket/       Socket.io setup, JWT middleware, rooms, presence
├── simulator/    ticker (metrics), scenarios (fiber-cut, recover)
├── seed/         lab topology + demo users
└── scripts/      socket-listener.js (terminal dashboard)
```
