require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const db = require('./db/connection');
const cardsRouter = require('./routes/cards');
const authRoutes = require('./routes/auth');
const playersRoutes = require('./routes/players');
const infoRoutes = require('./routes/info');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || `http://localhost:${process.env.PORT}`,
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/cards', cardsRouter);
app.use('/api/auth', authRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/info', infoRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

const rooms = {};
const reconnectTimers = {}; // { [nickname]: { timeout, roomId, socketId, rejoinsUsed } }

const getPublicRooms = () => {
  return Object.values(rooms).filter(r => r.players.length < 2 && !r.isPrivate).map(r => ({ id: r.id, name: r.name, isPrivate: false }));
};

const syncGameState = (roomId) => {
  const room = rooms[roomId];
  if (!room || room.players.length < 2) return;

  room.players.forEach((player) => {
    const opponent = room.players.find(p => p.nickname !== player.nickname) || room.players[0];

    const state = {
      roundCount: room.roundCount || 1,
      isMyTurn: room.currentTurn === player.id,
      player: {
        nickname: player.nickname,
        avatar: player.avatar,
        hp: player.hp,
        ap: player.ap,
        maxAp: player.maxAp,
        hand: player.hand,
        board: player.board,
        stagedCards: player.stagedCards,
        queuedAttacks: player.queuedAttacks
      },
      opponent: {
        nickname: opponent.nickname,
        avatar: opponent.avatar,
        hp: opponent.hp,
        ap: opponent.ap,
        maxAp: opponent.maxAp,
        handCount: opponent.hand ? opponent.hand.length : 0,
        board: opponent.board,
        // Send face-down representation of staged cards (just length)
        stagedCount: opponent.stagedCards ? opponent.stagedCards.length : 0
      }
    };

    if (!player.id.startsWith('__disconnected__')) {
      io.to(player.id).emit('sync-game-state', state);
    }
  });
};

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.emit('rooms-update', getPublicRooms());

  socket.on('create-room', (roomData) => {
    const roomId = `room-${Date.now()}`;
    const newRoom = {
      id: roomId,
      name: roomData.name,
      isPrivate: roomData.isPrivate,
      password: roomData.password,
      players: [{
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
        stats: { dmgDealt: 0, dmgDefended: 0, cardsPlayed: 0 }
      }],
    };
    rooms[roomId] = newRoom;
    socket.join(roomId);

    io.emit('rooms-update', getPublicRooms());
    socket.emit('room-created', newRoom);
  });

  socket.on('join-room', (joinData) => {
    const { roomId, password, nickname, heroId, avatar } = joinData;
    const room = rooms[roomId];

    if (!room) return socket.emit('error', 'Room not found');
    if (room.players.length >= 2) return socket.emit('error', 'Room is full');
    if (room.isPrivate && room.password !== password) return socket.emit('error', 'Invalid password');
    if (room.players.find(p => p.nickname === nickname)) return socket.emit('error', 'You are already in this room');

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
      stats: { dmgDealt: 0, dmgDefended: 0, cardsPlayed: 0 }
    });
    socket.join(roomId);

    io.emit('rooms-update', getPublicRooms());
    io.to(roomId).emit('game-start', room);

    // Deal cards to each player from their chosen hero's deck
    dealCards(room);
  });

  socket.on('pass-turn', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.currentTurn !== socket.id) return;

    room.turnsPassed = (room.turnsPassed || 0) + 1;

    if (room.turnsPassed >= 2) {
      resolveRound(room);
    } else {
      const opponent = room.players.find(p => p.id !== socket.id) || room.players[0];
      room.currentTurn = opponent.id;
      syncGameState(roomId);
    }
  });

  socket.on('play-card', ({ roomId, cardUid, targetUid }) => {
    const room = rooms[roomId];
    if (!room || room.currentTurn !== socket.id) return;

    const player = room.players.find(p => p.id === socket.id);

    const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
    if (cardIndex === -1) return;

    const card = player.hand[cardIndex];
    if (player.ap < card.cost) return;
    if (card.category === 'Summon' && player.board.length + player.stagedCards.filter(c => c.category === 'Summon').length >= 7) return;

    player.ap -= card.cost;
    player.hand.splice(cardIndex, 1);
    player.stats.cardsPlayed += 1;

    // Stage the card with its intended target
    player.stagedCards.push({ ...card, targetUid });

    syncGameState(roomId);
  });

  socket.on('revoke-card', ({ roomId, cardUid }) => {
    const room = rooms[roomId];
    if (!room || room.currentTurn !== socket.id) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const stagedIndex = player.stagedCards.findIndex(c => c.uid === cardUid);
    if (stagedIndex === -1) return;

    const card = player.stagedCards[stagedIndex];
    player.stagedCards.splice(stagedIndex, 1);
    player.hand.push(card);
    player.ap += card.cost;

    syncGameState(roomId);
  });

  socket.on('board-attack', ({ roomId, attackerUid, targetUid }) => {
    const room = rooms[roomId];
    if (!room || room.currentTurn !== socket.id) return;

    const player = room.players.find(p => p.id === socket.id);

    const attackerIndex = player.board.findIndex(c => c.uid === attackerUid);
    if (attackerIndex === -1) return;

    // Queue the attack intent
    const existingIndex = player.queuedAttacks.findIndex(a => a.attackerUid === attackerUid);
    if (existingIndex !== -1) {
      player.queuedAttacks[existingIndex].targetUid = targetUid;
    } else {
      player.queuedAttacks.push({ attackerUid, targetUid });
    }

    syncGameState(roomId);
  });

  async function resolveRound(room) {
    room.currentTurn = null; // Lock UI during resolution
    syncGameState(room.id);

    const p1 = room.players[0];
    const p2 = room.players[1];
    
    function applyPassives(player) {
      const messages = [];
      if (player.heroId === 1) { // Iron Man
        const activeSummons = player.board.filter(c => c.category === 'Summon').length;
        if (activeSummons >= 2) {
          let triggered = false;
          player.stagedCards.forEach(c => {
            if (c.category === 'Hybrid') {
              c.attack += c.defense;
              c.defense = 0;
              triggered = true;
            }
          });
          if (triggered) messages.push(`${player.nickname}'s Iron Man passive triggered: Hybrid cards convert defense to attack!`);
        }
      } else if (player.heroId === 3) { // Venom
        const hybridCards = player.stagedCards.filter(c => c.category === 'Hybrid');
        if (hybridCards.length >= 2) {
          let firstFound = false;
          let triggered = false;
          player.stagedCards.forEach(c => {
            if (c.category === 'Hybrid') {
              if (!firstFound) {
                firstFound = true;
              } else {
                c.attack += c.defense;
                c.defense = 0;
                triggered = true;
              }
            }
          });
          if (triggered) messages.push(`${player.nickname}'s Venom passive triggered: Successive Hybrid cards convert defense to attack!`);
        }
      } else if (player.heroId === 2) { // Human Torch
        const tradeCards = player.stagedCards.filter(c => c.category === 'Trade');
        if (tradeCards.length >= 2) {
          player.board.forEach(c => c.attack = Math.floor(c.attack * 1.5));
          player.stagedCards.forEach(c => c.attack = Math.floor(c.attack * 1.5));
          messages.push(`${player.nickname}'s Human Torch passive triggered: +50% Damage output!`);
        }
      }
      return messages;
    }

    const passives1 = applyPassives(p1);
    const passives2 = applyPassives(p2);
    const allPassiveMessages = [...passives1, ...passives2];
    
    // Animation Snapshot BEFORE resolution
    const p1Anim = {
      id: p1.id, heroId: p1.heroId,
      totalAtk: p1.board.reduce((s, c) => s + c.attack, 0) + p1.stagedCards.filter(c => c.category !== 'Summon').reduce((s, c) => s + c.attack, 0),
      totalDef: p1.board.reduce((s, c) => s + c.defense, 0) + p1.stagedCards.filter(c => c.category === 'Hybrid').reduce((s, c) => s + c.defense, 0),
      startHp: p1.hp, startDef: p1.board.reduce((s, c) => s + c.defense, 0) + p1.stagedCards.filter(c => c.category === 'Hybrid').reduce((s, c) => s + c.defense, 0)
    };
    const p2Anim = {
      id: p2.id, heroId: p2.heroId,
      totalAtk: p2.board.reduce((s, c) => s + c.attack, 0) + p2.stagedCards.filter(c => c.category !== 'Summon').reduce((s, c) => s + c.attack, 0),
      totalDef: p2.board.reduce((s, c) => s + c.defense, 0) + p2.stagedCards.filter(c => c.category === 'Hybrid').reduce((s, c) => s + c.defense, 0),
      startHp: p2.hp, startDef: p2.board.reduce((s, c) => s + c.defense, 0) + p2.stagedCards.filter(c => c.category === 'Hybrid').reduce((s, c) => s + c.defense, 0)
    };

    // Calculate temporary armor from staged Hybrid cards
    p1.armor = p1.stagedCards.filter(c => c.category === 'Hybrid').reduce((sum, c) => sum + c.defense, 0);
    p2.armor = p2.stagedCards.filter(c => c.category === 'Hybrid').reduce((sum, c) => sum + c.defense, 0);

    // 1. Resolve Board Attacks
    // Note: in a true simultaneous system, damage is tallied and then applied, 
    // but for simplicity we will process p1's queued attacks, then p2's, 
    // keeping track of what dies so we don't overkill. 
    // If a card dies during resolution, its queued attack might still resolve (simultaneous strike).
    // Helper to get first chronological alive summon, or null if none
    const getAutoTarget = (opponent) => opponent.board.find(c => c.defense > 0);

    const resolveAttacks = (attackerPlayer, defenderPlayer) => {
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
            attacker.defense -= autoTarget.attack; // Retaliation
            defenderPlayer.stats.dmgDealt += autoTarget.attack;
            attackerPlayer.stats.dmgDefended += autoTarget.attack;
            
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
    };

    resolveAttacks(p1, p2);
    resolveAttacks(p2, p1);

    // 2. Resolve Staged Cards (Hybrid/Trade attacks, then Summons enter board)
    const resolveStaged = (player, opponent) => {
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
          player.board.push(card);
        }
      }
    };

    resolveStaged(p1, p2);
    resolveStaged(p2, p1);

    // Clear dead summons from board
    p1.board = p1.board.filter(c => c.defense > 0);
    p2.board = p2.board.filter(c => c.defense > 0);
    
    // Finalize Animation Snapshot and emit
    p1Anim.hpDamageTaken = p1Anim.startHp - p1.hp;
    const p1EndDef = p1.board.reduce((s, c) => s + c.defense, 0) + p1.armor;
    p1Anim.shieldDamageTaken = Math.max(0, p1Anim.startDef - p1EndDef);

    p2Anim.hpDamageTaken = p2Anim.startHp - p2.hp;
    const p2EndDef = p2.board.reduce((s, c) => s + c.defense, 0) + p2.armor;
    p2Anim.shieldDamageTaken = Math.max(0, p2Anim.startDef - p2EndDef);

    io.to(room.id).emit('combat-animation', { p1: p1Anim, p2: p2Anim, passiveMessages: allPassiveMessages });
    
    // Pause server processing while clients animate
    await new Promise(resolve => setTimeout(resolve, 4500));
    
    // 3. Clear Staged & Queued, Refill Hands, Prep Next Round
    for (const player of room.players) {
      player.stagedCards = [];
      player.queuedAttacks = [];

      // AP Scaling (+3 per round, cumulative up to maxAp)
      player.ap = Math.min(player.ap + 3, player.maxAp);
      
      if (room.roundCount % 5 === 0) {
        player.ap = Math.min(player.ap + 3, player.maxAp);
      }

      // Draw cards up to HAND_SIZE
      const cardsNeeded = HAND_SIZE - player.hand.length;
      for (let i = 0; i < cardsNeeded; i++) {
        const card = await drawCard(player.heroId, player.hand);
        if (card) player.hand.push(card);
      }
    }

    room.turnsPassed = 0;
    room.roundCount = (room.roundCount || 1) + 1;
    room.currentTurn = room.players[0].id;

    syncGameState(room.id);
    checkWinCondition(room);
  }

  socket.on('get-rooms', () => {
    socket.emit('rooms-update', getPublicRooms());
  });


  socket.on('leave-room', (roomId) => {
    // Intentional leave (resign/cancel) — clear any pending reconnect timer
    const user = Object.keys(reconnectTimers).find(
      nick => reconnectTimers[nick].roomId === roomId && reconnectTimers[nick].socketId === socket.id
    );
    if (user) {
      clearTimeout(reconnectTimers[user].timeout);
      delete reconnectTimers[user];
    }
    removePlayerFromRoom(socket.id, roomId);
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const player = room.players.find(p => p.id === socket.id);
      if (!player) continue;

      if (room.players.length === 2) {
        // ── Active game: grant reconnect window ───────────────────────────
        const prior = reconnectTimers[player.nickname];
        const rejoinsUsed = prior ? prior.rejoinsUsed : 0;

        if (rejoinsUsed >= 3) {
          // 4th disconnect → immediate defeat, no more chances
          console.log(`${player.nickname} exceeded reconnect limit — forfeiting`);
          removePlayerFromRoom(socket.id, roomId);
        } else {
          // Mark player as disconnected (keep in room)
          player.disconnected = true;
          player.id = `__disconnected__${player.nickname}`;

          // Notify the opponent
          const opponent = room.players.find(p => p.nickname !== player.nickname);
          if (opponent && opponent.id && !opponent.id.startsWith('__disconnected__')) {
            io.to(opponent.id).emit('opponent-reconnecting', {
              secondsLeft: 20,
              rejoinsLeft: 2 - rejoinsUsed, // remaining after this one
            });
          }

          const nickname = player.nickname; // capture for closure
          const timeout = setTimeout(() => {
            console.log(`Reconnect timer expired for ${nickname}`);
            delete reconnectTimers[nickname];
            removePlayerByNickname(nickname, roomId);
          }, 20000);

          // Cancel previous timer if any (edge case: rapid reconnects)
          if (prior) clearTimeout(prior.timeout);

          reconnectTimers[nickname] = { timeout, roomId, socketId: socket.id, rejoinsUsed: rejoinsUsed + 1 };
        }
      } else {
        // Waiting room — immediate cleanup
        removePlayerFromRoom(socket.id, roomId);
      }
      break;
    }
  });

  socket.on('check-game-state', ({ roomId, nickname }) => {
    const room = rooms[roomId];

    // Room is gone (game ended while we were away) — tell client to go to lobby
    if (!room) {
      socket.emit('room-gone');
      return;
    }

    const playerIndex = room.players.findIndex(p => p.nickname === nickname);
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
      const opponent = room.players.find(p => p.nickname !== nickname);
      if (opponent && opponent.id && !opponent.id.startsWith('__disconnected__')) {
        io.to(opponent.id).emit('opponent-reconnected', { nickname });
      }

      socket.emit('game-start', room);
      // Let the client update the base variables, then immediately overwrite with correct authoritative state
      syncGameState(roomId);
    } else {
      // Still waiting for opponent — put them back in the waiting room
      socket.emit('waiting-room-restore', { roomId });
    }
  });
});

