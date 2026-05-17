/**
 * socket/gameEngine.js
 * All game business logic as pure/quasi-pure functions.
 * Receives io, room, rooms as explicit arguments — no global state.
 * Does NOT register any socket.on(). Handlers call these functions.
 *
 */

const crypto = require('crypto');
const Card = require('../models/Card');
const { recordResult, recordDraw } = require('./statsHandlers');

const HAND_SIZE = 5;

// ── Public room list ──────────────────────────────────────────────────────────

/**
 * Returns the list of rooms visible in the lobby (not full, public).
 * @param {Object} rooms
 * @returns {{ id: string, name: string, isPrivate: boolean }[]}
 */
function getPublicRooms(rooms) {
  return Object.values(rooms)
    .filter((r) => r.players.length < 2)
    .map((r) => ({ id: r.id, name: r.name, isPrivate: r.isPrivate || false }));
}

// ── Game state sync ───────────────────────────────────────────────────────────

/**
 * Emit personalized sync-game-state to each player in the room.
 * Keeps the same payload shape as the original server.js for client compatibility.
 * @param {Object} io
 * @param {string} roomId
 * @param {Object} rooms
 */
function syncGameState(io, roomId, rooms) {
  const room = rooms[roomId];
  if (!room || room.players.length < 2) return;

  room.players.forEach((player) => {
    const opponent =
      room.players.find((p) => p.nickname !== player.nickname) || room.players[0];

    const state = {
      roundCount: room.roundCount || 1,
      isMyTurn: room.currentTurn === null ? null : room.currentTurn === player.id,
      player: {
        nickname: player.nickname,
        avatar: player.avatar,
        heroId: player.heroId,
        hp: player.hp,
        ap: player.ap,
        maxAp: player.maxAp,
        hand: player.hand,
        board: player.board,
        stagedCards: player.stagedCards,
        queuedAttacks: player.queuedAttacks,
      },
      opponent: {
        nickname: opponent.nickname,
        avatar: opponent.avatar,
        heroId: opponent.heroId,
        hp: opponent.hp,
        ap: opponent.ap,
        maxAp: opponent.maxAp,
        handCount: opponent.hand ? opponent.hand.length : 0,
        board: opponent.board,
        stagedCount: opponent.stagedCards ? opponent.stagedCards.length : 0,
        stagedCards: room.currentTurn === null ? opponent.stagedCards : undefined,
      },
    };

    if (!player.id.startsWith('__disconnected__')) {
      io.to(player.id).emit('sync-game-state', state);
    }
  });
}

// ── Passives ──────────────────────────────────────────────────────────────────

/**
 * Apply hero-specific passive abilities for a player before round resolution.
 * Mutates player in-place.
 * @param {Object} player
 * @returns {string[]} passive trigger messages
 */
function applyPassives(player) {
  const messages = [];

  if (player.heroId === 1) {
    // Iron Man: 3+ active Summons on board → +1 AP
    const activeSummons = player.board.filter((c) => c.category === 'Summon').length;
    if (activeSummons >= 3) {
      player.ap = Math.min(player.ap + 1, player.maxAp);
      messages.push(`${player.nickname}'s Iron Man passive triggered: +1 AP from active Summons!`);
    }
  } else if (player.heroId === 3) {
    // Venom: Hybrid cards in staged → boost Trade attack and Summon defense
    const hybridCount = player.stagedCards.filter((c) => c.category === 'Hybrid').length;
    if (hybridCount > 0) {
      let triggeredTrade = false;
      let triggeredSummon = false;
      player.stagedCards.forEach((c) => {
        if (c.category === 'Trade') {
          c.attack += 2 * hybridCount;
          triggeredTrade = true;
        } else if (c.category === 'Summon') {
          c.defense += 2 * hybridCount;
          triggeredSummon = true;
        }
      });
      if (triggeredTrade || triggeredSummon) {
        messages.push(
          `${player.nickname}'s Venom passive triggered: +${2 * hybridCount} stats from Hybrid synergy!`
        );
      }
    }
  } else if (player.heroId === 2) {
    // Human Torch: 2+ Trade cards staged → +35% attack for all staged and board cards
    const tradeCards = player.stagedCards.filter((c) => c.category === 'Trade');
    if (tradeCards.length >= 2) {
      player.board.forEach((c) => { c.attack = Math.round(c.attack * 1.35); });
      player.stagedCards.forEach((c) => { c.attack = Math.round(c.attack * 1.35); });
      messages.push(`${player.nickname}'s Human Torch passive triggered: +35% Damage output!`);
    }
  }

  return messages;
}

