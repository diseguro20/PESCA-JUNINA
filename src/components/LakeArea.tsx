import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Volume2, VolumeX, HelpCircle, AlertCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';

interface Fish {
  id: number;
  type: string;
  color: string;
  x: number; // Posição horizontal em %
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
  
  // Variáveis da física "Burst & Glide" (Impulso e Deslizamento)
  swimCycleTimer: number; // Temporizador interno do ciclo de nado
  swimCyclePeriod: number; // Duração do ciclo completo (batidas + deslize)
  burstDuration: number; // Duração do impulso ativo
  wiggleAmp: number; // Amplitude atual do bater de cauda (0 a 1)
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
  y: number;
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

// Sub-componente memoizado para renderizar a lista de peixes uma única vez
const FishListContainer: React.FC<{ fishes: Fish[] }> = React.memo(({ fishes }) => {
  return (
    <>
      {fishes.map((fish) => {
        const isLendario = fish.hasHat;
        const fishColorName = fish.color === 'comum' ? 'comum' : fish.color;
        const imageSrc = `/images/fish/fish_${fishColorName}.png`;

        // Filtros de glow e sombra baseados na cor/raridade
        let dropShadowFilter = "drop-shadow(0 0 3px rgba(59, 130, 245, 0.4))";
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

        return (
          <div
            id={`fish-el-${fish.id}`}
            key={fish.id}
            className="absolute pointer-events-none select-none"
            style={{
              top: `${fish.y}%`,
              left: `${fish.x}%`,
              transform: `scale(${fish.scale}) scaleX(${fish.currentScaleX})`,
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

            {/* Peixe Realista com wiggle em JS */}
            <div 
              id={`fish-wiggle-el-${fish.id}`}
              className="relative w-24 h-16"
              style={{
                transformOrigin: fish.currentScaleX > 0 ? 'right center' : 'left center',
              }}
            >
              <img
                src={imageSrc}
                alt="Fish"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.fish-fallback') as HTMLElement;
                  if (fallback) fallback.style.display = 'block';
                }}
              />

              {/* Fallback de SVG Caso as Imagens Falhem */}
              <div className="fish-fallback" style={{ display: 'none' }}>
                <svg className="w-full h-full overflow-visible" viewBox="0 0 120 60">
                  <path d="M15,30 C30,12 65,14 78,30 C65,46 30,48 15,30 Z" fill="#ffd166" />
                  <circle cx="24" cy="26" r="3.5" fill="white" />
                </svg>
              </div>

              {/* Chapéu de Palha Junino Caipira */}
              {isLendario && (
                <div 
                  className="absolute fish-hat" 
                  style={{ 
                    top: '-10px', 
                    left: fish.leftToRight ? '40px' : '0px',
                    transition: 'left 0.22s ease-out'
                  }}
                >
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
      })}
    </>
  );
}, () => true);

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
  const fishListRef = useRef<Fish[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  const splashesRef = useRef<Splash[]>([]);
  const lakeRef = useRef<HTMLDivElement>(null);
  const bobberPosRef = useRef({ x: 50, y: 40 });
  const bobberUnderRef = useRef(false);
  const bobberTwitchRef = useRef(false);
  const [rodState, setRodState] = useState<'idle' | 'casting' | 'bending'>('idle');
  const rodStateRef = useRef<'idle' | 'casting' | 'bending'>('idle');

  // Cache de dimensões para evitar Layout Thrashing
  const lakeWidthRef = useRef(1000);
  const lakeHeightRef = useRef(450);

  // Função auxiliar para atualizar o estado e a ref do rodState de forma síncrona
  const updateRodState = (state: 'idle' | 'casting' | 'bending') => {
    setRodState(state);
    rodStateRef.current = state;
  };

  // Física de mola (Spring Physics) para a vara de pesca
  const rodTipRef = useRef({ x: 65, y: 95 });
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
    const w = lakeWidthRef.current;
    const h = lakeHeightRef.current;
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
    splashesRef.current.push(...newSplashes);
  };

  // 1. Inicializar Peixes Memória Síncrona
  const initialFishes = React.useMemo(() => {
    const types = ['comum', 'azul', 'vermelho', 'verde', 'purple', 'gold', 'rainbow'];
    return Array.from({ length: 12 }).map((_, i) => {
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
        speedX: 0.012 + Math.random() * 0.018, // Velocidade horizontal base reduzida e mais natural
        speedY: 0,
        targetY: y,
        leftToRight: Math.random() > 0.5,
        currentScaleX: Math.random() > 0.5 ? 1 : -1,
        depth,
        hasHat: type === 'rainbow' || (type === 'gold' && Math.random() > 0.5),
        wiggleSpeed: 0.09 + Math.random() * 0.06, // Velocidade base do wiggle suavizada
        swimSpeedFactor: 0.4,
        changeTargetTimer: 50 + Math.floor(Math.random() * 150),
        wigglePhase: Math.random() * Math.PI * 2,
        
        // Inicialização física "Burst & Glide" (Impulso e Deslizamento)
        swimCycleTimer: Math.random() * 200, // Tempo de início aleatório
        swimCyclePeriod: 160 + Math.random() * 140, // Ciclo completo (2.6 a 5 segundos)
        burstDuration: 35 + Math.random() * 25, // Duração ativa da batida (0.6 a 1 segundo)
        wiggleAmp: 0
      };
    });
  }, []);

  // Sincronizar peixes gerados com a ref no início
  useEffect(() => {
    fishListRef.current = initialFishes;
  }, [initialFishes]);

  // ResizeObserver para cachear dimensões do lago e ajustar canvas sem reflows no game loop
  useEffect(() => {
    if (!lakeRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width || 1000;
        const height = entry.contentRect.height || 450;
        lakeWidthRef.current = width;
        lakeHeightRef.current = height;
        
        // Ajustar dimensões do canvas imediatamente de forma otimizada
        const canvas = document.getElementById('lake-canvas') as HTMLCanvasElement;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
        }
      }
    });
    
    observer.observe(lakeRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Loop de animação dos peixes, mola da vara e partículas
  useEffect(() => {
    let animId: number;
    let bubbleCounter = 0;

    const updatePhysics = () => {
      // 1. Atualizar física dos peixes no array em memória e aplicar transformações no DOM diretamente (60 FPS fluidos)
      const currentFishList = fishListRef.current;
      const now = Date.now();
      const lakeWidth = lakeWidthRef.current;
      
      // Responsividade de escala: peixes encolhem proporcionalmente em telas menores
      const responsivenessFactor = Math.max(0.5, Math.min(1.0, lakeWidth / 850));

      for (let i = 0; i < currentFishList.length; i++) {
        const fish = currentFishList[i]!;

        // a. Ciclo de nado (Burst & Glide)
        fish.swimCycleTimer += 1;
        if (fish.swimCycleTimer >= fish.swimCyclePeriod) {
          fish.swimCycleTimer = 0;
          fish.swimCyclePeriod = 160 + Math.random() * 140;
          fish.burstDuration = 35 + Math.random() * 25;
        }

        const isBursting = fish.swimCycleTimer < fish.burstDuration;

        if (isBursting) {
          // Fase de Impulso (Burst): acelera gradualmente e bate a cauda de forma ágil
          fish.swimSpeedFactor += (1.30 - fish.swimSpeedFactor) * 0.05;
          fish.wiggleAmp += (1.0 - fish.wiggleAmp) * 0.12;
          fish.wigglePhase += fish.wiggleSpeed * 1.4; // Frequência ativa de batidas
        } else {
          // Fase de Deslizamento (Glide): desacelera por atrito e cauda para de bater
          fish.swimSpeedFactor += (0.20 - fish.swimSpeedFactor) * 0.015;
          fish.wiggleAmp += (0.0 - fish.wiggleAmp) * 0.06;
          fish.wigglePhase += fish.wiggleSpeed * 0.12; // Oscilação residual muito sutil
        }

        // b. Atualizar timer de mudança de direção vertical
        fish.changeTargetTimer -= 1;
        if (fish.changeTargetTimer <= 0) {
          let minY = 28, maxY = 80;
          if (fish.depth === 'shallow') { minY = 28; maxY = 45; }
          else if (fish.depth === 'medium') { minY = 45; maxY = 65; }
          else if (fish.depth === 'deep') { minY = 65; maxY = 82; }
          
          fish.targetY = minY + Math.random() * (maxY - minY);
          fish.changeTargetTimer = 180 + Math.floor(Math.random() * 240); // 3 a 7 segundos em 60fps
        }

        // c. Movimento vertical orgânico em direção ao targetY
        const diffY = fish.targetY - fish.y;
        fish.speedY = fish.speedY + (diffY * 0.0016 - fish.speedY * 0.08); // Suavização do nado vertical
        fish.y += fish.speedY;

        // Adicionar uma oscilação senoidal sutil na posição vertical
        const wobble = Math.sin(now * 0.002 + (fish.id * 5)) * 0.025;
        fish.y += wobble;

        // d. Movimento horizontal
        fish.x += (fish.leftToRight ? fish.speedX : -fish.speedX) * fish.swimSpeedFactor;

        // Curva de retorno suave nas bordas
        if (fish.x > 105 && fish.leftToRight) {
          fish.leftToRight = false;
        } else if (fish.x < -15 && !fish.leftToRight) {
          fish.leftToRight = true;
        }

        // e. Giro 3D suave (currentScaleX)
        const targetScaleX = fish.leftToRight ? 1 : -1;
        fish.currentScaleX += (targetScaleX - fish.currentScaleX) * 0.07;

        // f. Atualizar o DOM diretamente para evitar re-renders do React e garantir 60fps lisos
        const el = document.getElementById(`fish-el-${fish.id}`);
        if (el) {
          el.style.left = `${fish.x}%`;
          el.style.top = `${fish.y}%`;
          
          // Aplicar escala do peixe com base na profundidade e no fator de responsividade da tela
          const currentScale = fish.scale * responsivenessFactor;
          el.style.transform = `scale(${currentScale.toFixed(3)}) scaleX(${fish.currentScaleX.toFixed(3)})`;
          
          const innerEl = document.getElementById(`fish-wiggle-el-${fish.id}`) as HTMLDivElement;
          if (innerEl) {
            // Calcular rotação e distorção senoidal do nado usando a amplitude atual
            const wiggleAngleBase = Math.sin(fish.wigglePhase) * 6.0 * fish.wiggleAmp;
            
            // Adicionar inclinação corporal vertical (Pitch) baseado na velocidade vertical
            // Se speedY > 0 (descendo), o peixe inclina para baixo. Se speedY < 0 (subindo), inclina para cima.
            // Multiplicamos por -180 para converter a taxa de velocidade em graus de inclinação física coerente
            const pitchAngle = Math.max(-12, Math.min(12, -fish.speedY * 180));
            const totalRotation = wiggleAngleBase + pitchAngle;

            const skewY = Math.sin(fish.wigglePhase) * 6.5 * fish.wiggleAmp;
            const scaleY = 1.0 - (1.0 - (0.96 + Math.cos(fish.wigglePhase * 2) * 0.04)) * fish.wiggleAmp;
            const translateX = Math.sin(fish.wigglePhase) * 1.5 * fish.wiggleAmp;
            
            innerEl.style.transform = `rotate(${totalRotation.toFixed(2)}deg) skewY(${skewY.toFixed(2)}deg) scaleY(${scaleY.toFixed(2)}) translateX(${translateX.toFixed(2)}px)`;
            innerEl.style.transformOrigin = fish.currentScaleX > 0 ? 'right center' : 'left center';
          }

          // Ajustar dinamicamente a posição do chapéu caipira se houver
          const hatEl = el.querySelector('.fish-hat') as HTMLDivElement;
          if (hatEl) {
            hatEl.style.left = fish.leftToRight ? '40px' : '0px';
          }
        }
      }

      // f. Atualizar física de mola (Spring) da vara de pesca
      const rTip = rodTipRef.current;
      const k = 0.075; // Rigidez da mola
      const damping = 0.72; // Atrito/amortecimento
      const fX = (rodTipTarget.current.x - rTip.x) * k;
      const fY = (rodTipTarget.current.y - rTip.y) * k;
      
      rodTipVel.current.x = (rodTipVel.current.x + fX) * damping;
      rodTipVel.current.y = (rodTipVel.current.y + fY) * damping;
      
      let nextX = rTip.x + rodTipVel.current.x;
      let nextY = rTip.y + rodTipVel.current.y;

      // Jitter de tensionamento caso o peixe esteja fisgado
      if (rodTipTarget.current.x === 42) {
        nextX += (Math.random() - 0.5) * 1.8;
        nextY += (Math.random() - 0.5) * 1.8;
      }

      rodTipRef.current = { x: nextX, y: nextY };

      // g. Atualizar a vara de pesca no DOM diretamente
      const rodBody = document.getElementById('rod-body-path');
      if (rodBody) {
        rodBody.setAttribute('d', `M167,169 C145,${120 + (nextY - 95) * 0.45} 108,${82 + (nextY - 95) * 0.75} ${nextX} ${nextY}`);
      }
      const rodLine = document.getElementById('rod-line-path');
      if (rodLine) {
        rodLine.setAttribute('d', `M165,165 L125,${115 + (nextY - 95) * 0.2} L95,${95 + (nextY - 95) * 0.5} L${nextX} ${nextY}`);
      }
      const p1 = document.getElementById('passador-1');
      if (p1) {
        p1.setAttribute('cy', `${115 + (nextY - 95) * 0.2}`);
      }
      const p2 = document.getElementById('passador-2');
      if (p2) {
        p2.setAttribute('cy', `${95 + (nextY - 95) * 0.5}`);
      }
      const p3 = document.getElementById('passador-3');
      if (p3) {
        p3.setAttribute('cx', `${nextX}`);
        p3.setAttribute('cy', `${nextY}`);
      }

      // h. Atualizar a linha de pesca no DOM (usando refs de tamanho para evitar layout thrashing)
      const line = document.getElementById('fishing-line');
      if (line) {
        const clientWidth = lakeWidthRef.current;
        const clientHeight = lakeHeightRef.current;
        const tipXInLake = clientWidth - 241 + (nextX * 1.28);
        const tipYInLake = clientHeight - 236 + (nextY * 1.28);
        const bX = bobberPosRef.current.x;
        const bY = bobberPosRef.current.y;
        
        const isBending = rodStateRef.current === 'bending';
        const lineD = isBending
          ? `M ${tipXInLake} ${tipYInLake} Q ${clientWidth * (bX + 8) / 100} ${clientHeight * (bY + 30) / 200} ${bX * clientWidth / 100} ${bY * clientHeight / 100}`
          : `M ${tipXInLake} ${tipYInLake} Q ${clientWidth * (bX + 4) / 100} ${clientHeight * (bY + 55) / 200} ${bX * clientWidth / 100} ${bY * clientHeight / 100}`;
          
        line.setAttribute('d', lineD);
        if (isBending) {
          line.setAttribute('stroke', '#ffd166');
          line.setAttribute('stroke-width', '1.8');
          line.style.filter = 'drop-shadow(0 0 4px rgba(255,209,102,0.8))';
        } else {
          line.setAttribute('stroke', 'rgba(255,255,255,0.4)');
          line.setAttribute('stroke-width', '0.95');
          line.style.filter = 'none';
        }
      }

      // i. Atualizar a boia no DOM
      const bobberEl = document.getElementById('bobber');
      if (bobberEl) {
        const bPos = bobberPosRef.current;
        const under = bobberUnderRef.current;
        const twitch = bobberTwitchRef.current;
        
        bobberEl.style.left = `${bPos.x}%`;
        bobberEl.style.top = `${bPos.y}%`;
        
        const translationY = under ? '16px' : twitch ? '4px' : '0px';
        bobberEl.style.transform = `translate(-50%, ${translationY}) translate(-50%, -75%)`;
        bobberEl.style.opacity = under ? '0.35' : '1';
      }

      // j. Atualizar peixe fisgado no DOM
      const caughtEl = document.getElementById('caught-fish-emerging');
      if (caughtEl) {
        const bPos = bobberPosRef.current;
        caughtEl.style.left = `${bPos.x}%`;
        caughtEl.style.top = `${bPos.y}%`;
      }

      // k. Atualizar partículas de Splash em memória
      splashesRef.current = splashesRef.current
        .map((s) => ({
          ...s,
          x: s.x + s.vx,
          y: s.y + s.vy,
          vy: s.vy + 0.15, // Gravidade
          opacity: s.opacity - 0.025,
        }))
        .filter((s) => s.opacity > 0);

      // l. Atualizar bolhas de ar em memória
      const updatedBubbles = bubblesRef.current
        .map((b) => ({
          ...b,
          y: b.y - b.speed,
          x: b.x + Math.sin(b.y * 0.06) * 0.25 // Ondulação sutil
        }))
        .filter((b) => b.y > -5);

      if (Math.random() < 0.055 && updatedBubbles.length < 28) {
        updatedBubbles.push({
          id: bubbleCounter++,
          x: 3 + Math.random() * 94,
          y: 105,
          size: 2.5 + Math.random() * 4.5,
          speed: 0.35 + Math.random() * 0.55,
          opacity: 0.15 + Math.random() * 0.25
        });
      }
      bubblesRef.current = updatedBubbles;

      // m. Desenhar bolhas e splashes no Canvas de alta performance (sem consultas de layout ao DOM)
      const canvas = document.getElementById('lake-canvas') as HTMLCanvasElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Desenhar bolhas
          ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 0.8;
          const currentBubbles = bubblesRef.current;
          for (let i = 0; i < currentBubbles.length; i++) {
            const b = currentBubbles[i]!;
            const pxX = (b.x * canvas.width) / 100;
            const pxY = (b.y * canvas.height) / 100;
            ctx.beginPath();
            ctx.arc(pxX, pxY, b.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          
          // Desenhar splashes
          const currentSplashes = splashesRef.current;
          for (let i = 0; i < currentSplashes.length; i++) {
            const s = currentSplashes[i]!;
            ctx.fillStyle = `rgba(219, 234, 254, ${s.opacity})`;
            ctx.strokeStyle = `rgba(255, 255, 255, ${s.opacity * 0.35})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      }

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
    updateRodState('casting');
    setStatusMessage('Preparando arremesso caipira...');
    playSound('cast');

    // Boia na ponta da vara
    bobberPosRef.current = { x: 80, y: 90 };
    bobberUnderRef.current = false;
    bobberTwitchRef.current = false;

    // Animar arremesso balístico
    let progress = 0;
    const targetX = 22 + Math.random() * 56;
    const targetY = 32 + Math.random() * 26;

    const castInterval = setInterval(() => {
      progress += 0.038;
      if (progress >= 1) {
        clearInterval(castInterval);
        bobberPosRef.current = { x: targetX, y: targetY };
        setGameStatus('fishing');
        updateRodState('idle');
        setStatusMessage('Pescando... Aguarde o puxão da boia!');
        createSplashParticles(targetX, targetY);
        playSound('splash');
        
        // Iniciar chamada ao backend
        triggerBackendRoll(targetX, targetY);
      } else {
        // Trajetória balística parabólica com gravidade
        const currentX = 80 - (80 - targetX) * progress;
        const currentY = 90 - (90 - targetY) * progress - Math.sin(progress * Math.PI) * 38;
        bobberPosRef.current = { x: currentX, y: currentY };
      }
    }, 20);
  };

  const triggerBackendRoll = async (bX: number, bY: number) => {
    try {
      const result = await playFishingRound(betAmount);
      
      // Sequência de suspense com puxões na boia
      setTimeout(() => {
        bobberTwitchRef.current = true;
        playSound('bite');
        setTimeout(() => {
          bobberTwitchRef.current = false;
        }, 180);
      }, 1100);

      setTimeout(() => {
        bobberTwitchRef.current = true;
        playSound('bite');
        setTimeout(() => {
          bobberTwitchRef.current = false;
          // Fisgou! Boia afunda
          bobberUnderRef.current = true;
          updateRodState('bending');
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
      updateRodState('idle');
      setIsProcessing(false);
      bobberUnderRef.current = false;
      bobberTwitchRef.current = false;
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
        updateRodState('idle');
        setIsProcessing(false);
        bobberUnderRef.current = false;
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
        bobberPosRef.current = { x: currentX, y: currentY };
      }
    }, 22);
  };

  // Coordenadas calculadas da ponta da vara na escala do Lago (para renderização inicial)
  const clientWidthInit = lakeRef.current?.clientWidth || 1000;
  const clientHeightInit = lakeRef.current?.clientHeight || 450;
  const tipXInLake = clientWidthInit - 241 + (rodTipRef.current.x * 1.28);
  const tipYInLake = clientHeightInit - 236 + (rodTipRef.current.y * 1.28);

  return (
    <div className="w-full h-full flex flex-col relative">
      
      {/* Estilo local para Vitórias Régias e balanço */}
      <style jsx global>{`
        @keyframes waterLiliesSway {
          0% { transform: rotate(-3deg) translateY(0px); }
          100% { transform: rotate(3deg) translateY(2.5px); }
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

        {/* Canvas de alta performance para partículas de bolhas e splash */}
        <canvas 
          id="lake-canvas"
          className="absolute inset-0 w-full h-full pointer-events-none z-5"
        />

        {/* 1. Renderizar os Peixes que Nadam (Isolados do ciclo do React para 60 FPS travados) */}
        <FishListContainer fishes={initialFishes} />

        {/* 2. Efeitos e Linha de Pesca SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* Ondulação (Ripple) da boia flutuando */}
          {gameStatus === 'fishing' && (
            <g id="bobber-ripple" transform={`translate(${bobberPosRef.current.x * clientWidthInit / 100}, ${bobberPosRef.current.y * clientHeightInit / 100})`}>
              <circle r="14" fill="none" stroke="rgba(255,209,102,0.35)" strokeWidth="1" className="animate-ping" style={{ animationDuration: '2.5s' }} />
              <circle r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" className="animate-ping" style={{ animationDuration: '4s', animationDelay: '0.8s' }} />
            </g>
          )}

          {/* Linha de Pesca conectada Dinamicamente ao RodTip */}
          {(gameStatus === 'preparing' || gameStatus === 'fishing' || gameStatus === 'caught') && (
            <path
              id="fishing-line"
              d={
                rodState === 'bending'
                  ? `M ${tipXInLake} ${tipYInLake} 
                     Q ${clientWidthInit * (bobberPosRef.current.x + 8) / 100} ${clientHeightInit * (bobberPosRef.current.y + 30) / 200} 
                     ${bobberPosRef.current.x * clientWidthInit / 100} ${bobberPosRef.current.y * clientHeightInit / 100}`
                  : `M ${tipXInLake} ${tipYInLake} 
                     Q ${clientWidthInit * (bobberPosRef.current.x + 4) / 100} ${clientHeightInit * (bobberPosRef.current.y + 55) / 200} 
                     ${bobberPosRef.current.x * clientWidthInit / 100} ${bobberPosRef.current.y * clientHeightInit / 100}`
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
            id="bobber"
            className="absolute z-10 w-6 h-10 pointer-events-none flex flex-col items-center justify-start"
            style={{
              left: `${bobberPosRef.current.x}%`,
              top: `${bobberPosRef.current.y}%`,
              transform: `translate(-50%, ${bobberUnderRef.current ? '16px' : bobberTwitchRef.current ? '4px' : '0px'}) translate(-50%, -75%)`,
              transition: gameStatus === 'preparing' ? 'none' : 'transform 0.1s ease-out, top 0.08s ease-out, left 0.08s ease-out',
              opacity: bobberUnderRef.current ? 0.35 : 1
            }}
          >
            {/* Boia caipira premium */}
            <div className="w-4 h-6 rounded-full border border-black/40 shadow-xl flex flex-col overflow-hidden animate-bounce" style={{ animationDuration: '1.4s' }}>
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
            id="caught-fish-emerging"
            className="absolute z-10 pointer-events-none animate-bounce"
            style={{
              left: `${bobberPosRef.current.x}%`,
              top: `${bobberPosRef.current.y}%`,
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
            <path d="M167,183 L178,167" stroke="#ffd166" strokeWidth="3" strokeLinecap="round" />
            
            {/* Carretilha/Molinete Premium */}
            <g transform="translate(155, 155)">
              <circle cx="10" cy="10" r="9" fill="#2d3748" stroke="#1a202c" strokeWidth="2" />
              <rect x="7" y="3" width="6" height="14" rx="2" fill="#ffd166" />
              <circle cx="10" cy="10" r="3.5" fill="#e2e8f0" />
              <g className={gameStatus === 'caught' ? 'origin-center animate-spin' : ''} style={{ transformOrigin: '10px 10px', animationDuration: '1s' }}>
                <path d="M10,10 L3,2" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                <circle cx="3" cy="2" r="3" fill="#e63946" />
              </g>
            </g>

            {/* Corpo Flexível Dinâmico da Vara (Bending Path) */}
            <path 
              id="rod-body-path"
              d={`M167,169 C145,${120 + (rodTipRef.current.y - 95) * 0.45} 108,${82 + (rodTipRef.current.y - 95) * 0.75} ${rodTipRef.current.x} ${rodTipRef.current.y}`} 
              fill="none" 
              stroke="#6a401c" 
              strokeWidth="3.2" 
              strokeLinecap="round" 
            />

            {/* Linha saindo do molinete */}
            <path 
              id="rod-line-path"
              d={`M165,165 L125,${115 + (rodTipRef.current.y - 95) * 0.2} L95,${95 + (rodTipRef.current.y - 95) * 0.5} L${rodTipRef.current.x} ${rodTipRef.current.y}`} 
              fill="none" 
              stroke="rgba(255,255,255,0.3)" 
              strokeWidth="0.8" 
            />

            {/* Passadores */}
            <g>
              <circle id="passador-1" cx={125} cy={115 + (rodTipRef.current.y - 95) * 0.2} r="2.5" fill="none" stroke="#ffd166" strokeWidth="1" />
              <circle id="passador-2" cx={95} cy={95 + (rodTipRef.current.y - 95) * 0.5} r="2" fill="none" stroke="#ffd166" strokeWidth="1" />
              <circle id="passador-3" cx={rodTipRef.current.x} cy={rodTipRef.current.y} r="1.5" fill="none" stroke="#ffd166" strokeWidth="1" />
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
