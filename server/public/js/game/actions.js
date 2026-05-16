// Player actions: play card, end turn, resign, leave, revoke card.

function doPassTurn() {
  AppState.socket.emit('pass-turn', AppState.currentRoomId);
}

function updateEndTurnButton() {
  const btn = document.getElementById('end-turn-btn');
  if (!btn) return;
  btn.disabled = !AppState.isMyTurn;
  btn.style.opacity = AppState.isMyTurn ? '1' : '0.4';
  btn.style.cursor = AppState.isMyTurn ? 'pointer' : 'not-allowed';
  btn.textContent = 'End Turn';
  btn.classList.remove('ready');
}

window.playCard = function (cardUid) {
  if (!AppState.gameStarted) return showNotification('Waiting for opponent!');
  if (!AppState.isMyTurn) return;
  const card = AppState.playerHand.find((c) => c.uid === cardUid);
  if (!card) return;
  if (AppState.playerAP < card.cost) return showNotification('Not enough AP!');
  AppState.socket.emit('play-card', { roomId: AppState.currentRoomId, cardUid: card.uid, targetUid: 'hero' });
};

window.revokeCard = function (cardUid) {
  if (!AppState.gameStarted || !AppState.isMyTurn) return;
  AppState.socket.emit('revoke-card', { roomId: AppState.currentRoomId, cardUid });
  hideCardInfo();
};

window.handleEndTurn = function () {
  if (!AppState.isMyTurn) return;
  if (AppState.currentUser.confirm_end_turn === 0 || AppState.currentUser.confirm_end_turn === false) {
    doPassTurn();
  } else {
    document.getElementById('end-turn-modal').style.display = 'flex';
  }
};

window.confirmEndTurn = function () {
  document.getElementById('end-turn-modal').style.display = 'none';
  const dontAsk = document.getElementById('dont-ask-end-turn').checked;
  if (dontAsk) {
    AppState.currentUser.confirm_end_turn = 0;
    saveSettingsToDB();
    localStorage.setItem('user', JSON.stringify(AppState.currentUser));
  }
  doPassTurn();
};

window.handleResign = function () {
  if (!AppState.currentRoomId) return;
  if (AppState.currentUser.confirm_resign === 0 || AppState.currentUser.confirm_resign === false) {
    window.confirmResign();
  } else {
    document.getElementById('resign-modal').style.display = 'flex';
  }
};

window.confirmResign = function () {
  document.getElementById('resign-modal').style.display = 'none';
  const dontAsk = document.getElementById('dont-ask-resign').checked;
  if (dontAsk) {
    AppState.currentUser.confirm_resign = 0;
    saveSettingsToDB();
    localStorage.setItem('user', JSON.stringify(AppState.currentUser));
  }
  AppState.socket.emit('leave-room', AppState.currentRoomId);
};

window.handleLeaveWaiting = function () {
  if (!AppState.currentRoomId) return;
  AppState.socket.emit('leave-room', AppState.currentRoomId);
  exitRoom();
  navigate('lobby');
};

window.handleLeaveGame = function () {
  if (AppState.gameStarted) {
    window.handleResign();
  } else {
    window.handleLeaveWaiting();
  }
};
