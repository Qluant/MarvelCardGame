/**
 * socket/index.js
 * Socket.IO initialization: creates io, attaches JWT auth middleware,
 * declares shared state (rooms), registers all handlers.
 *
 * Exported as a factory function: (server) => void
 */

const { verifyJwt } = require('../utils/cryptoHelper');
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
  const activeSockets = {}; // { [nickname]: socketId }
  const reconnectTimers = {}; // { [nickname]: { timeout, roomId, socketId, rejoinsUsed } }

  // ── Socket.IO Auth Middleware ──────────────────────────────────────────────
  // Runs before io.on('connection'). Rejects without valid JWT.
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyJwt(token, config.jwt.secret);
      socket.user = payload; // { userId, username } — available in all handlers
      next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    const nickname = socket.user.username;
    
    // Tab duplication detection
    if (activeSockets[nickname]) {
      const oldSocketId = activeSockets[nickname];
      io.to(oldSocketId).emit('duplicate-tab');
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) oldSocket.disconnect(true);
    }
    activeSockets[nickname] = socket.id;

    socket.on('disconnect', () => {
      if (activeSockets[nickname] === socket.id) {
        delete activeSockets[nickname];
      }
    });

    // Send current lobby state to the new client immediately
    socket.emit('rooms-update', getPublicRooms(rooms));

    // Register event handlers — each file gets (io, socket, rooms)
    require('./lobbyHandlers')(io, socket, rooms, reconnectTimers);
    require('./gameHandlers')(io, socket, rooms);
    require('./reconnectHandlers')(io, socket, rooms, reconnectTimers);
  });
};