// ── Board attack resolution ───────────────────────────────────────────────────

/**
 * Get the first alive Summon on the opponent's board, or null.
 * @param {Object} opponent
 * @returns {Object|null}
 */
function getAutoTarget(opponent) {
  return opponent.board.find((c) => c.defense > 0) || null;
}

/**
 * Resolve all queued board attacks from attackerPlayer against defenderPlayer.
 * Mutates both players' stats, defenderPlayer's armor/hp/board in-place.
 * @param {Object} attackerPlayer
 * @param {Object} defenderPlayer
 */
function resolveAttacks(attackerPlayer, defenderPlayer) {
  for (const attacker of attackerPlayer.board) {
    if (attacker.defense <= 0) continue;

    let remainingDamage = attacker.attack;
    while (remainingDamage > 0 && attacker.defense > 0) {
      if (defenderPlayer.armor > 0) {
        if (defenderPlayer.armor <= remainingDamage) {
          attackerPlayer.stats.dmgDealt += defenderPlayer.armor;
          defenderPlayer.stats.dmgDefended += defenderPlayer.armor;
          remainingDamage -= defenderPlayer.armor;
          defenderPlayer.armor = 0;
        } else {
          attackerPlayer.stats.dmgDealt += remainingDamage;
          defenderPlayer.stats.dmgDefended += remainingDamage;
          defenderPlayer.armor -= remainingDamage;
          remainingDamage = 0;
        }
        continue;
      }

      const autoTarget = getAutoTarget(defenderPlayer);
      if (autoTarget) {
        if (autoTarget.defense <= remainingDamage) {
          attackerPlayer.stats.dmgDealt += autoTarget.defense;
          defenderPlayer.stats.dmgDefended += autoTarget.defense;
          remainingDamage -= autoTarget.defense;
          autoTarget.defense = 0;
        } else {
          attackerPlayer.stats.dmgDealt += remainingDamage;
          defenderPlayer.stats.dmgDefended += remainingDamage;
          autoTarget.defense -= remainingDamage;
          remainingDamage = 0;
        }
      } else {
        attackerPlayer.stats.dmgDealt += remainingDamage;
        defenderPlayer.hp -= remainingDamage;
        remainingDamage = 0;
      }
    }
  }
}

// ── Staged card resolution ────────────────────────────────────────────────────

/**
 * Resolve all staged cards for a player:
 * - Trade/Hybrid → attack damage chain against opponent
 * - Summon → pushed to newSummonsList (enters board after all attacks)
 * @param {Object} player
 * @param {Object} opponent
 * @param {Object[]} newSummonsList  mutated in-place
 */
function resolveStaged(player, opponent, newSummonsList) {
  for (const card of player.stagedCards) {
    if (card.category === 'Trade' || card.category === 'Hybrid') {
      let remainingDamage = card.attack;
      while (remainingDamage > 0) {
        if (opponent.armor > 0) {
          if (opponent.armor <= remainingDamage) {
            player.stats.dmgDealt += opponent.armor;
            opponent.stats.dmgDefended += opponent.armor;
            remainingDamage -= opponent.armor;
            opponent.armor = 0;
          } else {
            player.stats.dmgDealt += remainingDamage;
            opponent.stats.dmgDefended += remainingDamage;
            opponent.armor -= remainingDamage;
            remainingDamage = 0;
          }
          continue;
        }

        const autoTarget = getAutoTarget(opponent);
        if (autoTarget) {
          if (autoTarget.defense <= remainingDamage) {
            player.stats.dmgDealt += autoTarget.defense;
            opponent.stats.dmgDefended += autoTarget.defense;
            remainingDamage -= autoTarget.defense;
            autoTarget.defense = 0;
          } else {
            player.stats.dmgDealt += remainingDamage;
            opponent.stats.dmgDefended += remainingDamage;
            autoTarget.defense -= remainingDamage;
            remainingDamage = 0;
          }
        } else {
          player.stats.dmgDealt += remainingDamage;
          opponent.hp -= remainingDamage;
          remainingDamage = 0;
        }
      }
    } else if (card.category === 'Summon') {
      newSummonsList.push(card);
    }
  }
}

