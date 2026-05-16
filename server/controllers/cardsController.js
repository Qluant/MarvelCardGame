/**
 * controllers/cardsController.js
 * Handles the cards listing endpoint.
 * No SQL here — only model calls.
 */

const Card = require('../models/Card');

const cardsController = {
  /**
   * GET /api/cards
   * Auth required.
   */
  async getAll(req, res, next) {
    const cards = await Card.getAll();
    res.json(cards);
  },
};

module.exports = cardsController;
