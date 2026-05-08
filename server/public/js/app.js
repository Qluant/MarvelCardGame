// Global State
let currentUser = null;
let currentRoomId = null;
let socket = null;
let playerHand = [];
let playerActiveCards = [];
let enemyActiveCards = [];
let enemyHandCount = 0;
let gameStarted = false;

const API_URL = 'http://localhost:3000/api';

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

// Router
function navigate(viewName) {
  document.querySelectorAll('.view').forEach(v => {
    v.style.display = 'none';
    v.classList.remove('active');
  });
  
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
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
      body: JSON.stringify({ nickname, password })
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
  
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password })
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
         cardsHtml += `<div class="card-wrapper">${renderCard(c)}</div>`;
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
}

// Card Renderer
function renderCard(card, isHand = false, onClick = null) {
  const seed = card.name.replace(/\s/g, '');
  const placeholderImg = `https://picsum.photos/seed/${seed}/200/150`;
  const onClickStr = onClick ? `onclick="${onClick}"` : '';
  
  return `
    <div class="marvel-card" ${onClickStr}>
      <div class="card-cost">${card.cost}</div>
      <div class="card-image-container"><img src="${placeholderImg}" alt="${card.name}" class="card-image"/></div>
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
    gameStarted = true;
    const opponent = room.players.find(p => p.nickname !== currentUser.nickname);
    if (opponent) {
      document.getElementById('enemy-nickname').innerText = opponent.nickname;
      document.getElementById('enemy-avatar').src = `https://picsum.photos/seed/${opponent.nickname}/120/120`;
      enemyHandCount = 3;
      renderBoard();
    }
  });

  socket.on('move-made', (data) => {
    if (data.playerId !== socket.id) {
      enemyHandCount = Math.max(0, enemyHandCount - 1);
      enemyActiveCards.push(data.move);
      renderBoard();
    }
  });

  socket.on('player-left', () => {
    alert('Opponent left! You win!');
    navigate('lobby');
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
    enterGame(roomId);
  }
}

window.submitJoinPrivate = function() {
  const roomId = document.getElementById('join-private-id').value;
  const password = document.getElementById('join-private-password').value;
  document.getElementById('join-private-modal').style.display = 'none';
  socket.emit('join-room', { roomId, password, nickname: currentUser.nickname });
  enterGame(roomId);
}

function enterGame(roomId) {
  currentRoomId = roomId;
  navigate('game');
  
  gameStarted = false;
  document.getElementById('enemy-nickname').innerText = 'Waiting...';
  document.getElementById('enemy-avatar').src = '';
  document.getElementById('player-nickname').innerText = currentUser.nickname;
  document.getElementById('player-avatar').src = `https://picsum.photos/seed/${currentUser.nickname}/120/120`;
  
  playerHand = [
    { id: 1, name: 'Unibeam', category: 'Trade', cost: 5, attack: 8, defense: 0, description: 'Concentrated beam.' },
    { id: 2, name: 'Stark Decoy', category: 'Summon', cost: 1, attack: 1, defense: 2, description: 'Holographic decoy.' },
  ];
  playerActiveCards = [];
  enemyActiveCards = [];
  enemyHandCount = 0;
  
  renderBoard();
  socket.emit('check-game-state', { roomId, nickname: currentUser.nickname });
}

window.handleLeaveGame = function() {
  socket.emit('leave-room', currentRoomId);
  navigate('lobby');
}

window.playCard = function(cardId) {
  if (!gameStarted) return alert("Waiting for opponent!");
  if (playerActiveCards.length >= 7) return;
  
  const cardIndex = playerHand.findIndex(c => c.id === cardId);
  if (cardIndex !== -1) {
    const card = playerHand[cardIndex];
    playerHand.splice(cardIndex, 1);
    playerActiveCards.push(card);
    socket.emit('make-move', { roomId: currentRoomId, move: card });
    renderBoard();
  }
};

function renderBoard() {
  // Render Player Hand
  const pHandList = document.getElementById('player-hand-list');
  pHandList.innerHTML = '';
  playerHand.forEach((card, idx) => {
    const mid = (playerHand.length - 1) / 2;
    const offset = idx - mid;
    const rotate = offset * 4;
    const translateY = Math.abs(offset) * 8;
    
    pHandList.innerHTML += `
      <li class="hand-slot" style="transform: rotate(${rotate}deg) translateY(${translateY}px)">
        ${renderCard(card, true, `playCard(${card.id})`)}
      </li>
    `;
  });

  // Render Enemy Hand
  const eHandList = document.getElementById('enemy-hand-list');
  eHandList.innerHTML = '';
  for (let i = 0; i < enemyHandCount; i++) {
    const mid = (enemyHandCount - 1) / 2;
    const offset = i - mid;
    const rotate = offset * -4;
    const translateY = Math.abs(offset) * -8;
    eHandList.innerHTML += `
      <li class="card-back" style="transform: rotate(${rotate}deg) translateY(${translateY}px)">
        <div class="card-back-stamp">M</div>
      </li>
    `;
  }

  // Render Active Cards
  const pActiveList = document.getElementById('player-active-cards');
  pActiveList.innerHTML = playerActiveCards.map(c => `<li class="active-card-slot">${renderCard(c)}</li>`).join('');
  
  const eActiveList = document.getElementById('enemy-active-cards');
  eActiveList.innerHTML = enemyActiveCards.map(c => `<li class="active-card-slot">${renderCard(c)}</li>`).join('');
}
