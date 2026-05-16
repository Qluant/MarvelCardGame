// Waiting room view: enter game, waiting tips, exit room.

function enterGame(roomId) {
  AppState.currentRoomId = roomId;
  AppState.inRoom = true;
  localStorage.setItem('activeGame', JSON.stringify({ roomId, nickname: AppState.currentUser.nickname }));
  navigate('waiting');
  startWaitingTips();

  AppState.gameStarted = false;
  document.getElementById('enemy-nickname').innerText = 'Waiting...';
  document.getElementById('enemy-avatar').src = '/assets/images/default_avatar.png';
  document.getElementById('player-nickname').innerText = AppState.currentUser.nickname;
  document.getElementById('player-avatar').src = AppState.currentUser.avatar || '/assets/images/default_avatar.png';

  AppState.playerHand = [];
  AppState.playerActiveCards = [];
  AppState.enemyActiveCards = [];
  AppState.enemyHandCount = 0;
  AppState.isMyTurn = false;
  AppState.playerAP = 6;
  AppState.playerMaxAP = 15;
  AppState.enemyAP = 6;
  AppState.enemyMaxAP = 15;
  AppState.currentRoundCount = 1;

  if (AppState.gameTimerInterval) clearInterval(AppState.gameTimerInterval);
  document.querySelector('.timer').innerText = '60';

  renderBoard();
  AppState.socket.emit('check-game-state', { roomId, nickname: AppState.currentUser.nickname });
}
window.enterGame = enterGame;

async function startWaitingTips() {
  if (window.waitingTipsInterval) clearInterval(window.waitingTipsInterval);
  const tipEl = document.getElementById('waiting-tip');

  if (AppState.waitingTipsList.length === 0) {
    try {
      const res = await fetch('/data/tips.json');
      if (res.ok) {
        AppState.waitingTipsList = await res.json();
      } else {
        AppState.waitingTipsList = ['Wait for your opponent to join.'];
      }
    } catch (e) {
      AppState.waitingTipsList = ['Wait for your opponent to join.'];
    }
  }

  const showRandomTip = () => {
    if (AppState.waitingTipsList.length > 0) {
      const tip = AppState.waitingTipsList[Math.floor(Math.random() * AppState.waitingTipsList.length)];
      tipEl.style.opacity = 0;
      setTimeout(() => {
        tipEl.innerText = tip;
        tipEl.style.opacity = 1;
        tipEl.style.transition = 'opacity 0.5s';
      }, 500);
    }
  };

  showRandomTip();
  window.waitingTipsInterval = setInterval(showRandomTip, 5000);
}
window.startWaitingTips = startWaitingTips;

function exitRoom() {
  AppState.inRoom = false;
  if (AppState.gameTimerInterval) clearInterval(AppState.gameTimerInterval);
  if (window.waitingTipsInterval) clearInterval(window.waitingTipsInterval);
  AppState.currentRoomId = null;
  AppState.gameStarted = false;

  AppState.playerHand = [];
  AppState.playerActiveCards = [];
  AppState.playerStagedCards = [];
  AppState.enemyActiveCards = [];
  AppState.enemyHandCount = 0;
  AppState.enemyStagedCount = 0;

  // Clear hero backgrounds
  const playerBg = document.getElementById('hero-bg-player');
  const enemyBg = document.getElementById('hero-bg-enemy');
  if (playerBg) { playerBg.className = 'hero-bg-overlay hero-bg-bottom'; playerBg.innerHTML = ''; }
  if (enemyBg) { enemyBg.className = 'hero-bg-overlay hero-bg-top'; enemyBg.innerHTML = ''; }

  localStorage.removeItem('activeGame');
}
window.exitRoom = exitRoom;
