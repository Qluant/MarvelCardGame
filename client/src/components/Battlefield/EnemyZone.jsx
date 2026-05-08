import React from 'react';

function EnemyZone({ enemy, handCount }) {
  const heroAvatar = enemy.avatar || `https://picsum.photos/seed/${enemy.nickname}/120/120`;

  return (
    <div className="enemy-zone">
      {/* Fanned Enemy Hand (Top of screen) */}
      <div className="enemy-hand">
        <ul className="hand-fanned-enemy">
          {Array.from({ length: handCount }).map((_, idx) => {
             const mid = (handCount - 1) / 2;
             const offset = idx - mid;
             const rotate = offset * -4; // Reverse tilt for top edge
             const translateY = Math.abs(offset) * -8; 
             
            return (
              <li 
                key={idx} 
                className="card-back"
                style={{ transform: `rotate(${rotate}deg) translateY(${translateY}px)` }}
              >
                <div className="card-back-stamp">M</div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Enemy Portrait */}
      <div className="hero-portrait-container">
        <img src={heroAvatar} alt="Enemy Hero" className="hero-avatar" />
        <div className="hero-hp">{enemy.hp}</div>
        <h3 className="hero-name">{enemy.nickname}</h3>
      </div>
    </div>
  );
}

export default EnemyZone;
