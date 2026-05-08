import React from 'react';
import MarvelCard from '../Card/MarvelCard';

function PlayerZone({ player, hand, onPlayCard }) {
  const heroAvatar = player.avatar || `https://picsum.photos/seed/${player.nickname}/120/120`;

  return (
    <div className="player-zone">
      {/* Hero Portrait */}
      <div className="hero-portrait-container">
        <img src={heroAvatar} alt="Player Hero" className="hero-avatar" />
        <div className="hero-hp">{player.hp}</div>
        <h3 className="hero-name">{player.nickname}</h3>
      </div>
      
      {/* Fanned Hand */}
      <div className="player-hand">
        <ul className="hand-fanned">
          {hand.map((card, idx) => {
            const mid = (hand.length - 1) / 2;
            const offset = idx - mid;
            const rotate = offset * 4; // degrees to tilt
            const translateY = Math.abs(offset) * 8; // pixels dropped
            
            return (
              <li 
                key={card.id} 
                style={{ transform: `rotate(${rotate}deg) translateY(${translateY}px)` }}
                className="hand-slot"
              >
                <MarvelCard 
                  {...card}
                  onClick={() => onPlayCard(card)}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default PlayerZone;
