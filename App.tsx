
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

const CLEAN_THRESHOLD = 0.85;
// Используем Picsum - он работает стабильнее во встроенных браузерах соцсетей
const BACKGROUND_URL = `https://picsum.photos/id/10/1200/800`;

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isImageLoading, setIsImageLoading] = useState(true);
  const lastCheckTime = useRef<number>(0);

  const currentBrushSize = useMemo(() => {
    const minSide = Math.min(windowSize.width, windowSize.height);
    let adaptiveSize = Math.floor(minSide * 0.08);
    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (isDesktop) {
      adaptiveSize = Math.floor(adaptiveSize * 1.5);
    }
    return Math.max(50, Math.min(adaptiveSize, 200));
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

    // Слой "грязи" - темно-серый с текстурой
    ctx.fillStyle = '#33302d';
    ctx.fillRect(0, 0, width, height);

    // Добавляем шум для реалистичности
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < 50000; i++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
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
    const sampleRate = 40; 

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

    // Режим "ластика"
    ctx.globalCompositeOperation = 'destination-out';
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentBrushSize);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
    ctx.fill();

    const now = Date.now();
    if (now - lastCheckTime.current > 150) {
      calculateProgress();
      lastCheckTime.current = now;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Важно для iOS/Telegram: активируем аудио при первом жесте
    audioService.startScrubbing();
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setMousePos({ x: e.clientX, y: e.clientY });
    scrub(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isDrawing) {
      scrub(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDrawing(false);
    audioService.stopScrubbing();
    calculateProgress();
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <div 
      className="relative w-full h-full overflow-hidden bg-zinc-900 touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Запасной фон, если картинка не грузится */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        {isImageLoading && (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mb-2" />
            <p className="text-white/40 text-xs font-mono uppercase tracking-widest">Loading View...</p>
          </div>
        )}
      </div>

      <img 
        src={BACKGROUND_URL} 
        alt="Landscape"
        onLoad={() => setIsImageLoading(false)}
        onError={() => setIsImageLoading(false)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
      />

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 touch-none transition-opacity duration-1000 ${status === GameStatus.CLEAN ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      />

      {/* UI */}
      <div className="absolute top-0 left-0 p-4 z-20 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <p className="text-white text-[10px] font-black tracking-[0.2em] uppercase">
            Cleaned: {progress}%
          </p>
        </div>
      </div>

      <div className="absolute top-0 right-0 p-4 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); initCanvas(); }}
          className="bg-black/40 hover:bg-black/60 active:scale-90 transition-all p-3 rounded-full border border-white/20 text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {status === GameStatus.CLEAN && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 animate-in fade-in duration-700 bg-black/40 backdrop-blur-sm">
           <div className="bg-zinc-900 border border-white/10 p-12 rounded-[2rem] flex flex-col items-center text-center shadow-2xl">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-6 text-white shadow-lg shadow-green-500/30">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Crystal Clear!</h2>
              <button 
                onClick={(e) => { e.stopPropagation(); initCanvas(); }}
                className="mt-6 bg-white text-black font-bold py-3 px-8 rounded-xl active:scale-95 transition-all"
              >
                Reset
              </button>
           </div>
        </div>
      )}

      {/* Custom Cursor for Desktop */}
      <div 
        className={`cursor-brush ${isDrawing ? 'active' : ''}`}
        style={{ 
          left: mousePos.x, 
          top: mousePos.y,
          width: isDrawing ? currentBrushSize * 1.1 : currentBrushSize,
          height: isDrawing ? currentBrushSize * 1.1 : currentBrushSize,
          opacity: status === GameStatus.CLEAN ? 0 : 1
        }}
      />
    </div>
  );
};

export default App;
