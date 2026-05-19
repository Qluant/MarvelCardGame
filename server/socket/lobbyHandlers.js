const { validateRoomName, validateHeroId } = require('../utils/validate');
const {
  getPublicRooms,
  dealCards,
  removePlayerFromRoom,
} = require('./gameEngine');

module.exports = (io, socket, rooms, reconnectTimers) => {
  socket.on('create-room', (roomData) => {
    const nameCheck = validateRoomName(roomData.name);
    if (!nameCheck.valid) return socket.emit('error', nameCheck.message);

    const heroCheck = validateHeroId(roomData.heroId);
    if (!heroCheck.valid) return socket.emit('error', heroCheck.message);

    const roomId = `room-${Date.now()}`;
    const newRoom = {
      id: roomId,
      name: roomData.name,
      isPrivate: roomData.isPrivate,
      password: roomData.password,
      players: [
        {
          id: socket.id,
          nickname: roomData.nickname,
          avatar: roomData.avatar || null,
          heroId: roomData.heroId,
          hp: 30,
          ap: 6,
          maxAp: 15,
          hand: [],
          board: [],
          stagedCards: [],
          queuedAttacks: [],
          stats: { dmgDealt: 0, dmgDefended: 0, cardsPlayed: 0 },
        },
      ],
    };
    rooms[roomId] = newRoom;
    socket.join(roomId);

    io.emit('rooms-update', getPublicRooms(rooms));
    socket.emit('room-created', newRoom);
  });

  socket.on('join-room', (joinData) => {
    const { roomId, password, nickname, heroId, avatar } = joinData;
    const room = rooms[roomId];

    if (!room) return socket.emit('error', 'Room not found');
    if (room.players.length >= 2) return socket.emit('error', 'Room is full');
    if (room.isPrivate && room.password !== password) return socket.emit('error', 'Invalid password');
    if (room.players.find((p) => p.nickname === nickname)) {
      return socket.emit('error', 'You are already in this room');
    }

    const heroCheck = validateHeroId(heroId);
    if (!heroCheck.valid) return socket.emit('error', heroCheck.message);

    room.players.push({
      id: socket.id,
      nickname,
      avatar: avatar || null,
      heroId,
      hp: 30,
      ap: 6,
      maxAp: 15,
      hand: [],
      board: [],
      stagedCards: [],
      queuedAttacks: [],
      stats: { dmgDealt: 0, dmgDefended: 0, cardsPlayed: 0 },
    });
    socket.join(roomId);

    io.emit('rooms-update', getPublicRooms(rooms));
    io.to(roomId).emit('game-start', room);

    dealCards(io, room, rooms);
  });

  socket.on('leave-room', (roomId) => {
    const user = Object.keys(reconnectTimers).find(
      (nick) =>
        reconnectTimers[nick].roomId === roomId &&
        reconnectTimers[nick].socketId === socket.id
    );
    if (user) {
      clearTimeout(reconnectTimers[user].timeout);
      delete reconnectTimers[user];
    }

    removePlayerFromRoom(io, socket.id, roomId, rooms);
    socket.leave(roomId);
  });

  socket.on('get-rooms', () => {
    socket.emit('rooms-update', getPublicRooms(rooms));
  });
};
