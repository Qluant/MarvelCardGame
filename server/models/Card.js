/**
 * models/Card.js
 * Data access layer for the Cards table.
 * Only SQL — no HTTP, no socket, no validation.
 */

const db = require('../db/connection');

const Card = {
  /**
   * Get all cards with their hero alias (for the /api/cards endpoint).
   * @returns {Promise<Object[]>} [{ card_id, name, category, attack, defense, cost, description, hero_alias }]
   */
  async getAll() {
    const [rows] = await db.query(
      `SELECT c.card_id, c.name, c.category, c.attack, c.defense, c.cost, c.description,
              h.alias AS hero_alias
       FROM Cards c
       JOIN Heroes h ON c.hero_id = h.hero_id`
    );
    return rows;
  },

  /**
   * Get all cards that belong to a specific hero.
   * Used by gameEngine.drawCard().
   * @param {number} heroId
   * @returns {Promise<Object[]>} [{ card_id, name, category, attack, defense, cost, description }]
   */
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
