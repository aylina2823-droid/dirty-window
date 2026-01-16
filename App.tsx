
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

const CLEAN_THRESHOLD = 0.85;

const SCENIC_IMAGES = [
  "1470071459604-3b5ec3a7fe05",
  "1441974231531-c6227db76b6e",
  "1501785887741-f67a99599682",
  "1472214103551-237f51d073d2",
  "1469474968028-56623f02e42e",
  "1447752875215-b2761acb3c5d",
  "1586348943549-c92dd457c647",
  "1426604966149-8084e0af976a"
];

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const [bgId, setBgId] = useState(SCENIC_IMAGES[0]);
  const lastCheckTime = useRef<number>(0);

  const currentImageUrl = useMemo(() => {
    return `https://images.unsplash.com/photo-${bgId}?auto=format&fit=crop&w=1200&q=70`;
  }, [bgId]);

  const currentBrushSize = useMemo(() => {
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    let size = Math.floor(minSide * 0.16);
    return Math.max(80, Math.min(size, 180));
  }, []);

  const initCanvas = useCallback(() => {
    const others = SCENIC_IMAGES.filter(id => id !== bgId);
    setBgId(others[Math.floor(Math.random() * others.length)]);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(240, 245, 255, 0.97)');
    gradient.addColorStop(1, 'rgba(220, 225, 240, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 10000; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }

    setProgress(0);
    setStatus(GameStatus.PLAYING);
  }, [bgId]);

  useEffect(() => {
    initCanvas();
    const handleResize = () => {
      if (canvasRef.current) initCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
    ctx.fill();

    if (Date.now() - lastCheckTime.current > 120) {
      calculateProgress();
      lastCheckTime.current = Date.now();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    audioService.startScrubbing(); // Это также активирует AudioContext на мобильных
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setMousePos({ x: e.clientX, y: e.clientY });
    scrub(e.clientX, e.clientY);
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-zinc-900 overflow-hidden touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
        if (isDrawing) scrub(e.clientX, e.clientY);
      }}
      onPointerUp={() => { 
        setIsDrawing(false); 
        audioService.stopScrubbing(); 
        calculateProgress(); 
      }}
    >
      <img 
        src={currentImageUrl} 
        alt=""
        className="absolute inset-0 w-full h-full object-cover block pointer-events-none z-0"
        style={{ 
          filter: status === GameStatus.CLEAN ? 'none' : `blur(${Math.max(0, 25 - progress * 0.5)}px)`,
          transition: 'filter 0.3s ease-out'
        }}
      />

      <canvas 
        ref={canvasRef} 
        className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-1000 ${status === GameStatus.CLEAN ? 'opacity-0' : 'opacity-100'}`} 
      />

      <div className="absolute top-6 left-6 z-20 pointer-events-none select-none">
        <div className="bg-white/20 backdrop-blur-xl px-5 py-2 rounded-2xl border border-white/10 text-white shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">
            Очищено: <span className="text-white">{progress}%</span>
          </p>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); initCanvas(); }} 
          className="bg-white/20 hover:bg-white/30 p-4 rounded-2xl border border-white/10 text-white shadow-2xl backdrop-blur-xl transition-all active:scale-90"
          title="Сбросить"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {status === GameStatus.CLEAN && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8 bg-black/20 animate-in fade-in duration-500">
          <div className="bg-white/95 backdrop-blur-3xl p-10 rounded-[2.5rem] shadow-2xl text-center max-w-xs w-full">
            <h2 className="text-2xl font-black mb-6 text-zinc-900 tracking-tighter uppercase">Идеально чисто</h2>
            <button 
              onClick={(e) => { e.stopPropagation(); initCanvas(); }} 
              className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-bold active:scale-95 transition-all text-[11px] tracking-widest uppercase"
            >
              Следующее окно
            </button>
          </div>
        </div>
      )}

      <div 
        className="cursor-brush" 
        style={{ 
          left: mousePos.x, 
          top: mousePos.y, 
          width: currentBrushSize, 
          height: currentBrushSize,
          opacity: (status === GameStatus.CLEAN || isDrawing) ? 0 : 0.4,
          background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 70%)',
          border: '1px solid rgba(255,255,255,0.2)'
        }} 
      />
    </div>
  );
};

export default App;