// ── Win condition ─────────────────────────────────────────────────────────────

/**
 * Check HP and emit game-over if needed. Records stats via statsHandlers.
 * @param {Object} io
 * @param {Object} room
 * @param {Object} rooms
 */
function checkWinCondition(io, room, rooms) {
  if (!room || room.players.length !== 2) return;
  const p1 = room.players[0];
  const p2 = room.players[1];

  if (p1.hp <= 0 && p2.hp <= 0) {
    io.to(room.id).emit('game-over', { outcome: 'draw' });
    recordDraw(p1, p2);
    delete rooms[room.id];
    io.emit('rooms-update', getPublicRooms(rooms));
  } else if (p1.hp <= 0 || p2.hp <= 0) {
    const winner = p1.hp > 0 ? p1 : p2;
    const loser  = p1.hp <= 0 ? p1 : p2;

    io.to(room.id).emit('game-over', {
      outcome: 'win',
      opponentNickname: loser.nickname,
      winnerNickname: winner.nickname,
    });
    recordResult(winner, loser);
    delete rooms[room.id];
    io.emit('rooms-update', getPublicRooms(rooms));
  }
}

// ── Round resolution ──────────────────────────────────────────────────────────

/**
 * Full round resolution cycle:
 * 1. Lock UI (currentTurn = null), sync
 * 2. Apply passives
 * 3. Snapshot for animation
 * 4. Calculate armor from Hybrid staged cards
 * 5. Resolve board attacks (both directions)
 * 6. Resolve staged cards (both directions)
 * 7. Summons enter board, dead summons removed
 * 8. Emit combat-animation, wait 4500ms
 * 9. Prep next round (AP, draw, roundCount, turn order)
 * @param {Object} io
 * @param {Object} room
 * @param {Object} rooms
 */
