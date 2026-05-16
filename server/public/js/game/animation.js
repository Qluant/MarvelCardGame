// Deal animation, coin flip, combat animation, notifications, game result overlay.

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const getHeroName = (id) => ({ 1: 'ironman', 2: 'torch', 3: 'venom' }[id] || 'default');

window.showNotification = function (message, type = 'error') {
  const el = document.createElement('div');
  el.className = `in-game-notification ${type}`;
  el.innerText = message;
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
};

function showGameResult(title, subtitle, color) {
  AppState.inRoom = false;
  let overlay = document.getElementById('game-result-overlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'game-result-overlay'; document.body.appendChild(overlay); }
  overlay.innerHTML = `<div class="gr-box"><div class="gr-title" style="color:${color}">${title}</div><div class="gr-subtitle">${subtitle}</div><div class="gr-countdown">Returning to lobby in <span id="gr-count">3</span>s...</div></div>`;
  overlay.style.display = 'flex';
  let secs = 3;
  const tick = setInterval(() => {
    secs--;
    const el = document.getElementById('gr-count');
    if (el) el.textContent = secs;
    if (secs <= 0) { clearInterval(tick); overlay.style.display = 'none'; navigate('lobby'); }
  }, 1000);
}

function animateDrawCards(playerCount, enemyCount) {
  const CARD_DELAY = 200, DEAL_DURATION = 750;
  const playerZone = document.getElementById('player-hand-list');
  const enemyZone  = document.getElementById('enemy-hand-list');
  if (!playerZone || !enemyZone) { renderBoard(); return; }
  const getCenter = (elId) => { const el = document.getElementById(elId); if (el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; } return { x: window.innerWidth/2, y: window.innerHeight/2 }; };
  const pDeckPos = getCenter('player-deck'), eDeckPos = getCenter('enemy-deck');
  const playerRect = playerZone.getBoundingClientRect(), enemyRect = enemyZone.getBoundingClientRect();
  let totalToLand = playerCount + enemyCount;
  if (totalToLand === 0) { renderBoard(); return; }
  let landed = 0;
  const done = () => { if (++landed === totalToLand) renderBoard(); };
  for (let i = 0; i < playerCount; i++) spawnFlyingCard(pDeckPos, { x: playerRect.left + (playerRect.width/Math.max(playerCount,1))*i+50, y: playerRect.top+playerRect.height/2 }, i*CARD_DELAY, DEAL_DURATION, done);
  for (let i = 0; i < enemyCount; i++) spawnFlyingCard(eDeckPos, { x: enemyRect.left + (enemyRect.width/Math.max(enemyCount,1))*i+50, y: enemyRect.top+enemyRect.height/2 }, (i+playerCount)*CARD_DELAY, DEAL_DURATION, done);
}

function spawnFlyingCard(from, to, cardDelay, duration, onDone) {
  const el = document.createElement('div');
  el.className = 'flying-card-token';
  el.innerHTML = '<div class="flying-card-stamp">M</div>';
  Object.assign(el.style, { left: from.x+'px', top: from.y+'px' });
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = `left ${duration}ms cubic-bezier(.2,.8,.4,1), top ${duration}ms cubic-bezier(.2,.8,.4,1), opacity ${duration*0.4}ms ease ${duration*0.6}ms`;
    el.style.left = to.x+'px'; el.style.top = to.y+'px'; el.style.opacity = '0';
    setTimeout(() => { el.remove(); onDone(); }, duration+200);
  }, cardDelay);
}

window.startCoinFlipAnimation = function (winnerNickname) {
  const coinOverlay = document.getElementById('coin-overlay');
  const startCoin   = document.getElementById('start-coin');
  const winnerLabel = document.getElementById('coin-winner-label');
  if (coinOverlay && startCoin) {
    coinOverlay.style.display = 'flex';
    if (winnerLabel) { winnerLabel.style.opacity = '0'; winnerLabel.textContent = ''; }
    startCoin.style.transition = 'none';
    startCoin.style.transform = 'rotateY(0deg) translateZ(0)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      startCoin.style.transition = 'transform 3s ease-out';
      startCoin.style.transform = `rotateY(${AppState.isMyTurn ? 1080 : 1260}deg) translateZ(0)`;
    }));
    setTimeout(() => {
      if (winnerLabel && winnerNickname) {
        const youWon = AppState.isMyTurn;
        winnerLabel.textContent = '';
        winnerLabel.style.color = youWon ? '#2ecc71' : '#e74c3c';
        winnerLabel.style.textShadow = youWon ? '0 0 10px rgba(46,204,113,0.8)' : '0 0 10px rgba(231,76,60,0.8)';
        winnerLabel.style.opacity = '1';
      }
    }, 3000);
    setTimeout(() => { coinOverlay.style.display = 'none'; window.startGameTimer(); }, 4500);
  } else {
    window.startGameTimer();
  }
};

function showTurnOverlay(firstText, firstColor, secondText, secondColor) {
  const overlay = document.getElementById('turn-overlay');
  overlay.style.display = 'flex';
  overlay.innerHTML = `<span class="overlay-text" style="color:${firstColor}">${firstText}</span>`;
  setTimeout(() => {
    overlay.innerHTML = `<span class="overlay-text" style="color:${secondColor}">${secondText}</span>`;
    setTimeout(() => { overlay.style.display = 'none'; }, 1500);
  }, 1500);
}

