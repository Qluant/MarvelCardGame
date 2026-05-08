import React, { useState } from 'react';
import PlayerZone from './PlayerZone';
import EnemyZone from './EnemyZone';
import Timer from '../UI/Timer';
import CoinToss from '../UI/CoinToss';
import MarvelCard from '../Card/MarvelCard';

function Board({ user, game, onLeaveGame }) {
  const [turnResult] = useState('You go first');
  const [player] = useState({ nickname: user?.nickname || 'Player1', hp: 30 });
  const [enemy] = useState({ nickname: 'EnemyPlayer', hp: 30 });
  
  const [playerHand, setPlayerHand] = useState([
    { id: 1, name: 'Unibeam', category: 'Trade', cost: 5, attack: 8, defense: 0, description: 'Concentrated beam.' },
    { id: 2, name: 'Stark Decoy', category: 'Summon', cost: 1, attack: 1, defense: 2, description: 'Holographic decoy.' },
    { id: 3, name: 'Repulsor', category: 'Hybrid', cost: 3, attack: 4, defense: 2, description: 'Kinetic blast.' },
    { id: 4, name: 'Arc Reactor', category: 'Trade', cost: 2, attack: 0, defense: 5, description: 'Energy source.' }
  ]);
  const [enemyHandCount] = useState(5);
  
  const [playerActiveCards, setPlayerActiveCards] = useState([]);
  const [enemyActiveCards, setEnemyActiveCards] = useState([
    { id: 99, name: 'Doom Bot', category: 'Summon', cost: 3, attack: 3, defense: 3, description: 'Latverian menace.' }
  ]);

  const handlePlayCard = (card) => {
    // Prevent playing if board is full (optional mock logic)
    if (playerActiveCards.length >= 7) return;
    
    setPlayerHand(playerHand.filter(c => c.id !== card.id));
    setPlayerActiveCards([...playerActiveCards, { ...card }]);
  };

  return (
    <div className="board">
      <button className="leave-btn" onClick={onLeaveGame}>Leave Game</button>
      
      <CoinToss result={turnResult} />
      <Timer />

      {/* TOP: Enemy Hero & Hand */}
      <EnemyZone enemy={enemy} handCount={enemyHandCount} />
      
      {/* MIDDLE: Battlefield */}
      <div className="battlefield">
        {/* Enemy Side of Board */}
        <div className="battlefield-half enemy-half">
          <ul>
            {enemyActiveCards.map((card, idx) => (
              <li key={idx} className="active-card-slot">
                <MarvelCard {...card} />
              </li>
            ))}
          </ul>
        </div>
        
        {/* Divider Line */}
        <div className="battlefield-divider"></div>

        {/* Player Side of Board */}
        <div className="battlefield-half player-half">
          <ul>
            {playerActiveCards.map((card, idx) => (
              <li key={idx} className="active-card-slot">
                <MarvelCard {...card} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* BOTTOM: Player Hero & Hand */}
      <PlayerZone 
        player={player} 
        hand={playerHand} 
        onPlayCard={handlePlayCard} 
      />
    </div>
  );
}

export default Board;
