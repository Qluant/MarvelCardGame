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
// Action Points
let playerAP = 3;
let playerMaxAP = 3;
let enemyAP = 3;
let enemyMaxAP = 3;
const AP_CAP = 10;

const API_URL = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
  }
  
  // Connect socket
  socket = io();
  setupSocketListeners();
  
  updateHeaderAuth();
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
  if (viewName === 'profile' && currentUser) loadProfile();
  if (viewName === 'info') loadInfo();
  if (viewName === 'lobby') {
    if (!currentUser) return navigate('login');
    socket.emit('get-rooms');
  }
}

window.navigate = navigate; // expose to global scope for HTML onclick

// Auth Logic
window.handleLogin = async function(e) {
  e.preventDefault();
  const nickname = document.getElementById('login-nickname').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nickname, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      currentUser = { nickname };
      localStorage.setItem('user', JSON.stringify(currentUser));
      updateHeaderAuth();
      navigate('lobby');
    } else {
      alert(data.error);
    }
  } catch (err) { alert('Login failed'); }
}

window.handleRegister = async function(e) {
  e.preventDefault();
  const nickname = document.getElementById('reg-nickname').value;
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;

  if (password !== confirmPassword) {
    alert('Passwords do not match!');
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nickname, password })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Registered! Please login.');
      navigate('login');
    } else {
      alert(data.error);
    }
  } catch (err) { alert('Registration failed'); }
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
    tbody.innerHTML += `<tr><td>#${idx+1}</td><td>${p.nickname}</td><td>${p.wins}</td><td>${p.loses}</td><td>${p.winstreak}</td></tr>`;
  });
}

async function loadProfile() {
  const res = await fetch(`${API_URL}/players/${currentUser.nickname}`);
  const p = await res.json();
  document.getElementById('profile-title').innerText = `${p.nickname}'s Profile`;
  document.getElementById('profile-games').innerText = p.games_played;
  document.getElementById('profile-wins').innerText = p.wins;
  document.getElementById('profile-loses').innerText = p.loses;
  document.getElementById('profile-winstreak').innerText = p.winstreak;
}

