import React, { useState, useEffect } from 'react';
import MarvelCard from '../Card/MarvelCard';

function Info() {
  const [heroes, setHeroes] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/info/heroes')
      .then(res => res.json())
      .then(data => setHeroes(data))
      .catch(console.error);
  }, []);

  return (
    <div className="page-container info-page">
      <h2>Heroes & Cards Compendium</h2>
      <div className="heroes-list">
        {heroes.map(hero => (
          <div key={hero.hero_id} className="hero-section glass-panel">
            <h3>{hero.alias}</h3>
            <div className="hero-cards">
              {hero.cards && hero.cards.length > 0 && hero.cards[0].name ? hero.cards.map((card, idx) => (
                <div key={idx} className="card-wrapper">
                   <MarvelCard {...card} />
                </div>
              )) : <p>No cards available for this hero yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Info;
