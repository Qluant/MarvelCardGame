import React, { useState, useEffect } from 'react';

function Profile({ user }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (user) {
      fetch(`http://localhost:5000/api/players/${user.nickname}`)
        .then(res => res.json())
        .then(data => setProfile(data))
        .catch(console.error);
    }
  }, [user]);

  if (!user) return <div className="page-container"><div className="glass-panel">Please login to view profile.</div></div>;
  if (!profile) return <div className="page-container"><div className="glass-panel">Loading profile...</div></div>;

  return (
    <div className="page-container">
      <div className="glass-panel profile-panel">
        <h2>{profile.nickname}'s Profile</h2>
        <div className="profile-stats">
          <div className="stat-box">
            <span>Games Played</span>
            <strong>{profile.games_played}</strong>
          </div>
          <div className="stat-box">
            <span>Wins</span>
            <strong>{profile.wins}</strong>
          </div>
          <div className="stat-box">
            <span>Loses</span>
            <strong>{profile.loses}</strong>
          </div>
          <div className="stat-box">
            <span>Winstreak</span>
            <strong>{profile.winstreak}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
