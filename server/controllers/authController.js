const { hashPassword, verifyPassword, signJwt } = require('../utils/cryptoHelper');
const config = require('../config');
const Player = require('../models/Player');
const { validateNickname, validatePassword } = require('../utils/validate');

const authController = {
  async register(req, res, next) {
    const { username, password } = req.body;

    const nickCheck = validateNickname(username);
    if (!nickCheck.valid) {
      return res.status(400).json({ error: nickCheck.message });
    }

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return res.status(400).json({ error: passCheck.message });
    }

    const existing = await Player.findByNickname(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await hashPassword(password);
    const { insertId } = await Player.create({ nickname: username, passwordHash });

    res.status(201).json({ message: 'User registered successfully', userId: insertId });
  },

  async login(req, res, next) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // same 401 for "not found" and "wrong password"
    const user = await Player.findByNickname(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signJwt(
      { userId: user.player_id, username: user.nickname },
      config.jwt.secret
    );

    res.json({ message: 'Login successful', token });
  },
};

module.exports = authController;
