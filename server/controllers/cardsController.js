const Card = require('../models/Card');

const cardsController = {
  async getAll(req, res, next) {
    const cards = await Card.getAll();
    res.json(cards);
  },
};

module.exports = cardsController;
