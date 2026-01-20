
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

// Порог очистки 0.85
const CLEAN_THRESHOLD = 0.85;

// Линейная структура уровней (70 изображений):
// Теперь файлы на GitHub переименованы в строгом порядке сюжета (1.jpg - 70.jpg).
// Используем простой цикл и кэш-бастер ?v=3.
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
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  const lastCheckTime = useRef<number>(0);
  const retryCount = useRef<number>(0);

  // Определение текстов этапов по утвержденным диапазонам (каждые 10 уровней)
  // bgIndex 0-9   (Уровень 1-10)
  // bgIndex 10-19 (Уровень 11-20)
  // и т.д.
  const stageInfo = useMemo(() => {
    if (bgIndex < 10) {
      return {
        title: "Тихое пробуждение",
        subtitle: "Мир всё еще размыт после сна. Протри, чтобы сфокусироваться."
      };
    } else if (bgIndex < 20) {
      return {
        title: "Вкус жизни",
        subtitle: "Ароматы витают в воздухе. Очисти стекло, чтобы увидеть блюдо."
      };
    } else if (bgIndex < 30) {
      return {
        title: "Дыхание моря",
        subtitle: "Соленый ветер и волны. Сотри брызги, чтобы увидеть горизонт."
      };
    } else if (bgIndex < 40) {
      return {
        title: "Игра цвета",
        subtitle: "Палитра эмоций скрыта. Очисти фон, чтобы вернуть яркость."
      };
    } else if (bgIndex < 50) {
      return {
        title: "Величие вершин",
        subtitle: "Свежий воздух и свобода. Сотри туман, чтобы увидеть простор."
      };
    } else if (bgIndex < 60) {
      return {
        title: "Огни мегаполиса",
        subtitle: "Город не спит. Сотри темноту, чтобы найти свет."
      };
    } else {
      return {
        title: "Небесная высь",
        subtitle: "Ты на вершине мира. Коснись облаков своей рукой."
      };
    }
  }, [bgIndex]);

  const currentImageUrl = useMemo(() => {
    return backgroundImages[bgIndex];
  }, [bgIndex]);

  // Предзагрузка следующего изображения
  useEffect(() => {
    const nextIndex = (bgIndex + 1) % backgroundImages.length;
    const nextUrl = backgroundImages[nextIndex];
    const img = new Image();
    img.src = nextUrl;
  }, [bgIndex]);

  // Динамический размер кисти
  const currentBrushRadius = useMemo(() => {
    return windowWidth < 768 ? 50 : 80;
  }, [windowWidth]);

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

  useEffect(() => {
    setupCanvasLayer();
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setupCanvasLayer();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvasLayer]);

  // Блокировка нативных жестов скролла и закрытия
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

  // Эффект для задержки появления кнопки "Следующее окно"
  useEffect(() => {
    let timer: number;
    if (status === GameStatus.CLEAN) {
      timer = window.setTimeout(() => {
        setShowVictoryUI(true);
      }, 2500);
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
    
    // Срабатывает каждые 10 уровней (0, 10, 20...)
    if (nextIdx % 10 === 0) {
      setStatus(GameStatus.START);
    } else {
      setStatus(GameStatus.PLAYING);
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

  const scrub = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || status !== GameStatus.PLAYING) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
      className="fixed inset-0 w-full h-full bg-zinc-950 overflow-hidden touch-none overscroll-none"
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
        className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-1000 touch-none overscroll-none ${status === GameStatus.CLEAN ? 'opacity-0' : 'opacity-100'}`} 
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
            className="bg-black/40 hover:bg-black/50 p-4 rounded-2xl border border-white/10 text-white shadow-2xl backdrop-blur-xl transition-all active:scale-90 touch-auto"
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
          <div className="bg-white/90 backdrop-blur-3xl p-10 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <h2 className="text-2xl font-black mb-2 text-zinc-900 tracking-tight uppercase leading-tight">
              {stageInfo.title}
            </h2>
            <p className="text-zinc-500 text-[13px] mb-8 leading-relaxed font-medium uppercase tracking-wider">
              {stageInfo.subtitle}
            </p>
            <button 
              onClick={(e) => { e.stopPropagation(); startGame(); }} 
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-5 rounded-2xl font-bold active:scale-95 transition-all text-[14px] tracking-[0.2em] uppercase shadow-xl touch-auto"
            >
              Начать
            </button>
          </div>
        </div>
      )}

      {/* Экран победы (кнопка "Дальше") */}
      {showVictoryUI && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8 bg-black/50 animate-in fade-in duration-700 backdrop-blur-md">
          <div className="bg-white/95 backdrop-blur-3xl p-10 rounded-[2.5rem] shadow-2xl text-center max-w-xs w-full scale-up-center animate-in zoom-in duration-500">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-black mb-6 text-zinc-900 tracking-tighter uppercase">Чисто</h2>
            <button 
              onClick={(e) => { e.stopPropagation(); nextWindow(); }} 
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-5 rounded-2xl font-bold active:scale-95 transition-all text-[14px] tracking-widest uppercase shadow-xl touch-auto"
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
