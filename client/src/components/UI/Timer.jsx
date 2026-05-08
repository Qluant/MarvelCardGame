import React, { useState, useEffect } from 'react';

function Timer({ initialTime = 30 }) {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  // Note: This is a simple mockup timer. 
  // In a real game, the server will dictate the time.
  useEffect(() => {
    if (timeLeft <= 0) return;
    const intervalId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft]);

  return (
    <div className="timer">
      Time Left: {timeLeft}s
    </div>
  );
}

export default Timer;
