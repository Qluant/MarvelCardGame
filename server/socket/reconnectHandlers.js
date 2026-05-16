/**
 * socket/reconnectHandlers.js
 * Handles disconnect, reconnect window, and game state restoration.
 *
 * @param {Object} io
 * @param {Object} socket
 * @param {Object} rooms
 * @param {Object} reconnectTimers  { [nickname]: { timeout, roomId, socketId, rejoinsUsed } }
 */

const {
  getPublicRooms,
  syncGameState,
  removePlayerFromRoom,
  removePlayerByNickname,
} = require('./gameEngine');

module.exports = (io, socket, rooms, reconnectTimers) => {
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) continue;

      if (room.players.length === 2) {
        // ── Active game: grant reconnect window ───────────────────────────
        const prior = reconnectTimers[player.nickname];
        const rejoinsUsed = prior ? prior.rejoinsUsed : 0;

        if (rejoinsUsed >= 3) {
          // 4th disconnect → immediate defeat, no more chances
          console.log(`${player.nickname} exceeded reconnect limit — forfeiting`);
          removePlayerFromRoom(io, socket.id, roomId, rooms);
        } else {
          // Mark player as disconnected (keep in room)
          player.disconnected = true;
          player.id = `__disconnected__${player.nickname}`;

          // Notify the opponent
          const opponent = room.players.find((p) => p.nickname !== player.nickname);
          if (opponent && opponent.id && !opponent.id.startsWith('__disconnected__')) {
            io.to(opponent.id).emit('opponent-reconnecting', {
              secondsLeft: 20,
              rejoinsLeft: 2 - rejoinsUsed, // remaining after this one
            });
          }

          const nickname = player.nickname; // capture for timer closure
          const timeout = setTimeout(() => {
            console.log(`Reconnect timer expired for ${nickname}`);
            delete reconnectTimers[nickname];
            removePlayerByNickname(io, nickname, roomId, rooms);
          }, 20000);

          // Cancel previous timer if any (edge case: rapid reconnects)
          if (prior) clearTimeout(prior.timeout);

          reconnectTimers[nickname] = {
            timeout,
            roomId,
            socketId: socket.id,
            rejoinsUsed: rejoinsUsed + 1,
          };
        }
      } else {
        // Waiting room — immediate cleanup
        removePlayerFromRoom(io, socket.id, roomId, rooms);
      }
      break;
    }
  });

  socket.on('check-game-state', ({ roomId, nickname }) => {
    const room = rooms[roomId];

    // Room is gone (game ended while away) — send client to lobby
    if (!room) {
      socket.emit('room-gone');
      return;
    }

    const playerIndex = room.players.findIndex((p) => p.nickname === nickname);
    if (playerIndex === -1) {
      socket.emit('room-gone');
      return;
    }

    // Cancel pending reconnect timer
    if (reconnectTimers[nickname]) {
      clearTimeout(reconnectTimers[nickname].timeout);
      delete reconnectTimers[nickname];
    }

    // Restore player with new socket id
    room.players[playerIndex].id = socket.id;
    room.players[playerIndex].disconnected = false;
    socket.join(roomId);

    if (room.players.length === 2) {
      // Active game — full resync
      const opponent = room.players.find((p) => p.nickname !== nickname);
      if (opponent && opponent.id && !opponent.id.startsWith('__disconnected__')) {
        io.to(opponent.id).emit('opponent-reconnected', { nickname });
      }

      socket.emit('game-start', room);
      // Overwrite with authoritative state immediately after client sets base variables
      syncGameState(io, roomId, rooms);
    } else {
      // Still waiting for opponent — restore waiting room
      socket.emit('waiting-room-restore', { roomId });
    }
  });
};
