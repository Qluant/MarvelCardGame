const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

const router = express.Router();

const AuthConfig = {
  saltRounds: 10,
  jwtSecret: process.env.JWT_SECRET,
  tokenExpiresIn: '24h'
};

if (!AuthConfig.jwtSecret) {
  throw new Error('JWT_SECRET is not defined in .env!');
}

const DBAdapter = {
  async findByUsername(username) {
    const [rows] = await db.query('SELECT * FROM Player WHERE nickname = ?', [username]);
    return rows[0];
  },
  
  async create(username, passwordHash) {
    const [result] = await db.query(
      'INSERT INTO Player (avatar, nickname, password, games_played, wins, loses, winstreak) VALUES (NULL, ?, ?, 0, 0, 0, 0)',
      [username, passwordHash]
    );
    return { id: result.insertId, nickname: username };
  }
};

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await DBAdapter.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, AuthConfig.saltRounds);
    const newUser = await DBAdapter.create(username, passwordHash);

    res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await DBAdapter.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.player_id || user.id, username: user.nickname },
      AuthConfig.jwtSecret,
      { expiresIn: AuthConfig.tokenExpiresIn }
    );

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
