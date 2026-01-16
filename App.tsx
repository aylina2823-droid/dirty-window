
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

const BRUSH_SIZE = 50;
const CLEAN_THRESHOLD = 0.85;
const BACKGROUND_URL = "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2070&auto=format&fit=crop";

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const lastCheckTime = useRef<number>(0);

  // Initialize Canvas Grime
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Base color - dirty grayish brown
    ctx.fillStyle = 'rgba(70, 65, 60, 0.98)';
    ctx.fillRect(0, 0, width, height);

    // Add noise and texture
    for (let i = 0; i < 50000; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const opacity = Math.random() * 0.2;
      ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Add some "smudges"
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 200 + 100;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(40, 35, 30, 0.3)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    setProgress(0);
    setStatus(GameStatus.PLAYING);
  }, []);

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, [initCanvas]);

  const calculateProgress = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Performance optimization: sample pixels instead of checking every single one
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let transparentCount = 0;
    const sampleRate = 20; // Check every 20th pixel to save CPU

    for (let i = 3; i < data.length; i += 4 * sampleRate) {
      if (data[i] === 0) {
        transparentCount++;
      }
    }

    const totalSampled = data.length / (4 * sampleRate);
    const currentProgress = transparentCount / totalSampled;
    
    setProgress(Math.min(100, Math.floor(currentProgress * 100)));

    if (currentProgress > CLEAN_THRESHOLD && status !== GameStatus.CLEAN) {
      setStatus(GameStatus.CLEAN);
      audioService.stopScrubbing();
    }
  }, [status]);

  const scrub = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || status === GameStatus.CLEAN) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    
    // Create a softer brush using radial gradient
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, BRUSH_SIZE);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_SIZE, 0, Math.PI * 2);
    ctx.fill();

    // Throttle progress check
    const now = Date.now();
    if (now - lastCheckTime.current > 300) {
      calculateProgress();
      lastCheckTime.current = now;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDrawing(true);
    setMousePos({ x: e.clientX, y: e.clientY });
    scrub(e.clientX, e.clientY);
    audioService.startScrubbing();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isDrawing) {
      scrub(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    audioService.stopScrubbing();
    calculateProgress();
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-black cursor-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Background Image Layer */}
      <img 
        src={BACKGROUND_URL} 
        alt="Beautiful landscape"
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
      />

      {/* Dirt Canvas Layer */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 transition-opacity duration-1000 ${status === GameStatus.CLEAN ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 p-6 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
          <p className="text-white text-sm font-medium tracking-wider">
            {status === GameStatus.CLEAN ? 'SPARKLING CLEAN!' : `CLEANED: ${progress}%`}
          </p>
        </div>
      </div>

      <div className="absolute top-0 right-0 p-6">
        <button
          onClick={(e) => {
            e.stopPropagation();
            initCanvas();
          }}
          className="bg-white/10 hover:bg-white/20 active:scale-95 transition-all backdrop-blur-md p-3 rounded-full border border-white/30 text-white flex items-center justify-center group"
          title="Reset Window"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {/* Victory Message */}
      {status === GameStatus.CLEAN && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-1000">
           <div className="bg-white/10 backdrop-blur-xl p-12 rounded-3xl border border-white/20 flex flex-col items-center shadow-2xl">
              <div className="bg-green-500 text-white rounded-full p-4 mb-6 shadow-lg shadow-green-500/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Window Cleaned!</h1>
              <p className="text-white/60 text-lg">You reveal the beauty beneath the grime.</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  initCanvas();
                }}
                className="mt-8 bg-white text-black font-semibold py-3 px-8 rounded-full hover:bg-gray-200 pointer-events-auto active:scale-95 transition-all"
              >
                Clean Again
              </button>
           </div>
        </div>
      )}

      {/* Custom Cursor Brush */}
      <div 
        className={`cursor-brush ${isDrawing ? 'active' : ''}`}
        style={{ left: mousePos.x, top: mousePos.y }}
      />
    </div>
  );
};

export default App;
