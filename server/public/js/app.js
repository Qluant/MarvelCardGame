// Global State
let currentUser = null;
let currentRoomId = null;
let socket = null;
let playerHand = [];
let playerActiveCards = [];
let enemyActiveCards = [];
let enemyHandCount = 0;
let gameStarted = false;
let gameTimerInterval = null;
let gameTimeLeft = 60;
let isMyTurn = false;
let initialCoinTossDone = false;
let playerStagedCards = [];
let enemyStagedCount = 0;
// Action Points
let playerAP = 6;
let playerMaxAP = 15;
let enemyAP = 6;
let enemyMaxAP = 15;
const AP_CAP = 15;
let currentRoundCount = 1;

const API_URL = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);

    // Silently re-fetch profile from DB to refresh avatar/heroId after server restarts
    try {
      const profileRes = await fetch(`${API_URL}/players/${currentUser.nickname}`);
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.avatar) currentUser.avatar = profile.avatar;
        if (profile.selected_hero_id) currentUser.heroId = profile.selected_hero_id;
        if (profile.confirm_end_turn !== undefined) currentUser.confirm_end_turn = profile.confirm_end_turn;
        if (profile.confirm_resign !== undefined) currentUser.confirm_resign = profile.confirm_resign;
        localStorage.setItem('user', JSON.stringify(currentUser));
      }
    } catch (_) { /* offline or server not ready — use cached data */ }
  }
  
  // Connect socket
  socket = io();
  setupSocketListeners();
  
  updateHeaderAuth();

  // ── Reconnect to an active game if the page was refreshed ───────────────
  const savedGame = sessionStorage.getItem('activeGame');
  if (savedGame && currentUser) {
    const { roomId, nickname } = JSON.parse(savedGame);
    if (nickname === currentUser.nickname) {
      // Restore in-room state and ask the server what state we're in.
      // Do NOT navigate to 'game' yet — let the server response decide:
      //   game-start          → active game, go to game view
      //   waiting-room-restore → still waiting, go to waiting view
      //   room-gone           → room is dead, clear session and go to lobby
      currentRoomId = roomId;
      inRoom = true;
      // Use 'connect' to guarantee the socket is ready before asking the server.
      // Emitting before connection is established causes the event to be lost.
      socket.once('connect', () => {
        socket.emit('check-game-state', { roomId, nickname });
      });
      return; // skip the default navigate below
    }
  }

  navigate(currentUser ? 'lobby' : 'login');
});

function updateHeaderAuth() {
  if (currentUser) {
    document.getElementById('nav-profile').style.display = 'inline';
    document.getElementById('nav-login').style.display = 'none';
    document.getElementById('nav-logout').style.display = 'inline';
    document.getElementById('nav-profile').innerText = `Profile (${currentUser.nickname})`;
  } else {
    document.getElementById('nav-profile').style.display = 'none';
    document.getElementById('nav-login').style.display = 'inline';
    document.getElementById('nav-logout').style.display = 'none';
  }
}

// Tracks whether the user is locked inside a room (waiting or playing)
let inRoom = false;

