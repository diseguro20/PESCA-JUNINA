import React, { useState, useEffect, useRef } from 'react';
import { Anchor, Sparkles, AlertCircle, Volume2, VolumeX, HelpCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';

interface Fish {
  id: number;
  type: string;
  color: string;
  y: number; // Porcentagem de profundidade (30% a 85%)
  scale: number; // Tamanho
  speed: number; // Velocidade do nado
  leftToRight: boolean; // Direção
  offset: number; // Posição horizontal inicial/atual
  depth: 'shallow' | 'medium' | 'deep';
  hasHat?: boolean;
}

interface LakeAreaProps {
  onRoundComplete: (result: { winAmount: number; multiplier: number; fishType: string; fishColor: string }) => void;
  betAmount: number;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
}

export const LakeArea: React.FC<LakeAreaProps> = ({
  onRoundComplete,
  betAmount,
  isProcessing,
  setIsProcessing
}) => {
  const { playFishingRound } = useGame();
  
  // Estados do Jogo
  const [gameStatus, setGameStatus] = useState<'waiting' | 'preparing' | 'fishing' | 'caught' | 'result'>('waiting');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Escolha o valor e jogue a linha!');
  const [caughtFishData, setCaughtFishData] = useState<any>(null);
  
  // Elementos do Lago e Física
  const [fishList, setFishList] = useState<Fish[]>([]);
  const lakeRef = useRef<HTMLDivElement>(null);
  const [bobberPos, setBobberPos] = useState({ x: 50, y: 40 }); // Em porcentagem do lago
  
  // Sons simulados (Web Audio API para não precisar de arquivos externos)
  const playSound = (type: 'cast' | 'splash' | 'win' | 'fail') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === 'cast') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'splash') {
        // Ruído branco para simular água
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        noise.connect(filter);
        filter.connect(ctx.destination);
        noise.start();
      } else if (type === 'win') {
        const notes = [261.63, 329.63, 392.00, 523.25]; // Acorde C maior
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.1);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + idx * 0.1 + 0.3);
          osc.start(ctx.currentTime + idx * 0.1);
          osc.stop(ctx.currentTime + idx * 0.1 + 0.3);
        });
      }
    } catch (e) {
      console.warn("Erro ao reproduzir áudio:", e);
    }
  };

  // 1. Inicializar Peixes Nadando
  useEffect(() => {
    const types = ['comum', 'azul', 'vermelho', 'verde', 'purple', 'gold', 'rainbow'];
    const generatedFish: Fish[] = Array.from({ length: 10 }).map((_, i) => {
      const type = types[i % types.length]!;
      const depthOptions: Array<'shallow' | 'medium' | 'deep'> = ['shallow', 'medium', 'deep'];
      const depth = depthOptions[i % 3]!;
      
      let scale = 0.7 + Math.random() * 0.4;
      if (depth === 'shallow') scale *= 0.7; // Mais profundos parecem maiores ou vice-versa, vamos ajustar
      if (depth === 'deep') scale *= 1.3;

      return {
        id: i,
        type,
        color: type,
        y: 25 + Math.random() * 55, // Porcentagem do topo
        scale,
        speed: 0.08 + Math.random() * 0.12, // Velocidade por frame
        leftToRight: Math.random() > 0.5,
        offset: Math.random() * 100, // Inicia em posição aleatória
        depth,
        hasHat: type === 'rainbow', // O Lendário ganha o chapéu de palha
      };
    });
    setFishList(generatedFish);
  }, []);

  // 2. Loop de animação dos peixes (Natação fluida)
  useEffect(() => {
    let animId: number;
    const updatePhysics = () => {
      setFishList((prevList) =>
        prevList.map((fish) => {
          let newOffset = fish.offset + (fish.leftToRight ? fish.speed : -fish.speed);
          let newDir = fish.leftToRight;

          // Se passar da borda do lago, vira e muda direção
          if (newOffset > 105) {
            newOffset = 105;
            newDir = false;
          } else if (newOffset < -15) {
            newOffset = -15;
            newDir = true;
          }

          return {
            ...fish,
            offset: newOffset,
            leftToRight: newDir,
          };
        })
      );
      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 3. Função Principal: Lançar Vara de Pesca (Fluxo da Rodada)
  const handleCastFishingLine = async () => {
    if (isProcessing || gameStatus !== 'waiting') return;

    setIsProcessing(true);
    setGameStatus('preparing');
    setStatusMessage('Preparando lançamento...');
    playSound('cast');

    // Mover a boia de volta para a vara antes de lançar
    setBobberPos({ x: 50, y: 100 });

    // Animar arremesso da boia
    let progress = 0;
    const targetX = 35 + Math.random() * 30; // Alvo aleatório no lago
    const targetY = 30 + Math.random() * 25;

    const castInterval = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) {
        clearInterval(castInterval);
        setBobberPos({ x: targetX, y: targetY });
        setGameStatus('fishing');
        setStatusMessage('Pescando... Aguarde o peixe fisgar!');
        playSound('splash');
        
        // Iniciar suspense do jogo chamando o backend
        triggerBackendRoll(targetX, targetY);
      } else {
        // Trajetória parabólica
        const currentX = 50 + (targetX - 50) * progress;
        const currentY = 100 - (100 - targetY) * progress - Math.sin(progress * Math.PI) * 25;
        setBobberPos({ x: currentX, y: currentY });
      }
    }, 25);
  };

  const triggerBackendRoll = async (bX: number, bY: number) => {
    try {
      // Chamar o backend seguro
      const result = await playFishingRound(betAmount);
      
      // Suspense de 2.5 segundos para dar clima de quermesse
      setTimeout(() => {
        setCaughtFishData(result);
        setGameStatus('caught');
        setStatusMessage('FISGOU! Recolhendo a linha...');
        playSound('splash');

        // Animar recolhimento do peixe em direção ao pescador
        animateReeling(result, bX, bY);
      }, 2500);

    } catch (error: any) {
      // Se der erro (ex: saldo insuficiente), aborta e avisa
      setGameStatus('waiting');
      setIsProcessing(false);
      setStatusMessage(error.message || 'Erro ao pescar.');
    }
  };

  const animateReeling = (result: any, startX: number, startY: number) => {
    let progress = 0;
    const reelInterval = setInterval(() => {
      progress += 0.08;
      if (progress >= 1) {
        clearInterval(reelInterval);
        setGameStatus('waiting');
        setIsProcessing(false);
        setStatusMessage('Escolha o valor e jogue a linha!');
        
        // Notificar o pai sobre o resultado
        onRoundComplete({
          winAmount: result.winAmount,
          multiplier: result.multiplier,
          fishType: result.fishType,
          fishColor: result.fishColor
        });

        if (result.multiplier > 0) {
          playSound('win');
        }
      } else {
        // Mover boia e peixe de volta para a vara (em linha reta rápida)
        const currentX = startX + (50 - startX) * progress;
        const currentY = startY + (90 - startY) * progress;
        setBobberPos({ x: currentX, y: currentY });
      }
    }, 30);
  };

  // Renderizar o Peixe Vetorial no lago
  const renderLakeFish = (fish: Fish) => {
    const isLendario = fish.hasHat;
    let colorHex = "#3b82f6";
    if (fish.color === 'gold') colorHex = "#ffd166";
    else if (fish.color === 'red') colorHex = "#e63946";
    else if (fish.color === 'verde') colorHex = "#06d6a0";
    else if (fish.color === 'purple') colorHex = "#a855f7";
    else if (fish.color === 'rainbow') colorHex = "url(#rainbow-fish)";

    return (
      <div
        key={fish.id}
        className="absolute pointer-events-none select-none transition-opacity duration-300"
        style={{
          top: `${fish.y}%`,
          left: `${fish.offset}%`,
          transform: `scale(${fish.scale}) scaleX(${fish.leftToRight ? 1 : -1})`,
          opacity: fish.depth === 'shallow' ? 0.75 : fish.depth === 'medium' ? 0.45 : 0.25,
          zIndex: fish.depth === 'shallow' ? 4 : fish.depth === 'medium' ? 3 : 2,
        }}
      >
        {/* Sombra do Peixe */}
        <svg className="w-16 h-10 translate-y-3 opacity-30 fill-black filter blur-xs" viewBox="0 0 100 50">
          <path d="M10,25 Q40,5 70,25 L85,15 L80,25 L85,35 Z" />
        </svg>

        {/* Peixe Real */}
        <div className="absolute top-0 left-0">
          <svg className="w-16 h-10 filter drop-shadow-md" viewBox="0 0 100 50">
            <path 
              d="M10,25 Q40,5 70,25 L85,15 L80,25 L85,35 Z" 
              fill={colorHex}
            />
            {/* Olho */}
            <circle cx="25" cy="22" r="2" fill="white" />
            <circle cx="25.5" cy="22" r="1" fill="black" />
            
            {/* Chapéu de Palha Caipira */}
            {isLendario && (
              <g transform="translate(16, 2) rotate(-10) scale(0.3)">
                <path d="M20,50 Q50,0 80,50 Z" fill="#d9b38c" stroke="#8a5a36" strokeWidth="3" />
                <ellipse cx="50" cy="53" rx="48" ry="12" fill="#d9b38c" stroke="#8a5a36" strokeWidth="3" />
                <path d="M22,48 Q50,30 78,48 L76,51 Q50,35 24,51 Z" fill="#e63946" />
              </g>
            )}

            <defs>
              <linearGradient id="rainbow-fish" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      
      {/* BARRA SUPERIOR DO LAGO (CONTROLES RÁPIDOS) */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 pointer-events-auto">
        {/* Indicador de Status */}
        <div className="bg-junina-blue-deep/80 border border-junina-gold/20 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs backdrop-blur-sm shadow-md">
          <div className={`w-2.5 h-2.5 rounded-full ${
            gameStatus === 'waiting' ? 'bg-junina-gold animate-pulse' :
            gameStatus === 'fishing' ? 'bg-blue-400 animate-ping' : 'bg-junina-green animate-bounce'
          }`} />
          <span className="font-bold tracking-wide text-gray-200 uppercase">{statusMessage}</span>
        </div>

        {/* Mudo / Som */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2 rounded-full border border-junina-gold/20 text-junina-gold hover:bg-junina-gold/15 transition-all backdrop-blur-sm ${soundEnabled ? 'bg-junina-gold/10' : 'bg-junina-blue-deep/60'}`}
          title={soundEnabled ? 'Mutar Sons' : 'Ativar Sons'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* ÁREA DO LAGO (LAKE VIEWPORT) */}
      <div 
        ref={lakeRef}
        className="flex-1 w-full rounded-3xl border border-junina-gold/30 water-surface relative select-none shadow-2xl overflow-hidden flex flex-col justify-end"
        style={{ minHeight: '320px' }}
      >
        {/* Grade de Profundidade Visual (Simulada por Gradientes) */}
        <div className="absolute inset-0 bg-gradient-to-t from-junina-blue-deep via-transparent to-transparent opacity-60 pointer-events-none" />

        {/* 1. Renderizar os Peixes que Nadam no Lago */}
        {fishList.map(renderLakeFish)}

        {/* 2. Efeitos de Ondulações na Água e Linha de Pesca */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          
          {/* Ondulação (Ripple) da boia flutuando */}
          {gameStatus === 'fishing' && (
            <g transform={`translate(${bobberPos.x * (lakeRef.current?.clientWidth || 0) / 100}, ${bobberPos.y * (lakeRef.current?.clientHeight || 0) / 100})`}>
              <circle r="12" fill="none" stroke="rgba(255,259,102,0.4)" strokeWidth="1" className="animate-ping" style={{ animationDuration: '3s' }} />
              <circle r="24" fill="none" stroke="rgba(255,259,102,0.2)" strokeWidth="1" className="animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
            </g>
          )}

          {/* Linha de Pesca (SVG Path Curvada) */}
          {(gameStatus === 'preparing' || gameStatus === 'fishing' || gameStatus === 'caught') && (
            <path
              d={`M ${(lakeRef.current?.clientWidth || 0) / 2} ${(lakeRef.current?.clientHeight || 0) - 10} 
                  Q ${(lakeRef.current?.clientWidth || 0) * (50 + (bobberPos.x - 50) * 0.4) / 100} ${(lakeRef.current?.clientHeight || 0) * (100 + (bobberPos.y - 100) * 0.55) / 100} 
                  ${bobberPos.x * (lakeRef.current?.clientWidth || 0) / 100} ${bobberPos.y * (lakeRef.current?.clientHeight || 0) / 100}`}
              fill="none"
              stroke="rgba(244,244,244,0.45)"
              strokeWidth="1.2"
              strokeDasharray={gameStatus === 'preparing' ? '4,4' : 'none'}
            />
          )}

        </svg>

        {/* 3. A Boia de Pesca (Bobber) Física */}
        {(gameStatus === 'preparing' || gameStatus === 'fishing' || gameStatus === 'caught') && (
          <div
            className={`absolute z-10 w-6 h-10 pointer-events-none flex flex-col items-center justify-start`}
            style={{
              left: `${bobberPos.x}%`,
              top: `${bobberPos.y}%`,
              transform: 'translate(-50%, -80%)',
              transition: gameStatus === 'preparing' ? 'none' : 'top 0.1s ease-out, left 0.1s ease-out',
            }}
          >
            {/* Boia caipira (metade vermelha, metade branca) */}
            <div className={`w-3.5 h-6 rounded-full border border-black/40 shadow-md flex flex-col overflow-hidden ${
              gameStatus === 'fishing' ? 'animate-bounce' : ''
            }`} style={{ animationDuration: '1.2s' }}>
              <div className="w-full h-1/2 bg-junina-red" />
              <div className="w-full h-1/2 bg-white" />
            </div>
            {/* Antena da Boia */}
            <div className="w-0.5 h-3 bg-yellow-400 mt-[-28px]" />
          </div>
        )}

        {/* 4. Renderizar Peixe Sendo Puxado (Estado Caught) */}
        {gameStatus === 'caught' && (
          <div 
            className="absolute z-10 pointer-events-none animate-bounce"
            style={{
              left: `${bobberPos.x}%`,
              top: `${bobberPos.y}%`,
              transform: 'translate(-50%, -20%) scale(1.1)',
            }}
          >
            {/* Peixe fisgado saindo da água com respingos */}
            <div className="relative">
              <svg className="w-12 h-8 fill-junina-gold text-white drop-shadow" viewBox="0 0 100 50">
                <path d="M10,25 Q40,5 70,25 L85,15 L80,25 L85,35 Z" />
              </svg>
              <div className="absolute top-[-5px] right-[-5px] bg-junina-orange text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white/20 scale-75 uppercase">
                Fisgado!
              </div>
            </div>
          </div>
        )}

        {/* 5. A Vara de Pesca (Visual do Pescador no Rodapé) */}
        <div className="w-full h-12 flex justify-center items-end relative z-10 pointer-events-none">
          <div className="w-8 h-24 bg-gradient-to-t from-junina-wood-dark to-junina-wood rounded-full border border-junina-wood-light origin-bottom transform rotate-[-30deg] translate-y-12 translate-x-[-12px]" />
        </div>

      </div>

      {/* ÁREA DE CONTROLES INFERIORES */}
      <div className="mt-4 flex flex-col md:flex-row gap-3 items-center">
        
        {/* Indicador de Aposta no Celular */}
        <div className="w-full md:w-auto flex items-center justify-between gap-3 bg-junina-blue-deep/60 px-4 py-3 rounded-2xl border border-junina-gold/15 flex-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Valor da Rodada</span>
            <span className="text-base font-black text-junina-gold">
              R$ {betAmount.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-1.5 text-xs font-bold text-gray-400">
            <span>Mín: R$ 1,00</span>
            <span>•</span>
            <span>Máx: R$ 500,00</span>
          </div>
        </div>

        {/* Botão Principal PESCAR */}
        <button
          onClick={handleCastFishingLine}
          disabled={isProcessing || gameStatus !== 'waiting'}
          className={`w-full md:w-64 py-4 rounded-2xl font-black text-base shadow-xl tracking-wider select-none transform transition-all active:scale-[0.98] ${
            isProcessing || gameStatus !== 'waiting'
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
              : 'bg-gradient-to-r from-junina-orange via-junina-gold to-junina-orange text-junina-wood-dark hover:shadow-junina-gold/25 hover:brightness-105 hover:scale-[1.01]'
          }`}
        >
          {gameStatus === 'waiting' && 'LANCAR LINHA (PESCAR)'}
          {gameStatus === 'preparing' && 'PREPARANDO...'}
          {gameStatus === 'fishing' && 'AGUARDANDO PEIXE...'}
          {gameStatus === 'caught' && 'RECOLHENDO LINHA!'}
        </button>

      </div>

    </div>
  );
};
