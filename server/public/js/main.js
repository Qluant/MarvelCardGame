document.addEventListener('DOMContentLoaded', async () => {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    AppState.currentUser = JSON.parse(savedUser);

    try {
      const { res, data: profile } = await Api.get(`/players/${AppState.currentUser.nickname}`);
      if (res.ok) {
        if (profile.avatar) AppState.currentUser.avatar = profile.avatar;
        if (profile.selected_hero_id) AppState.currentUser.heroId = profile.selected_hero_id;
        if (profile.confirm_end_turn !== undefined) AppState.currentUser.confirm_end_turn = profile.confirm_end_turn;
        if (profile.confirm_resign !== undefined) AppState.currentUser.confirm_resign = profile.confirm_resign;
        localStorage.setItem('user', JSON.stringify(AppState.currentUser));
      }
    } catch (_) {}
  }

  updateHeaderAuth();

  const path = window.location.pathname;
  let initialView = path.substring(1);
  if (initialView === '') {
    initialView = AppState.currentUser ? 'lobby' : 'home';
  } else if (initialView === 'heroes') {
    initialView = 'character-info';
  }

  if (!AppState.currentUser) {
    const publicViews = ['home', 'login', 'register', 'character-info', 'top10'];
    const protectedViews = ['lobby', 'profile', 'game', 'waiting'];
    if (protectedViews.includes(initialView)) {
      initialView = 'login';
    } else if (!publicViews.includes(initialView)) {
      initialView = '404';
    }
    navigate(initialView, true);
    return;
  }

  initSocket();

  const savedGame = localStorage.getItem('activeGame');
  if (savedGame) {
    const { roomId, nickname } = JSON.parse(savedGame);
    if (nickname === AppState.currentUser.nickname) {
      AppState.currentRoomId = roomId;
      AppState.inRoom = true;
      AppState.socket.once('connect', () => {
        AppState.socket.emit('check-game-state', { roomId, nickname });
      });
      return; 
    }
  }

  if (initialView === 'login' || initialView === 'register') {
    initialView = 'lobby';
  }

  navigate(initialView, true);
});
