
import React, { useState, useCallback, useRef } from 'react';
import { GameStatus, GameState } from './types';
import RacingGame from './components/RacingGame';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.START,
    score: 0,
    highScore: parseInt(localStorage.getItem('midnight_velocity_hi') || '0', 10),
  });
  
  const scoreRef = useRef<HTMLSpanElement>(null);

  const handleGameOver = useCallback((finalScore: number) => {
    setGameState(prev => {
      const newHighScore = Math.max(prev.highScore, Math.floor(finalScore));
      localStorage.setItem('midnight_velocity_hi', newHighScore.toString());
      return {
        ...prev,
        status: GameStatus.GAMEOVER,
        score: Math.floor(finalScore),
        highScore: newHighScore
      };
    });
  }, []);

  const handleScoreUpdate = useCallback((score: number) => {
    if (scoreRef.current) {
      scoreRef.current.innerText = `${Math.floor(score)}`;
    }
  }, []);

  const startGame = () => {
    setGameState(prev => ({ ...prev, status: GameStatus.PLAYING, score: 0 }));
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans text-white select-none">
      <RacingGame 
        status={gameState.status} 
        onGameOver={handleGameOver}
        onScoreUpdate={handleScoreUpdate}
      />

      {/* Gameplay HUD */}
      {gameState.status === GameStatus.PLAYING && (
        <div className="absolute top-8 left-0 right-0 flex flex-col items-center pointer-events-none">
          <span className="text-sm tracking-widest text-cyan-400 uppercase font-bold mb-1">Distance</span>
          <span ref={scoreRef} className="text-6xl font-black italic tabular-nums">0</span>
        </div>
      )}

      {/* Start Screen */}
      {gameState.status === GameStatus.START && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
          <div className="text-center p-8 border border-white/10 rounded-3xl bg-black/40">
            <h1 className="text-7xl font-black italic tracking-tighter mb-2">MIDNIGHT</h1>
            <h2 className="text-4xl font-bold text-orange-500 italic mb-8">RACER</h2>
            
            <div className="space-y-2 mb-10 text-gray-400 text-sm uppercase tracking-widest">
              <p>ARROWS TO STEER</p>
              <p>DARE TO DRIVE</p>
            </div>

            <button 
              onClick={startGame}
              className="px-12 py-4 bg-white text-black font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-colors rounded-full text-xl"
            >
              Start Engine
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.status === GameStatus.GAMEOVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50">
          <div className="text-center max-w-sm w-full p-10 border border-red-500/30 rounded-[2rem]">
            <h2 className="text-5xl font-black text-red-600 mb-6 italic uppercase">Crashed</h2>
            
            <div className="mb-10">
              <p className="text-gray-500 uppercase tracking-widest text-xs mb-2">Final Distance</p>
              <p className="text-6xl font-black">{gameState.score}</p>
              {gameState.score >= gameState.highScore && (
                <p className="text-orange-500 font-bold text-xs mt-2 uppercase tracking-widest animate-bounce">New Record!</p>
              )}
            </div>

            <button 
              onClick={startGame}
              className="w-full py-4 bg-white text-black font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all rounded-xl text-lg mb-4"
            >
              Restart
            </button>
            <p className="text-gray-500 text-xs uppercase tracking-tighter">Best: {gameState.highScore}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
