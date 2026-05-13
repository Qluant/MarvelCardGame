const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET /api/players/top
// Fetches top 10 players by wins
router.get('/top', async (req, res) => {
  try {
    const query = `
      SELECT player_id, nickname, avatar, wins, loses, draws, winstreak 
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
    const [rows] = await db.query(
      'SELECT player_id, nickname, avatar, wins, loses, draws, winstreak, games_played, selected_hero_id, confirm_end_turn, confirm_resign FROM Player WHERE nickname = ?',
      [req.params.nickname]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching player profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/players/:nickname/hero
// Persists the selected hero for the player
router.put('/:nickname/hero', async (req, res) => {
  try {
    const { heroId } = req.body;
    if (!heroId) return res.status(400).json({ error: 'heroId is required' });

    const [result] = await db.query(
      'UPDATE Player SET selected_hero_id = ? WHERE nickname = ?',
      [heroId, req.params.nickname]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Player not found' });

    res.json({ message: 'Hero selected', heroId });
  } catch (error) {
    console.error('Error saving hero selection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// PUT /api/players/:nickname/settings
// Update user avatar and confirmation settings
router.put('/:nickname/settings', async (req, res) => {
  try {
    const { avatar, confirm_end_turn, confirm_resign } = req.body;
    
    // Simple validation
    if (confirm_end_turn === undefined || confirm_resign === undefined) {
      return res.status(400).json({ error: 'Missing setting fields' });
    }

    const [result] = await db.query(
      'UPDATE Player SET avatar = ?, confirm_end_turn = ?, confirm_resign = ? WHERE nickname = ?',
      [avatar || null, confirm_end_turn ? 1 : 0, confirm_resign ? 1 : 0, req.params.nickname]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
