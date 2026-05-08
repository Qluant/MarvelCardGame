const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET /api/players/top
// Fetches top 10 players by wins
router.get('/top', async (req, res) => {
  try {
    const query = `
      SELECT player_id, nickname, wins, loses, winstreak 
      FROM Player 
      ORDER BY wins DESC, winstreak DESC 
      LIMIT 10
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching top players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/players/:nickname
router.get('/:nickname', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT player_id, nickname, wins, loses, winstreak, games_played FROM Player WHERE nickname = ?', [req.params.nickname]);
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching player profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
