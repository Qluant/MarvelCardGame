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
    origin: 'http://localhost:3000',
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
      players: [ { id: socket.id, nickname: roomData.nickname } ],
    };
    rooms[roomId] = newRoom;
    socket.join(roomId);
    
    io.emit('rooms-update', getPublicRooms());
    socket.emit('room-created', newRoom);
  });

  socket.on('join-room', (joinData) => {
    const { roomId, password, nickname } = joinData;
    const room = rooms[roomId];
    
    if (!room) return socket.emit('error', 'Room not found');
    if (room.players.length >= 2) return socket.emit('error', 'Room is full');
    if (room.isPrivate && room.password !== password) return socket.emit('error', 'Invalid password');

    room.players.push({ id: socket.id, nickname });
    socket.join(roomId);
    
    io.emit('rooms-update', getPublicRooms());
    io.to(roomId).emit('game-start', room);
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
    socket.leave(roomId);
    if (rooms[roomId]) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      if (rooms[roomId].players.length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('player-left', { playerId: socket.id });
      }
    }
    io.emit('rooms-update', getPublicRooms());
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
