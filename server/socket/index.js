const { verifyJwt } = require('../utils/cryptoHelper');
const config = require('../config');
const { getPublicRooms } = require('./gameEngine');

module.exports = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: config.clientOrigin,
      methods: ['GET', 'POST'],
    },
  });

  const rooms = {};
  const activeSockets = {};
  const reconnectTimers = {};

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyJwt(token, config.jwt.secret);
      socket.user = payload;
      next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    const nickname = socket.user.username;
    
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

    socket.emit('rooms-update', getPublicRooms(rooms));

    require('./lobbyHandlers')(io, socket, rooms, reconnectTimers);
    require('./gameHandlers')(io, socket, rooms);
    require('./reconnectHandlers')(io, socket, rooms, reconnectTimers);
  });
};
