const Player = require('../models/Player');
const { validateHeroId, validateUrl } = require('../utils/validate');

const playersController = {
  async getTop(req, res, next) {
    const players = await Player.getTopPlayers(10);
    res.json(players);
  },

  async getProfile(req, res, next) {
    const player = await Player.getProfile(req.params.nickname);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
  },

  async updateHero(req, res, next) {
    // only the authenticated user can change their own hero
    if (req.user.username !== req.params.nickname) {
      return res.status(403).json({ error: "Forbidden: cannot modify another player's data" });
    }

    const { heroId } = req.body;
    const check = validateHeroId(heroId);
    if (!check.valid) {
      return res.status(400).json({ error: check.message });
    }

    const { affectedRows } = await Player.updateHero(req.params.nickname, Number(heroId));
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Hero selected', heroId: Number(heroId) });
  },

  async updateSettings(req, res, next) {
    if (req.user.username !== req.params.nickname) {
      return res.status(403).json({ error: "Forbidden: cannot modify another player's data" });
    }

    const { avatar, confirm_end_turn, confirm_resign } = req.body;

    const urlCheck = validateUrl(avatar);
    if (!urlCheck.valid) {
      return res.status(400).json({ error: urlCheck.message });
    }

    if (confirm_end_turn === undefined || confirm_resign === undefined) {
      return res.status(400).json({ error: 'Missing setting fields' });
    }

    const { affectedRows } = await Player.updateSettings(req.params.nickname, {
      avatar,
      confirm_end_turn,
      confirm_resign,
    });
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Settings updated successfully' });
  },
};

module.exports = playersController;
