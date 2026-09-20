# NetOps Live: Frontend

React + Vite + Tailwind CSS v4 + Socket.io client.

## Run

The backend must be running first (`cd server && npm run dev`).

```bash
cd client
npm install
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
npm run dev              # http://localhost:5173
```

## How data flows

```
REST  GET /api/devices, /api/alarms   ->  initial state
Socket.io events                      ->  applied on top, no polling
Socket reconnects                     ->  REST refetch, so nothing is missed
```

- `context/SocketContext.jsx`: one connection per signed-in user, JWT sent in the handshake
- `hooks/useSocketEvent.js`: subscribe/unsubscribe to one event, tied to a component's lifetime
- `hooks/useDevices.js`: merges `device:status`, `device:metrics`, `device:interface`, `device:bgp`, `device:isis`
- `hooks/useAlarms.js`: `alarm:raised` / `alarm:cleared`
- `components/IncidentToasts.jsx`: `incident:created` notification for every engineer, on every page
- `hooks/useIncidents.js`: live incident list per filter (`incident:created` / `incident:updated`)
- `hooks/useIncident.js`: one incident; joins its room for comments and presence, sends `version` on
  every edit and recovers from a `409` conflict by reloading

## Structure

```
src/
├── lib/          api.js (fetch + JWT), format.js
├── context/      AuthContext, SocketContext
├── hooks/        useSocketEvent, useDevices, useAlarms, useIncidents, useIncident, useNow
├── pages/        LoginPage, DashboardPage, IncidentsPage, NewIncidentPage, IncidentDetailPage
└── components/   Layout, TopBar, StatusSummary, DeviceTable, DeviceRow, DeviceDetail,
                  AlarmFeed, SimulatorPanel, IncidentToasts, IncidentBadges, StatusBadge, UsageBar
```
