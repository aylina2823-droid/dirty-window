
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

const CLEAN_THRESHOLD = 0.85;

// Обновленный список из 10 максимально стабильных и популярных ID Unsplash
const SCENIC_IMAGES = [
  "1464822759023-fed622ff2c3b", // Горный массив
  "1501854140801-50d01698950b", // Зеленые холмы
  "1441974231531-c6227db76b6e", // Лесная чаща
  "1470071459604-3b5ec3a7fe05", // Туманный пейзаж
  "1447752875215-b2761acb3c5d", // Осенний лес
  "1472214103551-237f51d073d2", // Поле на закате
  "1532274402911-5a3b114c5d27", // Озеро в горах
  "1506744038136-46273834b3fb", // Гранд-Каньон
  "1511497584788-876760111969", // Хвойный лес
  "1493246507139-91e8fad9978e"  // Снежные пики
];

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const [bgIndex, setBgIndex] = useState(0);
  const [isImgLoading, setIsImgLoading] = useState(true);
  const lastCheckTime = useRef<number>(0);
  const retryCount = useRef<number>(0);

  // Формируем URL. Добавляем sig для предотвращения проблем с кэшем, если картинка битая
  const currentImageUrl = useMemo(() => {
    return `https://images.unsplash.com/photo-${SCENIC_IMAGES[bgIndex]}?q=80&w=1800&auto=format&fit=crop`;
  }, [bgIndex]);

  // Предзагрузка следующего изображения
  useEffect(() => {
    const nextIndex = (bgIndex + 1) % SCENIC_IMAGES.length;
    const nextUrl = `https://images.unsplash.com/photo-${SCENIC_IMAGES[nextIndex]}?q=80&w=1800&auto=format&fit=crop`;
    const img = new Image();
    img.src = nextUrl;
  }, [bgIndex]);

  const currentBrushSize = useMemo(() => {
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    let size = Math.floor(minSide * 0.16);
    return Math.max(80, Math.min(size, 180));
  }, []);

  const initCanvas = useCallback(() => {
    setBgIndex((prev) => (prev + 1) % SCENIC_IMAGES.length);
    setIsImgLoading(true);
    retryCount.current = 0;

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
    setStatus(GameStatus.PLAYING);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        // Сохраняем содержимое при ресайзе или просто перерисовываем
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
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
    audioService.startScrubbing();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setMousePos({ x: e.clientX, y: e.clientY });
    scrub(e.clientX, e.clientY);
  };

  const handleImageError = () => {
    console.warn(`Картинка ${SCENIC_IMAGES[bgIndex]} не загрузилась. Пробуем следующую...`);
    // Чтобы не уйти в бесконечный цикл, если вдруг всё сломалось
    if (retryCount.current < SCENIC_IMAGES.length) {
      retryCount.current++;
      setBgIndex((prev) => (prev + 1) % SCENIC_IMAGES.length);
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
        calculateProgress(); 
      }}
    >
      {/* Фоновое изображение */}
      <img 
        src={currentImageUrl} 
        alt=""
        className={`absolute inset-0 w-full h-full object-cover block pointer-events-none z-0 transition-opacity duration-700 ${isImgLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ 
          filter: status === GameStatus.CLEAN ? 'none' : `blur(${Math.max(0, 20 - progress * 0.4)}px)`,
          transition: 'filter 0.4s ease-out, opacity 0.7s ease-in'
        }}
        onLoad={() => setIsImgLoading(false)}
        onError={handleImageError}
      />

      {/* Индикатор загрузки фото */}
      {isImgLoading && (
        <div className="absolute inset-0 z-0 flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest animate-pulse font-bold">
          Загрузка пейзажа...
        </div>
      )}

      {/* Канвас со "стеклом" */}
      <canvas 
        ref={canvasRef} 
        className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-1000 ${status === GameStatus.CLEAN ? 'opacity-0' : 'opacity-100'}`} 
      />

      {/* Прогресс */}
      <div className="absolute top-6 left-6 z-20 pointer-events-none select-none">
        <div className="bg-black/40 backdrop-blur-xl px-5 py-2 rounded-2xl border border-white/10 text-white shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">
            Очищено: <span className="text-white">{progress}%</span>
          </p>
        </div>
      </div>

      {/* Кнопка сброса */}
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); initCanvas(); }} 
          className="bg-black/40 hover:bg-black/50 p-4 rounded-2xl border border-white/10 text-white shadow-2xl backdrop-blur-xl transition-all active:scale-90"
          title="Сбросить"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {/* Экран победы */}
      {status === GameStatus.CLEAN && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8 bg-black/50 animate-in fade-in duration-500 backdrop-blur-md">
          <div className="bg-white/95 backdrop-blur-3xl p-10 rounded-[2.5rem] shadow-2xl text-center max-w-xs w-full scale-up-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-black mb-6 text-zinc-900 tracking-tighter uppercase">Идеально чисто</h2>
            <button 
              onClick={(e) => { e.stopPropagation(); initCanvas(); }} 
              className="w-full bg-zinc-900 text-white py-5 rounded-2xl font-bold active:scale-95 transition-all text-[11px] tracking-widest uppercase shadow-xl"
            >
              Следующее окно
            </button>
          </div>
        </div>
      )}

      {/* Курсор-кисть */}
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
