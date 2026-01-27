import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

// Extend window for Telegram
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        expand: () => void;
        ready: () => void;
        disableVerticalSwipes: () => void;
        headerColor: string;
        backgroundColor: string;
      };
    };
  }
}

// Порог очистки 0.85
const CLEAN_THRESHOLD = 0.85;

// Линейная структура уровней (70 изображений):
const backgroundImages = Array.from({ length: 70 }, (_, i) => i + 1).map(
  num => `https://raw.githubusercontent.com/aylina2823-droid/dirty-window/main/public/backgrounds/${num}.jpg?v=3`
);

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [showVictoryUI, setShowVictoryUI] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const [bgIndex, setBgIndex] = useState(0);
  const [isImgLoading, setIsImgLoading] = useState(true);
  const [surfaceSize, setSurfaceSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  const lastCheckTime = useRef<number>(0);
  const retryCount = useRef<number>(0);

  // Telegram Initialization
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      if (window.Telegram.WebApp.disableVerticalSwipes) {
        window.Telegram.WebApp.disableVerticalSwipes();
      }
    }
  }, []);

  const seriesConfig = useMemo(() => {
    if (bgIndex < 10) {
      return {
        emoji: "🌅",
        color: "#FF8E73", 
        title: "Тихое пробуждение",
        subtitle: "Мир всё еще размыт после сна. Протри, чтобы сфокусироваться."
      };
    } else if (bgIndex < 20) {
      return {
        emoji: "🍕",
        color: "#FFB300", 
        title: "Вкус жизни",
        subtitle: "Ароматы витают в воздухе. Очисти стекло, чтобы увидеть блюдо."
      };
    } else if (bgIndex < 30) {
      return {
        emoji: "🌊",
        color: "#65dbcc",
        title: "Дыхание моря",
        subtitle: "Соленый ветер и волны. Сотри брызги, чтобы увидеть горизонт."
      };
    } else if (bgIndex < 40) {
      return {
        emoji: "🎨",
        color: "#9469fa",
        title: "Игра цвета",
        subtitle: "Палитра эмоций скрыта. Очисти фон, чтобы вернуть яркость."
      };
    } else if (bgIndex < 50) {
      return {
        emoji: "🏔️",
        color: "#2f855a",
        title: "Величие вершин",
        subtitle: "Свежий воздух и свобода. Сотри туман, чтобы увидеть простор."
      };
    } else if (bgIndex < 60) {
      return {
        emoji: "🌃",
        color: "#1f406e",
        title: "Огни мегаполиса",
        subtitle: "Город не спит. Сотри темноту, чтобы найти свет."
      };
    } else {
      return {
        emoji: "☁️",
        color: "#7ad1ff",
        title: "Небесная высь",
        subtitle: "Ты на вершине мира. Коснись облаков своей рукой."
      };
    }
  }, [bgIndex]);

  const currentImageUrl = useMemo(() => {
    return backgroundImages[bgIndex];
  }, [bgIndex]);

  useEffect(() => {
    const nextIndex = (bgIndex + 1) % backgroundImages.length;
    const nextUrl = backgroundImages[nextIndex];
    const img = new Image();
    img.src = nextUrl;
  }, [bgIndex]);

  const currentBrushRadius = useMemo(() => {
    return surfaceSize.width < 768 ? 50 : 80;
  }, [surfaceSize.width]);

  const setupCanvasLayer = useCallback(() => {
    const canvas = canvasRef.current;
    const surface = (canvasRef.current?.parentElement as HTMLDivElement);
    if (!canvas || !surface) return;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = surface.clientWidth;
    const height = surface.clientHeight;
    setSurfaceSize({ width, height });

    canvas.width = width;
    canvas.height = height;

    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(235, 240, 250, 0.98)');
    gradient.addColorStop(1, 'rgba(215, 220, 235, 0.96)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 8000; i++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
    setProgress(0);
  }, []);

  useEffect(() => {
    setupCanvasLayer();
    const handleResize = () => {
      setupCanvasLayer();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvasLayer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefault = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) {
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchstart', preventDefault, { passive: false });
    container.addEventListener('touchmove', preventDefault, { passive: false });
    
    return () => {
      container.removeEventListener('touchstart', preventDefault);
      container.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  useEffect(() => {
    let timer: number;
    if (status === GameStatus.CLEAN) {
      timer = window.setTimeout(() => {
        setShowVictoryUI(true);
      }, 1000); // Показываем панель через 1 секунду после начала исчезновения тумана
    }
    return () => clearTimeout(timer);
  }, [status]);

  const startGame = () => {
    audioService.startScrubbing();
    audioService.stopScrubbing();
    setStatus(GameStatus.PLAYING);
  };

  const nextWindow = () => {
    const nextIdx = (bgIndex + 1) % backgroundImages.length;
    setBgIndex(nextIdx);
    setIsImgLoading(true);
    setShowVictoryUI(false);
    retryCount.current = 0;
    setupCanvasLayer();
    
    if (nextIdx % 10 === 0) {
      setStatus(GameStatus.START);
    } else {
      setStatus(GameStatus.PLAYING);
    }
  };

  const downloadImage = async () => {
    try {
      const response = await fetch(currentImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `window-cleaning-level-${bgIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download image", e);
      // Fallback
      const link = document.createElement('a');
      link.href = currentImageUrl;
      link.target = "_blank";
      link.download = `window-cleaning-level-${bgIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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

  const scrub = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || status !== GameStatus.PLAYING) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(x, y, 0, x, y, currentBrushRadius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, currentBrushRadius, 0, Math.PI * 2);
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
      ref={containerRef}
      className="fixed inset-0 w-full h-full bg-[var(--tg-theme-bg-color,#ffffff)] overflow-hidden flex flex-col pt-[20px] px-[10px] pb-[calc(env(safe-area-inset-bottom,0px)+80px)] sm:pb-[110px] touch-none overscroll-none"
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
      <div 
        className="relative flex-1 bg-zinc-900 rounded-[2.5rem] overflow-hidden"
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
          className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-1000 touch-none overscroll-none ${status === GameStatus.CLEAN ? 'opacity-0' : 'opacity-100'}`} 
        />

        {status === GameStatus.PLAYING && (
          <div className="absolute top-6 left-6 z-20 pointer-events-none select-none flex flex-col gap-2">
            <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-white shadow-2xl flex items-center gap-3">
               <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: seriesConfig.color }} />
               </div>
               <p className="text-[9px] font-black uppercase tracking-[0.2em]">
                {progress}%
              </p>
            </div>
          </div>
        )}

        {status === GameStatus.PLAYING && (
          <div className="absolute top-6 right-6 z-20">
            <button 
              onClick={(e) => { e.stopPropagation(); setupCanvasLayer(); }} 
              className="bg-black/40 hover:bg-black/50 p-4 rounded-2xl border border-white/10 text-white shadow-2xl backdrop-blur-xl transition-all active:scale-90 touch-auto"
              title="Запотеть заново"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>
        )}

        {/* Start Modal */}
        {status === GameStatus.START && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-[#F0F2F5]/80 backdrop-blur-[8px]">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.1)] text-center max-w-sm w-full animate-in fade-in zoom-in duration-300">
              <div className="text-[48px] mb-4 leading-none select-none">
                {seriesConfig.emoji}
              </div>
              <h2 className="text-xl font-black mb-2 tracking-tight uppercase leading-tight" style={{ color: seriesConfig.color }}>
                {seriesConfig.title}
              </h2>
              <p className="text-zinc-500 text-[12px] mb-5 leading-relaxed font-medium uppercase tracking-wider">
                {seriesConfig.subtitle}
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); startGame(); }} 
                className="w-full text-white py-[16px] rounded-2xl font-bold active:scale-95 transition-all text-[18px] tracking-widest uppercase shadow-lg touch-auto"
                style={{ backgroundColor: seriesConfig.color }}
              >
                Начать
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Victory Bottom Control Panel */}
      <div 
        className={`fixed left-0 right-0 bottom-0 bg-[var(--tg-theme-bg-color,#ffffff)] px-6 py-4 transition-transform duration-500 ease-out z-40 border-t border-black/5 flex items-center justify-between gap-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] ${showVictoryUI ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex flex-col">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 select-none">
            ИДЕАЛЬНО ЧИСТО ✨
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); downloadImage(); }} 
            className="w-12 h-12 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-full transition-all active:scale-90 touch-auto"
            title="Скачать"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); nextWindow(); }} 
            className="px-8 h-12 flex items-center gap-2 text-white font-bold rounded-full transition-all active:scale-95 shadow-md uppercase tracking-wider text-[14px] touch-auto"
            style={{ backgroundColor: seriesConfig.color }}
          >
            <span>ДАЛЬШЕ</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      <div 
        className="cursor-brush" 
        style={{ 
          left: mousePos.x, 
          top: mousePos.y, 
          width: currentBrushRadius * 2, 
          height: currentBrushRadius * 2,
          opacity: (status !== GameStatus.PLAYING || isDrawing) ? 0 : 0.4,
          background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 70%)',
          border: '1px solid rgba(255,255,255,0.2)'
        }} 
      />
    </div>
  );
};

export default App;
