const db = require('../db/connection');

const Card = {
  async getAll() {
    const [rows] = await db.query(
      `SELECT c.card_id, c.name, c.category, c.attack, c.defense, c.cost, c.description,
              h.alias AS hero_alias
       FROM Cards c
       JOIN Heroes h ON c.hero_id = h.hero_id`
    );
    return rows;
  },

  async getByHeroId(heroId) {
    const [rows] = await db.query(
      `SELECT card_id AS baseId, name, category, cost, attack, defense, description
       FROM Cards
       WHERE hero_id = ?`,
      [heroId]
    );
    return rows;
  },
};

module.exports = Card;
