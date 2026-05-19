window.startGameTimer = function () {
  if (AppState.gameTimerInterval) clearInterval(AppState.gameTimerInterval);
  AppState.gameTimeLeft = 60;
  document.querySelector('.timer').innerText = AppState.gameTimeLeft;

  AppState.gameTimerInterval = setInterval(() => {
    AppState.gameTimeLeft--;
    if (AppState.gameTimeLeft >= 0) {
      document.querySelector('.timer').innerText = AppState.gameTimeLeft;
    } else {
      AppState.gameTimeLeft = 60;
      document.querySelector('.timer').innerText = AppState.gameTimeLeft;
      doPassTurn(); 
    }
  }, 1000);
};
