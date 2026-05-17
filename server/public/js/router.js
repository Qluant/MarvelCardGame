// SPA router. Manages view visibility and header state.
// All views are hidden by default; navigate() shows exactly one at a time.
// inRoom guard prevents accidental navigation away from game/waiting views.

function updateHeaderAuth() {
  if (AppState.currentUser) {
    document.getElementById('nav-profile').style.display = 'inline';
    document.getElementById('nav-login').style.display = 'none';
    document.getElementById('nav-logout').style.display = 'inline';
    const navHome = document.getElementById('nav-home');
    if(navHome) navHome.style.display = 'none';
    document.getElementById('nav-profile').innerText = `Profile (${AppState.currentUser.nickname})`;
  } else {
    document.getElementById('nav-profile').style.display = 'none';
    document.getElementById('nav-login').style.display = 'inline';
    document.getElementById('nav-logout').style.display = 'none';
    const navHome = document.getElementById('nav-home');
    if(navHome) navHome.style.display = 'inline';
  }
}

function navigate(viewName) {
  // Block navigation away from game/waiting unless explicitly leaving
  const lockingViews = ['game', 'waiting'];
  const currentActive = document.querySelector('.view.active');
  const currentViewId = currentActive ? currentActive.id.replace('view-', '') : null;
  if (AppState.inRoom && lockingViews.includes(currentViewId) && !lockingViews.includes(viewName)) {
    return; // silently block — user must use Leave/Resign button
  }

  document.querySelectorAll('.view').forEach((v) => {
    v.style.display = 'none';
    v.classList.remove('active');
  });

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
  }

  const header = document.querySelector('.app-header');
  if (header) {
    header.style.display = (viewName === 'game' || viewName === 'waiting') ? 'none' : 'flex';
  }

  // View-specific triggers
  if (viewName === 'top10') loadTop10();
  if (viewName === 'profile' && AppState.currentUser) {
    loadProfile(window._targetProfileNickname || AppState.currentUser.nickname);
    window._targetProfileNickname = null;
  }
  if (viewName === 'home') loadCharacterInfo('home-heroes-list', false);
  if (viewName === 'character-info') loadCharacterInfo('character-info-heroes-list', true);
  if (viewName === 'lobby') {
    if (!AppState.currentUser) return navigate('login');
    AppState.socket.emit('get-rooms');
  }
}

window.navigate = navigate;

window.viewUserProfile = function (nickname) {
  window._targetProfileNickname = nickname;
  navigate('profile');
};
