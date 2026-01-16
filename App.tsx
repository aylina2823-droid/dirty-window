
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

const CLEAN_THRESHOLD = 0.85;
const BACKGROUND_URL = `https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=80`;

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const [isImageLoading, setIsImageLoading] = useState(true);
  const lastCheckTime = useRef<number>(0);

  const currentBrushSize = useMemo(() => {
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    let size = Math.floor(minSide * 0.12);
    if (window.matchMedia('(pointer: fine)').matches) size *= 1.3;
    return Math.max(70, Math.min(size, 250));
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Рисуем текстуру грязи
    ctx.fillStyle = '#7d7874'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 20000; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }
    
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 10000; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
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

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    const step = 80; 
    for (let i = 3; i < data.length; i += 4 * step) {
      if (data[i] === 0) transparent++;
    }
    const ratio = transparent / (data.length / (4 * step));
    setProgress(Math.floor(ratio * 100));

    if (ratio > CLEAN_THRESHOLD) {
      setStatus(GameStatus.CLEAN);
      audioService.stopScrubbing();
    }
  }, []);

  const scrub = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || status === GameStatus.CLEAN) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(x, y, 0, x, y, currentBrushSize);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
    ctx.fill();

    if (Date.now() - lastCheckTime.current > 100) {
      calculateProgress();
      lastCheckTime.current = Date.now();
    }
  };

  const handleDown = (e: React.PointerEvent) => {
    audioService.startScrubbing();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    scrub(e.clientX, e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isDrawing) scrub(e.clientX, e.clientY);
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-zinc-900 overflow-hidden touch-none"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={() => { setIsDrawing(false); audioService.stopScrubbing(); }}
    >
      <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
        {isImageLoading && <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />}
      </div>
      
      <img 
        src={BACKGROUND_URL} 
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setIsImageLoading(false)}
      />

      <canvas ref={canvasRef} className={`absolute inset-0 z-10 transition-opacity duration-1000 ${status === GameStatus.CLEAN ? 'opacity-0' : 'opacity-100'}`} />

      <div className="absolute top-6 left-6 z-20 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest">
        Progress: {progress}%
      </div>

      <div className="absolute top-6 right-6 z-20">
        <button onClick={initCanvas} className="bg-white/10 p-4 rounded-xl border border-white/10 text-white active:scale-90 transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
        </button>
      </div>

      {status === GameStatus.CLEAN && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter">Window Cleaned!</h2>
            <button onClick={initCanvas} className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors">PLAY AGAIN</button>
          </div>
        </div>
      )}

      <div className="cursor-brush" style={{ left: mousePos.x, top: mousePos.y, opacity: status === GameStatus.CLEAN ? 0 : 1 }} />
    </div>
  );
};

export default App;
