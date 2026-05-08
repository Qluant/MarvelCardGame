import { io } from 'socket.io-client';

// Connect to backend WebSocket server
const SOCKET_URL = 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false, // We'll connect manually when needed
});