// Router
function navigate(viewName) {
  // Block navigation away from game/waiting unless explicitly leaving
  const lockingViews = ['game', 'waiting'];
  const currentActive = document.querySelector('.view.active');
  const currentViewId = currentActive ? currentActive.id.replace('view-', '') : null;
  if (inRoom && lockingViews.includes(currentViewId) && !lockingViews.includes(viewName)) {
    return; // silently block — user must use the Leave/Resign button
  }

  document.querySelectorAll('.view').forEach(v => {
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
    if (viewName === 'game' || viewName === 'waiting') {
      header.style.display = 'none';
    } else {
      header.style.display = 'flex';
    }
  }

  // View specific logic
  if (viewName === 'top10') loadTop10();
  if (viewName === 'profile' && currentUser) {
    loadProfile(window._targetProfileNickname || currentUser.nickname);
    window._targetProfileNickname = null; // reset
  }
  if (viewName === 'character-info') loadCharacterInfo();
  if (viewName === 'lobby') {
    if (!currentUser) return navigate('login');
    socket.emit('get-rooms');
  }
}

window.navigate = navigate; // expose to global scope for HTML onclick

// Auth Logic
function showFormError(elementId, message, isSuccess = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'form-error' + (isSuccess ? ' success' : '');
  el.style.display = 'block';
}

let currentCardInfoModal = null;

window.showCardInfo = function(encodedCard, isStaged) {
  if (currentCardInfoModal) currentCardInfoModal.remove();
  const card = JSON.parse(decodeURIComponent(encodedCard));
  
  const modal = document.createElement('div');
  modal.id = 'card-info-modal';
  
  // Full screen overlay that closes modal on click
  Object.assign(modal.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: '9999',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    backdropFilter: 'blur(5px)'
  });
  
  modal.onclick = function() { hideCardInfo(); };
  
  const cardHtml = renderCard(card, false, null, true);
  
  let revokeBtnHtml = '';
  if (isStaged && isMyTurn) {
    revokeBtnHtml = `
      <button class="revoke-btn" onclick="revokeCard('${card.uid}'); event.stopPropagation();" title="Revoke Card" style="
        margin-top: 120px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--marvel-red);
        color: white;
        border: 2px solid rgba(255,255,255,0.5);
        font-size: 28px;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 0 20px rgba(224, 49, 49, 0.6);
        transition: transform 0.2s, box-shadow 0.2s;
      " onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 0 30px rgba(224, 49, 49, 0.9)';" 
         onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 0 20px rgba(224, 49, 49, 0.6)';">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="4" x2="12" y2="20"></line>
          <polyline points="19 13 12 20 5 13"></polyline>
        </svg>
      </button>
    `;
  }
  
  let closeBtnHtml = `
    <button onclick="hideCardInfo(); event.stopPropagation();" style="
      position: absolute;
      top: 30px;
      right: 30px;
      background: rgba(0,0,0,0.5);
      color: white;
      border: 2px solid rgba(255,255,255,0.5);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      padding: 0;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all 0.2s;
      z-index: 10;
    " onmouseover="this.style.background='rgba(224,49,49,0.8)'; this.style.transform='scale(1.1)';" 
       onmouseout="this.style.background='rgba(0,0,0,0.5)'; this.style.transform='scale(1)';">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  modal.innerHTML = `
    ${closeBtnHtml}
    <div onclick="event.stopPropagation()" style="display: flex; flex-direction: column; align-items: center;">
      <div style="transform: scale(1.6); transform-origin: center; pointer-events: none;">
        ${cardHtml}
      </div>
      ${revokeBtnHtml}
    </div>
  `;
  
  document.body.appendChild(modal);
  currentCardInfoModal = modal;
};

window.hideCardInfo = function() {
  if (currentCardInfoModal) {
    currentCardInfoModal.remove();
    currentCardInfoModal = null;
  }
};

window.revokeCard = function(cardUid) {
  if (!gameStarted || !isMyTurn) return;
  socket.emit('revoke-card', { roomId: currentRoomId, cardUid });
  hideCardInfo();
};

window.handleLogin = async function(e) {
  e.preventDefault();
  const nickname = document.getElementById('login-nickname').value;
  const password = document.getElementById('login-password').value;
  
  const errDiv = document.getElementById('login-error');
  if (errDiv) errDiv.style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nickname, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      currentUser = { nickname };

      // Restore hero selection from DB
      try {
        const profileRes = await fetch(`${API_URL}/players/${nickname}`);
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.selected_hero_id) {
            currentUser.heroId = profile.selected_hero_id;
          }
          if (profile.avatar) {
            currentUser.avatar = profile.avatar;
          }
        }
      } catch (_) {}

      localStorage.setItem('user', JSON.stringify(currentUser));
      updateHeaderAuth();
      navigate('lobby');
    } else {
      showFormError('login-error', data.error);
    }
  } catch (err) { showFormError('login-error', 'Login failed'); }
}

window.handleRegister = async function(e) {
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
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nickname, password })
    });
    const data = await res.json();
    if (res.ok) {
      showFormError('login-error', 'Registered! Please login.', true);
      navigate('login');
    } else {
      showFormError('reg-error', data.error);
    }
  } catch (err) { showFormError('reg-error', 'Registration failed'); }
}

window.handleLogout = function() {
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateHeaderAuth();
  navigate('login');
}

// Data Fetchers
async function loadTop10() {
  const res = await fetch(`${API_URL}/players/top`);
  const data = await res.json();
  const tbody = document.getElementById('top10-tbody');
  tbody.innerHTML = '';
  data.forEach((p, idx) => {
    const avatarImg = p.avatar || '/assets/images/default_avatar.png';
    tbody.innerHTML += `<tr>
      <td>#${idx+1}</td>
      <td><img src="${avatarImg}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid var(--marvel-red);"></td>
      <td><a href="#" onclick="viewUserProfile('${p.nickname}'); return false;" style="color: var(--marvel-red); font-weight: bold; text-decoration: none;">${p.nickname}</a></td>
      <td>${p.wins}</td><td>${p.loses}</td><td>${p.draws}</td><td>${p.winstreak}</td>
    </tr>`;
  });
}

window.viewUserProfile = function(nickname) {
  window._targetProfileNickname = nickname;
  navigate('profile');
};

async function loadProfile(targetNickname) {
  const nicknameToLoad = targetNickname || currentUser.nickname;
  const res = await fetch(`${API_URL}/players/${nicknameToLoad}`);
  const p = await res.json();
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
      p.heroStats.forEach(hs => {
        let bgStyle = '';
        if (hs.hero_id === 1) bgStyle = 'background: linear-gradient(135deg, rgba(30,144,255,0.2), rgba(255,215,0,0.1)); border-left: 4px solid #1E90FF;';
        if (hs.hero_id === 2) bgStyle = 'background: linear-gradient(135deg, rgba(255,69,0,0.2), rgba(255,140,0,0.1)); border-left: 4px solid #FF4500;';
        if (hs.hero_id === 3) bgStyle = 'background: linear-gradient(135deg, rgba(0,0,0,0.5), rgba(128,0,128,0.2)); border-left: 4px solid #800080;';

        const winRate = hs.games_played > 0 ? Math.round((hs.wins / hs.games_played) * 100) : 0;

        heroGrid.innerHTML += `
          <div style="${bgStyle} padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <h4 style="margin: 0 0 10px 0; font-family: var(--font-header); font-size: 1.3rem; letter-spacing: 1px;">${hs.alias}</h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.9rem;">
              <div><strong>Games:</strong> ${hs.games_played}</div>
              <div><strong>Wins:</strong> ${hs.wins} (${winRate}%)</div>
              <div><strong>Losses/Draws:</strong> ${hs.loses}/${hs.draws}</div>
              <div><strong>Dmg Dealt:</strong> ${hs.dmg_dealt}</div>
              <div><strong>Dmg Defended:</strong> ${hs.dmg_defended}</div>
              <div><strong>Cards Played:</strong> ${hs.cards_played}</div>
            </div>
          </div>
        `;
      });
    } else {
      heroGrid.innerHTML = '<p style="text-align: center; color: #aaa;">No hero statistics available yet.</p>';
    }
  }
  
  const settingsContainer = document.getElementById('profile-settings-container');
  if (nicknameToLoad === currentUser.nickname) {
    if (settingsContainer) settingsContainer.style.display = 'block';
    document.getElementById('setting-confirm-end').checked = p.confirm_end_turn;
    document.getElementById('setting-confirm-resign').checked = p.confirm_resign;
    document.getElementById('setting-avatar-url').value = p.avatar || '';
  } else {
    if (settingsContainer) settingsContainer.style.display = 'none';
  }
  
  document.getElementById('profile-avatar-img').src = p.avatar || '/assets/images/default_avatar.png';
}

async function saveSettingsToDB() {
  await fetch(`${API_URL}/players/${currentUser.nickname}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      confirm_end_turn: currentUser.confirm_end_turn,
      confirm_resign: currentUser.confirm_resign,
      avatar: currentUser.avatar
    })
  });
}

function checkImageValid(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

window.saveProfileSettings = async function() {
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

  currentUser.confirm_end_turn = confirmEnd ? 1 : 0;
  currentUser.confirm_resign = confirmResign ? 1 : 0;
  currentUser.avatar = avatarUrl || null;

  try {
    await saveSettingsToDB();
    msgEl.style.color = '#2ecc71';
    msgEl.innerText = 'Settings saved successfully!';
    document.getElementById('profile-avatar-img').src = currentUser.avatar || '/assets/images/default_avatar.png';
    localStorage.setItem('user', JSON.stringify(currentUser));
  } catch(e) {
    msgEl.style.color = 'var(--marvel-red)';
    msgEl.innerText = 'Error saving settings.';
  }
}

async function loadCharacterInfo() {
  const list = document.getElementById('character-info-heroes-list');
  list.innerHTML = '<p>Loading heroes...</p>';

  try {
    const res = await fetch(`${API_URL}/info/heroes`);
    const heroes = await res.json();
    list.innerHTML = '';

    heroes.forEach(hero => {
      const isSelected = currentUser && currentUser.heroId === hero.hero_id;
      const abilityClass = (hero.special_ability || 'None').toLowerCase();

      let cardsHtml = '';
      if (hero.cards && hero.cards.length && hero.cards[0] && hero.cards[0].name) {
        hero.cards.forEach(c => {
          const encoded = encodeURIComponent(JSON.stringify(c));
          cardsHtml += `<div class="card-wrapper info-card-wrapper" data-card="${encoded}">${renderCard(c)}</div>`;
        });
      } else {
        cardsHtml = '<p>No cards available.</p>';
      }

      list.innerHTML += `
        <div class="hero-section glass-panel${isSelected ? ' hero-section-selected' : ''}" id="hero-section-${hero.hero_id}">
          <div class="hero-section-header">
            <div class="hero-section-meta" style="flex: 1;">
              <h3 style="margin: 0 0 5px 0;">${hero.alias}</h3>
              <p class="hero-passive-desc" style="margin: 0; font-size: 0.95rem; color: #d0d0d0; line-height: 1.4; max-width: 80%;">
                <strong style="color: var(--marvel-red);">Passive:</strong> ${hero.special_ability || 'None'}
              </p>
            </div>
            <button
              class="hero-tile-select-btn${isSelected ? ' hero-tile-select-btn-active' : ''}"
              id="hero-select-btn-${hero.hero_id}"
              onclick="selectHero(${hero.hero_id}, '${hero.alias}')">
              ${isSelected ? '✓ Your Hero' : 'Select'}
            </button>
          </div>
          <div class="hero-cards">${cardsHtml}</div>
        </div>
      `;
    });

    initCardPreview();
  } catch (err) {
    list.innerHTML = '<p>Failed to load heroes.</p>';
  }
}

window.selectHero = async function(heroId, heroAlias) {
  try {
    await fetch(`${API_URL}/players/${currentUser.nickname}/hero`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroId })
    });

    currentUser.heroId = heroId;
    currentUser.heroAlias = heroAlias;
    localStorage.setItem('user', JSON.stringify(currentUser));

    // Update hero-section visuals without full reload
    document.querySelectorAll('.hero-section').forEach(s => s.classList.remove('hero-section-selected'));
    document.querySelectorAll('[id^="hero-select-btn-"]').forEach(b => {
      b.textContent = 'Select';
      b.classList.remove('hero-tile-select-btn-active');
    });
    const section = document.getElementById(`hero-section-${heroId}`);
    if (section) section.classList.add('hero-section-selected');
    const btn = document.getElementById(`hero-select-btn-${heroId}`);
    if (btn) { btn.textContent = '✓ Your Hero'; btn.classList.add('hero-tile-select-btn-active'); }
  } catch (err) {
    showNotification('Failed to save hero selection. Please try again.');
  }
};