async function loadInfo() {
  const res = await fetch(`${API_URL}/info/heroes`);
  const data = await res.json();
  const list = document.getElementById('info-heroes-list');
  list.innerHTML = '';

  data.forEach(hero => {
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
      <div class="hero-section glass-panel">
        <h3>${hero.alias}</h3>
        <div class="hero-cards">${cardsHtml}</div>
      </div>
    `;
  });

  initCardPreview();
}

function initCardPreview() {
  // Create singleton tooltip if not yet present
  let tooltip = document.getElementById('card-preview-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'card-preview-tooltip';
    tooltip.className = 'card-preview-tooltip';
    document.body.appendChild(tooltip);
  }

  // Delegate events from the info list
  const list = document.getElementById('info-heroes-list');

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

// Map a card name to its local image path (name -> snake_case filename)
function cardImageUrl(cardName) {
  const filename = cardName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
  return `/assets/images/${filename}.jpg`;
}

// Card Renderer (hand / info view)
function renderCard(card, isHand = false, onClick = null) {
  const imgSrc = cardImageUrl(card.name);
  const onClickStr = onClick ? `onclick="${onClick}"` : '';
  
  return `
    <div class="marvel-card" ${onClickStr}>
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

// Compact board card renderer (Hearthstone-style: image + stat badges only)
function renderBoardCard(card) {
  const imgSrc = cardImageUrl(card.name);
  return `
    <div class="board-minion" title="${card.name}: ${card.description}">
      <img src="${imgSrc}" alt="${card.name}" class="board-minion-img"/>
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

    // If this player joined via join-room (not create-room), enterGame was never called —
    // initialise the full game state here
    if (!currentRoomId || currentRoomId !== room.id) {
      currentRoomId = room.id;
      inRoom = true;
      gameStarted = false;
      document.getElementById('player-nickname').innerText = currentUser.nickname;
      document.getElementById('player-avatar').src = ``;
      document.getElementById('enemy-nickname').innerText = 'Opponent';
      document.getElementById('enemy-avatar').src = '';
      playerHand = [
        { id: 1, name: 'Unibeam',     category: 'Trade',  cost: 5, attack: 8, defense: 0, description: 'Concentrated beam.' },
        { id: 2, name: 'Stark Tech Decoy', category: 'Summon', cost: 1, attack: 1, defense: 2, description: 'Holographic decoy.' },
      ];
      playerActiveCards = [];
      enemyActiveCards = [];
      enemyHandCount = 0;
      playerAP = 3; playerMaxAP = 3;
      enemyAP = 3;  enemyMaxAP = 3;
    }

    // Unlock temporarily so navigate to 'game' is allowed from 'waiting' or 'lobby'
    inRoom = false;
    navigate('game');
    inRoom = true;

    gameStarted = true;
    // First player in the room goes first
    isMyTurn = room.players[0].id === socket.id;
    updateEndTurnButton();
    const opponent = room.players.find(p => p.id !== socket.id) || room.players[0];
    if (opponent) {
      document.getElementById('enemy-nickname').innerText = opponent.nickname;
      document.getElementById('enemy-avatar').src = ``;
      enemyHandCount = playerHand.length; // mirror our own hand size
      // Both start with 3 AP
      playerAP = 3; playerMaxAP = 3;
      enemyAP = 3;  enemyMaxAP = 3;
      renderBoard();
      
      // Start Timer
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
    }
  });

  socket.on('move-made', (data) => {
    if (data.passTurn) {
      // Flip whose turn it is
      isMyTurn = !isMyTurn;
      updateEndTurnButton();

      // AP: the player whose turn is STARTING gets +1 max and +1 current AP (accumulation)
      if (data.playerId === socket.id) {
        // I just passed → enemy's turn starts
        enemyMaxAP = Math.min(enemyMaxAP + 1, AP_CAP);
        enemyAP    = Math.min(enemyAP + 1, enemyMaxAP);
      } else {
        // Enemy just passed → my turn starts
        playerMaxAP = Math.min(playerMaxAP + 1, AP_CAP);
        playerAP    = Math.min(playerAP + 1, playerMaxAP);
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
          doPassTurn();
        }
      }, 1000);

      // Show turn change overlay
      if (data.playerId === socket.id) {
        showTurnOverlay('Your turn is over', '#4dabf7', 'Enemy Turn', '#e03131');
      } else {
        showTurnOverlay('Enemy Turn is over', '#e03131', 'Your Turn!', '#4dabf7');
      }
      renderBoard();
      return;
    }
    
    if (data.playerId !== socket.id) {
      // Enemy played a card — deduct their AP and remove a card back
      enemyHandCount = Math.max(0, enemyHandCount - 1);
      enemyAP = Math.max(0, enemyAP - (data.move ? data.move.cost : 0));
      enemyActiveCards.push(data.move);
      renderBoard();
    }
  });

  socket.on('game-over', ({ outcome, opponentNickname }) => {
    exitRoom();
    if (outcome === 'win') {
      showGameResult('VICTORY', `${opponentNickname} has resigned.`, '#2ecc71');
    } else {
      showGameResult('DEFEAT', 'You have resigned.', '#e03131');
    }
  });

  socket.on('error', (msg) => alert(msg));
}

window.handleCreateRoom = function(e) {
  e.preventDefault();
  const name = document.getElementById('create-room-name').value;
  const isPrivate = document.getElementById('create-room-private').checked;
  const password = document.getElementById('create-room-password').value;
  socket.emit('create-room', { name, isPrivate, password, nickname: currentUser.nickname });
}

window.attemptJoinRoom = function(roomId, isPrivate) {
  if (isPrivate) {
    document.getElementById('join-private-id').value = roomId;
    document.getElementById('join-private-modal').style.display = 'block';
  } else {
    socket.emit('join-room', { roomId, nickname: currentUser.nickname });
  }
}

window.submitJoinPrivate = function() {
  const roomId = document.getElementById('join-private-id').value;
  const password = document.getElementById('join-private-password').value;
  document.getElementById('join-private-modal').style.display = 'none';
  socket.emit('join-room', { roomId, password, nickname: currentUser.nickname });
}

// ── Turn helpers ──────────────────────────────────────────────────────────────

function doPassTurn() {
  socket.emit('make-move', { roomId: currentRoomId, move: null, passTurn: true });
}

function updateEndTurnButton() {
  const btn = document.getElementById('end-turn-btn');
  if (!btn) return;
  btn.disabled = !isMyTurn;
  btn.style.opacity = isMyTurn ? '1' : '0.4';
  btn.style.cursor = isMyTurn ? 'pointer' : 'not-allowed';
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
  document.getElementById('end-turn-modal').style.display = 'flex';
}

window.confirmEndTurn = function() {
  document.getElementById('end-turn-modal').style.display = 'none';
  doPassTurn();
}

function enterGame(roomId) {
  currentRoomId = roomId;
  inRoom = true;
  navigate('waiting');
  startWaitingTips();
  
  gameStarted = false;
  document.getElementById('enemy-nickname').innerText = 'Waiting...';
  document.getElementById('enemy-avatar').src = '';
  document.getElementById('player-nickname').innerText = currentUser.nickname;
  document.getElementById('player-avatar').src = ``;
  
  playerHand = [
    { id: 1, name: 'Unibeam', category: 'Trade', cost: 5, attack: 8, defense: 0, description: 'Concentrated beam.' },
    { id: 2, name: 'Stark Tech Decoy', category: 'Summon', cost: 1, attack: 1, defense: 2, description: 'Holographic decoy.' },
  ];
  playerActiveCards = [];
  enemyActiveCards = [];
  enemyHandCount = 0;
  enemyCardsPlayedThisTurn = 0;
  isMyTurn = false;
  
  // Initialize AP
  playerAP = 3;
  playerMaxAP = 3;
  enemyAP = 3;
  enemyMaxAP = 3;
  
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
}

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
window.handleResign = function() {
  if (!currentRoomId) return;
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

window.playCard = function(cardId) {
  if (!gameStarted) return alert('Waiting for opponent!');
  if (!isMyTurn) return; // silently block — not your turn
  
  const cardIndex = playerHand.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const card = playerHand[cardIndex];
    if (playerAP < card.cost) return alert("Not enough AP!");
    if (playerActiveCards.length >= 7) return;

    playerAP -= card.cost;
    playerHand.splice(cardIndex, 1);
    playerActiveCards.push(card);
    socket.emit('make-move', { roomId: currentRoomId, move: card, passTurn: false });
    renderBoard();
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
    pApText.textContent = `${playerAP}/10`;
    pApBubbles.innerHTML = '';
    // Always show 10 bubbles
    for (let i = 0; i < 10; i++) {
      let state = 'locked';
      if (i < playerMaxAP) {
        state = i < playerAP ? 'filled' : 'empty';
      }
      pApBubbles.innerHTML += `<div class="ap-bubble ${state}"></div>`;
    }
  }

  if (eApText && eApBubbles) {
    eApText.textContent = `${enemyAP}/10`;
    eApBubbles.innerHTML = '';
    // Always show 10 bubbles
    for (let i = 0; i < 10; i++) {
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
    const onClickStr = isMyTurn ? `playCard(${card.id})` : null;
    
    pHandList.innerHTML += `
      <li class="hand-slot${isMyTurn ? '' : ' no-play'}" style="transform: translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(0.7)">
        ${renderCard(card, true, onClickStr)}
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

  // Render Active Cards
  const pActiveList = document.getElementById('player-active-cards');
  pActiveList.innerHTML = playerActiveCards.map(c => `<li class="active-card-slot">${renderBoardCard(c)}</li>`).join('');
  
  const eActiveList = document.getElementById('enemy-active-cards');
  eActiveList.innerHTML = enemyActiveCards.map(c => `<li class="active-card-slot">${renderBoardCard(c)}</li>`).join('');
}