async function runCombatAnimation(animData) {
  try {
    if (typeof hideCardInfo === 'function') hideCardInfo();
    if (AppState.gameTimerInterval) clearInterval(AppState.gameTimerInterval);

    if (animData.passiveMessages && animData.passiveMessages.length > 0) {
      animData.passiveMessages.forEach((msg, idx) => setTimeout(() => showNotification(msg, 'info'), idx * 2500));
    }

    const { p1, p2 } = animData;
    const isP1 = AppState.currentUser && p1.id === AppState.socket.id;
    const myAnim = isP1 ? p1 : p2, enemyAnim = isP1 ? p2 : p1;
    const myAvatar = document.getElementById('player-avatar'), enemyAvatar = document.getElementById('enemy-avatar');
    const myHn = getHeroName(myAnim.heroId), enemyHn = getHeroName(enemyAnim.heroId);
    const hasMyAtk = myAnim.totalAtk>0, hasMyDef = myAnim.totalDef>0, hasEnemyAtk = enemyAnim.totalAtk>0, hasEnemyDef = enemyAnim.totalDef>0;

    const spawnProj = (heroName, type, targetId, ox, oy) => {
      const el = document.createElement('div'); el.className = `combat-projectile proj-${heroName}-${type}`;
      const rect = document.getElementById(targetId).parentElement.getBoundingClientRect();
      el.style.left = (rect.left+rect.width/2+ox)+'px'; el.style.top = (rect.top+rect.height/2+oy)+'px';
      document.body.appendChild(el); return el;
    };
    let myAtk=null,myDef=null,enAtk=null,enDef=null;
    if (hasMyAtk)    myAtk  = spawnProj(myHn,    'atk','player-staged-cards',-40,-80);
    if (hasMyDef)    myDef  = spawnProj(myHn,    'def','player-staged-cards', 40,-80);
    if (hasEnemyAtk) enAtk  = spawnProj(enemyHn, 'atk','enemy-staged-cards', -40, 80);
    if (hasEnemyDef) enDef  = spawnProj(enemyHn, 'def','enemy-staged-cards',  40, 80);

    await delay(100);
    [myAtk,myDef,enAtk,enDef].filter(Boolean).forEach(c=>c.classList.add('visible'));
    await delay(1200);

    const FD = 900;
    const flyTo = (el, targetEl) => {
      if (!el) return; const r = targetEl.getBoundingClientRect(); el.offsetHeight;
      el.style.transition = `left ${FD}ms cubic-bezier(.25,.8,.25,1),top ${FD}ms cubic-bezier(.25,.8,.25,1)`;
      el.style.left=(r.left+r.width/2)+'px'; el.style.top=(r.top+r.height/2)+'px';
    };
    flyTo(myDef,myAvatar); flyTo(enDef,enemyAvatar);
    await delay(FD);
    if(myDef)myDef.remove(); if(enDef)enDef.remove();

    let myShield=null,enShield=null;
    if(hasMyDef){myShield=document.createElement('div');myShield.className=`hero-shield-overlay shield-${myHn}`;myAvatar.parentElement.appendChild(myShield);}
    if(hasEnemyDef){enShield=document.createElement('div');enShield.className=`hero-shield-overlay shield-${enemyHn}`;enemyAvatar.parentElement.appendChild(enShield);}
    await delay(500);
    flyTo(myAtk,enemyAvatar); flyTo(enAtk,myAvatar);
    await delay(FD);
    if(myAtk)myAtk.remove(); if(enAtk)enAtk.remove();

    const spawnImpact = (el,hn) => {const i=document.createElement('div');i.className=`combat-impact impact-${hn}`;el.parentElement.appendChild(i);setTimeout(()=>i.remove(),800);};
    if(hasMyAtk)    spawnImpact(enemyAvatar,myHn);
    if(hasEnemyAtk) spawnImpact(myAvatar,enemyHn);

    const spawnDmg = (el,amt,col) => {if(amt<=0||isNaN(amt))return;const t=document.createElement('div');t.className='floating-dmg';t.style.color=col;t.textContent='-'+amt;el.parentElement.appendChild(t);setTimeout(()=>t.remove(),1200);};
    spawnDmg(myAvatar,myAnim.shieldDamageTaken,'#3498db'); spawnDmg(enemyAvatar,enemyAnim.shieldDamageTaken,'#3498db');
    if(myShield&&myAnim.shieldDamageTaken>0)myShield.classList.add('shield-hit');
    if(enShield&&enemyAnim.shieldDamageTaken>0)enShield.classList.add('shield-hit');
    await delay(600);
    spawnDmg(myAvatar,myAnim.hpDamageTaken,'#e03131'); spawnDmg(enemyAvatar,enemyAnim.hpDamageTaken,'#e03131');
    if(myAnim.hpDamageTaken>0)myAvatar.parentElement.classList.add('hero-shake');
    if(enemyAnim.hpDamageTaken>0)enemyAvatar.parentElement.classList.add('hero-shake');
    if(myShield&&myAnim.hpDamageTaken>0&&myAnim.startDef-myAnim.shieldDamageTaken<=0)myShield.classList.add('shield-break');
    if(enShield&&enemyAnim.hpDamageTaken>0&&enemyAnim.startDef-enemyAnim.shieldDamageTaken<=0)enShield.classList.add('shield-break');
    await delay(1000);
    if(myShield)myShield.remove(); if(enShield)enShield.remove();
    myAvatar.parentElement.classList.remove('hero-shake');
    enemyAvatar.parentElement.classList.remove('hero-shake');
  } catch(err) { console.error('Animation error:',err); }
}
