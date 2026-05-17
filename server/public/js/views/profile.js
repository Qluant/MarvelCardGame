// Profile view: load stats, render hero-stats grid, settings.

async function loadProfile(targetNickname) {
  const nicknameToLoad = targetNickname || (AppState.currentUser ? AppState.currentUser.nickname : null);
  if (!nicknameToLoad) return;
  const { data: p } = await Api.get(`/players/${nicknameToLoad}`);

  document.getElementById('profile-title').innerText = `${p.nickname}'s Profile`;
  document.getElementById('profile-games').innerText = p.games_played;
  document.getElementById('profile-wins').innerText = p.wins;
  document.getElementById('profile-loses').innerText = p.loses;
  document.getElementById('profile-draws').innerText = p.draws;
  document.getElementById('profile-winstreak').innerText = p.winstreak;

  const heroGrid = document.getElementById('hero-stats-grid');
  if (heroGrid) {
    heroGrid.innerHTML = '';
    if (p.heroStats && p.heroStats.length > 0) {
      p.heroStats.forEach((hs) => {
        let bgStyle = '';
        if (hs.hero_id === 1) bgStyle = 'background:linear-gradient(135deg,rgba(30,144,255,0.2),rgba(255,215,0,0.1));border-left:4px solid #1E90FF;';
        if (hs.hero_id === 2) bgStyle = 'background:linear-gradient(135deg,rgba(255,69,0,0.2),rgba(255,140,0,0.1));border-left:4px solid #FF4500;';
        if (hs.hero_id === 3) bgStyle = 'background:linear-gradient(135deg,rgba(0,0,0,0.5),rgba(128,0,128,0.2));border-left:4px solid #800080;';
        const winRate = hs.games_played > 0 ? Math.round((hs.wins / hs.games_played) * 100) : 0;
        heroGrid.innerHTML += `
          <div style="${bgStyle} padding:15px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.3);">
            <h4 style="margin:0 0 10px 0;font-family:var(--font-header);font-size:1.3rem;letter-spacing:1px;">${hs.alias}</h4>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:0.9rem;">
              <div><strong>Games:</strong> ${hs.games_played}</div>
              <div><strong>Wins:</strong> ${hs.wins} (${winRate}%)</div>
              <div><strong>Losses/Draws:</strong> ${hs.loses}/${hs.draws}</div>
              <div><strong>Dmg Dealt:</strong> ${hs.dmg_dealt}</div>
              <div><strong>Dmg Defended:</strong> ${hs.dmg_defended}</div>
              <div><strong>Cards Played:</strong> ${hs.cards_played}</div>
            </div>
          </div>`;
      });
    } else {
      heroGrid.innerHTML = '<p style="text-align:center;color:#aaa;">No hero statistics available yet.</p>';
    }
  }

  const settingsContainer = document.getElementById('profile-settings-container');
  if (AppState.currentUser && nicknameToLoad === AppState.currentUser.nickname) {
    if (settingsContainer) settingsContainer.style.display = 'block';
    document.getElementById('setting-confirm-end').checked = !!p.confirm_end_turn;
    document.getElementById('setting-confirm-resign').checked = !!p.confirm_resign;
    document.getElementById('setting-avatar-url').value = p.avatar || '';
  } else {
    if (settingsContainer) settingsContainer.style.display = 'none';
  }

  document.getElementById('profile-avatar-img').src = p.avatar || '/assets/images/avatar.jpg';
}

async function saveSettingsToDB() {
  await Api.put(`/players/${AppState.currentUser.nickname}/settings`, {
    confirm_end_turn: AppState.currentUser.confirm_end_turn,
    confirm_resign: AppState.currentUser.confirm_resign,
    avatar: AppState.currentUser.avatar,
  });
}
window.saveSettingsToDB = saveSettingsToDB;

function checkImageValid(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

window.saveProfileSettings = async function () {
  const confirmEnd = document.getElementById('setting-confirm-end').checked;
  const confirmResign = document.getElementById('setting-confirm-resign').checked;
  const avatarUrl = document.getElementById('setting-avatar-url').value.trim();

  const msgEl = document.getElementById('settings-msg');
  msgEl.style.display = 'block';
  msgEl.style.color = '#ccc';
  msgEl.innerText = 'Validating...';

  if (avatarUrl) {
    const isValid = await checkImageValid(avatarUrl);
    if (!isValid) {
      msgEl.style.color = 'var(--marvel-red)';
      msgEl.innerText = 'Invalid Image URL! Settings not saved.';
      return;
    }
  }

  AppState.currentUser.confirm_end_turn = confirmEnd ? 1 : 0;
  AppState.currentUser.confirm_resign = confirmResign ? 1 : 0;
  AppState.currentUser.avatar = avatarUrl || null;

  try {
    await saveSettingsToDB();
    msgEl.style.color = '#2ecc71';
    msgEl.innerText = 'Settings saved successfully!';
    document.getElementById('profile-avatar-img').src =
      AppState.currentUser.avatar || '/assets/images/avatar.jpg';
    localStorage.setItem('user', JSON.stringify(AppState.currentUser));
  } catch (e) {
    msgEl.style.color = 'var(--marvel-red)';
    msgEl.innerText = 'Error saving settings.';
  }
};