function initCardPreview() {
  let tooltip = document.getElementById('card-preview-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'card-preview-tooltip';
    tooltip.className = 'card-preview-tooltip';
    document.body.appendChild(tooltip);
  }

  // Use the merged character-info list
  const list = document.getElementById('character-info-heroes-list');
  if (!list) return;

  list.addEventListener('mouseenter', (e) => {
    const wrapper = e.target.closest('.info-card-wrapper');
    if (!wrapper) return;
    const card = JSON.parse(decodeURIComponent(wrapper.dataset.card));
    const imgSrc = cardImageUrl(card.name);
    const categoryColor = { Trade: 'var(--color-trade)', Hybrid: 'var(--color-hybrid)', Summon: 'var(--color-summon)' }[card.category] || 'white';

    tooltip.innerHTML = `
      <div class="cp-image-wrap">
        <img src="${imgSrc}" alt="${card.name}" class="cp-image"/>
      </div>
      <div class="cp-body">
        <h3 class="cp-name">${card.name}</h3>
        <span class="cp-category" style="color:${categoryColor}">${card.category}</span>
        <p class="cp-desc">${card.description}</p>
        <div class="cp-stats">
          <span class="cp-atk">⚔️ ${card.attack}</span>
          <span class="cp-cost">💠 ${card.cost} AP</span>
          <span class="cp-def">🛡️ ${card.defense}</span>
        </div>
      </div>
    `;
    tooltip.classList.add('visible');
    positionTooltip(e, tooltip);
  }, true);

  list.addEventListener('mousemove', (e) => {
    if (!e.target.closest('.info-card-wrapper')) return;
    positionTooltip(e, tooltip);
  }, true);

  list.addEventListener('mouseleave', (e) => {
    if (e.target.closest('.info-card-wrapper') && !e.relatedTarget?.closest('.info-card-wrapper')) {
      tooltip.classList.remove('visible');
    }
  }, true);
}

function positionTooltip(e, tooltip) {
  const TW = 300, TH = 360, MARGIN = 16;
  let x = e.clientX + MARGIN;
  let y = e.clientY + MARGIN;
  if (x + TW > window.innerWidth)  x = e.clientX - TW - MARGIN;
  if (y + TH > window.innerHeight) y = e.clientY - TH - MARGIN;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

// ── Deal animation ────────────────────────────────────────────────────────────
function animateDrawCards(playerCount, enemyCount) {
  const CARD_DELAY   = 200; // ms stagger between cards (increased)
  const DEAL_DURATION = 750; // ms per card flight (increased)

  const playerZone = document.getElementById('player-hand-list');
  const enemyZone  = document.getElementById('enemy-hand-list');
  if (!playerZone || !enemyZone) { renderBoard(); return; }

  const getCenter = (elId) => {
    const el = document.getElementById(elId);
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  };

  const pDeckPos = getCenter('player-deck');
  const eDeckPos = getCenter('enemy-deck');

  const playerRect = playerZone.getBoundingClientRect();
  const enemyRect  = enemyZone.getBoundingClientRect();
  let totalToLand = playerCount + enemyCount;
  
  if (totalToLand === 0) {
    renderBoard();
    return;
  }
  
  let landed = 0;
  const done = () => { 
    if (++landed === totalToLand) {
      renderBoard();
    }
  };

  for (let i = 0; i < playerCount; i++) {
    spawnFlyingCard(
      pDeckPos,
      { x: playerRect.left + (playerRect.width / Math.max(playerCount, 1)) * i + 50, y: playerRect.top + playerRect.height / 2 },
      i * CARD_DELAY, DEAL_DURATION, done
    );
  }
  
  for (let i = 0; i < enemyCount; i++) {
    spawnFlyingCard(
      eDeckPos,
      { x: enemyRect.left + (enemyRect.width / Math.max(enemyCount, 1)) * i + 50, y: enemyRect.top + enemyRect.height / 2 },
      (i + playerCount) * CARD_DELAY, DEAL_DURATION, done
    );
  }
}

function spawnFlyingCard(from, to, delay, duration, onDone) {
  const el = document.createElement('div');
  el.className = 'flying-card-token';
  el.innerHTML = '<div class="flying-card-stamp">M</div>';
  Object.assign(el.style, { left: from.x + 'px', top: from.y + 'px' });
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.transition = `left ${duration}ms cubic-bezier(.2,.8,.4,1), top ${duration}ms cubic-bezier(.2,.8,.4,1), opacity ${duration * 0.4}ms ease ${duration * 0.6}ms`;
    el.style.left    = to.x + 'px';
    el.style.top     = to.y + 'px';
    el.style.opacity = '0';
    setTimeout(() => { el.remove(); onDone(); }, duration + 200);
  }, delay);
}

// Map a card name to its local image path (name -> snake_case filename)
function cardImageUrl(cardName) {
  const filename = cardName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
  return `/assets/images/${filename}.jpg`;
}

// Card Renderer (hand / info view)
function renderCard(card, isHand = false, onClick = null, canAfford = true) {
  const imgSrc = cardImageUrl(card.name);
  const onClickStr = onClick ? `onclick="${onClick}"` : '';
  const affordableClass = canAfford ? '' : ' unaffordable';
  
  return `
    <div class="marvel-card${affordableClass}" ${onClickStr}>
      <div class="card-cost">${card.cost}</div>
      <div class="card-image-container"><img src="${imgSrc}" alt="${card.name}" class="card-image"/></div>
      <div class="card-body">
        <h4>${card.name}</h4>
        <div class="card-category">${card.category}</div>
        <p class="card-desc">${card.description}</p>
        <div class="card-stats">
          <span class="stat-attack">⚔️ ${card.attack}</span>
          <span class="stat-defense">🛡️ ${card.defense}</span>
        </div>
      </div>
    </div>
  `;
}

