// Card and board rendering. Reads AppState for current game state.

function cardImageUrl(cardName) {
  const filename = cardName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
  return `/assets/images/${filename}.jpg`;
}

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
    </div>`;
}

function renderBoardCard(card, isStaged = false) {
  const imgSrc = cardImageUrl(card.name);
  const encoded = encodeURIComponent(JSON.stringify(card));
  return `
    <div class="board-minion" onclick="showCardInfo('${encoded}', ${isStaged})">
      <img src="${imgSrc}" alt="${card.name}" class="board-minion-img"/>
      <div class="board-minion-name">${card.name}</div>
      <div class="board-minion-atk">${card.attack}</div>
      <div class="board-minion-def">${card.defense}</div>
    </div>`;
}

window.showCardInfo = function (encodedCard, isStaged) {
  if (AppState.currentCardInfoModal) AppState.currentCardInfoModal.remove();
  const card = JSON.parse(decodeURIComponent(encodedCard));

  const modal = document.createElement('div');
  modal.id = 'card-info-modal';
  Object.assign(modal.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: '9999',
    display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column',
    backdropFilter: 'blur(5px)',
  });
  modal.onclick = function () { hideCardInfo(); };

  let revokeBtnHtml = '';
  if (isStaged && AppState.isMyTurn) {
    revokeBtnHtml = `
      <button class="revoke-btn" onclick="revokeCard('${card.uid}'); event.stopPropagation();" title="Revoke Card" style="
        margin-top:120px;width:60px;height:60px;border-radius:50%;
        background:var(--marvel-red);color:white;border:2px solid rgba(255,255,255,0.5);
        font-size:28px;cursor:pointer;display:flex;justify-content:center;align-items:center;
        box-shadow:0 0 20px rgba(224,49,49,0.6);transition:transform 0.2s,box-shadow 0.2s;"
        onmouseover="this.style.transform='scale(1.1)'"
        onmouseout="this.style.transform='scale(1)'">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="4" x2="12" y2="20"></line>
          <polyline points="19 13 12 20 5 13"></polyline>
        </svg>
      </button>`;
  }

  modal.innerHTML = `
    <button onclick="hideCardInfo(); event.stopPropagation();" style="
      position:absolute;top:30px;right:30px;background:rgba(0,0,0,0.5);color:white;
      border:2px solid rgba(255,255,255,0.5);border-radius:50%;width:50px;height:50px;
      padding:0;cursor:pointer;display:flex;justify-content:center;align-items:center;
      transition:all 0.2s;z-index:10;"
      onmouseover="this.style.background='rgba(224,49,49,0.8)'"
      onmouseout="this.style.background='rgba(0,0,0,0.5)'">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div onclick="event.stopPropagation()" style="display:flex;flex-direction:column;align-items:center;">
      <div style="transform:scale(1.6);transform-origin:center;pointer-events:none;">${renderCard(card, false, null, true)}</div>
      ${revokeBtnHtml}
    </div>`;

  document.body.appendChild(modal);
  AppState.currentCardInfoModal = modal;
};

window.hideCardInfo = function () {
  if (AppState.currentCardInfoModal) {
    AppState.currentCardInfoModal.remove();
    AppState.currentCardInfoModal = null;
  }
};

function renderBoard() {
  // Turn indicator
  const indicator = document.getElementById('turn-indicator');
  if (indicator) {
    if (!AppState.gameStarted) {
      indicator.textContent = 'Waiting for opponent...';
      indicator.className = 'turn-indicator waiting';
    } else if (AppState.isMyTurn) {
      indicator.textContent = '⚔ Your Turn';
      indicator.className = 'turn-indicator my-turn';
    } else {
      indicator.textContent = '🛡 Enemy Turn';
      indicator.className = 'turn-indicator enemy-turn';
    }
  }

  // AP displays
  const pApText = document.getElementById('player-ap-text');
  const pApBubbles = document.getElementById('player-ap-bubbles');
  const eApText = document.getElementById('enemy-ap-text');
  const eApBubbles = document.getElementById('enemy-ap-bubbles');

  if (pApText && pApBubbles) {
    pApText.textContent = `${AppState.playerAP}/${AppState.AP_CAP}`;
    pApBubbles.innerHTML = '';
    for (let i = 0; i < AppState.AP_CAP; i++) {
      let state = 'locked';
      if (i < AppState.playerMaxAP) state = i < AppState.playerAP ? 'filled' : 'empty';
      pApBubbles.innerHTML += `<div class="ap-bubble ${state}"></div>`;
    }
  }

  if (eApText && eApBubbles) {
    eApText.textContent = `${AppState.enemyAP}/${AppState.AP_CAP}`;
    eApBubbles.innerHTML = '';
    for (let i = 0; i < AppState.AP_CAP; i++) {
      let state = 'locked';
      if (i < AppState.enemyMaxAP) state = i < AppState.enemyAP ? 'filled' : 'empty';
      eApBubbles.innerHTML += `<div class="ap-bubble ${state}"></div>`;
    }
  }

  // Player hand
  const pHandList = document.getElementById('player-hand-list');
  pHandList.innerHTML = '';
  AppState.playerHand.forEach((card, idx) => {
    const mid = (AppState.playerHand.length - 1) / 2;
    const offset = idx - mid;
    const rotate = offset * 6;
    const translateY = Math.abs(offset) * 12;
    const translateX = offset * 40;
    const onClickStr = AppState.isMyTurn ? `playCard('${card.uid}')` : null;
    const canAfford = AppState.playerAP >= card.cost;
    pHandList.innerHTML += `
      <li class="hand-slot${AppState.isMyTurn ? '' : ' no-play'}" style="transform:translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(0.7)">
        ${renderCard(card, true, onClickStr, canAfford)}
      </li>`;
  });

  // Enemy hand (face-down)
  const getCbClass = (heroId) => heroId === 1 ? ' card-back-ironman' : heroId === 2 ? ' card-back-torch' : heroId === 3 ? ' card-back-venom' : '';
  const playerCbClass = getCbClass(AppState.playerHeroId);
  const enemyCbClass = getCbClass(AppState.enemyHeroId);

  const pDeck = document.getElementById('player-deck');
  if (pDeck) pDeck.className = 'deck-visual' + playerCbClass;

  const eDeck = document.getElementById('enemy-deck');
  if (eDeck) eDeck.className = 'deck-visual' + enemyCbClass;

  const eHandList = document.getElementById('enemy-hand-list');
  eHandList.innerHTML = '';
  for (let i = 0; i < AppState.enemyHandCount; i++) {
    const mid = (AppState.enemyHandCount - 1) / 2;
    const offset = i - mid;
    const rotate = offset * -6;
    const translateY = Math.abs(offset) * -12;
    const translateX = offset * 40;
    eHandList.innerHTML += `
      <li class="card-back${enemyCbClass}" style="transform:translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(0.7)">
        <div class="card-back-stamp">M</div>
      </li>`;
  }

  // Enemy staged (face-down, or face-up if combat phase)
  const eStagedList = document.getElementById('enemy-staged-cards');
  eStagedList.innerHTML = '';
  if (AppState.enemyStagedCards && AppState.enemyStagedCards.length > 0) {
    AppState.enemyStagedCards.forEach((c) => {
      if (c.category === 'Summon') {
        eStagedList.innerHTML += `<li class="card-back${enemyCbClass}" style="transform:scale(0.6)"><div class="card-back-stamp">M</div></li>`;
      } else {
        eStagedList.innerHTML += `<li class="active-card-slot" style="transform:scale(0.9)">${renderBoardCard(c, false)}</li>`;
      }
    });
  } else {
    for (let i = 0; i < AppState.enemyStagedCount; i++) {
      eStagedList.innerHTML += `<li class="card-back${enemyCbClass}" style="transform:scale(0.6)"><div class="card-back-stamp">M</div></li>`;
    }
  }

  // Active cards
  const pActiveList = document.getElementById('player-active-cards');
  pActiveList.innerHTML = AppState.playerActiveCards.map((c) => `<li class="active-card-slot">${renderBoardCard(c, false)}</li>`).join('');

  const eActiveList = document.getElementById('enemy-active-cards');
  eActiveList.innerHTML = AppState.enemyActiveCards.map((c) => `<li class="active-card-slot">${renderBoardCard(c, false)}</li>`).join('');

  // Player staged
  const pStagedList = document.getElementById('player-staged-cards');
  pStagedList.innerHTML = AppState.playerStagedCards.map((c) => `<li class="active-card-slot" style="transform:scale(0.9)">${renderBoardCard(c, true)}</li>`).join('');
}