// ── Room teardown helper (by socket id) ─────────────────────────────────────
function removePlayerFromRoom(socketId, roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const wasGame = room.players.length === 2;
  const loser = room.players.find(p => p.id === socketId);
  const winner = room.players.find(p => p.id !== socketId);

  room.players = room.players.filter(p => p.id !== socketId);

  if (room.players.length === 0 || wasGame) {
    delete rooms[roomId];

    if (wasGame && loser && winner) {
      io.to(winner.id).emit('game-over', { outcome: 'win', opponentNickname: loser.nickname });
      io.to(loser.id).emit('game-over', { outcome: 'loss', opponentNickname: winner.nickname });
      recordResult(winner, loser);
    }
  }

  io.emit('rooms-update', getPublicRooms());
}

// ── Room teardown helper (by nickname — used when timer fires) ───────────────
function removePlayerByNickname(nickname, roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const wasGame = room.players.length === 2;
  const loser = room.players.find(p => p.nickname === nickname);
  const winner = room.players.find(p => p.nickname !== nickname);

  if (!loser) return;

  room.players = room.players.filter(p => p.nickname !== nickname);

  if (wasGame) {
    delete rooms[roomId];
    if (winner && winner.id && !winner.id.startsWith('__disconnected__')) {
      io.to(winner.id).emit('game-over', { outcome: 'win', opponentNickname: loser.nickname });
    }
    // Disconnected player has no live socket — nothing to emit to them
    recordResult(winner, loser);
  }

  io.emit('rooms-update', getPublicRooms());
}

