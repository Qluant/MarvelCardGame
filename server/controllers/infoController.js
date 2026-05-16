/**
 * controllers/infoController.js
 * Handles the heroes info endpoint (heroes + their cards).
 * No SQL here — only model calls.
 */

const Hero = require('../models/Hero');

const infoController = {
  /**
   * GET /api/info/heroes
   * Auth required.
   */
  async getHeroes(req, res, next) {
    const heroes = await Hero.getAllWithCards();
    res.json(heroes);
  },
};

module.exports = infoController;
