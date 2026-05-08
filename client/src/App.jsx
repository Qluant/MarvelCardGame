import React, { useState } from 'react';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import RoomList from './components/Lobby/RoomList';
import Board from './components/Battlefield/Board';

function App() {
  const [currentView, setCurrentView] = useState('auth'); // 'auth', 'register', 'lobby', 'game'
  const [user, setUser] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);

  const handleLogin = (nickname) => {
    // TODO: Connect to backend for real authentication
    setUser({ nickname });
    setCurrentView('lobby');
  };

  const handleJoinGame = (roomId) => {
    // TODO: Connect to backend / WebSockets to join room
    setCurrentGame({ roomId });
    setCurrentView('game');
  };

  const handleLeaveGame = () => {
    setCurrentGame(null);
    setCurrentView('lobby');
  };

  return (
    <div className="app-container">
      {currentView === 'auth' && (
        <LoginForm 
          onLogin={handleLogin} 
          onSwitchToRegister={() => setCurrentView('register')} 
        />
      )}
      
      {currentView === 'register' && (
        <RegisterForm 
          onRegister={handleLogin} 
          onSwitchToLogin={() => setCurrentView('auth')} 
        />
      )}

      {currentView === 'lobby' && (
        <RoomList 
          user={user}
          onJoinGame={handleJoinGame} 
          onLogout={() => setCurrentView('auth')}
        />
      )}

      {currentView === 'game' && (
        <Board 
          user={user}
          game={currentGame}
          onLeaveGame={handleLeaveGame}
        />
      )}
    </div>
  );
}

export default App;
