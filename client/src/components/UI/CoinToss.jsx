import React from 'react';

function CoinToss({ result }) {
  // result can be 'You go first' or 'Enemy goes first'
  return (
    <div className="coin-toss">
      <h3>Coin Toss Result:</h3>
      <p>{result}</p>
    </div>
  );
}

export default CoinToss;