// Compact board card renderer (image + name + stat badges)
function renderBoardCard(card, isStaged = false) {
  const imgSrc = cardImageUrl(card.name);
  const encoded = encodeURIComponent(JSON.stringify(card));
  return `
    <div class="board-minion" onclick="showCardInfo('${encoded}', ${isStaged})">
      <img src="${imgSrc}" alt="${card.name}" class="board-minion-img"/>
      <div class="board-minion-name">${card.name}</div>
      <div class="board-minion-atk">${card.attack}</div>
      <div class="board-minion-def">${card.defense}</div>
    </div>
  `;
}

// Sockets & Game Logic
function setupSocketListeners() {
  socket.on('rooms-update', (rooms) => {
    const container = document.getElementById('lobby-rooms-container');
    if (rooms.length === 0) {
      container.innerHTML = '<p>No open rooms. Create one!</p>';
      return;
    }
    let html = '<ul>';
    rooms.forEach(room => {
      html += `
        <li class="room-item">
          <span>${room.name} ${room.isPrivate ? '🔒' : ''}</span>
          <button onclick="attemptJoinRoom('${room.id}', ${room.isPrivate})">Join</button>
        </li>
      `;
    });
    html += '</ul>';
    container.innerHTML = html;
  });

  socket.on('room-created', (room) => {
    enterGame(room.id);
  });

  socket.on('game-start', (room) => {
    if (window.waitingTipsInterval) clearInterval(window.waitingTipsInterval);

    // Detect if this is a reconnect (we already have state) vs a fresh join
    const isReconnect = currentRoomId === room.id && gameStarted;

    if (!currentRoomId || currentRoomId !== room.id) {
      // Fresh joiner path (joined via join-room, enterGame was never called)
      currentRoomId = room.id;
      inRoom = true;
      localStorage.setItem('activeGame', JSON.stringify({ roomId: room.id, nickname: currentUser.nickname }));
      gameStarted = false;
      document.getElementById('player-avatar').src = currentUser.avatar || '/assets/images/default_avatar.png';
      document.getElementById('enemy-nickname').innerText = 'Opponent';
      document.getElementById('enemy-avatar').src = '/assets/images/default_avatar.png';
      playerHand = [];
      enemyHandCount = 0;
      currentRoundCount = 1;
      playerAP = 6; playerMaxAP = 15;
      enemyAP = 6;  enemyMaxAP = 15;
    }

    // Unlock temporarily so navigate to 'game' is allowed from 'waiting' or 'lobby'
    inRoom = false;
    navigate('game');
    inRoom = true;
    
    // Unconditionally set player nickname so it doesn't say "PLAYER" on reconnect
    document.getElementById('player-nickname').innerText = currentUser.nickname;
    inRoom = true;

    gameStarted = true;
    isMyTurn = room.players[0].id === socket.id;
    updateEndTurnButton();
    const me = room.players.find(p => p.id === socket.id) || room.players[0];
    const opponent = room.players.find(p => p.id !== socket.id) || room.players[0];
    if (opponent) {
      document.getElementById('enemy-nickname').innerText = opponent.nickname;
      document.getElementById('enemy-avatar').src = opponent.avatar || '/assets/images/default_avatar.png';

      if (!isReconnect) {
        // Fresh game — reset counts; they will be populated by sync-game-state
        enemyHandCount = 0;
        currentRoundCount = 1;
        playerAP = 6; playerMaxAP = 15;
        enemyAP = 6;  enemyMaxAP = 15;
        initialCoinTossDone = false;
      } else {
        initialCoinTossDone = true;
      }

      // Apply hero-themed full-screen background overlays
      const heroHalfClass = id => ({1: 'half-ironman', 2: 'half-torch', 3: 'half-venom'}[id] || '');
      const playerBg = document.getElementById('hero-bg-player');
      const enemyBg = document.getElementById('hero-bg-enemy');
      
      const applyHeroBg = (bgElem, heroId) => {
        if (!bgElem) return;
        bgElem.className = bgElem.className.replace(/half-\w+/g, '').trim();
        bgElem.innerHTML = ''; // Clear old particles
        const cls = heroHalfClass(heroId);
        if (cls) bgElem.classList.add(cls);
        
        if (heroId === 2) {
          // Spawn Torch sparks with individual paths
          for (let i = 0; i < 40; i++) {
            const wrapper = document.createElement('div');
            wrapper.className = 'torch-spark-wrapper';
            wrapper.style.left = (Math.random() * 100) + '%';
            
            const durY = Math.random() * 2.5 + 2; // 2s to 4.5s
            const durX = Math.random() * 1.5 + 1; // 1s to 2.5s
            const delay = Math.random() * 3; // 0s to 3s
            const endX = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 40 + 20) + 'px';
            
            wrapper.style.setProperty('--dur-y', durY + 's');
            wrapper.style.setProperty('--delay', delay + 's');
            
            const spark = document.createElement('div');
            spark.className = 'torch-spark-particle';
            spark.style.setProperty('--dur-x', durX + 's');
            spark.style.setProperty('--end-x', endX);
            spark.style.background = Math.random() > 0.5 ? '#ffeb3b' : '#ff9800';
            
            wrapper.appendChild(spark);
            bgElem.appendChild(wrapper);
          }
        }
      };

      applyHeroBg(playerBg, me.heroId);
      applyHeroBg(enemyBg, opponent.heroId);

      renderBoard();
    }
  });

  window.startCoinFlipAnimation = function(winnerNickname) {
    const coinOverlay = document.getElementById('coin-overlay');
    const startCoin = document.getElementById('start-coin');
    const winnerLabel = document.getElementById('coin-winner-label');
    if (coinOverlay && startCoin) {
      coinOverlay.style.display = 'flex';
      if (winnerLabel) { winnerLabel.style.opacity = '0'; winnerLabel.textContent = ''; }
      
      // Reset state instantly without transition
      startCoin.style.transition = 'none';
      startCoin.style.transform = `rotateY(0deg) translateZ(0)`;
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          startCoin.style.transition = 'transform 3s ease-out';
          const baseSpins = 1080; 
          const finalRotation = isMyTurn ? baseSpins : baseSpins + 180;
          startCoin.style.transform = `rotateY(${finalRotation}deg) translateZ(0)`;
        });
      });
      
      // After spin, reveal who won
      setTimeout(() => {
        if (winnerLabel && winnerNickname) {
          const youWon = isMyTurn;
          winnerLabel.textContent = youWon
            ? `🏆 YOU go first!`
            : `⚔️ ${winnerNickname} goes first!`;
          winnerLabel.style.color = youWon ? '#2ecc71' : '#e74c3c';
          winnerLabel.style.textShadow = youWon
            ? '0 0 10px rgba(46,204,113,0.8)'
            : '0 0 10px rgba(231,76,60,0.8)';
          winnerLabel.style.opacity = '1';
        }
      }, 3000);
      
      // Hide after label has been shown
      setTimeout(() => {
        coinOverlay.style.display = 'none';
        window.startGameTimer();
      }, 4500);
    } else {
      window.startGameTimer();
    }
  };

  // Server randomized who goes first - trigger the coin animation with that info
  socket.on('coin-flip', ({ winnerId, winnerNickname }) => {
    // isMyTurn is already updated from sync-game-state before this fires,
    // but we need to be sure — set it explicitly from the winnerId
    isMyTurn = (winnerId === socket.id);
    if (!initialCoinTossDone) {
      initialCoinTossDone = true;
      window.startCoinFlipAnimation(winnerNickname);
    }
  });

  // After each round the server alternates who goes first — show a quick banner
  socket.on('turn-order-change', ({ firstPlayerId, firstPlayerNickname }) => {
    const banner = document.getElementById('turn-order-banner');
    const textEl = document.getElementById('turn-order-text');
    const subEl = document.getElementById('turn-order-sub');
    if (!banner || !textEl) return;

    const isMe = firstPlayerId === socket.id;
    textEl.textContent = isMe ? '⚡ YOUR TURN FIRST' : `⚔️ ${firstPlayerNickname.toUpperCase()} FIRST`;
    textEl.style.color = isMe ? '#2ecc71' : '#e74c3c';
    textEl.style.textShadow = isMe
      ? '0 0 20px rgba(46,204,113,0.9)'
      : '0 0 20px rgba(231,76,60,0.9)';
    if (subEl) subEl.textContent = isMe ? 'You go first this round!' : 'Opponent goes first this round!';

    banner.style.display = 'flex';
    setTimeout(() => { banner.style.display = 'none'; }, 2000);
  });

  window.startGameTimer = function() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    gameTimeLeft = 60;
    document.querySelector('.timer').innerText = gameTimeLeft;
    
    const tickTimer = () => {
      gameTimeLeft--;
      if (gameTimeLeft >= 0) {
        document.querySelector('.timer').innerText = gameTimeLeft;
      } else {
        // Timer reached 0, pass turn automatically
        gameTimeLeft = 60;
        document.querySelector('.timer').innerText = gameTimeLeft;
        doPassTurn();
      }
    };
    
    gameTimerInterval = setInterval(tickTimer, 1000);
  };

  const delay = ms => new Promise(r => setTimeout(r, ms));
  // Hero name mapper for CSS classes
  const getHeroName = id => {
    const names = {1: 'ironman', 2: 'torch', 3: 'venom'};
    return names[id] || 'default';
  };

  function showNotification(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      top: 15%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: var(--marvel-red);
      font-family: var(--font-header);
      padding: 15px 30px;
      border: 2px solid var(--marvel-red);
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(224,49,49,0.5);
      z-index: 9999;
      font-size: 1.5rem;
      letter-spacing: 1px;
      animation: fadeInOut 2.5s forwards;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
    
    if (!document.getElementById('toast-style')) {
      const style = document.createElement('style');
      style.id = 'toast-style';
      style.innerHTML = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          15% { opacity: 1; transform: translate(-50%, 0); }
          85% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -20px); }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2500);
  }

  socket.on('combat-animation', async (animData) => {
    try {
      if (typeof hideCardInfo === 'function') hideCardInfo();
      
      // Lock UI and pause timer
      document.getElementById('turn-overlay').style.display = 'flex';
      document.getElementById('turn-overlay').innerHTML = '<h1 style="font-family: var(--font-comic); font-size: 5rem; color: #f39c12; text-shadow: 0 0 20px #000; letter-spacing: 4px; animation: pulseTurn 1.5s infinite;">COMBAT!</h1>';
      if (gameTimerInterval) clearInterval(gameTimerInterval);
      
      if (animData.passiveMessages && animData.passiveMessages.length > 0) {
        animData.passiveMessages.forEach((msg, idx) => {
          setTimeout(() => showNotification(msg), idx * 2500);
        });
      }
      
      const { p1, p2 } = animData;
      const isP1 = (currentUser && p1.id === socket.id);
      
      const myAnim = isP1 ? p1 : p2;
      const enemyAnim = isP1 ? p2 : p1;

      const myHalf = document.querySelector('.player-half');
      const enemyHalf = document.querySelector('.enemy-half');
      const myAvatar = document.getElementById('player-avatar');
      const enemyAvatar = document.getElementById('enemy-avatar');

      const myHeroName = getHeroName(myAnim.heroId);
      const enemyHeroName = getHeroName(enemyAnim.heroId);

      const hasMyAtk = myAnim.totalAtk > 0;
      const hasMyDef = myAnim.totalDef > 0;
      const hasEnemyAtk = enemyAnim.totalAtk > 0;
      const hasEnemyDef = enemyAnim.totalDef > 0;

      // Spawn a hero-specific projectile at a fixed position
      const spawnProjectile = (heroName, type, targetId, offsetX, offsetY) => {
        const el = document.createElement('div');
        el.className = `combat-projectile proj-${heroName}-${type}`;
        const target = document.getElementById(targetId).parentElement;
        const rect = target.getBoundingClientRect();
        
        el.style.left = (rect.left + rect.width / 2 + offsetX) + 'px';
        el.style.top = (rect.top + rect.height / 2 + offsetY) + 'px';
        document.body.appendChild(el);
        return el;
      };

      // Phase 1: Spawn projectiles (only if they have atk/def)
      let myAtkProj = null, myDefProj = null, enemyAtkProj = null, enemyDefProj = null;

      if (hasMyAtk) {
        myAtkProj = spawnProjectile(myHeroName, 'atk', 'player-staged-cards', -40, -80);
      }
      if (hasMyDef) {
        myDefProj = spawnProjectile(myHeroName, 'def', 'player-staged-cards', 40, -80);
      }
      if (hasEnemyAtk) {
        enemyAtkProj = spawnProjectile(enemyHeroName, 'atk', 'enemy-staged-cards', -40, 80);
      }
      if (hasEnemyDef) {
        enemyDefProj = spawnProjectile(enemyHeroName, 'def', 'enemy-staged-cards', 40, 80);
      }

      await delay(100);

      // Make visible (triggers CSS scale transition)
      [myAtkProj, myDefProj, enemyAtkProj, enemyDefProj]
        .filter(Boolean)
        .forEach(c => c.classList.add('visible'));
      
      await delay(1200);

      const flightDuration = 900;
      const flyTo = (el, targetElem) => {
        if (!el) return;
        const target = targetElem.getBoundingClientRect();
        el.offsetHeight; // force reflow
        el.style.transition = `left ${flightDuration}ms cubic-bezier(0.25, 0.8, 0.25, 1), top ${flightDuration}ms cubic-bezier(0.25, 0.8, 0.25, 1)`;
        el.style.left = (target.left + target.width / 2) + 'px';
        el.style.top = (target.top + target.height / 2) + 'px';
      };

      // Phase 2: Defense flies to own hero (shield up)
      if (myDefProj) flyTo(myDefProj, myAvatar);
      if (enemyDefProj) flyTo(enemyDefProj, enemyAvatar);

      await delay(flightDuration);

      if (myDefProj) myDefProj.remove();
      if (enemyDefProj) enemyDefProj.remove();
      
      // Create shield overlays only if defense exists
      let myShield = null, enemyShield = null;

      if (hasMyDef) {
        myShield = document.createElement('div');
        myShield.className = `hero-shield-overlay shield-${myHeroName}`;
        myAvatar.parentElement.appendChild(myShield);
      }

      if (hasEnemyDef) {
        enemyShield = document.createElement('div');
        enemyShield.className = `hero-shield-overlay shield-${enemyHeroName}`;
        enemyAvatar.parentElement.appendChild(enemyShield);
      }

      await delay(500);

      // Phase 3: Attacks fly across to opponent
      if (myAtkProj) flyTo(myAtkProj, enemyAvatar);
      if (enemyAtkProj) flyTo(enemyAtkProj, myAvatar);

      await delay(flightDuration);

      if (myAtkProj) myAtkProj.remove();
      if (enemyAtkProj) enemyAtkProj.remove();

      // Impact explosions
      const spawnImpact = (targetElem, heroName) => {
        const impact = document.createElement('div');
        impact.className = `combat-impact impact-${heroName}`;
        targetElem.parentElement.appendChild(impact);
        setTimeout(() => impact.remove(), 800);
      };

      if (hasMyAtk) spawnImpact(enemyAvatar, myHeroName);
      if (hasEnemyAtk) spawnImpact(myAvatar, enemyHeroName);

      const spawnDamageText = (targetElem, amount, color) => {
        if (amount <= 0 || isNaN(amount)) return;
        const txt = document.createElement('div');
        txt.className = 'floating-dmg';
        txt.style.color = color;
        txt.textContent = '-' + amount;
        targetElem.parentElement.appendChild(txt);
        setTimeout(() => txt.remove(), 1200);
      };

      // Shield damage — show on the avatar that RECEIVED the damage
      spawnDamageText(myAvatar, myAnim.shieldDamageTaken, '#3498db');
      spawnDamageText(enemyAvatar, enemyAnim.shieldDamageTaken, '#3498db');

      if (myShield && myAnim.shieldDamageTaken > 0) myShield.classList.add('shield-hit');
      if (enemyShield && enemyAnim.shieldDamageTaken > 0) enemyShield.classList.add('shield-hit');

      await delay(600);

      // HP Damage — show on the avatar that RECEIVED the damage
      spawnDamageText(myAvatar, myAnim.hpDamageTaken, '#e03131');
      spawnDamageText(enemyAvatar, enemyAnim.hpDamageTaken, '#e03131');

      if (myAnim.hpDamageTaken > 0) myAvatar.parentElement.classList.add('hero-shake');
      if (enemyAnim.hpDamageTaken > 0) enemyAvatar.parentElement.classList.add('hero-shake');

      if (myShield && myAnim.hpDamageTaken > 0 && myAnim.startDef - myAnim.shieldDamageTaken <= 0) {
        myShield.classList.add('shield-break');
      }
      if (enemyShield && enemyAnim.hpDamageTaken > 0 && enemyAnim.startDef - enemyAnim.shieldDamageTaken <= 0) {
        enemyShield.classList.add('shield-break');
      }

      await delay(1000);
      
      if (myShield) myShield.remove();
      if (enemyShield) enemyShield.remove();
      myAvatar.parentElement.classList.remove('hero-shake');
      enemyAvatar.parentElement.classList.remove('hero-shake');
    } catch (error) {
      alert("Animation Error: " + error.message);
      console.error(error);
    }
  });

  socket.on('sync-game-state', (state) => {
    const oldPlayerHandCount = playerHand ? playerHand.length : 0;
    const oldEnemyHandCount = enemyHandCount || 0;

    // Detect turn flip to show overlay
    if (isMyTurn !== undefined && isMyTurn !== state.isMyTurn) {
      if (typeof hideCardInfo === 'function') hideCardInfo();
      
      if (state.isMyTurn === true) {
        showTurnOverlay('Enemy Turn is over', '#e03131', 'Your Turn!', '#4dabf7');
      } else if (state.isMyTurn === false) {
        showTurnOverlay('Your turn is over', '#4dabf7', 'Enemy Turn', '#e03131');
      } else {
        showTurnOverlay('Round Ending...', '#e67e22', 'Resolving Combat', '#e67e22');
      }
      
      // Reset timer
      if (gameTimerInterval) clearInterval(gameTimerInterval);
      gameTimeLeft = 60;
      document.querySelector('.timer').innerText = gameTimeLeft;
      gameTimerInterval = setInterval(() => {
        gameTimeLeft--;
        if (gameTimeLeft >= 0) {
          document.querySelector('.timer').innerText = gameTimeLeft;
        } else {
          gameTimeLeft = 60;
          document.querySelector('.timer').innerText = gameTimeLeft;
          if (isMyTurn) doPassTurn(); // Auto pass if time runs out
        }
      }, 1000);
    }

    isMyTurn = state.isMyTurn;
    updateEndTurnButton();

    if (state.roundCount) {
      if (state.roundCount > currentRoundCount) {
        if (state.roundCount % 5 === 1 && state.roundCount > 1) {
          showNotification('5 Rounds Passed: +3 Bonus AP!');
        }
        currentRoundCount = state.roundCount;
      }
      const roundEl = document.getElementById('round-counter');
      if (roundEl) roundEl.innerText = 'Round ' + state.roundCount;
    }

    playerHP = state.player.hp;
    playerAP = state.player.ap;
    playerMaxAP = state.player.maxAp;
    playerHand = state.player.hand || [];
    playerActiveCards = state.player.board || [];
    playerStagedCards = state.player.stagedCards || [];
    document.getElementById('player-hp').innerText = playerHP;

    enemyHP = state.opponent.hp;
    enemyAP = state.opponent.ap;
    enemyMaxAP = state.opponent.maxAp;
    enemyHandCount = state.opponent.handCount;
    enemyActiveCards = state.opponent.board || [];
    enemyStagedCount = state.opponent.stagedCount || 0;
    document.getElementById('enemy-hp').innerText = enemyHP;

    if (state.player && state.player.avatar) {
      document.getElementById('player-avatar').src = state.player.avatar;
    } else {
      document.getElementById('player-avatar').src = '/assets/images/default_avatar.png';
    }

    if (state.opponent && state.opponent.avatar) {
      document.getElementById('enemy-avatar').src = state.opponent.avatar;
    } else {
      document.getElementById('enemy-avatar').src = '/assets/images/default_avatar.png';
    }

    const newPlayerDraws = Math.max(0, playerHand.length - oldPlayerHandCount);
    const newEnemyDraws = Math.max(0, enemyHandCount - oldEnemyHandCount);

    if (newPlayerDraws > 0 || newEnemyDraws > 0) {
      animateDrawCards(newPlayerDraws, newEnemyDraws);
    } else {
      renderBoard();
    }
  });

  socket.on('game-over', ({ outcome, opponentNickname, winnerNickname }) => {
    exitRoom();
    const banner = document.getElementById('reconnect-banner');
    if (banner) banner.remove();
    
    if (outcome === 'draw') {
      showGameResult('DRAW', 'Both heroes fell in battle!', '#f39c12');
    } else if (winnerNickname === currentUser.nickname || outcome === 'win') {
      // If outcome === 'win' from old format or winnerNickname matches us
      // Actually, outcome is always 'win' when not draw, and winnerNickname is provided.
      // But if opponent disconnected, checkWinCondition wasn't called, wait!
      // 'opponent disconnected' game-over might still use the old format.
      // Wait, let's just check if we are the winner.
      if (winnerNickname === currentUser.nickname || !winnerNickname) {
         showGameResult('VICTORY', `${opponentNickname} disconnected or HP reached 0.`, '#2ecc71');
      } else {
         showGameResult('DEFEAT', 'You resigned, ran out of time, or HP reached 0.', '#e03131');
      }
    } else {
      showGameResult('DEFEAT', 'You resigned, ran out of time, or HP reached 0.', '#e03131');
    }
  });

  socket.on('opponent-reconnecting', ({ secondsLeft, rejoinsLeft }) => {
    let banner = document.getElementById('reconnect-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'reconnect-banner';
      banner.className = 'reconnect-banner';
      document.getElementById('view-game').appendChild(banner);
    }
    banner.innerHTML = `
      <span class="rb-icon">⚠️</span>
      <span class="rb-text">Opponent disconnected &mdash; waiting for them to return (<span id="rb-count">${secondsLeft}</span>s) &middot; ${rejoinsLeft} rejoins left</span>
    `;
    let secs = secondsLeft;
    if (window._rbInterval) clearInterval(window._rbInterval);
    window._rbInterval = setInterval(() => {
      secs--;
      const el = document.getElementById('rb-count');
      if (el) el.textContent = secs;
      if (secs <= 0) clearInterval(window._rbInterval);
    }, 1000);
  });

  socket.on('opponent-reconnected', ({ nickname }) => {
    const banner = document.getElementById('reconnect-banner');
    if (banner) banner.remove();
    if (window._rbInterval) clearInterval(window._rbInterval);
  });

  // Room no longer exists (game ended, never existed, or player not in it)
  socket.on('room-gone', () => {
    exitRoom(); // clears sessionStorage and in-room state
    navigate('lobby');
  });

  // Player refreshed while in the waiting room — bring them back to it
  socket.on('waiting-room-restore', ({ roomId }) => {
    currentRoomId = roomId;
    inRoom = true;
    navigate('waiting');
    startWaitingTips();
  });

  socket.on('error', (msg) => showNotification(msg));
}