// ── Card dealing & Game Init ──────────────────────────────────────────────────
const HAND_SIZE = 5;

async function drawCard(heroId, currentHand = []) {
  if (!heroId) return null;
  const [rows] = await db.query(
    'SELECT card_id AS baseId, name, category, cost, attack, defense, description FROM Cards WHERE hero_id = ?',
    [heroId]
  );
  if (rows.length === 0) return null;

  // Limit to max 2 copies of any given card in hand
  const counts = {};
  for (const c of currentHand) {
    counts[c.baseId] = (counts[c.baseId] || 0) + 1;
  }
  const allowedCards = rows.filter(r => (counts[r.baseId] || 0) < 2);
  
  if (allowedCards.length === 0) return null;

  // Weighted random: lower cost cards have higher probability
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

  // Attach a unique instance ID so multiple copies of the same card can be tracked
  return { ...card, uid: crypto.randomUUID() };
}

async function dealCards(room) {
  // Set starting state
  room.currentTurn = room.players[0].id;
  room.turnsPassed = 0;
  room.roundCount = 1;

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

  // Sync full initial state to everyone
  syncGameState(room.id);
}

function checkWinCondition(room) {
  if (!room || room.players.length !== 2) return;
  const p1 = room.players[0];
  const p2 = room.players[1];

  if (p1.hp <= 0 && p2.hp <= 0) {
    io.to(room.id).emit('game-over', { outcome: 'draw' });
    recordDraw(p1, p2);
    delete rooms[room.id];
    io.emit('rooms-update', getPublicRooms());
  } else if (p1.hp <= 0 || p2.hp <= 0) {
    const winner = p1.hp > 0 ? p1 : p2;
    const loser = p1.hp <= 0 ? p1 : p2;

    io.to(room.id).emit('game-over', { outcome: 'win', opponentNickname: loser.nickname, winnerNickname: winner.nickname });
    recordResult(winner, loser);
    delete rooms[room.id];
    io.emit('rooms-update', getPublicRooms());
  }
}

