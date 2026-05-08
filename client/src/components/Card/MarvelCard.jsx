import React from 'react';

function MarvelCard({ name, category, attack, defense, cost, description, onClick }) {
  // Generate a consistent placeholder image based on the card name
  const placeholderImg = `https://picsum.photos/seed/${name.replace(/\s/g, '')}/200/150`;

  return (
    <div className="marvel-card" onClick={onClick}>
      <div className="card-cost">{cost}</div>
      
      <div className="card-image-container">
        <img src={placeholderImg} alt={name} className="card-image" />
      </div>
      
      <div className="card-body">
        <h4>{name}</h4>
        <div className="card-category">{category}</div>
        <p className="card-desc">{description}</p>
        
        <div className="card-stats">
          <span className="stat-attack">⚔️ {attack}</span>
          <span className="stat-defense">🛡️ {defense}</span>
        </div>
      </div>
    </div>
  );
}

export default MarvelCard;
