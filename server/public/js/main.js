// Entry point. Runs on DOMContentLoaded.
// 1. Restore user session from localStorage
// 2. Silently re-fetch profile to sync avatar/heroId/settings
// 3. Update header auth state
// 4. If not logged in → go to login (no socket needed)
// 5. Init socket with JWT token
// 6. Check for in-progress game (session restore)
// 7. Navigate to lobby or login

document.addEventListener('DOMContentLoaded', async () => {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    AppState.currentUser = JSON.parse(savedUser);

    // Silently re-fetch profile to refresh avatar/heroId/settings after server restarts
    try {
      const { res, data: profile } = await Api.get(`/players/${AppState.currentUser.nickname}`);
      if (res.ok) {
        if (profile.avatar) AppState.currentUser.avatar = profile.avatar;
        if (profile.selected_hero_id) AppState.currentUser.heroId = profile.selected_hero_id;
        if (profile.confirm_end_turn !== undefined) AppState.currentUser.confirm_end_turn = profile.confirm_end_turn;
        if (profile.confirm_resign !== undefined) AppState.currentUser.confirm_resign = profile.confirm_resign;
        localStorage.setItem('user', JSON.stringify(AppState.currentUser));
      }
    } catch (_) { /* offline or server not ready — use cached data */ }
  }

  updateHeaderAuth();

  const path = window.location.pathname;
  let initialView = path.substring(1) || 'home';
  if (initialView === 'heroes') initialView = 'character-info';

  if (!AppState.currentUser) {
    const publicViews = ['home', 'login', 'register', 'character-info', 'top10'];
    if (!publicViews.includes(initialView)) {
      initialView = 'login';
    }
    navigate(initialView, true);
    return;
  }

  // Init socket with token (user is logged in)
  initSocket();

  // Reconnect to an active game if page was refreshed mid-game
  const savedGame = localStorage.getItem('activeGame');
  if (savedGame) {
    const { roomId, nickname } = JSON.parse(savedGame);
    if (nickname === AppState.currentUser.nickname) {
      AppState.currentRoomId = roomId;
      AppState.inRoom = true;
      // Socket may not be connected yet; wait for 'connect' event before asking server
      AppState.socket.once('connect', () => {
        AppState.socket.emit('check-game-state', { roomId, nickname });
      });
      return; // skip default navigate — let server response decide the view
    }
  }

  // If path is '/' or '/login' but user is logged in, redirect to lobby
  if (initialView === 'home' || initialView === 'login' || initialView === 'register') {
    initialView = 'lobby';
  }

  navigate(initialView, true);
});
