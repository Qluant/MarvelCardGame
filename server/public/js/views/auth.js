// Auth view handlers: login, register, logout.

function showFormError(elementId, message, isSuccess = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'form-error' + (isSuccess ? ' success' : '');
  el.style.display = 'block';
}

window.handleLogin = async function (e) {
  e.preventDefault();
  const nickname = document.getElementById('login-nickname').value;
  const password = document.getElementById('login-password').value;

  const errDiv = document.getElementById('login-error');
  if (errDiv) errDiv.style.display = 'none';

  try {
    const { res, data } = await Api.post('/auth/login', { username: nickname, password });
    if (res.ok) {
      localStorage.setItem('token', data.token);
      AppState.currentUser = { nickname };

      // Restore hero/avatar/settings from DB
      try {
        const { res: pRes, data: profile } = await Api.get(`/players/${nickname}`);
        if (pRes.ok) {
          if (profile.selected_hero_id) AppState.currentUser.heroId = profile.selected_hero_id;
          if (profile.avatar) AppState.currentUser.avatar = profile.avatar;
          if (profile.confirm_end_turn !== undefined) AppState.currentUser.confirm_end_turn = profile.confirm_end_turn;
          if (profile.confirm_resign !== undefined) AppState.currentUser.confirm_resign = profile.confirm_resign;
        }
      } catch (_) {}

      localStorage.setItem('user', JSON.stringify(AppState.currentUser));
      updateHeaderAuth();
      initSocket(); // connect socket with fresh token
      navigate('lobby');
    } else {
      showFormError('login-error', data.error);
    }
  } catch (err) {
    showFormError('login-error', 'Login failed');
  }
};

window.handleRegister = async function (e) {
  e.preventDefault();
  const nickname = document.getElementById('reg-nickname').value;
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;

  const errDiv = document.getElementById('reg-error');
  if (errDiv) errDiv.style.display = 'none';

  if (password !== confirmPassword) {
    showFormError('reg-error', 'Passwords do not match!');
    return;
  }

  try {
    const { res, data } = await Api.post('/auth/register', { username: nickname, password });
    if (res.ok) {
      showFormError('login-error', 'Registered! Please login.', true);
      navigate('login');
    } else {
      showFormError('reg-error', data.error);
    }
  } catch (err) {
    showFormError('reg-error', 'Registration failed');
  }
};

window.handleLogout = function () {
  AppState.currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (AppState.socket) AppState.socket.disconnect();
  AppState.socket = null;
  updateHeaderAuth();
  navigate('login');
};