window.handleCreateRoom = function(e) {
  e.preventDefault();
  if (!currentUser.heroId) {
    showNotification('Please select a hero first!');
    navigate('character-info');
    return;
  }
  const name = document.getElementById('create-room-name').value;
  const isPrivate = document.getElementById('create-room-private').checked;
  const password = document.getElementById('create-room-password').value;
  socket.emit('create-room', { name, isPrivate, password, nickname: currentUser.nickname, heroId: currentUser.heroId, avatar: currentUser.avatar });
}

window.attemptJoinRoom = function(roomId, isPrivate) {
  if (!currentUser.heroId) {
    showNotification('Please select a hero first!');
    navigate('character-info');
    return;
  }
  if (isPrivate) {
    document.getElementById('join-private-id').value = roomId;
    document.getElementById('join-private-modal').style.display = 'block';
  } else {
    socket.emit('join-room', { roomId, nickname: currentUser.nickname, heroId: currentUser.heroId, avatar: currentUser.avatar });
  }
}

window.submitJoinPrivate = function() {
  const roomId = document.getElementById('join-private-id').value;
  const password = document.getElementById('join-private-password').value;
  document.getElementById('join-private-modal').style.display = 'none';
  socket.emit('join-room', { roomId, password, nickname: currentUser.nickname, heroId: currentUser.heroId, avatar: currentUser.avatar });
}

