const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET /api/info/heroes
// Returns all heroes and their associated cards
router.get('/heroes', async (req, res) => {
  try {
    const query = `
      SELECT h.hero_id, h.alias, h.special_ability,
             JSON_ARRAYAGG(JSON_OBJECT('name', c.name, 'category', c.category, 'attack', c.attack, 'defense', c.defense, 'cost', c.cost, 'description', c.description)) as cards
      FROM Heroes h
      LEFT JOIN Cards c ON h.hero_id = c.hero_id
      GROUP BY h.hero_id
    `;
    const [rows] = await db.query(query);
    
    // MySQL JSON_ARRAYAGG sometimes returns stringified JSON or an array containing a single null object if no join match.
    // Let's parse it safely just in case.
    const formattedRows = rows.map(row => {
        let parsedCards = row.cards;
        if (typeof row.cards === 'string') {
            try { parsedCards = JSON.parse(row.cards); } catch (e) { parsedCards = []; }
        }
        return {
            ...row,
            cards: parsedCards
        };
    });

    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
