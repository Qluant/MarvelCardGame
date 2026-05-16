/**
 * app.js
 * Express application factory.
 * Configures middleware, mounts all HTTP routes, registers error handler.
 *
 * Does NOT call server.listen() — that is server.js's responsibility.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: config.clientOrigin,
  methods: ['GET', 'POST', 'PUT'],
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/cards',   require('./routes/cards'));
app.use('/api/players', require('./routes/players'));
app.use('/api/info',    require('./routes/info'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// ── Centralized error handler (must be LAST) ──────────────────────────────────
app.use(require('./middleware/errorHandler'));

module.exports = app;