// ── Turn helpers ──────────────────────────────────────────────────────────────

function doPassTurn() {
  socket.emit('pass-turn', currentRoomId);
}

function updateEndTurnButton() {
  const btn = document.getElementById('end-turn-btn');
  if (!btn) return;
  btn.disabled = !isMyTurn;
  btn.style.opacity = isMyTurn ? '1' : '0.4';
  btn.style.cursor = isMyTurn ? 'pointer' : 'not-allowed';
  btn.textContent = 'End Turn';
  btn.classList.remove('ready');
}

function showTurnOverlay(firstText, firstColor, secondText, secondColor) {
  const overlay = document.getElementById('turn-overlay');
  overlay.style.display = 'flex';
  overlay.innerHTML = `<span class="overlay-text" style="color:${firstColor}">${firstText}</span>`;

  // After 1.5s swap to second message, then fade out
  setTimeout(() => {
    overlay.innerHTML = `<span class="overlay-text" style="color:${secondColor}">${secondText}</span>`;
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 1500);
  }, 1500);
}

window.handleEndTurn = function() {
  if (!isMyTurn) return;
  if (currentUser.confirm_end_turn === 0 || currentUser.confirm_end_turn === false) {
    doPassTurn();
  } else {
    document.getElementById('end-turn-modal').style.display = 'flex';
  }
}

