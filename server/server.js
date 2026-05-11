require('dotenv').config();
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

const getPublicRooms = () => {
  return Object.values(rooms).filter(r => r.players.length < 2 && !r.isPrivate).map(r => ({ id: r.id, name: r.name, isPrivate: false }));
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
      players: [ { id: socket.id, nickname: roomData.nickname, heroId: roomData.heroId } ],
    };
    rooms[roomId] = newRoom;
    socket.join(roomId);
    
    io.emit('rooms-update', getPublicRooms());
    socket.emit('room-created', newRoom);
  });

  socket.on('join-room', (joinData) => {
    const { roomId, password, nickname, heroId } = joinData;
    const room = rooms[roomId];
    
    if (!room) return socket.emit('error', 'Room not found');
    if (room.players.length >= 2) return socket.emit('error', 'Room is full');
    if (room.isPrivate && room.password !== password) return socket.emit('error', 'Invalid password');
    if (room.players.find(p => p.nickname === nickname)) return socket.emit('error', 'You are already in this room');

    room.players.push({ id: socket.id, nickname, heroId });
    socket.join(roomId);
    
    io.emit('rooms-update', getPublicRooms());
    io.to(roomId).emit('game-start', room);

    // Deal cards to each player from their chosen hero's deck
    dealCards(room);
  });

  socket.on('make-move', (moveData) => {
    io.to(moveData.roomId).emit('move-made', {
      playerId: socket.id,
      move: moveData.move,
      passTurn: !!moveData.passTurn,
      timestamp: new Date(),
    });
  });

  socket.on('get-rooms', () => {
    socket.emit('rooms-update', getPublicRooms());
  });

  socket.on('check-game-state', ({ roomId, nickname }) => {
    const room = rooms[roomId];
    if (room) {
      const playerIndex = room.players.findIndex(p => p.nickname === nickname);
      if (playerIndex !== -1) {
        room.players[playerIndex].id = socket.id;
        socket.join(roomId);
        if (room.players.length === 2) {
          socket.emit('game-start', room);
        }
      }
    }
  });

  socket.on('leave-room', (roomId) => {
    removePlayerFromRoom(socket.id, roomId);
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      if (rooms[roomId].players.find(p => p.id === socket.id)) {
        removePlayerFromRoom(socket.id, roomId);
        break; // a socket can only be in one room
      }
    }
  });
});

// ── Room teardown helper ────────────────────────────────────────────────────
function removePlayerFromRoom(socketId, roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const wasGame = room.players.length === 2; // game was in progress
  const loser   = room.players.find(p => p.id === socketId);
  const winner  = room.players.find(p => p.id !== socketId);

  room.players = room.players.filter(p => p.id !== socketId);

  if (room.players.length === 0 || wasGame) {
    delete rooms[roomId];

    if (wasGame && loser && winner) {
      // Notify each player individually with their outcome
      io.to(winner.id).emit('game-over', { outcome: 'win',  opponentNickname: loser.nickname  });
      io.to(loser.id).emit('game-over',  { outcome: 'loss', opponentNickname: winner.nickname });

      // Persist stats to DB
      recordResult(winner.nickname, loser.nickname);
    }
  }
  // If the creator is still alone in a waiting room — room stays open

  io.emit('rooms-update', getPublicRooms());
}

// ── Card dealing ─────────────────────────────────────────────────────────────
const HAND_SIZE = 5;

async function dealCards(room) {
  for (const player of room.players) {
    try {
      const heroId = player.heroId;
      if (!heroId) {
        // No hero selected — send empty hand, client will handle it
        io.to(player.id).emit('deal-hand', []);
        continue;
      }

      const [rows] = await db.query(
        'SELECT card_id AS id, name, category, cost, attack, defense, description FROM Cards WHERE hero_id = ?',
        [heroId]
      );

      // Fisher-Yates shuffle
      const shuffled = [...rows];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const hand = shuffled.slice(0, HAND_SIZE);
      io.to(player.id).emit('deal-hand', hand);
    } catch (err) {
      console.error(`Failed to deal cards to ${player.nickname}:`, err);
      io.to(player.id).emit('deal-hand', []);
    }
  }
}

// ── Stats persistence ───────────────────────────────────────────────────────
async function recordResult(winnerNick, loserNick) {
  try {
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

    console.log(`Stats recorded: ${winnerNick} beat ${loserNick}`);
  } catch (err) {
    console.error('Failed to record result:', err);
  }
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
