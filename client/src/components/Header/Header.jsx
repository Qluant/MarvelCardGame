import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Header({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="header-logo">Great Battle</div>
      <nav className="header-nav">
        <Link to="/">Lobby</Link>
        <Link to="/top10">Top 10</Link>
        <Link to="/info">Info</Link>
        {user ? (
          <>
            <Link to="/profile">Profile ({user.nickname})</Link>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </nav>
    </header>
  );
}

export default Header;
