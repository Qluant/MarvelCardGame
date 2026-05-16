/**
 * socket/gameHandlers.js
 * Handles in-game player actions: playing/revoking cards, board attacks, passing turn.
 *
 * @param {Object} io
 * @param {Object} socket
 * @param {Object} rooms
 */

const { syncGameState, resolveRound } = require('./gameEngine');

module.exports = (io, socket, rooms) => {
  socket.on('pass-turn', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.currentTurn !== socket.id) return;

    room.turnsPassed = (room.turnsPassed || 0) + 1;

    if (room.turnsPassed >= 2) {
      resolveRound(io, room, rooms);
    } else {
      const opponent = room.players.find((p) => p.id !== socket.id) || room.players[0];
      room.currentTurn = opponent.id;
      syncGameState(io, roomId, rooms);
    }
  });

  socket.on('play-card', ({ roomId, cardUid, targetUid }) => {
    const room = rooms[roomId];
    if (!room || room.currentTurn !== socket.id) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const cardIndex = player.hand.findIndex((c) => c.uid === cardUid);
    if (cardIndex === -1) return;

    const card = player.hand[cardIndex];

    if (player.ap < card.cost) {
      return socket.emit('error', 'Not enough AP');
    }
    // Max 7 Summons on board (staged + in-play)
    if (
      card.category === 'Summon' &&
      player.board.length + player.stagedCards.filter((c) => c.category === 'Summon').length >= 7
    ) {
      return;
    }

    player.ap -= card.cost;
    player.hand.splice(cardIndex, 1);
    player.stats.cardsPlayed += 1;

    player.stagedCards.push({ ...card, targetUid });

    syncGameState(io, roomId, rooms);
  });

  socket.on('revoke-card', ({ roomId, cardUid }) => {
    const room = rooms[roomId];
    if (!room || room.currentTurn !== socket.id) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const stagedIndex = player.stagedCards.findIndex((c) => c.uid === cardUid);
    if (stagedIndex === -1) return;

    const card = player.stagedCards[stagedIndex];
    player.stagedCards.splice(stagedIndex, 1);
    player.hand.push(card);
    player.ap += card.cost;

    syncGameState(io, roomId, rooms);
  });

  socket.on('board-attack', ({ roomId, attackerUid, targetUid }) => {
    const room = rooms[roomId];
    if (!room || room.currentTurn !== socket.id) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const attackerIndex = player.board.findIndex((c) => c.uid === attackerUid);
    if (attackerIndex === -1) return;

    // Queue or update attack intent for this attacker
    const existingIndex = player.queuedAttacks.findIndex(
      (a) => a.attackerUid === attackerUid
    );
    if (existingIndex !== -1) {
      player.queuedAttacks[existingIndex].targetUid = targetUid;
    } else {
      player.queuedAttacks.push({ attackerUid, targetUid });
    }

    syncGameState(io, roomId, rooms);
  });
};
