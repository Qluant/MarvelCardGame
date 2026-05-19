const express = require('express');
const path    = require('path');
const config  = require('./config');

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  config.clientOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/cards',   require('./routes/cards'));
app.use('/api/players', require('./routes/players'));
app.use('/api/info',    require('./routes/info'));

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(require('./middleware/errorHandler'));

module.exports = app;