// ── Stats persistence ───────────────────────────────────────────────────────
async function recordResult(winner, loser) {
  try {
    const winnerNick = winner.nickname;
    const loserNick = loser.nickname;

    await db.query(`
      UPDATE Player
      SET wins = wins + 1,
          games_played = games_played + 1,
          winstreak = winstreak + 1
      WHERE nickname = ?
    `, [winnerNick]);

    await db.query(`
      UPDATE Player
      SET loses = loses + 1,
          games_played = games_played + 1,
          winstreak = 0
      WHERE nickname = ?
    `, [loserNick]);

    const updateHeroStats = async (p, isWin, isDraw) => {
      const [rows] = await db.query(`SELECT player_id FROM Player WHERE nickname = ?`, [p.nickname]);
      if (rows.length === 0) return;
      const pid = rows[0].player_id;
      
      const winAdd = isWin && !isDraw ? 1 : 0;
      const lossAdd = !isWin && !isDraw ? 1 : 0;
      const drawAdd = isDraw ? 1 : 0;

      await db.query(`
        INSERT INTO PlayerHeroStats (player_id, hero_id, games_played, wins, loses, draws, dmg_defended, dmg_dealt, cards_played)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          games_played = games_played + 1,
          wins = wins + VALUES(wins),
          loses = loses + VALUES(loses),
          draws = draws + VALUES(draws),
          dmg_defended = dmg_defended + VALUES(dmg_defended),
          dmg_dealt = dmg_dealt + VALUES(dmg_dealt),
          cards_played = cards_played + VALUES(cards_played)
      `, [pid, p.heroId, winAdd, lossAdd, drawAdd, p.stats.dmgDefended, p.stats.dmgDealt, p.stats.cardsPlayed]);
    };

    await updateHeroStats(winner, true, false);
    await updateHeroStats(loser, false, false);

    console.log(`Stats recorded: ${winnerNick} beat ${loserNick}`);
  } catch (err) {
    console.error('Failed to record result:', err);
  }
}

