/**
 * models/Hero.js
 * Data access layer for the Heroes table.
 * Only SQL — no HTTP, no socket, no validation.
 */

const db = require('../db/connection');

const Hero = {
  /**
   * Get all heroes (without cards).
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    const [rows] = await db.query('SELECT * FROM Heroes');
    return rows;
  },

  /**
   * Get all heroes with their associated cards as a nested array.
   * Uses JSON_ARRAYAGG — parses result if MySQL returns a string.
   * @returns {Promise<Object[]>} [{ hero_id, alias, special_ability, cards: [...] }]
   */
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

    // Some MySQL versions return JSON_ARRAYAGG result as a string
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
