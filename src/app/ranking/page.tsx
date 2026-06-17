"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { HeaderHUD } from '../../components/HeaderHUD';
import { Trophy, Star, Medal, Crown, Anchor, Flame, Users } from 'lucide-react';

export default function RankingPage() {
  const { user, loading: authLoading } = useAuth();
  const { rankings, refreshAllData } = useGame();
  const router = useRouter();

  // Redirecionamento se deslogado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Recarregar dados
  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user]);

  if (authLoading || !user) return null;

  // Obter Top 3 para o Pódio e o restante para a lista
  const top1 = rankings[0];
  const top2 = rankings[1];
  const top3 = rankings[2];
  const listPlayers = rankings.slice(3);

  // Estatísticas globais do ranking
  const totalCatches = rankings.reduce((acc, curr) => acc + (curr.totalWins || 0), 0);
  const maxMultiplierGlobal = rankings.reduce((max, curr) => (curr.maxMultiplier || 0) > max ? curr.maxMultiplier : max, 0);

  return (
    <JuninaBackground>
      <HeaderHUD />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:px-8 flex flex-col gap-8 relative z-20">
        
        {/* TÍTULO */}
        <div className="text-center flex flex-col items-center">
          <div className="mb-2 p-2 bg-junina-gold/10 border border-junina-gold/30 rounded-2xl text-junina-gold animate-bounce">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-junina-gold via-junina-orange to-junina-red uppercase tracking-wider">
            LIDERANÇA DA QUERMESSE
          </h2>
          <p className="text-xs text-gray-400 mt-1">Os pescadores mais habilidosos e sortudos do nosso lago caipira</p>
        </div>

        {/* ESTATÍSTICAS GLOBAIS */}
        <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto w-full text-center">
          <div className="bg-junina-blue-deep/60 border border-white/5 p-3 rounded-2xl flex flex-col justify-center">
            <span className="text-[8px] text-gray-500 font-extrabold uppercase tracking-wider">Total Pescadores</span>
            <span className="text-sm font-black text-white mt-0.5 flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-400" /> {rankings.length}
            </span>
          </div>
          <div className="bg-junina-blue-deep/60 border border-white/5 p-3 rounded-2xl flex flex-col justify-center">
            <span className="text-[8px] text-gray-500 font-extrabold uppercase tracking-wider">Peixes Capturados</span>
            <span className="text-sm font-black text-white mt-0.5 flex items-center justify-center gap-1">
              <Anchor className="w-3.5 h-3.5 text-junina-green" /> {totalCatches}
            </span>
          </div>
          <div className="bg-junina-blue-deep/60 border border-white/5 p-3 rounded-2xl flex flex-col justify-center">
            <span className="text-[8px] text-gray-500 font-extrabold uppercase tracking-wider">Maior Multiplicador</span>
            <span className="text-sm font-black text-white mt-0.5 flex items-center justify-center gap-1">
              <Flame className="w-3.5 h-3.5 text-junina-orange animate-pulse" /> {maxMultiplierGlobal}x
            </span>
          </div>
        </div>

        {/* 1. O PÓDIO DOS CAMPEÕES (TOP 3) */}
        {rankings.length > 0 && (
          <div className="flex flex-col md:flex-row justify-center items-end gap-6 max-w-3xl mx-auto w-full mt-4">
            
            {/* SEGUNDO LUGAR (ESQUERDA) */}
            {top2 && (
              <div className="w-full md:w-56 glass-premium p-6 rounded-3xl border-gray-400/30 flex flex-col items-center text-center order-2 md:order-1 transform hover:scale-[1.02] transition-transform">
                <div className="relative mb-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-gray-500 to-gray-300 flex items-center justify-center border-2 border-gray-400">
                    <span className="text-lg font-black text-gray-900">2</span>
                  </div>
                  <Medal className="w-6 h-6 text-gray-300 absolute bottom-[-4px] right-[-4px] filter drop-shadow" />
                </div>
                <span className="font-extrabold text-white text-base truncate max-w-[150px]">{top2.name}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">2º Lugar</span>
                <div className="mt-3 bg-gray-500/10 px-3 py-1 rounded-full border border-gray-500/20 text-xs font-black text-gray-300">
                  R$ {(top2.biggestWin || 0).toFixed(2)}
                </div>
              </div>
            )}

            {/* PRIMEIRO LUGAR (CENTRO - MAIS ALTO) */}
            {top1 && (
              <div className="w-full md:w-64 bg-gradient-to-b from-yellow-950/45 to-junina-blue-deep border border-junina-gold p-8 rounded-3xl flex flex-col items-center text-center order-1 md:order-2 transform hover:scale-[1.03] transition-transform relative shadow-xl shadow-junina-gold/5">
                {/* Coroa de Ouro */}
                <div className="absolute top-[-20px] text-junina-gold animate-bounce">
                  <Crown className="w-8 h-8 fill-junina-gold" />
                </div>
                
                <div className="relative mb-4">
                  <div className="w-18 h-18 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-300 flex items-center justify-center border-4 border-junina-gold shadow-lg shadow-junina-gold/20">
                    <span className="text-xl font-black text-junina-wood-dark">1</span>
                  </div>
                  <Star className="w-7 h-7 text-junina-gold fill-junina-gold absolute bottom-[-6px] right-[-6px] filter drop-shadow animate-pulse" />
                </div>
                <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-junina-gold to-white text-lg truncate max-w-[180px]">{top1.name}</span>
                <span className="text-xs text-junina-gold font-black uppercase tracking-widest mt-0.5">Rei da Quermesse</span>
                <div className="mt-4 bg-junina-gold/15 px-4 py-1.5 rounded-full border border-junina-gold/30 text-sm font-black text-junina-gold">
                  R$ {(top1.biggestWin || 0).toFixed(2)}
                </div>
              </div>
            )}

            {/* TERCEIRO LUGAR (DIREITA) */}
            {top3 && (
              <div className="w-full md:w-52 glass-premium p-6 rounded-3xl border-amber-600/30 flex flex-col items-center text-center order-3 md:order-3 transform hover:scale-[1.02] transition-transform">
                <div className="relative mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 flex items-center justify-center border-2 border-amber-600">
                    <span className="text-base font-black text-amber-950">3</span>
                  </div>
                  <Medal className="w-5 h-5 text-amber-600 absolute bottom-[-4px] right-[-4px] filter drop-shadow" />
                </div>
                <span className="font-extrabold text-white text-sm truncate max-w-[130px]">{top3.name}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">3º Lugar</span>
                <div className="mt-3 bg-amber-600/10 px-3 py-1 rounded-full border border-amber-600/20 text-xs font-black text-amber-400">
                  R$ {(top3.biggestWin || 0).toFixed(2)}
                </div>
              </div>
            )}

          </div>
        )}

        {/* 2. TABELA COM O RESTANTE DOS JOGADORES */}
        <div className="glass-premium rounded-3xl overflow-hidden border border-white/5 shadow-xl mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-junina-blue-deep/60 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-white/5">
                  <th className="py-4 px-6">Posição</th>
                  <th className="py-4 px-6">Nome do Jogador</th>
                  <th className="py-4 px-6">Total de Rodadas</th>
                  <th className="py-4 px-6 text-center">Catches (Vitórias)</th>
                  <th className="py-4 px-6 text-center">Maior Multiplicador</th>
                  <th className="py-4 px-6 text-right">Maior Captura (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {listPlayers.length === 0 && rankings.length <= 3 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 italic">Nenhum outro pescador listado.</td>
                  </tr>
                ) : (
                  listPlayers.map((row, idx) => (
                    <tr key={row.uid} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-400">#{idx + 4}</td>
                      <td className="py-4 px-6 font-extrabold text-white">{row.name}</td>
                      <td className="py-4 px-6 text-gray-400">{row.totalRounds || 1}</td>
                      <td className="py-4 px-6 text-center text-junina-green font-bold">{row.totalWins || 0}</td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                          {row.maxMultiplier || 0}x
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-black text-junina-gold">
                        R$ {(row.biggestWin || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </JuninaBackground>
  );
}
