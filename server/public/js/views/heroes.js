// Heroes view: load hero list with cards, select hero, card preview tooltip.

async function loadCharacterInfo(containerId = 'character-info-heroes-list', showSelect = true) {
  const list = document.getElementById(containerId);
  if (!list) return;
  list.innerHTML = '<p>Loading heroes...</p>';

  try {
    const { res, data: heroes } = await Api.get('/info/heroes');
    if (!res.ok) throw new Error('Failed');
    list.innerHTML = '';

    heroes.forEach((hero) => {
      const isSelected = AppState.currentUser && AppState.currentUser.heroId === hero.hero_id;

      let cardsHtml = '';
      if (hero.cards && hero.cards.length && hero.cards[0] && hero.cards[0].name) {
        hero.cards.forEach((c) => {
          const encoded = encodeURIComponent(JSON.stringify(c));
          cardsHtml += `<div class="card-wrapper info-card-wrapper" data-card="${encoded}">${renderCard(c)}</div>`;
        });
      } else {
        cardsHtml = '<p>No cards available.</p>';
      }

      let btnHtml = '';
      if (showSelect && AppState.currentUser) {
        btnHtml = `
            <button
              class="hero-tile-select-btn${isSelected ? ' hero-tile-select-btn-active' : ''}"
              id="hero-select-btn-${hero.hero_id}"
              onclick="selectHero(${hero.hero_id}, '${hero.alias}')">
              ${isSelected ? '✓ Your Hero' : 'Select'}
            </button>`;
      }

      list.innerHTML += `
        <div class="hero-section glass-panel${isSelected && showSelect ? ' hero-section-selected' : ''}" id="hero-section-${hero.hero_id}">
          <div class="hero-section-header">
            <div class="hero-section-meta" style="flex:1;">
              <h3 style="margin:0 0 5px 0;">${hero.alias}</h3>
              <p class="hero-passive-desc" style="margin:0;font-size:0.95rem;color:#d0d0d0;line-height:1.4;max-width:80%;">
                <strong style="color:var(--marvel-red);">Passive:</strong> ${hero.special_ability || 'None'}
              </p>
            </div>
            ${btnHtml}
          </div>
          <div class="hero-cards">${cardsHtml}</div>
        </div>
      `;
    });

    initCardPreview(list);
  } catch (err) {
    list.innerHTML = '<p>Failed to load heroes.</p>';
  }
}

window.selectHero = async function (heroId, heroAlias) {
  try {
    const { res } = await Api.put(`/players/${AppState.currentUser.nickname}/hero`, { heroId });
    if (!res.ok) throw new Error('Server rejected');

    AppState.currentUser.heroId = heroId;
    AppState.currentUser.heroAlias = heroAlias;
    localStorage.setItem('user', JSON.stringify(AppState.currentUser));

    // Update visuals without full reload
    document.querySelectorAll('.hero-section').forEach((s) => s.classList.remove('hero-section-selected'));
    document.querySelectorAll('[id^="hero-select-btn-"]').forEach((b) => {
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

function initCardPreview(list) {
  let tooltip = document.getElementById('card-preview-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'card-preview-tooltip';
    tooltip.className = 'card-preview-tooltip';
    document.body.appendChild(tooltip);
  }

  if (!list || list.dataset.previewInit) return;
  list.dataset.previewInit = 'true';

  list.addEventListener('mouseenter', (e) => {
    const wrapper = e.target.closest('.info-card-wrapper');
    if (!wrapper) return;
    const card = JSON.parse(decodeURIComponent(wrapper.dataset.card));
    const imgSrc = cardImageUrl(card.name);
    const categoryColor = { Trade: 'var(--color-trade)', Hybrid: 'var(--color-hybrid)', Summon: 'var(--color-summon)' }[card.category] || 'white';

    tooltip.innerHTML = `
      <div class="cp-image-wrap"><img src="${imgSrc}" alt="${card.name}" class="cp-image"/></div>
      <div class="cp-body">
        <h3 class="cp-name">${card.name}</h3>
        <span class="cp-category" style="color:${categoryColor}">${card.category}</span>
        <p class="cp-desc">${card.description}</p>
        <div class="cp-stats">
          <span class="cp-atk">⚔️ ${card.attack}</span>
          <span class="cp-cost">💠 ${card.cost} AP</span>
          <span class="cp-def">🛡️ ${card.defense}</span>
        </div>
      </div>`;
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