async function resolveRound(io, room, rooms) {
  room.currentTurn = null;
  syncGameState(io, room.id, rooms);

  const p1 = room.players[0];
  const p2 = room.players[1];

  const passives1 = applyPassives(p1);
  const passives2 = applyPassives(p2);
  const allPassiveMessages = [...passives1, ...passives2];

  const p1Anim = {
    id: p1.id,
    heroId: p1.heroId,
    totalAtk:
      p1.board.reduce((s, c) => s + c.attack, 0) +
      p1.stagedCards.filter((c) => c.category !== 'Summon').reduce((s, c) => s + c.attack, 0),
    totalDef:
      p1.board.reduce((s, c) => s + c.defense, 0) +
      p1.stagedCards.filter((c) => c.category === 'Hybrid').reduce((s, c) => s + c.defense, 0),
    startHp: p1.hp,
    startDef:
      p1.board.reduce((s, c) => s + c.defense, 0) +
      p1.stagedCards.filter((c) => c.category === 'Hybrid').reduce((s, c) => s + c.defense, 0),
  };
  const p2Anim = {
    id: p2.id,
    heroId: p2.heroId,
    totalAtk:
      p2.board.reduce((s, c) => s + c.attack, 0) +
      p2.stagedCards.filter((c) => c.category !== 'Summon').reduce((s, c) => s + c.attack, 0),
    totalDef:
      p2.board.reduce((s, c) => s + c.defense, 0) +
      p2.stagedCards.filter((c) => c.category === 'Hybrid').reduce((s, c) => s + c.defense, 0),
    startHp: p2.hp,
    startDef:
      p2.board.reduce((s, c) => s + c.defense, 0) +
      p2.stagedCards.filter((c) => c.category === 'Hybrid').reduce((s, c) => s + c.defense, 0),
  };

  p1.armor = p1.stagedCards.filter((c) => c.category === 'Hybrid').reduce((sum, c) => sum + c.defense, 0);
  p2.armor = p2.stagedCards.filter((c) => c.category === 'Hybrid').reduce((sum, c) => sum + c.defense, 0);

  resolveAttacks(p1, p2);
  resolveAttacks(p2, p1);

  const p1NewSummons = [];
  const p2NewSummons = [];
  resolveStaged(p1, p2, p1NewSummons);
  resolveStaged(p2, p1, p2NewSummons);

  // Summons enter board only after all attacks resolve
  p1.board.push(...p1NewSummons);
  p2.board.push(...p2NewSummons);

  // Remove dead summons
  p1.board = p1.board.filter((c) => c.defense > 0);
  p2.board = p2.board.filter((c) => c.defense > 0);

  // Finalize animation snapshot
  p1Anim.hpDamageTaken = p1Anim.startHp - p1.hp;
  p1Anim.shieldDamageTaken = Math.max(
    0,
    p1Anim.startDef - (p1.board.reduce((s, c) => s + c.defense, 0) + p1.armor)
  );
  p2Anim.hpDamageTaken = p2Anim.startHp - p2.hp;
  p2Anim.shieldDamageTaken = Math.max(
    0,
    p2Anim.startDef - (p2.board.reduce((s, c) => s + c.defense, 0) + p2.armor)
  );

  io.to(room.id).emit('combat-animation', {
    p1: p1Anim,
    p2: p2Anim,
    passiveMessages: allPassiveMessages,
  });

  // Wait for clients to animate
  await new Promise((resolve) => setTimeout(resolve, 4500));

  for (const player of room.players) {
    player.stagedCards = [];
    player.queuedAttacks = [];

    // AP scaling: +3 per round (cumulative up to maxAp)
    player.ap = Math.min(player.ap + 3, player.maxAp);
    // Every 5th round: bonus +3 AP
    if (room.roundCount % 5 === 0) {
      player.ap = Math.min(player.ap + 3, player.maxAp);
    }

    // Refill hand up to HAND_SIZE
    const cardsNeeded = HAND_SIZE - player.hand.length;
    for (let i = 0; i < cardsNeeded; i++) {
      const card = await drawCard(player.heroId, player.hand);
      if (card) player.hand.push(card);
    }
  }

  room.turnsPassed = 0;
  room.roundCount = (room.roundCount || 1) + 1;

  // Alternate who goes first each round
  room.firstPlayerIndex = 1 - (room.firstPlayerIndex ?? 0);
  room.currentTurn = room.players[room.firstPlayerIndex].id;

  io.to(room.id).emit('turn-order-change', {
    firstPlayerId: room.players[room.firstPlayerIndex].id,
    firstPlayerNickname: room.players[room.firstPlayerIndex].nickname,
  });

  syncGameState(io, room.id, rooms);
  checkWinCondition(io, room, rooms);
}

// ── Card draw ─────────────────────────────────────────────────────────────────

/**
 * Draw one card from the hero's deck with weighted randomness.
 * Max 2 copies of any card in hand enforced.
 * @param {number} heroId
 * @param {Object[]} currentHand
 * @returns {Promise<Object|null>}
 */
