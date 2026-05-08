import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PlayerZone from './PlayerZone';
import EnemyZone from './EnemyZone';
import Timer from '../UI/Timer';
import CoinToss from '../UI/CoinToss';
import MarvelCard from '../Card/MarvelCard';
import { socket } from '../../socket';

function Board({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [gameStarted, setGameStarted] = useState(false);
  const [turnResult] = useState('You go first');
  const [player] = useState({ nickname: user?.nickname || 'Player', hp: 30 });
  const [enemy, setEnemy] = useState({ nickname: 'Waiting...', hp: 30 });
  
  const [playerHand, setPlayerHand] = useState([
    { id: 1, name: 'Unibeam', category: 'Trade', cost: 5, attack: 8, defense: 0, description: 'Concentrated beam.' },
    { id: 2, name: 'Stark Decoy', category: 'Summon', cost: 1, attack: 1, defense: 2, description: 'Holographic decoy.' },
  ]);
  const [enemyHandCount, setEnemyHandCount] = useState(0);
  
  const [playerActiveCards, setPlayerActiveCards] = useState([]);
  const [enemyActiveCards, setEnemyActiveCards] = useState([]);

  useEffect(() => {
    socket.emit('check-game-state', { roomId: id, nickname: user?.nickname });

    socket.on('game-start', (room) => {
      setGameStarted(true);
      const opponent = room.players.find(p => p.nickname !== user?.nickname);
      if (opponent) {
        setEnemy(prev => ({ ...prev, nickname: opponent.nickname }));
        setEnemyHandCount(3); // mock starting hand
      }
    });

    socket.on('player-left', () => {
      alert('Opponent left the game! You win!');
      navigate('/');
    });

    socket.on('move-made', (data) => {
      if (data.playerId !== socket.id) {
        setEnemyHandCount(prev => Math.max(0, prev - 1));
        setEnemyActiveCards(prev => [...prev, data.move]);
      }
    });

    return () => {
      socket.off('game-start');
      socket.off('player-left');
      socket.off('move-made');
    };
  }, [navigate]);

  const handlePlayCard = (card) => {
    if (!gameStarted) return alert("Waiting for opponent!");
    if (playerActiveCards.length >= 7) return;
    
    setPlayerHand(playerHand.filter(c => c.id !== card.id));
    setPlayerActiveCards([...playerActiveCards, { ...card }]);
    
    socket.emit('make-move', { roomId: id, move: { ...card } });
  };

  const handleLeaveGame = () => {
    socket.emit('leave-room', id);
    navigate('/');
  };

  if (!gameStarted) {
    return (
      <div className="page-container">
        <div className="glass-panel" style={{textAlign: 'center'}}>
          <h2>Waiting for opponent...</h2>
          <p>Room ID: {id}</p>
          <button onClick={handleLeaveGame} style={{marginTop: '20px', padding: '10px 20px', background: 'var(--marvel-red)', color: 'white', borderRadius: '5px'}}>Cancel Match</button>
        </div>
      </div>
    );
  }

  return (
    <div className="board">
      <button className="leave-btn" onClick={handleLeaveGame}>Resign</button>
      
      <CoinToss result={turnResult} />
      <Timer />

      <EnemyZone enemy={enemy} handCount={enemyHandCount} />
      
      <div className="battlefield">
        <div className="battlefield-half enemy-half">
          <ul>
            {enemyActiveCards.map((card, idx) => (
              <li key={idx} className="active-card-slot">
                <MarvelCard {...card} />
              </li>
            ))}
          </ul>
        </div>
        
        <div className="battlefield-divider"></div>

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

      <PlayerZone player={player} hand={playerHand} onPlayCard={handlePlayCard} />
    </div>
  );
}

export default Board;
