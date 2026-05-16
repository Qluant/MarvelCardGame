/**
 * socket/statsHandlers.js
 * Persistence of game results. Called from gameEngine after game-over.
 * Uses Player and PlayerHeroStats models — no direct db.query() here.
 * Not a socket handler — no socket.on(). Pure async functions.
 */

const Player = require('../models/Player');
const PlayerHeroStats = require('../models/PlayerHeroStats');

/**
 * Record a win/loss result for two players.
 * @param {{ nickname, heroId, stats: { dmgDealt, dmgDefended, cardsPlayed } }} winner
 * @param {{ nickname, heroId, stats: { dmgDealt, dmgDefended, cardsPlayed } }} loser
 */
async function recordResult(winner, loser) {
  try {
    await Player.recordWin(winner.nickname);
    await Player.recordLoss(loser.nickname);

    const [winnerRow, loserRow] = await Promise.all([
      Player.findByNickname(winner.nickname),
      Player.findByNickname(loser.nickname),
    ]);

    if (winnerRow) {
      await PlayerHeroStats.upsertResult(winnerRow.player_id, winner.heroId, {
        won: true, lost: false, drew: false,
        dmgDealt: winner.stats.dmgDealt,
        dmgDefended: winner.stats.dmgDefended,
        cardsPlayed: winner.stats.cardsPlayed,
      });
    }

    if (loserRow) {
      await PlayerHeroStats.upsertResult(loserRow.player_id, loser.heroId, {
        won: false, lost: true, drew: false,
        dmgDealt: loser.stats.dmgDealt,
        dmgDefended: loser.stats.dmgDefended,
        cardsPlayed: loser.stats.cardsPlayed,
      });
    }

    console.log(`Stats recorded: ${winner.nickname} beat ${loser.nickname}`);
  } catch (err) {
    console.error('Failed to record result:', err);
  }
}

/**
 * Record a draw result for two players.
 * @param {{ nickname, heroId, stats: { dmgDealt, dmgDefended, cardsPlayed } }} p1
 * @param {{ nickname, heroId, stats: { dmgDealt, dmgDefended, cardsPlayed } }} p2
 */
async function recordDraw(p1, p2) {
  try {
    await Promise.all([
      Player.recordDraw(p1.nickname),
      Player.recordDraw(p2.nickname),
    ]);

    const [p1Row, p2Row] = await Promise.all([
      Player.findByNickname(p1.nickname),
      Player.findByNickname(p2.nickname),
    ]);

    if (p1Row) {
      await PlayerHeroStats.upsertResult(p1Row.player_id, p1.heroId, {
        won: false, lost: false, drew: true,
        dmgDealt: p1.stats.dmgDealt,
        dmgDefended: p1.stats.dmgDefended,
        cardsPlayed: p1.stats.cardsPlayed,
      });
    }

    if (p2Row) {
      await PlayerHeroStats.upsertResult(p2Row.player_id, p2.heroId, {
        won: false, lost: false, drew: true,
        dmgDealt: p2.stats.dmgDealt,
        dmgDefended: p2.stats.dmgDefended,
        cardsPlayed: p2.stats.cardsPlayed,
      });
    }

    console.log(`Stats recorded: Draw between ${p1.nickname} and ${p2.nickname}`);
  } catch (err) {
    console.error('Failed to record draw:', err);
  }
}

module.exports = { recordResult, recordDraw };