window.confirmEndTurn = function() {
  document.getElementById('end-turn-modal').style.display = 'none';
  const dontAsk = document.getElementById('dont-ask-end-turn').checked;
  if (dontAsk) {
    currentUser.confirm_end_turn = 0;
    saveSettingsToDB();
    localStorage.setItem('user', JSON.stringify(currentUser));
  }
  doPassTurn();
}

function enterGame(roomId) {
  currentRoomId = roomId;
  inRoom = true;
  // Persist so a refresh can reconnect
  localStorage.setItem('activeGame', JSON.stringify({ roomId, nickname: currentUser.nickname }));
  navigate('waiting');
  startWaitingTips();
  
  gameStarted = false;
  document.getElementById('enemy-nickname').innerText = 'Waiting...';
  document.getElementById('enemy-avatar').src = '/assets/images/default_avatar.png';
  document.getElementById('player-nickname').innerText = currentUser.nickname;
  document.getElementById('player-avatar').src = currentUser.avatar || '/assets/images/default_avatar.png';
  
  playerHand = [];
  playerActiveCards = [];
  enemyActiveCards = [];
  enemyHandCount = 0;
  enemyCardsPlayedThisTurn = 0;
  isMyTurn = false;
  
  // Initialize AP
  playerAP = 6;
  playerMaxAP = 15;
  enemyAP = 6;
  enemyMaxAP = 15;
  currentRoundCount = 1;
  
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  document.querySelector('.timer').innerText = '60';
  
  renderBoard();
  socket.emit('check-game-state', { roomId, nickname: currentUser.nickname });
}

window.waitingTipsInterval = null;
let waitingTipsList = [];

async function startWaitingTips() {
  if (window.waitingTipsInterval) clearInterval(window.waitingTipsInterval);
  const tipEl = document.getElementById('waiting-tip');
  
  if (waitingTipsList.length === 0) {
    try {
      const res = await fetch('/data/tips.json');
      if (res.ok) {
        waitingTipsList = await res.json();
      } else {
        waitingTipsList = ["Wait for your opponent to join."];
      }
    } catch (e) {
      waitingTipsList = ["Wait for your opponent to join."];
    }
  }

  const showRandomTip = () => {
    if (waitingTipsList.length > 0) {
      const tip = waitingTipsList[Math.floor(Math.random() * waitingTipsList.length)];
      tipEl.style.opacity = 0;
      setTimeout(() => {
        tipEl.innerText = tip;
        tipEl.style.opacity = 1;
        tipEl.style.transition = "opacity 0.5s";
      }, 500);
    }
  };

  showRandomTip();
  window.waitingTipsInterval = setInterval(showRandomTip, 5000);
}

function exitRoom() {
  inRoom = false;
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  if (window.waitingTipsInterval) clearInterval(window.waitingTipsInterval);
  currentRoomId = null;
  gameStarted = false;
  
  // Clear persistent UI state
  playerHand = [];
  playerActiveCards = [];
  playerStagedCards = [];
  enemyActiveCards = [];
  enemyHandCount = 0;
  enemyStagedCount = 0;
  
  // Clear backgrounds
  const playerBg = document.getElementById('hero-bg-player');
  const enemyBg = document.getElementById('hero-bg-enemy');
  if (playerBg) { playerBg.className = 'hero-bg-overlay hero-bg-bottom'; playerBg.innerHTML = ''; }
  if (enemyBg) { enemyBg.className = 'hero-bg-overlay hero-bg-top'; enemyBg.innerHTML = ''; }
  
  // Clear reconnect session
  localStorage.removeItem('activeGame');
}