async function recordDraw(p1, p2) {
  try {
    const p1Nick = p1.nickname;
    const p2Nick = p2.nickname;

    const query = `
      UPDATE Player
      SET draws = draws + 1,
          games_played = games_played + 1,
          winstreak = 0
      WHERE nickname IN (?, ?)
    `;
    await db.query(query, [p1Nick, p2Nick]);

    const updateHeroStats = async (p) => {
      const [rows] = await db.query(`SELECT player_id FROM Player WHERE nickname = ?`, [p.nickname]);
      if (rows.length === 0) return;
      const pid = rows[0].player_id;
      
      await db.query(`
        INSERT INTO PlayerHeroStats (player_id, hero_id, games_played, wins, loses, draws, dmg_defended, dmg_dealt, cards_played)
        VALUES (?, ?, 1, 0, 0, 1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          games_played = games_played + 1,
          draws = draws + VALUES(draws),
          dmg_defended = dmg_defended + VALUES(dmg_defended),
          dmg_dealt = dmg_dealt + VALUES(dmg_dealt),
          cards_played = cards_played + VALUES(cards_played)
      `, [pid, p.heroId, p.stats.dmgDefended, p.stats.dmgDealt, p.stats.cardsPlayed]);
    };

    await updateHeroStats(p1);
    await updateHeroStats(p2);

    console.log(`Stats recorded: Draw between ${p1Nick} and ${p2Nick}`);
  } catch (err) {
    console.error('Failed to record draw:', err);
  }
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
