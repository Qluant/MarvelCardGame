import React, { useState } from 'react';

function JoinRoom({ room, onJoin, onCancel }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onJoin(room.id, password);
  };

  return (
    <div className="join-room">
      <h3>Join {room.name}</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Password:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
        </div>
        <button type="submit">Join</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </form>
    </div>
  );
}

export default JoinRoom;
