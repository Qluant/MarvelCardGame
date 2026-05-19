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

  if (!AppState.currentUser) {
    navigate('home');
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

  navigate('lobby');
});
