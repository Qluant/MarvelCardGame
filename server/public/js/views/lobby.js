// Lobby view: create room, join room (public and private).

window.handleCreateRoom = function (e) {
  e.preventDefault();
  if (!AppState.currentUser.heroId) {
    showNotification('Please select a hero first!');
    navigate('character-info');
    return;
  }
  const name = document.getElementById('create-room-name').value;
  const isPrivate = document.getElementById('create-room-private').checked;
  const password = document.getElementById('create-room-password').value;
  AppState.socket.emit('create-room', {
    name,
    isPrivate,
    password,
    nickname: AppState.currentUser.nickname,
    heroId: AppState.currentUser.heroId,
    avatar: AppState.currentUser.avatar,
  });
};

window.attemptJoinRoom = function (roomId, isPrivate) {
  if (!AppState.currentUser.heroId) {
    showNotification('Please select a hero first!');
    navigate('character-info');
    return;
  }
  if (isPrivate) {
    document.getElementById('join-private-id').value = roomId;
    document.getElementById('join-private-modal').style.display = 'block';
  } else {
    AppState.socket.emit('join-room', {
      roomId,
      nickname: AppState.currentUser.nickname,
      heroId: AppState.currentUser.heroId,
      avatar: AppState.currentUser.avatar,
    });
  }
};

window.submitJoinPrivate = function () {
  const roomId = document.getElementById('join-private-id').value;
  const password = document.getElementById('join-private-password').value;
  document.getElementById('join-private-modal').style.display = 'none';
  AppState.socket.emit('join-room', {
    roomId,
    password,
    nickname: AppState.currentUser.nickname,
    heroId: AppState.currentUser.heroId,
    avatar: AppState.currentUser.avatar,
  });
};
