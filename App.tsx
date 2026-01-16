
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

const CLEAN_THRESHOLD = 0.85;
// Используем надежный URL
const BACKGROUND_URL = "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1200&auto=format&fit=crop";

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const lastCheckTime = useRef<number>(0);
  const imageLoaded = useRef(false);

  const currentBrushSize = useMemo(() => {
    const minSide = Math.min(windowSize.width, windowSize.height);
    let adaptiveSize = Math.floor(minSide * 0.07);
    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (isDesktop) {
      adaptiveSize = Math.floor(adaptiveSize * 1.5);
    }
    return Math.max(50, Math.min(adaptiveSize, 180));
  }, [windowSize]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    setWindowSize({ width, height });
    canvas.width = width;
    canvas.height = height;

    // Заливка грязью
    ctx.fillStyle = 'rgba(65, 60, 55, 0.97)';
    ctx.fillRect(0, 0, width, height);

    // Текстура шума
    for (let i = 0; i < 40000; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.15})`;
      ctx.fillRect(x, y, 1, 1);
    }

    setProgress(0);
    setStatus(GameStatus.PLAYING);
  }, []);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  const calculateProgress = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let transparentCount = 0;
    const sampleRate = 30; 

    for (let i = 3; i < data.length; i += 4 * sampleRate) {
      if (data[i] === 0) transparentCount++;
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
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentBrushSize);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
    ctx.fill();

    const now = Date.now();
    if (now - lastCheckTime.current > 200) {
      calculateProgress();
      lastCheckTime.current = now;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // ВАЖНО: Активируем звук при первом касании
    audioService.init();
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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

  const handlePointerUp = (e: React.PointerEvent) => {
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}
    setIsDrawing(false);
    audioService.stopScrubbing();
    calculateProgress();
  };

  return (
    <div 
      className="relative w-full h-full overflow-hidden bg-black touch-none select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <img 
        src={BACKGROUND_URL} 
        alt="View"
        onLoad={() => { imageLoaded.current = true; }}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 transition-opacity duration-1000 ${status === GameStatus.CLEAN ? 'opacity-0' : 'opacity-100'}`}
      />

      <div className="absolute top-0 left-0 p-4 z-20 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-lg">
          <p className="text-white text-xs font-bold tracking-widest uppercase">
            {status === GameStatus.CLEAN ? '✨ Window Cleaned!' : `Cleaned: ${progress}%`}
          </p>
        </div>
      </div>

      <div className="absolute top-0 right-0 p-4 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); initCanvas(); }}
          className="bg-white/10 hover:bg-white/20 active:scale-90 transition-all backdrop-blur-md p-3 rounded-full border border-white/20 text-white flex items-center justify-center shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {status === GameStatus.CLEAN && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 animate-in fade-in zoom-in duration-700 pointer-events-none">
           <div className="bg-black/60 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/10 flex flex-col items-center shadow-2xl text-center">
              <div className="bg-green-500 text-white rounded-full p-4 mb-6 shadow-xl shadow-green-500/40">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Perfect!</h1>
              <p className="text-white/70 text-base mb-8">The glass is now crystal clear.</p>
              <button 
                onClick={(e) => { e.stopPropagation(); initCanvas(); }}
                className="bg-white text-black font-bold py-4 px-10 rounded-2xl hover:bg-gray-100 pointer-events-auto active:scale-95 transition-all shadow-xl"
              >
                Start Over
              </button>
           </div>
        </div>
      )}

      {/* Курсор виден только на десктопе (скрыт через CSS для touch) */}
      <div 
        className={`cursor-brush ${isDrawing ? 'active' : ''}`}
        style={{ 
          left: mousePos.x, 
          top: mousePos.y,
          width: isDrawing ? currentBrushSize * 1.2 : currentBrushSize,
          height: isDrawing ? currentBrushSize * 1.2 : currentBrushSize
        }}
      />
    </div>
  );
};

export default App;
