import React, { useState } from 'react';

function LoginForm({ onLogin, onSwitchToRegister }) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (nickname && password) {
      try {
        const res = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: nickname, password })
        });
        const data = await res.json();
        
        if (res.ok) {
          localStorage.setItem('token', data.token); // Store JWT for future authenticated requests
          onLogin(nickname);
        } else {
          alert(`Login failed: ${data.error}`);
        }
      } catch (err) {
        console.error(err);
        alert('Server error while logging in.');
      }
    }
  };

  return (
    <div className="login-form">
      <h2>Login to Great Battle</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Nickname:</label>
          <input 
            type="text" 
            value={nickname} 
            onChange={(e) => setNickname(e.target.value)} 
          />
        </div>
        <div>
          <label>Password:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
        </div>
        <button type="submit">Login</button>
      </form>
      <button onClick={onSwitchToRegister}>Don't have an account? Register</button>
    </div>
  );
}

export default LoginForm;
