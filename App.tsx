
import React, { useState, useCallback } from 'react';
import { GameStatus, GameState } from './types';
import RacingGame from './components/RacingGame';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.START,
    score: 0,
    highScore: parseInt(localStorage.getItem('stealth_midnight_highscore') || '0', 10),
  });
  const [speedLevelUp, setSpeedLevelUp] = useState(false);

  const handleGameOver = useCallback((finalScore: number) => {
    setGameState(prev => {
      const newHighScore = Math.max(prev.highScore, Math.floor(finalScore));
      localStorage.setItem('stealth_midnight_highscore', newHighScore.toString());
      return {
        ...prev,
        status: GameStatus.GAMEOVER,
        score: Math.floor(finalScore),
        highScore: newHighScore
      };
    });
  }, []);

  const handleSpeedLevelUp = useCallback(() => {
    setSpeedLevelUp(true);
    setTimeout(() => setSpeedLevelUp(false), 1200);
  }, []);

  const startGame = () => {
    setGameState(prev => ({ ...prev, status: GameStatus.PLAYING, score: 0 }));
  };

  const resetToMenu = () => {
    setGameState(prev => ({ ...prev, status: GameStatus.START }));
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none touch-none font-sans text-white">
      {speedLevelUp && (
        <div className="absolute top-1/4 left-0 right-0 z-40 flex justify-center items-center pointer-events-none animate-bounce">
          <div className="bg-orange-600/90 text-white px-8 py-3 rounded-full border-2 border-white/30 shadow-[0_0_40px_rgba(255,69,0,0.6)]">
            <span className="text-2xl font-black italic uppercase tracking-widest">Speed Increase</span>
          </div>
        </div>
      )}

      <RacingGame 
        status={gameState.status} 
        onGameOver={handleGameOver}
        onScoreUpdate={(s) => setGameState(prev => ({ ...prev, score: Math.floor(s) }))}
        onSpeedLevelUp={handleSpeedLevelUp} 
      />

      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
        {gameState.status === GameStatus.PLAYING && (
          <div className="absolute top-8 left-0 right-0 flex flex-col items-center">
            <span className="text-xs uppercase tracking-[0.4em] text-orange-500 font-bold mb-1 opacity-80">Distance Traveled</span>
            <span className="text-6xl font-black tabular-nums tracking-tighter" style={{ textShadow: '0 0 30px #FF4500' }}>
              {gameState.score}m
            </span>
          </div>
        )}

        {gameState.status === GameStatus.START && (
          <div className="pointer-events-auto bg-black/80 backdrop-blur-xl p-12 rounded-[2.5rem] border border-orange-500/20 text-center max-w-md shadow-[0_0_80px_rgba(255,69,0,0.05)]">
            <h1 className="text-7xl font-black mb-1 tracking-tighter italic text-orange-500">MIDNIGHT</h1>
            <h2 className="text-2xl font-light mb-10 tracking-[0.4em] text-white uppercase opacity-40">RACER</h2>
            
            <div className="text-gray-400 mb-10 text-sm leading-relaxed text-left space-y-3">
              <p className="text-center font-bold text-orange-500 mb-4">THE RULES OF THE DARK</p>
              <p>• <span className="text-white">Internal Light:</span> You only see your own dashboard glow.</p>
              <p>• <span className="text-white">Detection:</span> Spot others by their headlights & taillights.</p>
              <p>• <span className="text-white">Velocity:</span> Speed increases every 300 meters.</p>
            </div>

            <button 
              onClick={startGame}
              className="w-full py-6 bg-orange-600 hover:bg-orange-500 transition-all rounded-2xl font-black text-2xl uppercase tracking-[0.2em] active:scale-95 shadow-[0_10px_40px_rgba(234,88,12,0.4)]"
            >
              Start Engine
            </button>
          </div>
        )}

        {gameState.status === GameStatus.GAMEOVER && (
          <div className="pointer-events-auto bg-black/95 p-12 rounded-[2.5rem] border border-red-600/30 text-center max-w-md animate-in fade-in zoom-in">
            <h1 className="text-6xl font-black mb-2 text-red-600 italic tracking-tighter">CRASHED</h1>
            <div className="my-10">
              <p className="text-gray-500 text-xs uppercase tracking-[0.3em] mb-2 font-bold">Total Distance</p>
              <p className="text-7xl font-black text-white tabular-nums">{gameState.score}m</p>
              {gameState.score >= gameState.highScore && gameState.score > 0 && (
                <p className="text-orange-500 text-xs mt-2 font-black uppercase tracking-widest animate-pulse">New Personal Best!</p>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <button 
                onClick={startGame}
                className="w-full py-5 bg-orange-600 hover:bg-orange-500 transition-colors rounded-xl font-black uppercase tracking-widest active:scale-95 shadow-[0_10px_30px_rgba(234,88,12,0.3)]"
              >
                Restart Drive
              </button>
              <button 
                onClick={resetToMenu}
                className="w-full py-5 bg-white/5 hover:bg-white/10 transition-colors rounded-xl font-bold uppercase tracking-widest"
              >
                Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
