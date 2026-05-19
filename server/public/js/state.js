const AppState = {
  currentUser: null,     
  inRoom: false,         

  socket: null,

  currentRoomId: null,
  gameStarted: false,
  isMyTurn: false,
  initialCoinTossDone: false,
  currentRoundCount: 1,

  playerHeroId: null,
  playerHand: [],
  playerActiveCards: [],
  playerStagedCards: [],
  playerHP: 30,
  playerAP: 6,
  playerMaxAP: 15,

  enemyHeroId: null,
  enemyActiveCards: [],
  enemyHandCount: 0,
  enemyStagedCount: 0,
  enemyHP: 30,
  enemyAP: 6,
  enemyMaxAP: 15,

  AP_CAP: 15,

  gameTimerInterval: null,
  gameTimeLeft: 60,

  currentCardInfoModal: null,
  waitingTipsList: [],
};
