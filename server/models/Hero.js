const db = require('../db/connection');

const Hero = {
  async getAll() {
    const [rows] = await db.query('SELECT * FROM Heroes');
    return rows;
  },

  async getAllWithCards() {
    const [rows] = await db.query(
      `SELECT h.hero_id, h.alias, h.avatar, h.special_ability,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'card_id',    c.card_id,
                  'name',       c.name,
                  'category',   c.category,
                  'attack',     c.attack,
                  'defense',    c.defense,
                  'cost',       c.cost,
                  'description', c.description
                )
              ) AS cards
       FROM Heroes h
       LEFT JOIN Cards c ON h.hero_id = c.hero_id
       GROUP BY h.hero_id`
    );

    return rows.map((row) => {
      let cards = row.cards;
      if (typeof cards === 'string') {
        try {
          cards = JSON.parse(cards);
        } catch {
          cards = [];
        }
      }
      return { ...row, cards: cards || [] };
    });
  },
};

module.exports = Hero;
