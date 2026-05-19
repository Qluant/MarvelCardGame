const Hero = require('../models/Hero');

const infoController = {
  async getHeroes(req, res, next) {
    const heroes = await Hero.getAllWithCards();
    res.json(heroes);
  },
};

module.exports = infoController;
