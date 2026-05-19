const {
  getPublicRooms,
  syncGameState,
  removePlayerFromRoom,
  removePlayerByNickname,
} = require('./gameEngine');

module.exports = (io, socket, rooms) => {
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) continue;

      console.log(`${player.nickname} disconnected — forfeiting`);
      removePlayerFromRoom(io, socket.id, roomId, rooms);
      break;
    }
  });

  socket.on('check-game-state', ({ roomId, nickname }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit('room-gone');
      return;
    }

    const playerIndex = room.players.findIndex((p) => p.nickname === nickname);
    if (playerIndex === -1) {
      socket.emit('room-gone');
      return;
    }

    room.players[playerIndex].id = socket.id;
    room.players[playerIndex].disconnected = false;
    socket.join(roomId);

    if (room.players.length === 2) {
      socket.emit('game-start', room);
      syncGameState(io, roomId, rooms);
    } else {
      socket.emit('waiting-room-restore', { roomId });
    }
  });
};
