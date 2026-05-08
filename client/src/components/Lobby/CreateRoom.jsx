import React, { useState } from 'react';

function CreateRoom({ onCreateRoom }) {
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (roomName) {
      onCreateRoom({ name: roomName, isPrivate, password });
      setRoomName('');
      setIsPrivate(false);
      setPassword('');
    }
  };

  return (
    <div className="create-room">
      <h3>Create a Room</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Room Name:</label>
          <input 
            type="text" 
            value={roomName} 
            onChange={(e) => setRoomName(e.target.value)} 
          />
        </div>
        <div>
          <label>Private Room:</label>
          <input 
            type="checkbox" 
            checked={isPrivate} 
            onChange={(e) => setIsPrivate(e.target.checked)} 
          />
        </div>
        {isPrivate && (
          <div>
            <label>Password:</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
        )}
        <button type="submit">Create Room</button>
      </form>
    </div>
  );
}

export default CreateRoom;
