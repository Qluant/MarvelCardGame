import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header/Header';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import RoomList from './components/Lobby/RoomList';
import Board from './components/Battlefield/Board';
import Top10 from './components/Top10/Top10';
import Profile from './components/Profile/Profile';
import Info from './components/Info/Info';
import { socket } from './socket';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleLogin = (nickname) => {
    const userData = { nickname };
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <Router>
      <div className="app-container-routed">
        <Header user={user} onLogout={handleLogout} />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={user ? <RoomList user={user} /> : <Navigate to="/login" />} />
            
            <Route path="/login" element={
              user ? <Navigate to="/" /> : (
                <div className="page-container" style={{maxWidth: '400px'}}>
                  <LoginForm 
                    onLogin={handleLogin} 
                    onSwitchToRegister={() => window.location.href = '/register'} 
                  />
                </div>
              )
            } />
            
            <Route path="/register" element={
              user ? <Navigate to="/" /> : (
                <div className="page-container" style={{maxWidth: '400px'}}>
                  <RegisterForm 
                    onSwitchToLogin={() => window.location.href = '/login'} 
                  />
                </div>
              )
            } />
            
            <Route path="/top10" element={<Top10 />} />
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="/info" element={<Info />} />
            
            <Route path="/game/:id" element={user ? <Board user={user} /> : <Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
