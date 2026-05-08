import React, { useState } from 'react';

function RegisterForm({ onRegister, onSwitchToLogin }) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password === confirmPassword && nickname) {
      try {
        const res = await fetch('http://localhost:5000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: nickname, password })
        });
        const data = await res.json();

        if (res.ok) {
          alert("Registration successful! You can now login.");
          onSwitchToLogin();
        } else {
          alert(`Registration failed: ${data.error}`);
        }
      } catch (err) {
        console.error(err);
        alert('Server error while registering.');
      }
    } else {
      alert("Passwords do not match or missing nickname!");
    }
  };

  return (
    <div className="register-form">
      <h2>Register for Great Battle</h2>
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
        <div>
          <label>Confirm Password:</label>
          <input 
            type="password" 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)} 
          />
        </div>
        <button type="submit">Register</button>
      </form>
      <button onClick={onSwitchToLogin}>Already have an account? Login</button>
    </div>
  );
}

export default RegisterForm;