window.showNotification = function(message, type = 'error') {
  const el = document.createElement('div');
  el.className = `in-game-notification ${type}`;
  el.innerText = message;
  document.body.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.remove();
  }, 3000);
};

function showGameResult(title, subtitle, color) {
  // Ensure we unlock navigation first
  inRoom = false;

  let overlay = document.getElementById('game-result-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'game-result-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="gr-box">
      <div class="gr-title" style="color:${color}">${title}</div>
      <div class="gr-subtitle">${subtitle}</div>
      <div class="gr-countdown">Returning to lobby in <span id="gr-count">3</span>s...</div>
    </div>
  `;
  overlay.style.display = 'flex';

  // Countdown then navigate
  let secs = 3;
  const tick = setInterval(() => {
    secs--;
    const el = document.getElementById('gr-count');
    if (el) el.textContent = secs;
    if (secs <= 0) {
      clearInterval(tick);
      overlay.style.display = 'none';
      navigate('lobby');
    }
  }, 1000);
}

// Called from Resign button inside active game
// Called from Resign button inside active game
window.handleResign = function() {
  if (!currentRoomId) return;
  if (currentUser.confirm_resign === 0 || currentUser.confirm_resign === false) {
    window.confirmResign();
  } else {
    document.getElementById('resign-modal').style.display = 'flex';
  }
};

window.confirmResign = function() {
  document.getElementById('resign-modal').style.display = 'none';
  const dontAsk = document.getElementById('dont-ask-resign').checked;
  if (dontAsk) {
    currentUser.confirm_resign = 0;
    saveSettingsToDB();
    localStorage.setItem('user', JSON.stringify(currentUser));
  }
  socket.emit('leave-room', currentRoomId);
  // Don't navigate here; wait for 'game-over' from server to show results
};

// Called from Cancel/Leave button inside waiting room
window.handleLeaveWaiting = function() {
  if (!currentRoomId) return;
  socket.emit('leave-room', currentRoomId);
  exitRoom();
  navigate('lobby');
};

// Generic leave (kept for backward compat — routes to the right handler)
window.handleLeaveGame = function() {
  if (gameStarted) {
    window.handleResign();
  } else {
    window.handleLeaveWaiting();
  }
};

window.playCard = function(cardUid) {
  if (!gameStarted) return showNotification('Waiting for opponent!');
  if (!isMyTurn) return; // block if not your turn

  
  const cardIndex = playerHand.findIndex(c => c.uid === cardUid);
  if (cardIndex !== -1) {
    const card = playerHand[cardIndex];
    if (playerAP < card.cost) return showNotification("Not enough AP!");
    
    // Let the server validate and apply the move.
    // For now, Trade/Hybrid cards always attack the enemy Hero directly.
    socket.emit('play-card', { 
      roomId: currentRoomId, 
      cardUid: card.uid, 
      targetUid: 'hero' 
    });
  }
};

function renderBoard() {
  // Update turn indicator
  const indicator = document.getElementById('turn-indicator');
  if (indicator) {
    if (!gameStarted) {
      indicator.textContent = 'Waiting for opponent...';
      indicator.className = 'turn-indicator waiting';
    } else if (isMyTurn) {
      indicator.textContent = '⚔ Your Turn';
      indicator.className = 'turn-indicator my-turn';
    } else {
      indicator.textContent = '🛡 Enemy Turn';
      indicator.className = 'turn-indicator enemy-turn';
    }
  }

  // Update AP Displays
  const pApText = document.getElementById('player-ap-text');
  const pApBubbles = document.getElementById('player-ap-bubbles');
  const eApText = document.getElementById('enemy-ap-text');
  const eApBubbles = document.getElementById('enemy-ap-bubbles');

  if (pApText && pApBubbles) {
    pApText.textContent = `${playerAP}/${AP_CAP}`;
    pApBubbles.innerHTML = '';
    for (let i = 0; i < AP_CAP; i++) {
      let state = 'locked';
      if (i < playerMaxAP) {
        state = i < playerAP ? 'filled' : 'empty';
      }
      pApBubbles.innerHTML += `<div class="ap-bubble ${state}"></div>`;
    }
  }

  if (eApText && eApBubbles) {
    eApText.textContent = `${enemyAP}/${AP_CAP}`;
    eApBubbles.innerHTML = '';
    for (let i = 0; i < AP_CAP; i++) {
      let state = 'locked';
      if (i < enemyMaxAP) {
        state = i < enemyAP ? 'filled' : 'empty';
      }
      eApBubbles.innerHTML += `<div class="ap-bubble ${state}"></div>`;
    }
  }

  // Render Player Hand — only clickable on your turn
  const pHandList = document.getElementById('player-hand-list');
  pHandList.innerHTML = '';
  
  playerHand.forEach((card, idx) => {
    const mid = (playerHand.length - 1) / 2;
    const offset = idx - mid;
    const rotate = offset * 6;
    const translateY = Math.abs(offset) * 12;
    const translateX = offset * 40;
    const onClickStr = isMyTurn ? `playCard('${card.uid}')` : null;
    const canAfford = playerAP >= card.cost;
    
    pHandList.innerHTML += `
      <li class="hand-slot${isMyTurn ? '' : ' no-play'}" style="transform: translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(0.7)">
        ${renderCard(card, true, onClickStr, canAfford)}
      </li>
    `;
  });

  // Render Enemy Hand
  const eHandList = document.getElementById('enemy-hand-list');
  eHandList.innerHTML = '';
  for (let i = 0; i < enemyHandCount; i++) {
    const mid = (enemyHandCount - 1) / 2;
    const offset = i - mid;
    const rotate = offset * -6;
    const translateY = Math.abs(offset) * -12;
    const translateX = offset * 40;
    eHandList.innerHTML += `
      <li class="card-back" style="transform: translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(0.7)">
        <div class="card-back-stamp">M</div>
      </li>
    `;
  }

  // Render Enemy Staged
  const eStagedList = document.getElementById('enemy-staged-cards');
  eStagedList.innerHTML = '';
  for (let i = 0; i < enemyStagedCount; i++) {
    eStagedList.innerHTML += `
      <li class="card-back" style="transform: scale(0.6)">
        <div class="card-back-stamp">?</div>
      </li>
    `;
  }

  // Render Active Cards
  const pActiveList = document.getElementById('player-active-cards');
  pActiveList.innerHTML = playerActiveCards.map(c => `<li class="active-card-slot">${renderBoardCard(c, false)}</li>`).join('');
  
  const eActiveList = document.getElementById('enemy-active-cards');
  eActiveList.innerHTML = enemyActiveCards.map(c => `<li class="active-card-slot">${renderBoardCard(c, false)}</li>`).join('');

  // Render Player Staged
  const pStagedList = document.getElementById('player-staged-cards');
  pStagedList.innerHTML = playerStagedCards.map(c => `<li class="active-card-slot" style="transform: scale(0.9)">${renderBoardCard(c, true)}</li>`).join('');
}
