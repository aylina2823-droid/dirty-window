import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { audioService } from './services/audioService';
import { GameStatus, Point } from './types';

const CLEAN_THRESHOLD = 0.85;
const BACKGROUND_URL = `https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80`;

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: -100, y: -100 });
  const [isImageLoading, setIsImageLoading] = useState(true);
  const lastCheckTime = useRef<number>(0);

  const currentBrushSize = useMemo(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const minSide = Math.min(width, height);
    let adaptiveSize = Math.floor(minSide * 0.12); 
    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (isDesktop) adaptiveSize = Math.floor(adaptiveSize * 1.3);
    return Math.max(70, Math.min(adaptiveSize, 250));
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#8b8682'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 30000; i++) ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1.5, 1.5);
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
    const step = 60; 
    for (let i = 3; i < data.length; i += 4 * step) if (data[i] === 0) transparent++;
    const current = transparent / (data.length / (4 * step));
    setProgress(Math.floor(current * 100));
    if (current > CLEAN_THRESHOLD) {
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
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentBrushSize);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
    ctx.fill();
    if (Date.now() - lastCheckTime.current > 100) {
      calculateProgress();
      lastCheckTime.current = Date.now();
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-zinc-900 touch-none select-none"
      onPointerDown={(e) => { audioService.startScrubbing(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setIsDrawing(true); scrub(e.clientX, e.clientY); }}
      onPointerMove={(e) => { setMousePos({ x: e.clientX, y: e.clientY }); if (isDrawing) scrub(e.clientX, e.clientY); }}
      onPointerUp={(e) => { setIsDrawing(false); audioService.stopScrubbing(); calculateProgress(); }}
    >
      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
        {isImageLoading && <div className="animate-spin w-8 h-8 border-4 border-t-white border-white/20 rounded-full" />}
      </div>
      <img src={BACKGROUND_URL} onLoad={() => setIsImageLoading(false)} className={`absolute inset-0 w-full h-full object-cover ${isImageLoading ? 'opacity-0' : 'opacity-100'}`} />
      <canvas ref={canvasRef} className={`absolute inset-0 z-10 transition-opacity duration-1000 ${status === GameStatus.CLEAN ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />
      <div className="absolute top-6 left-6 z-20 bg-black/40 p-2 px-4 rounded-xl border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest">
        Cleaned: {progress}%
      </div>
      <div className="absolute top-6 right-6 z-20">
        <button onClick={initCanvas} className="bg-white/10 p-4 rounded-xl text-white border border-white/20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg></button>
      </div>
      {status === GameStatus.CLEAN && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-sm">
           <div className="bg-white p-10 rounded-[2.5rem] text-center shadow-2xl">
              <h2 className="text-3xl font-black mb-6">CLEAN!</h2>
              <button onClick={initCanvas} className="bg-black text-white px-10 py-4 rounded-xl font-bold">AGAIN</button>
           </div>
        </div>
      )}
      <div className="cursor-brush" style={{ left: mousePos.x, top: mousePos.y, width: currentBrushSize, height: currentBrushSize, opacity: status === GameStatus.CLEAN ? 0 : 1 }} />
    </div>
  );
};
export default App;
