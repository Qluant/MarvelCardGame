require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const db = require('./db/connection');
const cardsRouter = require('./routes/cards');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/cards', cardsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on('join-game', (gameData) => {
    console.log(`Player joining game:`, gameData);
    socket.join(`game-${gameData.gameId}`);
    io.to(`game-${gameData.gameId}`).emit('player-joined', {
      playerId: socket.id,
      playerName: gameData.playerName,
    });
  });

  socket.on('make-move', (moveData) => {
    const gameId = moveData.gameId;
    io.to(`game-${gameId}`).emit('move-made', {
      playerId: socket.id,
      move: moveData.move,
      timestamp: new Date(),
    });
  });

  socket.on('leave-game', (gameData) => {
    socket.leave(`game-${gameData.gameId}`);
    io.to(`game-${gameData.gameId}`).emit('player-left', {
      playerId: socket.id,
    });
    console.log(`Player left game: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
