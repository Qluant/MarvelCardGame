// AppState singleton — replaces 20+ scattered `let` variables from old app.js.
// Loaded first. All other modules read/write via AppState.*.
const AppState = {
  // User session
  currentUser: null,     // { nickname, heroId, avatar, confirm_end_turn, confirm_resign }
  inRoom: false,         // true when in waiting or active game (blocks accidental navigation)

  // Socket
  socket: null,

  // Room / game
  currentRoomId: null,
  gameStarted: false,
  isMyTurn: false,
  initialCoinTossDone: false,
  currentRoundCount: 1,

  // Player state (authoritative from server)
  playerHeroId: null,
  playerHand: [],
  playerActiveCards: [],
  playerStagedCards: [],
  playerHP: 30,
  playerAP: 6,
  playerMaxAP: 15,

  // Enemy state
  enemyHeroId: null,
  enemyActiveCards: [],
  enemyHandCount: 0,
  enemyStagedCount: 0,
  enemyHP: 30,
  enemyAP: 6,
  enemyMaxAP: 15,

  // Constants
  AP_CAP: 15,

  // Timer
  gameTimerInterval: null,
  gameTimeLeft: 60,

  // UI
  currentCardInfoModal: null,
  waitingTipsList: [],
};
