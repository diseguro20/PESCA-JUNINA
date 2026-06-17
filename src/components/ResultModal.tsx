import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, ArrowRight, RefreshCw, History, Star, X } from 'lucide-react';
import Link from 'next/link';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  winAmount: number;
  multiplier: number;
  fishType: string;
  fishColor: string;
  betAmount: number;
  onPlayAgain: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  winAmount,
  multiplier,
  fishType,
  fishColor,
  betAmount,
  onPlayAgain
}) => {
  useEffect(() => {
    if (isOpen && multiplier > 0) {
      // Disparar confetes premium
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 25, spread: 360, ticks: 50, zIndex: 100 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 40 * (timeLeft / duration);
        // Confete vindo da esquerda e da direita
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen, multiplier]);

  if (!isOpen) return null;

  const isWin = multiplier > 0;
  
  // Customizar card com base no multiplicador
  let cardBorder = "border-gray-500/30";
  let bgGradient = "from-gray-900/90 to-junina-blue-deep/95";
  let multiplierBadge = "bg-gray-600 text-white";
  let fishShadow = "shadow-gray-500/10";
  let titleColor = "text-gray-300";

  if (multiplier >= 10) {
    cardBorder = "border-pink-500 animate-pulse";
    bgGradient = "from-purple-950/80 via-pink-950/70 to-junina-blue-deep/95";
    multiplierBadge = "bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 text-white font-black animate-bounce";
    fishShadow = "shadow-pink-500/50";
    titleColor = "text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-yellow-300 to-cyan-300";
  } else if (multiplier >= 5) {
    cardBorder = "border-junina-gold";
    bgGradient = "from-yellow-950/80 to-junina-blue-deep/95";
    multiplierBadge = "bg-junina-gold text-junina-wood-dark font-extrabold";
    fishShadow = "shadow-junina-gold/40";
    titleColor = "text-junina-gold";
  } else if (multiplier >= 3) {
    cardBorder = "border-purple-500";
    bgGradient = "from-purple-950/50 to-junina-blue-deep/95";
    multiplierBadge = "bg-purple-600 text-white";
    fishShadow = "shadow-purple-500/30";
    titleColor = "text-purple-300";
  } else if (multiplier >= 2) {
    cardBorder = "border-junina-green";
    bgGradient = "from-green-950/50 to-junina-blue-deep/95";
    multiplierBadge = "bg-junina-green text-junina-blue-deep font-extrabold";
    fishShadow = "shadow-junina-green/30";
    titleColor = "text-junina-green";
  } else if (multiplier > 0) {
    cardBorder = "border-blue-500/40";
    bgGradient = "from-blue-950/40 to-junina-blue-deep/95";
    multiplierBadge = "bg-blue-600 text-white";
    fishShadow = "shadow-blue-500/20";
    titleColor = "text-blue-300";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-junina-blue-deep/80 backdrop-blur-md animate-fade-in">
      
      {/* CARD PRINCIPAL */}
      <div className={`relative w-full max-w-md rounded-3xl border ${cardBorder} bg-gradient-to-b ${bgGradient} p-6 shadow-2xl ${fishShadow} transition-all overflow-hidden flex flex-col items-center text-center`}>
        
        {/* Glow de Fundo */}
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[50%] bg-radial-gradient from-white/10 to-transparent pointer-events-none" />

        {/* Botão Fechar */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/15 rounded-full transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ÍCONE DE ESTRELA PARA LENDÁRIOS */}
        {multiplier >= 5 && (
          <div className="absolute top-4 left-4 flex gap-1 text-junina-gold animate-pulse">
            <Star className="w-5 h-5 fill-junina-gold" />
            {multiplier >= 10 && <Star className="w-5 h-5 fill-junina-gold" />}
          </div>
        )}

        {/* ILUSTRAÇÃO/ÍCONE DE PEIXE */}
        <div className="relative w-32 h-32 my-4 flex items-center justify-center">
          <div className={`absolute inset-0 bg-radial-gradient from-white/5 to-transparent rounded-full filter blur-xl`} />
          
          {isWin ? (
            <div className="animate-fish-float flex flex-col items-center">
              {/* Representação Vetorial do Peixe */}
              <svg className="w-24 h-24 filter drop-shadow-lg" viewBox="0 0 100 100">
                {/* Peixe Principal */}
                <path 
                  d="M10,50 Q40,25 70,50 Q85,40 95,30 Q92,50 95,70 Q85,60 70,50 Q40,75 10,50 Z" 
                  fill={
                    fishColor === 'gold' ? '#ffd166' : 
                    fishColor === 'red' ? '#e63946' : 
                    fishColor === 'green' ? '#06d6a0' : 
                    fishColor === 'purple' ? '#a855f7' : 
                    fishColor === 'rainbow' ? 'url(#rainbow-grad)' : '#3b82f6'
                  }
                  stroke={fishColor === 'rainbow' ? '#fff' : 'rgba(255,255,255,0.2)'}
                  strokeWidth="1.5"
                />
                
                {/* Rabo do Peixe */}
                <path 
                  d="M70,50 L85,38 L80,50 L85,62 Z" 
                  fill={fishColor === 'rainbow' ? '#f472b6' : 'rgba(0,0,0,0.15)'}
                />
                
                {/* Olho do Peixe */}
                <circle cx="25" cy="45" r="4" fill="white" />
                <circle cx="26" cy="45" r="2" fill="black" />
                
                {/* Chapéu de Palha (Apenas se for Lendário >= 10x) */}
                {multiplier >= 10 && (
                  <g transform="translate(14, 15) rotate(-20) scale(0.45)">
                    {/* Copa do Chapéu */}
                    <path d="M20,50 Q50,0 80,50 Z" fill="#d9b38c" stroke="#8a5a36" strokeWidth="3" />
                    {/* Aba do Chapéu */}
                    <ellipse cx="50" cy="53" rx="48" ry="12" fill="#d9b38c" stroke="#8a5a36" strokeWidth="3" />
                    {/* Fita Vermelha */}
                    <path d="M22,48 Q50,30 78,48 L76,51 Q50,35 24,51 Z" fill="#e63946" />
                  </g>
                )}

                {/* Definições de Gradiente para o Peixe Lendário */}
                <defs>
                  <linearGradient id="rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="30%" stopColor="#f43f5e" />
                    <stop offset="60%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Bolhas */}
              <div className="absolute top-2 right-4 w-2 h-2 bg-white/40 rounded-full animate-ping" />
              <div className="absolute top-8 left-2 w-1.5 h-1.5 bg-white/30 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
            </div>
          ) : (
            <svg className="w-24 h-24 text-gray-600 opacity-60" viewBox="0 0 100 100">
              {/* Sapato velho ou latinha amassada (típico resultado 0x) */}
              <path 
                d="M15,80 Q20,30 35,40 L50,35 Q60,40 65,30 Q75,45 85,55 L85,80 L15,80 Z" 
                fill="#4a4a4a" 
                stroke="#2b2b2b" 
                strokeWidth="2" 
              />
              <path d="M15,80 L85,80" stroke="#ffd166" strokeWidth="3" />
              <line x1="30" y1="40" x2="45" y2="70" stroke="#333" strokeWidth="2" />
              <line x1="60" y1="45" x2="70" y2="75" stroke="#333" strokeWidth="2" />
            </svg>
          )}
        </div>

        {/* TÍTULO PRINCIPAL */}
        <h2 className={`text-2xl font-black tracking-wide ${titleColor}`}>
          {isWin ? 'BELO FISGADO!' : 'MAIS SORTE DA PRÓXIMA!'}
        </h2>

        {/* DESCRIÇÃO DO PEIXE */}
        <p className="text-gray-300 text-sm font-semibold mt-1">
          {isWin 
            ? `Você capturou um ${fishType}!` 
            : 'A boia afundou, mas o peixe conseguiu escapar!'
          }
        </p>

        {/* CRACHÁ DO MULTIPLICADOR */}
        <div className={`mt-4 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest ${multiplierBadge}`}>
          Multiplicador: {multiplier.toFixed(1)}x
        </div>

        {/* DETALHES FINANCEIROS */}
        <div className="w-full bg-junina-blue-deep/60 rounded-2xl border border-white/5 p-4 mt-5 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>Valor da Aposta</span>
            <span className="font-bold text-gray-200">R$ {betAmount.toFixed(2)}</span>
          </div>
          <div className="w-full h-px bg-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300 font-bold">Total Recebido</span>
            <span className={`text-base font-black ${isWin ? 'text-junina-green' : 'text-gray-400'}`}>
              R$ {winAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="w-full flex flex-col gap-2.5 mt-6">
          <button
            onClick={onPlayAgain}
            className="w-full py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-2xl shadow-lg hover:shadow-junina-gold/20 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" /> PESCAR NOVAMENTE
          </button>
          
          <div className="grid grid-cols-2 gap-2 w-full">
            <Link 
              href="/history" 
              className="py-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-1.5"
              onClick={onClose}
            >
              <History className="w-3.5 h-3.5" /> VER HISTÓRICO
            </Link>
            <button
              onClick={onClose}
              className="py-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-1.5"
            >
              VOLTAR AO LAGO <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
