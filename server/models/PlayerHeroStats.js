/**
 * models/PlayerHeroStats.js
 * Data access layer for the PlayerHeroStats table.
 * Only SQL — no HTTP, no socket, no validation.
 */

const db = require('../db/connection');

const PlayerHeroStats = {
  /**
   * Insert or update per-hero stats for a player.
   * Uses INSERT ... ON DUPLICATE KEY UPDATE — single DB call for both cases.
   *
   * @param {number} playerId
   * @param {number} heroId
   * @param {{ won: boolean, lost: boolean, drew: boolean, dmgDealt: number, dmgDefended: number, cardsPlayed: number }} data
   * @returns {Promise<void>}
   */
  async upsertResult(playerId, heroId, { won, lost, drew, dmgDealt, dmgDefended, cardsPlayed }) {
    const winAdd  = won  ? 1 : 0;
    const lossAdd = lost ? 1 : 0;
    const drawAdd = drew ? 1 : 0;

    await db.query(
      `INSERT INTO PlayerHeroStats
         (player_id, hero_id, games_played, wins, loses, draws, dmg_dealt, dmg_defended, cards_played)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         games_played  = games_played  + 1,
         wins          = wins          + VALUES(wins),
         loses         = loses         + VALUES(loses),
         draws         = draws         + VALUES(draws),
         dmg_dealt     = dmg_dealt     + VALUES(dmg_dealt),
         dmg_defended  = dmg_defended  + VALUES(dmg_defended),
         cards_played  = cards_played  + VALUES(cards_played)`,
      [playerId, heroId, winAdd, lossAdd, drawAdd, dmgDealt, dmgDefended, cardsPlayed]
    );
  },

  /**
   * Get all hero stats for a given player, joined with hero alias.
   * @param {number} playerId
   * @returns {Promise<Object[]>} [{ player_id, hero_id, alias, wins, loses, draws, ... }]
   */
  async getByPlayer(playerId) {
    const [rows] = await db.query(
      `SELECT phs.*, h.alias
       FROM PlayerHeroStats phs
       JOIN Heroes h ON phs.hero_id = h.hero_id
       WHERE phs.player_id = ?`,
      [playerId]
    );
    return rows;
  },
};

module.exports = PlayerHeroStats;
