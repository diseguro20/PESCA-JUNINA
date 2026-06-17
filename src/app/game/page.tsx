"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { HeaderHUD } from '../../components/HeaderHUD';
import { LakeArea } from '../../components/LakeArea';
import { ResultModal } from '../../components/ResultModal';
import { 
  Coins, 
  Flame, 
  History as HistoryIcon, 
  Trophy, 
  HelpCircle, 
  Plus, 
  Minus,
  Sparkles,
  AlertTriangle,
  Anchor
} from 'lucide-react';

export default function GamePage() {
  const { user, loading: authLoading } = useAuth();
  const { wallet, minBet, maxBet, history, rankings, refreshAllData } = useGame();
  const router = useRouter();

  // Estados do Jogo
  const [betAmount, setBetAmount] = useState(5.00);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de Resultado
  const [modalOpen, setModalOpen] = useState(false);
  const [roundResult, setRoundResult] = useState<{
    winAmount: number;
    multiplier: number;
    fishType: string;
    fishColor: string;
    betAmount: number;
  } | null>(null);

  // Redirecionamento se deslogado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Forçar recarga ao entrar
  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen w-full bg-junina-blue-deep flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Anchor className="w-12 h-12 text-junina-gold animate-spin-slow stroke-[2.5]" />
          <span className="text-junina-gold font-bold tracking-widest text-sm uppercase">Carregando Lago...</span>
        </div>
      </div>
    );
  }

  // Verificar se o usuário está bloqueado
  if (user.status !== 'active') {
    return (
      <div className="min-h-screen w-full bg-junina-blue-deep flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-gradient-to-b from-junina-red/20 to-junina-blue-deep rounded-3xl border border-junina-red p-8 text-center flex flex-col items-center shadow-2xl">
          <AlertTriangle className="w-16 h-16 text-junina-red mb-4 animate-pulse" />
          <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">CONTA BLOQUEADA</h2>
          <p className="text-sm text-gray-300 mb-6 leading-relaxed">
            Seu perfil de pescador foi suspenso temporariamente para auditoria. Entre em contato com a equipe administrativa no suporte da quermesse.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
          >
            VOLTAR PARA A PÁGINA INICIAL
          </button>
        </div>
      </div>
    );
  }

  // Controles de aposta rápida
  const adjustBet = (amount: number) => {
    if (isProcessing) return;
    setBetAmount((prev) => {
      const next = Number((prev + amount).toFixed(2));
      if (next < minBet) return minBet;
      if (next > maxBet) return maxBet;
      return next;
    });
  };

  const multiplyBet = (factor: number) => {
    if (isProcessing) return;
    setBetAmount((prev) => {
      const next = Number((prev * factor).toFixed(2));
      if (next < minBet) return minBet;
      if (next > maxBet) return maxBet;
      return next;
    });
  };

  // Quando a pescaria for concluída no lago
  const handleRoundComplete = (result: { winAmount: number; multiplier: number; fishType: string; fishColor: string }) => {
    setRoundResult({
      ...result,
      betAmount
    });
    setModalOpen(true);
    refreshAllData(); // Atualiza saldo e históricos
  };

  return (
    <JuninaBackground>
      <HeaderHUD />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:px-8 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start relative z-20">
        
        {/* COLUNA 1: PAINEL DE CONTROLES DE APOSTA (ESQUERDA) */}
        <div className="lg:col-span-1 flex flex-col gap-5 w-full">
          
          {/* Card Apostas */}
          <div className="glass-premium p-5 rounded-3xl flex flex-col">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-junina-gold" /> Painel da Pescaria
            </span>

            {/* Input Manual */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-300">Valor da Aposta (R$)</label>
              <div className="flex items-center bg-junina-blue-deep/60 rounded-2xl border border-white/10 px-3 py-1">
                <button
                  onClick={() => adjustBet(-1.00)}
                  disabled={isProcessing}
                  className="p-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => {
                    if (isProcessing) return;
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setBetAmount(val);
                  }}
                  className="w-full text-center bg-transparent border-none text-base font-black text-junina-gold focus:outline-none focus:ring-0"
                  step="1.0"
                  min={minBet}
                  max={maxBet}
                />
                <button
                  onClick={() => adjustBet(1.00)}
                  disabled={isProcessing}
                  className="p-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Botões Rápidos */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                onClick={() => adjustBet(1.00)}
                disabled={isProcessing}
                className="py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl transition-all border border-white/5"
              >
                + R$1
              </button>
              <button
                onClick={() => adjustBet(5.00)}
                disabled={isProcessing}
                className="py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl transition-all border border-white/5"
              >
                + R$5
              </button>
              <button
                onClick={() => adjustBet(10.00)}
                disabled={isProcessing}
                className="py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl transition-all border border-white/5"
              >
                + R$10
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                onClick={() => multiplyBet(0.5)}
                disabled={isProcessing}
                className="py-2 bg-white/5 hover:bg-white/10 text-[10px] font-extrabold rounded-xl transition-all border border-white/5"
              >
                METADE (½)
              </button>
              <button
                onClick={() => multiplyBet(2)}
                disabled={isProcessing}
                className="py-2 bg-white/5 hover:bg-white/10 text-[10px] font-extrabold rounded-xl transition-all border border-white/5"
              >
                DOBRAR (2x)
              </button>
              <button
                onClick={() => setBetAmount(maxBet)}
                disabled={isProcessing}
                className="py-2 bg-white/5 hover:bg-white/10 text-[10px] font-extrabold rounded-xl transition-all border border-white/5"
              >
                MÁXIMO
              </button>
            </div>

            {/* Informações da banca */}
            <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-1.5 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Saldo Disponível</span>
                <span className="font-bold text-gray-200">R$ {wallet?.balance.toFixed(2) ?? '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span>Ganho Limite (10x)</span>
                <span className="font-bold text-junina-gold">R$ {(betAmount * 10).toFixed(2)}</span>
              </div>
            </div>

          </div>

          {/* Legenda de Multiplicadores */}
          <div className="glass-premium p-5 rounded-3xl flex flex-col">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-junina-orange animate-pulse" /> Tabela de Peixes
            </span>
            <div className="flex flex-col gap-2">
              {[
                { label: '0x - Nenhum Peixe', color: 'bg-gray-600', txt: 'Nada fisgou' },
                { label: '0.5x - Peixe Comum', color: 'bg-blue-400', txt: 'Lambari pequenino' },
                { label: '1.0x - Peixe Azul', color: 'bg-blue-600', txt: 'Peixe comum' },
                { label: '1.5x - Peixe Vermelho', color: 'bg-red-500', txt: 'Traíra' },
                { label: '2.0x - Peixe Verde', color: 'bg-green-400', txt: 'Pacu sapeca' },
                { label: '3.0x - Peixe Roxo', color: 'bg-purple-500', txt: 'Tucunaré raro' },
                { label: '5.0x - Peixe Dourado', color: 'bg-yellow-500', txt: 'Dourado nobre' },
                { label: '10.0x - Lendário Junino', color: 'bg-gradient-to-r from-pink-500 via-orange-400 to-yellow-300', txt: 'Chapéu de palha!' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-gray-300 font-bold">{item.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">{item.txt}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* COLUNA 2 e 3: ÁREA CENTRAL DO LAGO DE PESCA */}
        <div className="lg:col-span-2 flex flex-col gap-4 w-full h-full justify-between">
          <LakeArea
            onRoundComplete={handleRoundComplete}
            betAmount={betAmount}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />
        </div>

        {/* COLUNA 4: HISTÓRICO & RANKING DO JOGADOR (DIREITA) */}
        <div className="lg:col-span-1 flex flex-col gap-5 w-full">
          
          {/* Suas Últimas Capturas */}
          <div className="glass-premium p-5 rounded-3xl flex flex-col max-h-72">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <HistoryIcon className="w-3.5 h-3.5 text-junina-gold" /> Suas Capturas
            </span>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 no-scrollbar">
              {history.length === 0 ? (
                <span className="text-xs text-gray-500 italic py-4 text-center">Nenhuma pescaria realizada ainda.</span>
              ) : (
                history.slice(0, 5).map((round, idx) => {
                  const isWin = round.multiplier > 0;
                  return (
                    <div key={idx} className="bg-junina-blue-deep/50 border border-white/5 px-3 py-2 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-white truncate max-w-[100px]">{round.fishType}</span>
                        <span className="text-[9px] text-gray-500">{new Date(round.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`font-black ${isWin ? 'text-junina-green' : 'text-gray-500'}`}>
                          {isWin ? `+R$ ${round.winAmount.toFixed(2)}` : '0x'}
                        </span>
                        <span className="text-[9px] text-gray-400">Aposta: R$ {round.betAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top Pescadores do Ranking */}
          <div className="glass-premium p-5 rounded-3xl flex flex-col max-h-72">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-junina-orange animate-bounce" /> Top Pescadores
            </span>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 no-scrollbar">
              {rankings.length === 0 ? (
                <span className="text-xs text-gray-500 italic py-4 text-center">Carregando leaderboard...</span>
              ) : (
                rankings.slice(0, 5).map((player, idx) => (
                  <div key={idx} className="bg-junina-blue-deep/50 border border-white/5 px-3 py-2 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`font-black text-xs ${
                        idx === 0 ? 'text-yellow-400' :
                        idx === 1 ? 'text-gray-300' :
                        idx === 2 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        #{idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-white truncate max-w-[90px]">{player.name}</span>
                        <span className="text-[9px] text-gray-500">Jogadas: {player.totalRounds || 1}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-extrabold text-junina-gold">R$ {(player.biggestWin || 0).toFixed(2)}</span>
                      <span className="text-[8px] text-gray-400">Máx: {player.maxMultiplier || 0}x</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* MODAL DE RESULTADO CELEBRATIVO */}
      {roundResult && (
        <ResultModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          winAmount={roundResult.winAmount}
          multiplier={roundResult.multiplier}
          fishType={roundResult.fishType}
          fishColor={roundResult.fishColor}
          betAmount={roundResult.betAmount}
          onPlayAgain={() => {
            setModalOpen(false);
            // Pequeno delay para reengajar a linha
            setTimeout(() => {
              const mainBtn = document.querySelector('button[disabled]') === null;
              if (mainBtn) {
                const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
                const pescarBtn = Object.values(document.querySelectorAll('button')).find(btn => btn.innerText.includes('LANÇAR') || btn.innerText.includes('PESCAR'));
                if (pescarBtn) pescarBtn.dispatchEvent(clickEvent);
              }
            }, 100);
          }}
        />
      )}
    </JuninaBackground>
  );
}
