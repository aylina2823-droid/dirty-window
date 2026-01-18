
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

const CLEAN_THRESHOLD = 0.85;

const backgroundImages = [
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/1.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/2.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/3.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/4.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/5.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/6.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/7.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/8.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/9.jpg',
  'https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/10.jpg'
];

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const [bgIndex, setBgIndex] = useState(0);
  const [isImgLoading, setIsImgLoading] = useState(true);
  const lastCheckTime = useRef<number>(0);
  const retryCount = useRef<number>(0);

  const currentImageUrl = useMemo(() => {
    return backgroundImages[bgIndex];
  }, [bgIndex]);

  // Preload next image
  useEffect(() => {
    const nextIndex = (bgIndex + 1) % backgroundImages.length;
    const nextUrl = backgroundImages[nextIndex];
    const img = new Image();
    img.src = nextUrl;
  }, [bgIndex]);

  const currentBrushSize = useMemo(() => {
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    let size = Math.floor(minSide * 0.16);
    return Math.max(80, Math.min(size, 180));
  }, []);

  const setupCanvasLayer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(235, 240, 250, 0.98)');
    gradient.addColorStop(1, 'rgba(215, 220, 235, 0.96)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 8000; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }
    setProgress(0);
  }, []);

  const startGame = () => {
    audioService.startScrubbing();
    audioService.stopScrubbing();
    setStatus(GameStatus.PLAYING);
  };

  const nextWindow = () => {
    setBgIndex((prev) => (prev + 1) % backgroundImages.length);
    setIsImgLoading(true);
    retryCount.current = 0;
    setupCanvasLayer();
    setStatus(GameStatus.PLAYING);
  };

  useEffect(() => {
    setupCanvasLayer();
    const handleResize = () => setupCanvasLayer();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvasLayer]);

  const calculateProgress = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || status !== GameStatus.PLAYING) return;
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
  }, [status]);

  const scrub = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || status !== GameStatus.PLAYING) return;
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
    if (status !== GameStatus.PLAYING) return;
    audioService.startScrubbing();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setMousePos({ x: e.clientX, y: e.clientY });
    scrub(e.clientX, e.clientY);
  };

  const handleImageError = () => {
    if (retryCount.current < backgroundImages.length) {
      retryCount.current++;
      setBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-zinc-950 overflow-hidden touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
        if (isDrawing) scrub(e.clientX, e.clientY);
      }}
      onPointerUp={() => { 
        setIsDrawing(false); 
        audioService.stopScrubbing(); 
        if (status === GameStatus.PLAYING) calculateProgress(); 
      }}
    >
      <img 
        src={currentImageUrl} 
        alt=""
        className={`absolute inset-0 w-full h-full object-cover block pointer-events-none z-0 transition-opacity duration-700 ${isImgLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ 
          filter: status === GameStatus.CLEAN ? 'none' : `blur(${Math.max(0, 25 - progress * 1.5)}px)`,
          transition: 'filter 0.3s ease-out, opacity 0.7s ease-in'
        }}
        onLoad={() => setIsImgLoading(false)}
        onError={handleImageError}
      />

      {isImgLoading && (
        <div className="absolute inset-0 z-0 flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest animate-pulse font-bold">
          Загрузка...
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-1000 ${status === GameStatus.CLEAN ? 'opacity-0' : 'opacity-100'}`} 
      />

      {status === GameStatus.PLAYING && (
        <div className="absolute top-6 left-6 z-20 pointer-events-none select-none flex flex-col gap-2">
          <div className="bg-black/40 backdrop-blur-xl px-5 py-2 rounded-2xl border border-white/10 text-white shadow-2xl flex items-center gap-3">
             <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${progress}%` }} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em]">
              {progress}%
            </p>
          </div>
        </div>
      )}

      {status === GameStatus.PLAYING && (
        <div className="absolute top-6 right-6 z-20">
          <button 
            onClick={(e) => { e.stopPropagation(); setupCanvasLayer(); }} 
            className="bg-black/40 hover:bg-black/50 p-4 rounded-2xl border border-white/10 text-white shadow-2xl backdrop-blur-xl transition-all active:scale-90"
            title="Запотеть заново"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
      )}

      {/* Начальный экран */}
      {status === GameStatus.START && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8 bg-black/20 backdrop-blur-[2px]">
          <div className="bg-white/90 backdrop-blur-3xl p-10 rounded-[2.5rem] shadow-2xl text-center max-w-xs w-full animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <h2 className="text-xl font-black mb-2 text-zinc-900 tracking-tight uppercase">Окно запотело</h2>
            <p className="text-zinc-500 text-[11px] mb-8 leading-relaxed font-medium uppercase tracking-wider">Протри стекло, чтобы увидеть вид за окном</p>
            <button 
              onClick={(e) => { e.stopPropagation(); startGame(); }} 
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-5 rounded-2xl font-bold active:scale-95 transition-all text-[14px] tracking-[0.2em] uppercase shadow-xl"
            >
              Начать
            </button>
          </div>
        </div>
      )}

      {/* Экран победы */}
      {status === GameStatus.CLEAN && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8 bg-black/50 animate-in fade-in duration-500 backdrop-blur-md">
          <div className="bg-white/95 backdrop-blur-3xl p-10 rounded-[2.5rem] shadow-2xl text-center max-w-xs w-full scale-up-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-black mb-6 text-zinc-900 tracking-tighter uppercase">Чисто</h2>
            <button 
              onClick={(e) => { e.stopPropagation(); nextWindow(); }} 
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-5 rounded-2xl font-bold active:scale-95 transition-all text-[14px] tracking-widest uppercase shadow-xl"
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
          opacity: (status !== GameStatus.PLAYING || isDrawing) ? 0 : 0.4,
          background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 70%)',
          border: '1px solid rgba(255,255,255,0.2)'
        }} 
      />
    </div>
  );
};

export default App;
