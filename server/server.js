/**
 * server.js — Entry point.
 * Creates the HTTP server, initializes Socket.IO, starts listening.
 * No business logic, no routes, no middleware — all in app.js and socket/.
 */

const http = require('http');
const app = require('./app');
const config = require('./config');

const server = http.createServer(app);

require('./socket')(server);

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log('WebSocket server ready for connections');
});
