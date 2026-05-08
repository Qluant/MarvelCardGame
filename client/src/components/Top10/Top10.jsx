import React, { useState, useEffect } from 'react';

function Top10() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/players/top')
      .then(res => res.json())
      .then(data => setPlayers(data))
      .catch(console.error);
  }, []);

  return (
    <div className="page-container">
      <div className="glass-panel leaderboard-panel">
        <h2>Top 10 Performers</h2>
        <table className="leaderboard">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Nickname</th>
              <th>Wins</th>
              <th>Loses</th>
              <th>Winstreak</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, idx) => (
              <tr key={p.player_id}>
                <td>#{idx + 1}</td>
                <td>{p.nickname}</td>
                <td>{p.wins}</td>
                <td>{p.loses}</td>
                <td>{p.winstreak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Top10;
