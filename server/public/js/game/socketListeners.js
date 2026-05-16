// All socket.on() handlers. Called once from initSocket() in socket.js.
// References AppState, renderBoard, animateDrawCards, showTurnOverlay, etc.
// All those functions are defined in earlier scripts in the load order.

function setupSocketListeners() {
  const socket = AppState.socket;

  socket.on('rooms-update', (rooms) => {
    const container = document.getElementById('lobby-rooms-container');
    if (!container) return;
    if (rooms.length === 0) { container.innerHTML = '<p>No open rooms. Create one!</p>'; return; }
    let html = '<ul>';
    rooms.forEach((room) => {
      html += `<li class="room-item"><span>${room.name} ${room.isPrivate ? '🔒' : ''}</span><button onclick="attemptJoinRoom('${room.id}', ${room.isPrivate})">Join</button></li>`;
    });
    container.innerHTML = html + '</ul>';
  });

  socket.on('room-created', (room) => {
    enterGame(room.id);
  });

  socket.on('game-start', (room) => {
    if (window.waitingTipsInterval) clearInterval(window.waitingTipsInterval);
    const isReconnect = AppState.currentRoomId === room.id && AppState.gameStarted;

    if (!AppState.currentRoomId || AppState.currentRoomId !== room.id) {
      AppState.currentRoomId = room.id;
      AppState.inRoom = true;
      localStorage.setItem('activeGame', JSON.stringify({ roomId: room.id, nickname: AppState.currentUser.nickname }));
      AppState.gameStarted = false;
      document.getElementById('player-avatar').src = AppState.currentUser.avatar || '/assets/images/avatar.jpg';
      document.getElementById('enemy-nickname').innerText = 'Opponent';
      document.getElementById('enemy-avatar').src = '/assets/images/avatar.jpg';
      AppState.playerHand = [];
      AppState.enemyHandCount = 0;
      AppState.currentRoundCount = 1;
      AppState.playerAP = 6; AppState.playerMaxAP = 15;
      AppState.enemyAP = 6;  AppState.enemyMaxAP = 15;
    }

    AppState.inRoom = false; navigate('game'); AppState.inRoom = true;
    document.getElementById('player-nickname').innerText = AppState.currentUser.nickname;
    AppState.gameStarted = true;
    AppState.isMyTurn = room.players[0].id === socket.id;
    updateEndTurnButton();

    const me       = room.players.find((p) => p.id === socket.id) || room.players[0];
    const opponent = room.players.find((p) => p.id !== socket.id) || room.players[0];
    if (opponent) {
      document.getElementById('enemy-nickname').innerText = opponent.nickname;
      document.getElementById('enemy-avatar').src = opponent.avatar || '/assets/images/avatar.jpg';
      if (!isReconnect) {
        AppState.enemyHandCount = 0; AppState.currentRoundCount = 1;
        AppState.playerAP = 6; AppState.playerMaxAP = 15;
        AppState.enemyAP = 6;  AppState.enemyMaxAP = 15;
        AppState.initialCoinTossDone = false;
      } else { AppState.initialCoinTossDone = true; }

      // Apply hero backgrounds
      const heroHalfClass = (id) => ({1:'half-ironman',2:'half-torch',3:'half-venom'}[id]||'');
      const applyHeroBg = (bgElem, heroId) => {
        if (!bgElem) return;
        bgElem.className = bgElem.className.replace(/half-\w+/g,'').trim();
        bgElem.innerHTML = '';
        const cls = heroHalfClass(heroId);
        if (cls) bgElem.classList.add(cls);
        if (heroId === 2) {
          for (let i = 0; i < 40; i++) {
            const wrapper = document.createElement('div'); wrapper.className = 'torch-spark-wrapper';
            wrapper.style.left = (Math.random()*100)+'%';
            const durY = Math.random()*2.5+2, durX = Math.random()*1.5+1, d = Math.random()*3;
            const endX = (Math.random()<0.5?-1:1)*(Math.random()*40+20)+'px';
            wrapper.style.setProperty('--dur-y',durY+'s'); wrapper.style.setProperty('--delay',d+'s');
            const spark = document.createElement('div'); spark.className='torch-spark-particle';
            spark.style.setProperty('--dur-x',durX+'s'); spark.style.setProperty('--end-x',endX);
            spark.style.background = Math.random()>0.5?'#ffeb3b':'#ff9800';
            wrapper.appendChild(spark); bgElem.appendChild(wrapper);
          }
        }
      };
      applyHeroBg(document.getElementById('hero-bg-player'), me.heroId);
      applyHeroBg(document.getElementById('hero-bg-enemy'), opponent.heroId);
      renderBoard();
    }
  });

  socket.on('coin-flip', ({ winnerId, winnerNickname }) => {
    AppState.isMyTurn = (winnerId === socket.id);
    if (!AppState.initialCoinTossDone) {
      AppState.initialCoinTossDone = true;
      window.startCoinFlipAnimation(winnerNickname);
    }
  });

  socket.on('turn-order-change', ({ firstPlayerId, firstPlayerNickname }) => {
    // Intentionally left blank. The user requested to only keep the blue/red turn text.
  });

  socket.on('combat-animation', async (animData) => {
    await runCombatAnimation(animData);
  });

  socket.on('sync-game-state', (state) => {
    const oldPlayerHandCount = AppState.playerHand ? AppState.playerHand.length : 0;
    const oldEnemyHandCount  = AppState.enemyHandCount || 0;
    const oldPlayerStagedCount = AppState.playerStagedCards ? AppState.playerStagedCards.length : 0;

    if (AppState.isMyTurn !== undefined && AppState.isMyTurn !== state.isMyTurn) {
      if (typeof hideCardInfo === 'function') hideCardInfo();
      if (state.isMyTurn === true) {
        const preText = AppState.isMyTurn === null ? 'Next Round' : 'Enemy Turn is over';
        showTurnOverlay(preText, '#e03131', 'Your Turn!', '#4dabf7');
      } else if (state.isMyTurn === false && state.isMyTurn !== null) {
        const preText = AppState.isMyTurn === null ? 'Next Round' : 'Your turn is over';
        showTurnOverlay(preText, '#4dabf7', 'Enemy Turn', '#e03131');
      }
      
      // Reset timer on turn change
      if (AppState.gameTimerInterval) clearInterval(AppState.gameTimerInterval);
      AppState.gameTimeLeft = 60;
      document.querySelector('.timer').innerText = AppState.gameTimeLeft;
      AppState.gameTimerInterval = setInterval(() => {
        AppState.gameTimeLeft--;
        if (AppState.gameTimeLeft >= 0) {
          document.querySelector('.timer').innerText = AppState.gameTimeLeft;
        } else {
          AppState.gameTimeLeft = 60;
          document.querySelector('.timer').innerText = AppState.gameTimeLeft;
          if (AppState.isMyTurn) doPassTurn();
        }
      }, 1000);
    }

    AppState.isMyTurn = state.isMyTurn;
    updateEndTurnButton();

    if (state.roundCount) {
      if (state.roundCount > AppState.currentRoundCount) {
        if (state.roundCount % 5 === 1 && state.roundCount > 1) showNotification('5 Rounds Passed: +3 Bonus AP!', 'info');
        AppState.currentRoundCount = state.roundCount;
      }
      const roundEl = document.getElementById('round-counter');
      if (roundEl) roundEl.innerText = 'Round ' + state.roundCount;
    }

    AppState.playerHP  = state.player.hp;
    AppState.playerAP  = state.player.ap;
    AppState.playerMaxAP = state.player.maxAp;
    AppState.playerHand  = state.player.hand || [];
    AppState.playerActiveCards  = state.player.board || [];
    AppState.playerStagedCards  = state.player.stagedCards || [];
    document.getElementById('player-hp').innerText = AppState.playerHP;

    AppState.enemyHP   = state.opponent.hp;
    AppState.enemyAP   = state.opponent.ap;
    AppState.enemyMaxAP  = state.opponent.maxAp;
    AppState.enemyHandCount = state.opponent.handCount;
    AppState.enemyActiveCards   = state.opponent.board || [];
    AppState.enemyStagedCount   = state.opponent.stagedCount || 0;
    document.getElementById('enemy-hp').innerText = AppState.enemyHP;

    document.getElementById('player-avatar').src = (state.player.avatar) || '/assets/images/avatar.jpg';
    document.getElementById('enemy-avatar').src  = (state.opponent.avatar) || '/assets/images/avatar.jpg';

    const newPlayerDraws = Math.max(0, AppState.playerHand.length - oldPlayerHandCount);
    const newEnemyDraws  = Math.max(0, AppState.enemyHandCount - oldEnemyHandCount);
    const stagedDecreased = AppState.playerStagedCards.length < oldPlayerStagedCount;
    if ((newPlayerDraws > 0 || newEnemyDraws > 0) && !stagedDecreased) {
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
    } else if (winnerNickname === AppState.currentUser.nickname || (!winnerNickname && outcome === 'win')) {
      showGameResult('VICTORY', `${opponentNickname} disconnected or HP reached 0.`, '#2ecc71');
    } else {
      showGameResult('DEFEAT', 'You resigned, ran out of time, or HP reached 0.', '#e03131');
    }
  });

  socket.on('opponent-reconnecting', ({ secondsLeft, rejoinsLeft }) => {
    let banner = document.getElementById('reconnect-banner');
    if (!banner) { banner = document.createElement('div'); banner.id = 'reconnect-banner'; banner.className = 'reconnect-banner'; document.getElementById('view-game').appendChild(banner); }
    banner.innerHTML = `<span class="rb-icon">⚠️</span><span class="rb-text">Opponent disconnected &mdash; waiting (<span id="rb-count">${secondsLeft}</span>s) &middot; ${rejoinsLeft} rejoins left</span>`;
    let secs = secondsLeft;
    if (window._rbInterval) clearInterval(window._rbInterval);
    window._rbInterval = setInterval(() => { secs--; const el = document.getElementById('rb-count'); if (el) el.textContent = secs; if (secs <= 0) clearInterval(window._rbInterval); }, 1000);
  });

  socket.on('opponent-reconnected', () => {
    const banner = document.getElementById('reconnect-banner');
    if (banner) banner.remove();
    if (window._rbInterval) clearInterval(window._rbInterval);
  });

  socket.on('room-gone', () => { exitRoom(); navigate('lobby'); });

  socket.on('waiting-room-restore', ({ roomId }) => {
    AppState.currentRoomId = roomId;
    AppState.inRoom = true;
    navigate('waiting');
    startWaitingTips();
  });

  socket.on('duplicate-tab', () => {
    alert('Session duplicated in another tab. This tab will be logged out.');
    handleLogout();
  });

  socket.on('error', (msg) => showNotification(msg));
}
