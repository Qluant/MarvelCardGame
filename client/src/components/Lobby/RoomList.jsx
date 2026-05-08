import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateRoom from './CreateRoom';
import JoinRoom from './JoinRoom';
import { socket } from '../../socket';

function RoomList({ user }) {
  const [rooms, setRooms] = useState([]);
  const [joiningPrivateRoom, setJoiningPrivateRoom] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    socket.on('rooms-update', (updatedRooms) => {
      setRooms(updatedRooms);
    });

    socket.on('room-created', (room) => {
      navigate(`/game/${room.id}`);
    });

    socket.on('error', (msg) => alert(msg));

    // Request initial list
    socket.emit('get-rooms');

    return () => {
      socket.off('rooms-update');
      socket.off('room-created');
      socket.off('error');
    };
  }, [navigate]);

  const handleCreateRoom = (newRoom) => {
    socket.emit('create-room', { ...newRoom, nickname: user.nickname });
  };

  const handleAttemptJoin = (room) => {
    if (room.isPrivate) {
      setJoiningPrivateRoom(room);
    } else {
      socket.emit('join-room', { roomId: room.id, nickname: user.nickname });
      navigate(`/game/${room.id}`);
    }
  };

  const handleJoinPrivate = (roomId, password) => {
    setJoiningPrivateRoom(null);
    socket.emit('join-room', { roomId, password, nickname: user.nickname });
    navigate(`/game/${roomId}`);
  };

  return (
    <div className="page-container">
      <div className="room-list glass-panel">
        <h2>Battle Lobby</h2>
        <CreateRoom onCreateRoom={handleCreateRoom} />

        <h3>Active Open Rooms</h3>
        {rooms.length === 0 ? <p>No open rooms. Create one!</p> : (
          <ul>
            {rooms.map(room => (
              <li key={room.id} className="room-item">
                <span>{room.name} {room.isPrivate ? '🔒' : ''}</span>
                <button onClick={() => handleAttemptJoin(room)}>Join</button>
              </li>
            ))}
          </ul>
        )}

        {joiningPrivateRoom && (
          <JoinRoom 
            room={joiningPrivateRoom} 
            onJoin={handleJoinPrivate} 
            onCancel={() => setJoiningPrivateRoom(null)} 
          />
        )}
      </div>
    </div>
  );
}

export default RoomList;
