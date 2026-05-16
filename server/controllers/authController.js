/**
 * controllers/authController.js
 * Handles registration and login.
 * Validates input → calls Player model → returns HTTP response.
 * No SQL here — only model calls.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Player = require('../models/Player');
const { validateNickname, validatePassword } = require('../utils/validate');

const SALT_ROUNDS = 10;

const authController = {
  /**
   * POST /api/auth/register
   * Body: { username, password }
   */
  async register(req, res, next) {
    const { username, password } = req.body;

    // 1. Validate nickname
    const nickCheck = validateNickname(username);
    if (!nickCheck.valid) {
      return res.status(400).json({ error: nickCheck.message });
    }

    // 2. Validate password
    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return res.status(400).json({ error: passCheck.message });
    }

    // 3. Check uniqueness
    const existing = await Player.findByNickname(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // 4. Hash password and create player
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { insertId } = await Player.create({ nickname: username, passwordHash });

    res.status(201).json({ message: 'User registered successfully', userId: insertId });
  },

  /**
   * POST /api/auth/login
   * Body: { username, password }
   */
  async login(req, res, next) {
    const { username, password } = req.body;

    // 1. Basic presence check (full validation would leak info via different 400 messages)
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // 2. Find player — same 401 for "not found" and "wrong password" (security: no enumeration)
    const user = await Player.findByNickname(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 4. Sign JWT
    const token = jwt.sign(
      { userId: user.player_id, username: user.nickname },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({ message: 'Login successful', token });
  },
};

module.exports = authController;
