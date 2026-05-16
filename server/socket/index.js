/**
 * socket/index.js
 * Socket.IO initialization: creates io, attaches JWT auth middleware,
 * declares shared state (rooms, reconnectTimers), registers all handlers.
 *
 * Exported as a factory function: (server) => void
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { getPublicRooms } = require('./gameEngine');

/**
 * @param {import('http').Server} server
 */
module.exports = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: config.clientOrigin,
      methods: ['GET', 'POST'],
    },
  });

  // ── Shared in-memory state ─────────────────────────────────────────────────
  const rooms = {};
  const reconnectTimers = {}; // { [nickname]: { timeout, roomId, socketId, rejoinsUsed } }

  // ── Socket.IO Auth Middleware ──────────────────────────────────────────────
  // Runs before io.on('connection'). Rejects without valid JWT.
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      socket.user = payload; // { userId, username } — available in all handlers
      next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Send current lobby state to the new client immediately
    socket.emit('rooms-update', getPublicRooms(rooms));

    // Register event handlers — each file gets (io, socket, rooms, reconnectTimers)
    require('./lobbyHandlers')(io, socket, rooms, reconnectTimers);
    require('./gameHandlers')(io, socket, rooms);
    require('./reconnectHandlers')(io, socket, rooms, reconnectTimers);
  });
};
