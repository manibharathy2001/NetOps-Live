const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROOMS } = require('../config/constants');

let io = null;

// incidentId -> Map<socketId, { id, name }>  ("Mani is viewing this incident")
const presence = new Map();

function viewersOf(incidentId) {
  const sockets = presence.get(incidentId);
  if (!sockets) return [];
  // One user may have the incident open in two tabs; list them once.
  const unique = new Map();
  for (const viewer of sockets.values()) unique.set(viewer.id, viewer);
  return [...unique.values()];
}

function broadcastPresence(incidentId) {
  io.to(ROOMS.incident(incidentId)).emit('incident:presence', {
    incidentId,
    viewers: viewersOf(incidentId),
  });
}

function leaveIncident(socket, incidentId) {
  socket.leave(ROOMS.incident(incidentId));
  const sockets = presence.get(incidentId);
  if (!sockets) return;
  sockets.delete(socket.id);
  if (sockets.size === 0) presence.delete(incidentId);
  broadcastPresence(incidentId);
}

function initSocket(httpServer, { origin }) {
  io = new Server(httpServer, { cors: { origin, credentials: true } });

  // Authenticate during the handshake. No valid JWT = no connection.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id).lean();
      if (!user) return next(new Error('User no longer exists'));
      socket.user = { id: String(user._id), name: user.name, role: user.role };
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(ROOMS.DASHBOARD);
    socket.data.incidents = new Set();
    console.log(`[socket] ${socket.user.name} connected (${socket.id})`);

    socket.on('incident:join', (incidentId) => {
      if (typeof incidentId !== 'string' || !incidentId) return;
      socket.join(ROOMS.incident(incidentId));
      socket.data.incidents.add(incidentId);
      if (!presence.has(incidentId)) presence.set(incidentId, new Map());
      presence.get(incidentId).set(socket.id, { id: socket.user.id, name: socket.user.name });
      broadcastPresence(incidentId);
    });

    socket.on('incident:leave', (incidentId) => {
      if (!socket.data.incidents.has(incidentId)) return;
      socket.data.incidents.delete(incidentId);
      leaveIncident(socket, incidentId);
    });

    socket.on('disconnect', () => {
      for (const incidentId of socket.data.incidents) leaveIncident(socket, incidentId);
      console.log(`[socket] ${socket.user.name} disconnected (${socket.id})`);
    });
  });

  return io;
}

// Services call these. They are no-ops when Socket.io isn't running
// (e.g. inside the seed script), so services never need to care.
function emitToDashboard(event, payload) {
  if (io) io.to(ROOMS.DASHBOARD).emit(event, payload);
}

function emitToIncident(incidentId, event, payload) {
  if (io) io.to(ROOMS.incident(String(incidentId))).emit(event, payload);
}

module.exports = { initSocket, emitToDashboard, emitToIncident };
