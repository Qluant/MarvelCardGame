function initSocket() {
  if (AppState.socket) {
    AppState.socket.disconnect();
    AppState.socket = null;
  }

  AppState.socket = io({
    auth: { token: localStorage.getItem('token') },
  });

  setupSocketListeners();
}