async function drawCard(heroId, currentHand = []) {
  if (!heroId) return null;

  const rows = await Card.getByHeroId(heroId);
  if (rows.length === 0) return null;

  // Enforce max 2 copies of the same card in hand
  const counts = {};
  for (const c of currentHand) {
    counts[c.baseId] = (counts[c.baseId] || 0) + 1;
  }
  const allowedCards = rows.filter((r) => (counts[r.baseId] || 0) < 2);
  if (allowedCards.length === 0) return null;

  // Weighted random: lower cost = higher probability
  let totalWeight = 0;
  for (const c of allowedCards) {
    c.weight = 100 / (c.cost + 1);
    totalWeight += c.weight;
  }

  let randomVal = Math.random() * totalWeight;
  let card = allowedCards[0];
  for (const c of allowedCards) {
    if (randomVal < c.weight) {
      card = c;
      break;
    }
    randomVal -= c.weight;
  }

  return { ...card, uid: crypto.randomUUID() };
}

// ── Initial card deal ─────────────────────────────────────────────────────────

/**
 * Deal initial hands, run coin flip, set first turn.
 * @param {Object} io
 * @param {Object} room
 * @param {Object} rooms
 */
async function dealCards(io, room, rooms) {
  const firstPlayerIndex = Math.floor(Math.random() * 2);
  room.firstPlayerIndex = firstPlayerIndex;
  room.currentTurn = room.players[firstPlayerIndex].id;
  room.turnsPassed = 0;
  room.roundCount = 1;

  io.to(room.id).emit('coin-flip', {
    winnerId: room.players[firstPlayerIndex].id,
    winnerNickname: room.players[firstPlayerIndex].nickname,
  });

  for (const player of room.players) {
    try {
      player.hand = [];
      for (let i = 0; i < HAND_SIZE; i++) {
        const card = await drawCard(player.heroId, player.hand);
        if (card) player.hand.push(card);
      }
    } catch (err) {
      console.error(`Failed to deal cards to ${player.nickname}:`, err);
    }
  }

  syncGameState(io, room.id, rooms);
}

// ── Player removal ────────────────────────────────────────────────────────────

/**
 * Remove a player from a room by their socket id.
 * If game was active, emits game-over and records stats.
 * @param {Object} io
 * @param {string} socketId
 * @param {string} roomId
 * @param {Object} rooms
 */
function removePlayerFromRoom(io, socketId, roomId, rooms) {
  const room = rooms[roomId];
  if (!room) return;

  const wasGame = room.players.length === 2;
  const loser  = room.players.find((p) => p.id === socketId);
  const winner = room.players.find((p) => p.id !== socketId);

  room.players = room.players.filter((p) => p.id !== socketId);

  if (room.players.length === 0 || wasGame) {
    delete rooms[roomId];

    if (wasGame && loser && winner) {
      io.to(winner.id).emit('game-over', { outcome: 'win', opponentNickname: loser.nickname });
      io.to(loser.id).emit('game-over', { outcome: 'loss', opponentNickname: winner.nickname });
      recordResult(winner, loser);
    }
  }

  io.emit('rooms-update', getPublicRooms(rooms));
}

/**
 * Remove a player from a room by nickname (used by reconnect timer expiry).
 * @param {Object} io
 * @param {string} nickname
 * @param {string} roomId
 * @param {Object} rooms
 */
function removePlayerByNickname(io, nickname, roomId, rooms) {
  const room = rooms[roomId];
  if (!room) return;

  const wasGame = room.players.length === 2;
  const loser  = room.players.find((p) => p.nickname === nickname);
  const winner = room.players.find((p) => p.nickname !== nickname);

  if (!loser) return;

  room.players = room.players.filter((p) => p.nickname !== nickname);

  if (wasGame) {
    delete rooms[roomId];
    if (winner && winner.id && !winner.id.startsWith('__disconnected__')) {
      io.to(winner.id).emit('game-over', { outcome: 'win', opponentNickname: loser.nickname });
    }
    // Disconnected player has no live socket — nothing to emit to them
    recordResult(winner, loser);
  }

  io.emit('rooms-update', getPublicRooms(rooms));
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  getPublicRooms,
  syncGameState,
  applyPassives,
  resolveAttacks,
  resolveStaged,
  resolveRound,
  drawCard,
  dealCards,
  checkWinCondition,
  removePlayerFromRoom,
  removePlayerByNickname,
};
