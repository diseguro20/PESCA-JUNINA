import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Volume2, VolumeX, HelpCircle, AlertCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';

interface Fish {
  id: number;
  type: string;
  color: string;
  x: number; // Posição horizontal em % (substitui o offset)
  y: number; // Posição vertical em %
  scale: number; // Tamanho
  speedX: number; // Velocidade horizontal base
  speedY: number; // Velocidade vertical atual
  targetY: number; // Altura alvo vertical para nado
  leftToRight: boolean; // Direção desejada
  currentScaleX: number; // Escala X atual para giro 3D suave (1 a -1)
  depth: 'shallow' | 'medium' | 'deep';
  hasHat?: boolean;
  wiggleSpeed: number; // Velocidade do bater de cauda
  swimSpeedFactor: number; // Fator de velocidade atual (aceleração/glide)
  changeTargetTimer: number; // Contagem regressiva para novo alvo vertical
  wigglePhase: number; // Fase para a oscilação vertical
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

interface Splash {
  id: number;
  x: number;
  y: number; // Coordenadas em pixels
  vx: number;
  vy: number;
  size: number;
  opacity: number;
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
  
  // Elementos do Lago, Partículas e Física
  const [fishList, setFishList] = useState<Fish[]>([]);
  const fishListRef = useRef<Fish[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [splashes, setSplashes] = useState<Splash[]>([]);
  const lakeRef = useRef<HTMLDivElement>(null);
  const [bobberPos, setBobberPos] = useState({ x: 50, y: 40 }); // Em porcentagem do lago
  const [bobberTwitch, setBobberTwitch] = useState(false);
  const [bobberUnder, setBobberUnder] = useState(false);
  const [rodState, setRodState] = useState<'idle' | 'casting' | 'bending'>('idle');

  // Física de mola (Spring Physics) para a vara de pesca
  const [rodTip, setRodTip] = useState({ x: 65, y: 95 });
  const rodTipTarget = useRef({ x: 65, y: 95 });
  const rodTipVel = useRef({ x: 0, y: 0 });
  
  // Sons sintetizados via Web Audio API (Ricos e Imersivos)
  const playSound = (type: 'cast' | 'splash' | 'win' | 'fail' | 'bite') => {
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
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'splash') {
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } else if (type === 'bite') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'win') {
        // Sanfona/Acordeon Caipira Caipira (Melodia Junina)
        const notes = [293.66, 329.63, 392.00, 440.00, 587.33, 659.25]; // D4, E4, G4, A4, D5, E5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.22);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.22);
        });
      }
    } catch (e) {
      console.warn("Erro ao reproduzir áudio:", e);
    }
  };

  // Criar splash de partículas na água
  const createSplashParticles = (pctX: number, pctY: number) => {
    if (!lakeRef.current) return;
    const w = lakeRef.current.clientWidth;
    const h = lakeRef.current.clientHeight;
    const pxX = (pctX * w) / 100;
    const pxY = (pctY * h) / 100;

    const newSplashes = Array.from({ length: 16 }).map((_, i) => ({
      id: Math.random() + i,
      x: pxX,
      y: pxY,
      vx: (Math.random() - 0.5) * 4,
      vy: -3 - Math.random() * 5,
      size: 3 + Math.random() * 5,
      opacity: 0.9 + Math.random() * 0.1,
    }));
    setSplashes((prev) => [...prev, ...newSplashes]);
  };

  // 1. Inicializar Peixes
  useEffect(() => {
    const types = ['comum', 'azul', 'vermelho', 'verde', 'purple', 'gold', 'rainbow'];
    const generatedFish: Fish[] = Array.from({ length: 12 }).map((_, i) => {
      const type = types[i % types.length]!;
      const depthOptions: Array<'shallow' | 'medium' | 'deep'> = ['shallow', 'medium', 'deep'];
      const depth = depthOptions[i % 3]!;
      
      let scale = 0.5 + Math.random() * 0.35;
      if (depth === 'shallow') scale *= 0.8;
      if (depth === 'deep') scale *= 1.3;

      let minY = 28, maxY = 80;
      if (depth === 'shallow') { minY = 28; maxY = 45; }
      else if (depth === 'medium') { minY = 45; maxY = 65; }
      else if (depth === 'deep') { minY = 65; maxY = 82; }

      const y = minY + Math.random() * (maxY - minY);

      return {
        id: i,
        type,
        color: type,
        x: Math.random() * 100,
        y,
        scale,
        speedX: 0.03 + Math.random() * 0.04,
        speedY: 0,
        targetY: y,
        leftToRight: Math.random() > 0.5,
        currentScaleX: Math.random() > 0.5 ? 1 : -1,
        depth,
        hasHat: type === 'rainbow' || (type === 'gold' && Math.random() > 0.5),
        wiggleSpeed: 0.15 + Math.random() * 0.15,
        swimSpeedFactor: 1.0,
        changeTargetTimer: 50 + Math.floor(Math.random() * 150),
        wigglePhase: Math.random() * Math.PI * 2
      };
    });
    setFishList(generatedFish);
    fishListRef.current = generatedFish;
  }, []);

  // 2. Loop de animação dos peixes, mola da vara e partículas
  useEffect(() => {
    let animId: number;
    let bubbleCounter = 0;

    const updatePhysics = () => {
      // 1. Atualizar física dos peixes no array em memória e aplicar transformações no DOM diretamente (60 FPS fluidos)
      const currentFishList = fishListRef.current;
      const now = Date.now();
      for (let i = 0; i < currentFishList.length; i++) {
        const fish = currentFishList[i]!;

        // a. Atualizar timer de mudança de direção vertical
        fish.changeTargetTimer -= 1;
        if (fish.changeTargetTimer <= 0) {
          let minY = 28, maxY = 80;
          if (fish.depth === 'shallow') { minY = 28; maxY = 45; }
          else if (fish.depth === 'medium') { minY = 45; maxY = 65; }
          else if (fish.depth === 'deep') { minY = 65; maxY = 82; }
          
          fish.targetY = minY + Math.random() * (maxY - minY);
          fish.changeTargetTimer = 180 + Math.floor(Math.random() * 240); // 3 a 7 segundos em 60fps
        }

        // b. Movimento vertical orgânico em direção ao targetY
        const diffY = fish.targetY - fish.y;
        fish.speedY = fish.speedY + (diffY * 0.0025 - fish.speedY * 0.08);
        fish.y += fish.speedY;

        // Adicionar uma oscilação senoidal sutil
        const wobble = Math.sin(now * 0.003 + fish.wigglePhase) * 0.03;
        fish.y += wobble;

        // c. Movimento horizontal com impulsos e glides
        if (Math.random() < 0.004) {
          fish.swimSpeedFactor = 0.4 + Math.random() * 1.1;
        }
        fish.swimSpeedFactor += (1.0 - fish.swimSpeedFactor) * 0.012;

        fish.x += (fish.leftToRight ? fish.speedX : -fish.speedX) * fish.swimSpeedFactor;

        // Curva de retorno suave nas bordas
        if (fish.x > 105 && fish.leftToRight) {
          fish.leftToRight = false;
        } else if (fish.x < -15 && !fish.leftToRight) {
          fish.leftToRight = true;
        }

        // d. Giro 3D suave (currentScaleX)
        const targetScaleX = fish.leftToRight ? 1 : -1;
        fish.currentScaleX += (targetScaleX - fish.currentScaleX) * 0.07;

        // e. Atualizar o DOM diretamente para evitar re-renders do React e garantir 60fps lisos
        const el = document.getElementById(`fish-el-${fish.id}`);
        if (el) {
          el.style.left = `${fish.x}%`;
          el.style.top = `${fish.y}%`;
          el.style.transform = `scale(${fish.scale}) scaleX(${fish.currentScaleX})`;
          
          const innerEl = el.querySelector('.fish-wiggle-anim') as HTMLDivElement;
          if (innerEl) {
            const currentSpeed = Math.max(Math.abs(fish.speedX) * fish.swimSpeedFactor, 0.01);
            const wiggleDuration = (0.08 / currentSpeed).toFixed(2);
            innerEl.style.animationDuration = `${wiggleDuration}s`;
            innerEl.style.transformOrigin = fish.currentScaleX > 0 ? 'right center' : 'left center';
          }
        }
      }

      // Atualizar física de mola (Spring) da vara de pesca
      setRodTip((prevTip) => {
        const k = 0.075; // Rigidez da mola
        const damping = 0.72; // Atrito/amortecimento
        const fX = (rodTipTarget.current.x - prevTip.x) * k;
        const fY = (rodTipTarget.current.y - prevTip.y) * k;
        
        rodTipVel.current.x = (rodTipVel.current.x + fX) * damping;
        rodTipVel.current.y = (rodTipVel.current.y + fY) * damping;
        
        let nextX = prevTip.x + rodTipVel.current.x;
        let nextY = prevTip.y + rodTipVel.current.y;

        // Jitter de tensão caso o peixe esteja fisgado
        if (rodTipTarget.current.x === 42) {
          nextX += (Math.random() - 0.5) * 1.8;
          nextY += (Math.random() - 0.5) * 1.8;
        }

        return { x: nextX, y: nextY };
      });

      // Atualizar partículas de Splash
      setSplashes((prevSplashes) =>
        prevSplashes
          .map((s) => ({
            ...s,
            x: s.x + s.vx,
            y: s.y + s.vy,
            vy: s.vy + 0.15, // Gravidade
            opacity: s.opacity - 0.025,
          }))
          .filter((s) => s.opacity > 0)
      );

      // Atualizar bolhas de ar
      setBubbles((prevBubbles) => {
        const updated = prevBubbles
          .map((b) => ({
            ...b,
            y: b.y - b.speed,
            x: b.x + Math.sin(b.y * 0.06) * 0.25 // Ondulação sutil
          }))
          .filter((b) => b.y > -5);

        // Ocasionalmente spawnar nova bolha
        if (Math.random() < 0.055 && updated.length < 28) {
          updated.push({
            id: bubbleCounter++,
            x: 3 + Math.random() * 94,
            y: 105,
            size: 2.5 + Math.random() * 4.5,
            speed: 0.35 + Math.random() * 0.55,
            opacity: 0.15 + Math.random() * 0.25
          });
        }
        return updated;
      });

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Controlar o target da física da vara baseado no estado
  useEffect(() => {
    if (rodState === 'casting') {
      rodTipTarget.current = { x: 85, y: 65 }; // Verga para trás
    } else if (rodState === 'bending') {
      rodTipTarget.current = { x: 42, y: 132 }; // Curva forte com puxão de peixe
    } else {
      rodTipTarget.current = { x: 65, y: 95 }; // Repouso
    }
  }, [rodState]);

  // 3. Lançar Vara de Pesca (Fluxo da Rodada)
  const handleCastFishingLine = async () => {
    if (isProcessing || gameStatus !== 'waiting') return;

    setIsProcessing(true);
    setGameStatus('preparing');
    setRodState('casting');
    setStatusMessage('Preparando arremesso caipira...');
    playSound('cast');

    // Boia na ponta da vara
    setBobberPos({ x: 80, y: 90 });
    setBobberUnder(false);
    setBobberTwitch(false);

    // Animar arremesso balístico
    let progress = 0;
    const targetX = 22 + Math.random() * 56;
    const targetY = 32 + Math.random() * 26;

    const castInterval = setInterval(() => {
      progress += 0.038;
      if (progress >= 1) {
        clearInterval(castInterval);
        setBobberPos({ x: targetX, y: targetY });
        setGameStatus('fishing');
        setRodState('idle');
        setStatusMessage('Pescando... Aguarde o puxão da boia!');
        createSplashParticles(targetX, targetY);
        playSound('splash');
        
        // Iniciar chamada ao backend
        triggerBackendRoll(targetX, targetY);
      } else {
        // Trajetória balística parabólica com gravidade
        const currentX = 80 - (80 - targetX) * progress;
        const currentY = 90 - (90 - targetY) * progress - Math.sin(progress * Math.PI) * 38;
        setBobberPos({ x: currentX, y: currentY });
      }
    }, 20);
  };

  const triggerBackendRoll = async (bX: number, bY: number) => {
    try {
      const result = await playFishingRound(betAmount);
      
      // Sequência de suspense com puxões na boia
      setTimeout(() => {
        setBobberTwitch(true);
        playSound('bite');
        setTimeout(() => setBobberTwitch(false), 180);
      }, 1100);

      setTimeout(() => {
        setBobberTwitch(true);
        playSound('bite');
        setTimeout(() => {
          setBobberTwitch(false);
          // Fisgou! Boia afunda
          setBobberUnder(true);
          setRodState('bending');
          setGameStatus('caught');
          setCaughtFishData(result);
          setStatusMessage('FISGOU! Puxe a linha sô!');
          createSplashParticles(bX, bY);
          playSound('splash');
          
          // Animar recolhimento com inércia
          animateReeling(result, bX, bY);
        }, 300);
      }, 2300);

    } catch (error: any) {
      setGameStatus('waiting');
      setRodState('idle');
      setIsProcessing(false);
      setBobberUnder(false);
      setBobberTwitch(false);
      setStatusMessage(error.message || 'Erro ao pescar.');
    }
  };

  const animateReeling = (result: any, startX: number, startY: number) => {
    let progress = 0;
    const reelInterval = setInterval(() => {
      progress += 0.055; // Velocidade do recolhimento
      if (progress >= 1) {
        clearInterval(reelInterval);
        setGameStatus('waiting');
        setRodState('idle');
        setIsProcessing(false);
        setBobberUnder(false);
        setStatusMessage('Escolha o valor e jogue a linha!');
        
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
        // Recolher a boia em direção ao topo da vara
        const currentX = startX + (80 - startX) * progress;
        const currentY = startY + (85 - startY) * progress;
        setBobberPos({ x: currentX, y: currentY });
      }
    }, 22);
  };

  // Renderizar o Peixe com a Imagem Realista
  const renderLakeFish = (fish: Fish) => {
    const isLendario = fish.hasHat;
    const fishColorName = fish.color === 'comum' ? 'comum' : fish.color;
    const imageSrc = `/images/fish/fish_${fishColorName}.png`;

    // Filtros de glow e sombra baseados na cor/raridade
    let dropShadowFilter = "drop-shadow(0 0 3px rgba(59, 130, 246, 0.4))";
    if (fish.color === 'gold') {
      dropShadowFilter = "drop-shadow(0 0 5px rgba(251, 191, 36, 0.65))";
    } else if (fish.color === 'vermelho') {
      dropShadowFilter = "drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))";
    } else if (fish.color === 'verde') {
      dropShadowFilter = "drop-shadow(0 0 4px rgba(16, 185, 129, 0.5))";
    } else if (fish.color === 'purple') {
      dropShadowFilter = "drop-shadow(0 0 5px rgba(168, 85, 247, 0.65))";
    } else if (fish.color === 'rainbow') {
      dropShadowFilter = "drop-shadow(0 0 8px rgba(236, 72, 153, 0.8))";
    }

    const currentSpeed = Math.max(Math.abs(fish.speedX) * fish.swimSpeedFactor, 0.01);
    const wiggleDuration = (0.08 / currentSpeed).toFixed(2);

    return (
      <div
        id={`fish-el-${fish.id}`}
        key={fish.id}
        className="absolute pointer-events-none select-none"
        style={{
          top: `${fishListRef.current[fish.id]?.y ?? fish.y}%`,
          left: `${fishListRef.current[fish.id]?.x ?? fish.x}%`,
          transform: `scale(${fish.scale}) scaleX(${fishListRef.current[fish.id]?.currentScaleX ?? fish.currentScaleX})`,
          opacity: fish.depth === 'shallow' ? 0.9 : fish.depth === 'medium' ? 0.55 : 0.22,
          zIndex: fish.depth === 'shallow' ? 4 : fish.depth === 'medium' ? 3 : 2,
          transition: 'opacity 0.6s ease',
          filter: dropShadowFilter
        }}
      >
        {/* Sombra subaquática do peixe */}
        <div className="absolute top-8 left-3 opacity-30 filter blur-[3px] transform scale-y-50 scale-x-90">
          <svg className="w-16 h-8 fill-black" viewBox="0 0 100 50">
            <path d="M75,25 C60,10 25,12 15,25 C25,38 60,40 75,25 Z" />
          </svg>
        </div>

        {/* Peixe Realista */}
        <div 
          className="relative w-24 h-16 fish-wiggle-anim"
          style={{
            transformOrigin: (fishListRef.current[fish.id]?.currentScaleX ?? fish.currentScaleX) > 0 ? 'right center' : 'left center',
            animation: `fishWiggle ${wiggleDuration}s ease-in-out infinite`,
            animationDelay: `${fish.wigglePhase}s`
          }}
        >
          <img
            src={imageSrc}
            alt="Fish"
            className="w-full h-full object-contain"
            onError={(e) => {
              // Se a imagem falhar, mostra o fallback do SVG antigo
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fish-fallback');
              if (fallback) fallback.setAttribute('class', 'fish-fallback block w-full h-full');
            }}
          />

          {/* Fallback de SVG Caso as Imagens Falhem */}
          <div className="fish-fallback hidden">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 120 60">
              <path d="M15,30 C30,12 65,14 78,30 C65,46 30,48 15,30 Z" fill="#ffd166" />
              <circle cx="24" cy="26" r="3.5" fill="white" />
            </svg>
          </div>

          {/* Chapéu de Palha Junino Caipira */}
          {isLendario && (
            <div className="absolute" style={{ top: '-10px', left: fish.leftToRight ? '40px' : '0px' }}>
              <svg className="w-10 h-8 overflow-visible" viewBox="0 0 100 80">
                {/* Copa do chapéu */}
                <path d="M25,45 Q50,5 75,45 Z" fill="#d9b38c" stroke="#7c2d12" strokeWidth="2" />
                {/* Aba do chapéu */}
                <ellipse cx="50" cy="48" rx="42" ry="8" fill="#eab308" stroke="#7c2d12" strokeWidth="2" />
                {/* Fita vermelha */}
                <path d="M27,43 Q50,29 73,43 L72,46 Q50,33 28,46 Z" fill="#e63946" />
                {/* Detalhes de palha desfiada */}
                <line x1="8" y1="50" x2="16" y2="47" stroke="#7c2d12" strokeWidth="1.2" />
                <line x1="92" y1="50" x2="84" y2="47" stroke="#7c2d12" strokeWidth="1.2" />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Coordenadas calculadas da ponta da vara na escala do Lago
  const clientWidth = lakeRef.current?.clientWidth || 1000;
  const clientHeight = lakeRef.current?.clientHeight || 450;
  const tipXInLake = clientWidth - 241 + (rodTip.x * 1.28);
  const tipYInLake = clientHeight - 236 + (rodTip.y * 1.28);

  return (
    <div className="w-full h-full flex flex-col relative">
      
      {/* Estilo local para Vitórias Régias, caustics e nado */}
      <style jsx global>{`
        @keyframes waterLiliesSway {
          0% { transform: rotate(-3deg) translateY(0px); }
          100% { transform: rotate(3deg) translateY(2.5px); }
        }
        @keyframes fishWiggle {
          0% {
            transform: rotate(0deg) skewY(0deg) scaleY(1) translateX(0px);
          }
          25% {
            transform: rotate(-4deg) skewY(-6deg) scaleY(0.94) translateX(2px);
          }
          50% {
            transform: rotate(0deg) skewY(0deg) scaleY(1) translateX(0px);
          }
          75% {
            transform: rotate(4deg) skewY(6deg) scaleY(0.94) translateX(-2px);
          }
          100% {
            transform: rotate(0deg) skewY(0deg) scaleY(1) translateX(0px);
          }
        }
      `}</style>

      {/* BARRA SUPERIOR DO LAGO */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 pointer-events-auto">
        <div className="bg-black/60 border border-junina-gold/30 px-4 py-2 rounded-2xl flex items-center gap-2.5 text-xs backdrop-blur-md shadow-lg">
          <div className={`w-2.5 h-2.5 rounded-full ${
            gameStatus === 'waiting' ? 'bg-junina-gold animate-pulse' :
            gameStatus === 'fishing' ? 'bg-blue-400 animate-ping' : 'bg-junina-green animate-bounce'
          }`} />
          <span className="font-extrabold tracking-widest text-junina-gold uppercase text-[10px]">{statusMessage}</span>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2.5 rounded-2xl border border-white/10 text-junina-gold hover:bg-white/10 transition-all backdrop-blur-md ${soundEnabled ? 'bg-junina-gold/20 neon-border-gold' : 'bg-black/45'}`}
          title={soundEnabled ? 'Mutar Sons' : 'Ativar Sons'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* ÁREA DO LAGO */}
      <div 
        ref={lakeRef}
        className="flex-1 w-full rounded-3xl border border-white/10 water-surface relative select-none shadow-2xl overflow-hidden flex flex-col justify-end min-h-[380px]"
      >
        {/* Camada superior do lago (brilho e caustics) */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-400/5 via-transparent to-black/55 pointer-events-none z-1" />

        {/* Vitórias-régias balançando suavemente */}
        <div 
          className="absolute top-[22%] left-[10%] w-14 h-7 bg-emerald-900/45 rounded-full border border-emerald-800/35 pointer-events-none z-2"
          style={{ animation: 'waterLiliesSway 4s ease-in-out infinite alternate' }}
        >
          <div className="w-3.5 h-3.5 bg-pink-400/30 rounded-full absolute right-2.5 top-[-2px] animate-pulse" />
        </div>
        <div 
          className="absolute top-[52%] right-[14%] w-18 h-9 bg-emerald-900/40 rounded-full border border-emerald-800/30 pointer-events-none z-2"
          style={{ animation: 'waterLiliesSway 5s ease-in-out infinite alternate-reverse' }}
        >
          <div className="w-4 h-4 bg-pink-400/25 rounded-full absolute left-5 top-[-3px] animate-pulse" />
        </div>

        {/* Partículas de bolhas de ar subindo */}
        {bubbles.map((b) => (
          <div
            key={b.id}
            className="absolute bg-white/20 rounded-full border border-white/5 pointer-events-none"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              opacity: b.opacity,
              zIndex: 3,
            }}
          />
        ))}

        {/* Partículas de Splash (Física de água ativa) */}
        {splashes.map((s) => (
          <div
            key={s.id}
            className="absolute bg-blue-100 rounded-full border border-white/30 pointer-events-none z-10 filter blur-[0.5px]"
            style={{
              left: `${s.x}px`,
              top: `${s.y}px`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
            }}
          />
        ))}

        {/* 1. Renderizar os Peixes que Nadam */}
        {fishList.map(renderLakeFish)}

        {/* 2. Efeitos e Linha de Pesca SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* Ondulação (Ripple) da boia flutuando */}
          {gameStatus === 'fishing' && (
            <g transform={`translate(${bobberPos.x * clientWidth / 100}, ${bobberPos.y * clientHeight / 100})`}>
              <circle r="14" fill="none" stroke="rgba(255,209,102,0.35)" strokeWidth="1" className="animate-ping" style={{ animationDuration: '2.5s' }} />
              <circle r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" className="animate-ping" style={{ animationDuration: '4s', animationDelay: '0.8s' }} />
            </g>
          )}

          {/* Linha de Pesca conectada Dinamicamente ao RodTip */}
          {(gameStatus === 'preparing' || gameStatus === 'fishing' || gameStatus === 'caught') && (
            <path
              d={
                rodState === 'bending'
                  ? `M ${tipXInLake} ${tipYInLake} 
                     Q ${clientWidth * (bobberPos.x + 8) / 100} ${clientHeight * (bobberPos.y + 30) / 200} 
                     ${bobberPos.x * clientWidth / 100} ${bobberPos.y * clientHeight / 100}`
                  : `M ${tipXInLake} ${tipYInLake} 
                     Q ${clientWidth * (bobberPos.x + 4) / 100} ${clientHeight * (bobberPos.y + 55) / 200} 
                     ${bobberPos.x * clientWidth / 100} ${bobberPos.y * clientHeight / 100}`
              }
              fill="none"
              stroke={rodState === 'bending' ? "#ffd166" : "rgba(255,255,255,0.4)"}
              strokeWidth={rodState === 'bending' ? "1.8" : "0.95"}
              strokeDasharray={gameStatus === 'preparing' ? '3,3' : 'none'}
              style={{ filter: rodState === 'bending' ? 'drop-shadow(0 0 4px rgba(255,209,102,0.8))' : 'none' }}
            />
          )}
        </svg>

        {/* 3. A Boia de Pesca (Bobber) */}
        {(gameStatus === 'preparing' || gameStatus === 'fishing' || gameStatus === 'caught') && (
          <div
            className="absolute z-10 w-6 h-10 pointer-events-none flex flex-col items-center justify-start"
            style={{
              left: `${bobberPos.x}%`,
              top: `${bobberPos.y}%`,
              transform: `translate(-50%, ${bobberUnder ? '16px' : bobberTwitch ? '4px' : '0px'}) translate(-50%, -75%)`,
              transition: gameStatus === 'preparing' ? 'none' : 'transform 0.1s ease-out, top 0.08s ease-out, left 0.08s ease-out',
              opacity: bobberUnder ? 0.35 : 1
            }}
          >
            {/* Boia caipira premium */}
            <div className={`w-4 h-6 rounded-full border border-black/40 shadow-xl flex flex-col overflow-hidden ${
              gameStatus === 'fishing' && !bobberTwitch ? 'animate-bounce' : ''
            }`} style={{ animationDuration: '1.4s' }}>
              <div className="w-full h-1/2 bg-gradient-to-b from-junina-red to-red-600" />
              <div className="w-full h-1/2 bg-gradient-to-b from-white to-gray-200" />
            </div>
            {/* Haste/Antena da Boia */}
            <div className="w-0.5 h-3.5 bg-junina-gold mt-[-26px] border-r border-black/20" />
          </div>
        )}

        {/* 4. Peixe Fisgado Emergindo */}
        {gameStatus === 'caught' && caughtFishData && (
          <div 
            className="absolute z-10 pointer-events-none animate-bounce"
            style={{
              left: `${bobberPos.x}%`,
              top: `${bobberPos.y}%`,
              transform: 'translate(-50%, -30%) scale(1.3)',
              animationDuration: '0.8s'
            }}
          >
            <div className="relative w-16 h-12 flex items-center justify-center">
              <img 
                src={`/images/fish/fish_${caughtFishData.fishColor === 'comum' ? 'comum' : caughtFishData.fishColor}.png`}
                alt="Fisgado"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
              {/* Efeito splash na fisgada */}
              <div className="absolute inset-0 bg-blue-300/20 filter blur-xs animate-ping rounded-full scale-150" />
              
              <div className="absolute top-[-15px] right-[-15px] bg-junina-red text-white text-[8px] font-black px-2 py-0.5 rounded-full border border-white/30 scale-75 uppercase tracking-widest shadow-md">
                FISGOU!
              </div>
            </div>
          </div>
        )}

        {/* 5. A Vara de Pesca (SVG premium com passadores e molinete) */}
        <div className="absolute right-[-15px] bottom-[-20px] w-64 h-64 pointer-events-none z-15">
          <svg 
            className="w-full h-full overflow-visible" 
            viewBox="0 0 200 200"
            style={{
              transform: rodState === 'casting' 
                ? 'rotate(-12deg) translate(-12px, 12px)' 
                : rodState === 'bending'
                ? 'rotate(4deg) translate(4px, -4px)'
                : 'rotate(0deg)',
              transformOrigin: '170px 180px',
              transition: 'transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.25)'
            }}
          >
            {/* Cabo de madeira da vara */}
            <path d="M165,185 L180,165" stroke="#2c1a0a" strokeWidth="8" strokeLinecap="round" />
            <path d="M167,183 L178,167" stroke="#ffd166" strokeWidth="3" strokeLinecap="round" /> {/* Detalhe do punho */}
            
            {/* Carretilha/Molinete Premium */}
            <g transform="translate(155, 155)">
              <circle cx="10" cy="10" r="9" fill="#2d3748" stroke="#1a202c" strokeWidth="2" />
              <rect x="7" y="3" width="6" height="14" rx="2" fill="#ffd166" />
              <circle cx="10" cy="10" r="3.5" fill="#e2e8f0" />
              {/* Manivela com rotação se estiver recolhendo */}
              <g className={gameStatus === 'caught' ? 'origin-center animate-spin' : ''} style={{ transformOrigin: '10px 10px', animationDuration: '1s' }}>
                <path d="M10,10 L3,2" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                <circle cx="3" cy="2" r="3" fill="#e63946" />
              </g>
            </g>

            {/* Corpo Flexível Dinâmico da Vara (Bending Path calculado por spring physics) */}
            <path 
              d={`M167,169 C145,${120 + (rodTip.y - 95) * 0.45} 108,${82 + (rodTip.y - 95) * 0.75} ${rodTip.x} ${rodTip.y}`} 
              fill="none" 
              stroke="#6a401c" 
              strokeWidth="3.2" 
              strokeLinecap="round" 
            />

            {/* Linha saindo do molinete até o corpo da vara */}
            <path 
              d={`M165,165 L125,${115 + (rodTip.y - 95) * 0.2} L95,${95 + (rodTip.y - 95) * 0.5} L${rodTip.x} ${rodTip.y}`} 
              fill="none" 
              stroke="rgba(255,255,255,0.3)" 
              strokeWidth="0.8" 
            />

            {/* Passadores de linha (anéis) na vara */}
            <g>
              <circle cx={125} cy={115 + (rodTip.y - 95) * 0.2} r="2.5" fill="none" stroke="#ffd166" strokeWidth="1" />
              <circle cx={95} cy={95 + (rodTip.y - 95) * 0.5} r="2" fill="none" stroke="#ffd166" strokeWidth="1" />
              <circle cx={rodTip.x} cy={rodTip.y} r="1.5" fill="none" stroke="#ffd166" strokeWidth="1" />
            </g>
          </svg>
        </div>

      </div>

      {/* ÁREA DE CONTROLES INFERIORES */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3.5 items-center w-full">
        
        {/* Indicador de Valor da Rodada */}
        <div className="w-full sm:w-auto flex items-center justify-between gap-4 bg-junina-blue-deep/75 px-5 py-3.5 rounded-2xl border border-junina-gold/25 flex-1 shadow-inner">
          <div className="flex flex-col text-left">
            <span className="text-[9px] text-gray-400 uppercase tracking-widest font-black">Aposta da Rodada</span>
            <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-junina-gold via-junina-orange to-junina-red mt-0.5">
              R$ {betAmount.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2 text-[10px] font-extrabold text-junina-gold bg-white/5 px-2.5 py-1 rounded-lg border border-junina-gold/15">
            <span>Min: R$ 1</span>
            <span>•</span>
            <span>Max: R$ 500</span>
          </div>
        </div>

        {/* Botão Principal */}
        <button
          onClick={handleCastFishingLine}
          disabled={isProcessing || gameStatus !== 'waiting'}
          className={`w-full sm:w-72 py-4 rounded-2xl font-black text-sm tracking-widest select-none transform transition-all active:scale-[0.97] uppercase shadow-lg border ${
            isProcessing || gameStatus !== 'waiting'
              ? 'bg-gray-800/40 border-gray-700/30 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-junina-orange via-junina-gold to-junina-orange border-junina-gold/40 text-junina-wood-dark hover:shadow-junina-gold/25 hover:brightness-105 hover:scale-[1.01] neon-border-gold font-extrabold'
          }`}
        >
          {gameStatus === 'waiting' && 'ARREMESSAR VARA (PESCAR)'}
          {gameStatus === 'preparing' && 'Arremessando...'}
          {gameStatus === 'fishing' && 'Aguardando peixe...'}
          {gameStatus === 'caught' && 'Fisgou! Recolhendo...'}
        </button>

      </div>

    </div>
  );
};
