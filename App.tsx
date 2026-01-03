
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
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans text-white select-none touch-none">
      <RacingGame 
        status={gameState.status} 
        onGameOver={handleGameOver}
        onScoreUpdate={handleScoreUpdate}
      />

      {/* Gameplay HUD */}
      {gameState.status === GameStatus.PLAYING && (
        <div className="absolute top-8 left-0 right-0 flex flex-col items-center pointer-events-none">
          <span className="text-[10px] tracking-[0.3em] text-cyan-400 uppercase font-bold mb-1 opacity-80">Distance</span>
          <span ref={scoreRef} className="text-5xl md:text-6xl font-black italic tabular-nums leading-none">0</span>
        </div>
      )}

      {/* Start Screen */}
      {gameState.status === GameStatus.START && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50 p-6">
          <div className="text-center w-full max-w-lg p-8 md:p-12 border border-white/10 rounded-[3rem] bg-black/40">
            <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter mb-2">MIDNIGHT</h1>
            <h2 className="text-2xl md:text-4xl font-bold text-orange-500 italic mb-10">RACER</h2>
            
            <div className="space-y-4 mb-12 text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium">
              <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-12">
                <div>
                  <p className="text-white mb-2">DESKTOP</p>
                  <p>WASD / ARROWS TO STEER</p>
                </div>
                <div>
                  <p className="text-white mb-2">MOBILE</p>
                  <p>TAP SIDES TO STEER</p>
                </div>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="group relative inline-flex items-center justify-center px-16 py-5 bg-white text-black font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all rounded-full text-lg md:text-xl active:scale-95 overflow-hidden"
            >
              <span className="relative z-10">Start Engine</span>
              <div className="absolute inset-0 bg-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.status === GameStatus.GAMEOVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-50 p-6">
          <div className="text-center max-w-sm w-full p-10 border border-red-500/30 rounded-[2.5rem] bg-black">
            <h2 className="text-4xl md:text-5xl font-black text-red-600 mb-8 italic uppercase tracking-tighter">Crashed</h2>
            
            <div className="mb-10">
              <p className="text-gray-500 uppercase tracking-widest text-[10px] mb-2">Final Distance</p>
              <p className="text-6xl font-black tabular-nums leading-none">{gameState.score}</p>
              {gameState.score >= gameState.highScore && gameState.score > 0 && (
                <p className="text-orange-500 font-bold text-[10px] mt-4 uppercase tracking-[0.2em] animate-pulse">New Personal Best!</p>
              )}
            </div>

            <button 
              onClick={startGame}
              className="w-full py-5 bg-white text-black font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all rounded-2xl text-lg mb-6 active:scale-95"
            >
              Restart
            </button>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold">Best Score: {gameState.highScore}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
