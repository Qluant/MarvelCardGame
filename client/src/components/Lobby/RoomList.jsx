import React, { useState } from 'react';
import CreateRoom from './CreateRoom';
import JoinRoom from './JoinRoom';

function RoomList({ user, onJoinGame, onLogout }) {
  // Mock data
  const [rooms, setRooms] = useState([
    { id: 1, name: "Tony's Room", isPrivate: false },
    { id: 2, name: "Secret Lair", isPrivate: true }
  ]);
  const [joiningPrivateRoom, setJoiningPrivateRoom] = useState(null);

  const handleCreateRoom = (newRoom) => {
    // TODO: emit create room event to server
    const room = {
      id: rooms.length + 1,
      name: newRoom.name,
      isPrivate: newRoom.isPrivate
    };
    setRooms([...rooms, room]);
  };

  const handleAttemptJoin = (room) => {
    if (room.isPrivate) {
      setJoiningPrivateRoom(room);
    } else {
      onJoinGame(room.id);
    }
  };

  const handleJoinPrivate = (roomId, password) => {
    // TODO: verify password with server
    console.log(`Joining private room ${roomId} with pass ${password}`);
    setJoiningPrivateRoom(null);
    onJoinGame(roomId);
  };

  return (
    <div className="room-list">
      <h2>Lobby</h2>
      <p>Welcome, {user?.nickname}!</p>
      <button onClick={onLogout}>Logout</button>

      <CreateRoom onCreateRoom={handleCreateRoom} />

      <h3>Active Rooms</h3>
      <ul>
        {rooms.map(room => (
          <li key={room.id} className="room-item">
            <span>{room.name} {room.isPrivate ? '(Private)' : ''}</span>
            <button onClick={() => handleAttemptJoin(room)}>Join</button>
          </li>
        ))}
      </ul>

      {joiningPrivateRoom && (
        <JoinRoom 
          room={joiningPrivateRoom} 
          onJoin={handleJoinPrivate} 
          onCancel={() => setJoiningPrivateRoom(null)} 
        />
      )}
    </div>
  );
}

export default RoomList;
