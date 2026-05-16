// Socket factory. Called from main.js after user is authenticated.
// Passes JWT token via handshake.auth.token for server-side verification.
// setupSocketListeners() is defined in game/socketListeners.js (loaded after this file).

function initSocket() {
  // Disconnect existing socket if reconnecting after login
  if (AppState.socket) {
    AppState.socket.disconnect();
    AppState.socket = null;
  }

  AppState.socket = io({
    auth: { token: localStorage.getItem('token') },
  });

  // Wait for setupSocketListeners (defined in game/socketListeners.js)
  setupSocketListeners();
}
