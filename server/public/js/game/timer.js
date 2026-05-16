// Game turn timer: counts down 60s, auto-passes turn on expiry.

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
      doPassTurn(); // auto-pass when time runs out
    }
  }, 1000);
};
