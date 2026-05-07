const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// GET /api/cards
// Fetches all cards with their corresponding hero_alias
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT c.card_id, c.name AS card_name, c.category, c.attack, c.defense, c.cost, c.description, h.alias AS hero_alias
      FROM Cards c
      JOIN Heroes h ON c.hero_id = h.hero_id
    `;
    const [rows] = await pool.execute(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Internal server error while fetching cards.' });
  }
});

module.exports = router;
