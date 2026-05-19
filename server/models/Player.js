const db = require('../db/connection');

const Player = {
  async findByNickname(nickname) {
    const [rows] = await db.query(
      'SELECT * FROM Player WHERE nickname = ? LIMIT 1',
      [nickname]
    );
    return rows[0] || null;
  },

  async create({ nickname, passwordHash }) {
    const [result] = await db.query(
      'INSERT INTO Player (nickname, password) VALUES (?, ?)',
      [nickname, passwordHash]
    );
    return { insertId: result.insertId };
  },

  async getProfile(nickname) {
    const [rows] = await db.query(
      `SELECT player_id, nickname, avatar, wins, loses, draws, winstreak,
              games_played, selected_hero_id, confirm_end_turn, confirm_resign
       FROM Player
       WHERE nickname = ?
       LIMIT 1`,
      [nickname]
    );
    if (rows.length === 0) return null;

    const player = rows[0];
    const [heroStats] = await db.query(
      `SELECT hs.*, h.alias
       FROM PlayerHeroStats hs
       JOIN Heroes h ON hs.hero_id = h.hero_id
       WHERE hs.player_id = ?`,
      [player.player_id]
    );
    player.heroStats = heroStats;
    return player;
  },

  async getTopPlayers(limit = 10) {
    const [rows] = await db.query(
      `SELECT player_id, nickname, avatar, wins, loses, draws, winstreak
       FROM Player
       ORDER BY wins DESC, winstreak DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  },
  async updateHero(nickname, heroId) {
    const [result] = await db.query(
      'UPDATE Player SET selected_hero_id = ? WHERE nickname = ?',
      [heroId, nickname]
    );
    return { affectedRows: result.affectedRows };
  },

  async updateSettings(nickname, { avatar, confirm_end_turn, confirm_resign }) {
    const [result] = await db.query(
      `UPDATE Player
       SET avatar = ?, confirm_end_turn = ?, confirm_resign = ?
       WHERE nickname = ?`,
      [avatar || null, confirm_end_turn ? 1 : 0, confirm_resign ? 1 : 0, nickname]
    );
    return { affectedRows: result.affectedRows };
  },

  async recordWin(nickname) {
    await db.query(
      `UPDATE Player
       SET wins = wins + 1, winstreak = winstreak + 1, games_played = games_played + 1
       WHERE nickname = ?`,
      [nickname]
    );
  },
  async recordLoss(nickname) {
    await db.query(
      `UPDATE Player
       SET loses = loses + 1, winstreak = 0, games_played = games_played + 1
       WHERE nickname = ?`,
      [nickname]
    );
  },

  async recordDraw(nickname) {
    await db.query(
      `UPDATE Player
       SET draws = draws + 1, winstreak = 0, games_played = games_played + 1
       WHERE nickname = ?`,
      [nickname]
    );
  },
};

module.exports = Player;
