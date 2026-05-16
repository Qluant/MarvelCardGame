/**
 * controllers/playersController.js
 * Handles player profile, hero selection, and settings.
 * Validates input → ownership check → calls Player model → returns HTTP response.
 * No SQL here — only model calls.
 */

const Player = require('../models/Player');
const { validateHeroId, validateUrl } = require('../utils/validate');

const playersController = {
  /**
   * GET /api/players/top
   * Public — no auth required.
   */
  async getTop(req, res, next) {
    const players = await Player.getTopPlayers(10);
    res.json(players);
  },

  /**
   * GET /api/players/:nickname
   * Public — no auth required.
   */
  async getProfile(req, res, next) {
    const player = await Player.getProfile(req.params.nickname);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
  },

  /**
   * PUT /api/players/:nickname/hero
   * Auth required. Ownership required.
   * Body: { heroId }
   */
  async updateHero(req, res, next) {
    // 1. Ownership: only the authenticated user can change their own hero
    if (req.user.username !== req.params.nickname) {
      return res.status(403).json({ error: "Forbidden: cannot modify another player's data" });
    }

    // 2. Validate heroId
    const { heroId } = req.body;
    const check = validateHeroId(heroId);
    if (!check.valid) {
      return res.status(400).json({ error: check.message });
    }

    // 3. Update in DB
    const { affectedRows } = await Player.updateHero(req.params.nickname, Number(heroId));
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Hero selected', heroId: Number(heroId) });
  },

  /**
   * PUT /api/players/:nickname/settings
   * Auth required. Ownership required.
   * Body: { avatar, confirm_end_turn, confirm_resign }
   */
  async updateSettings(req, res, next) {
    // 1. Ownership
    if (req.user.username !== req.params.nickname) {
      return res.status(403).json({ error: "Forbidden: cannot modify another player's data" });
    }

    const { avatar, confirm_end_turn, confirm_resign } = req.body;

    // 2. Validate avatar URL (null/empty is allowed — clears avatar)
    const urlCheck = validateUrl(avatar);
    if (!urlCheck.valid) {
      return res.status(400).json({ error: urlCheck.message });
    }

    // 3. Validate boolean flags presence
    if (confirm_end_turn === undefined || confirm_resign === undefined) {
      return res.status(400).json({ error: 'Missing setting fields' });
    }

    // 4. Update in DB
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
