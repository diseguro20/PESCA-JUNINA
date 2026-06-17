"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { HeaderHUD } from '../../components/HeaderHUD';
import { 
  History as HistoryIcon, 
  Anchor, 
  Coins, 
  Clock, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  HelpCircle
} from 'lucide-react';

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { history, deposits, withdrawals, refreshAllData } = useGame();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'games' | 'financial'>('games');

  // Redirecionamento se deslogado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Recarregar ao carregar tela
  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user]);

  if (authLoading || !user) return null;

  // Financeiro unificado
  const financialHistory = [
    ...deposits.map(d => ({ ...d, type: 'deposit' as const })),
    ...withdrawals.map(w => ({ ...w, type: 'withdraw' as const }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Estatísticas Rápidas
  const totalRounds = history.length;
  const wins = history.filter(r => r.multiplier > 0);
  const totalWins = wins.length;
  const totalEarned = wins.reduce((acc, curr) => acc + curr.winAmount, 0);
  const winRate = totalRounds > 0 ? (totalWins / totalRounds) * 100 : 0;

  return (
    <JuninaBackground>
      <HeaderHUD />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:px-8 flex flex-col gap-6 relative z-20">
        
        {/* TÍTULO E SUBTÍTULO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider flex items-center gap-2">
              <HistoryIcon className="w-8 h-8 text-junina-gold" /> SEU HISTÓRICO
            </h2>
            <p className="text-xs text-gray-400">Acompanhe suas estatísticas de pescaria e movimentações financeiras na quermesse</p>
          </div>

          {/* Seletor de Abas */}
          <div className="flex bg-junina-blue-deep/60 rounded-2xl border border-white/10 p-1 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('games')}
              className={`flex-1 md:flex-initial px-6 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'games' 
                  ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Anchor className="w-4 h-4" /> PESCARIAS
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`flex-1 md:flex-initial px-6 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'financial' 
                  ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Coins className="w-4 h-4" /> MOVIMENTAÇÕES
            </button>
          </div>
        </div>

        {/* 1. ABA DE JOGOS / PESCARIA */}
        {activeTab === 'games' && (
          <div className="flex flex-col gap-6 w-full">
            
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="glass-premium p-4 rounded-2xl flex flex-col">
                <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider mb-1">Total de Rodadas</span>
                <span className="text-xl font-black text-white">{totalRounds}</span>
              </div>
              <div className="glass-premium p-4 rounded-2xl flex flex-col">
                <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider mb-1">Peixes Capturados</span>
                <span className="text-xl font-black text-junina-gold">{totalWins}</span>
              </div>
              <div className="glass-premium p-4 rounded-2xl flex flex-col">
                <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider mb-1">Taxa de Captura</span>
                <span className="text-xl font-black text-blue-400">{winRate.toFixed(1)}%</span>
              </div>
              <div className="glass-premium p-4 rounded-2xl flex flex-col">
                <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider mb-1">Total Recebido</span>
                <span className="text-xl font-black text-junina-green">R$ {totalEarned.toFixed(2)}</span>
              </div>

            </div>

            {/* Tabela de Rodadas */}
            <div className="glass-premium rounded-3xl overflow-hidden border border-white/5 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-junina-blue-deep/60 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-white/5">
                      <th className="py-4 px-6">ID da Rodada</th>
                      <th className="py-4 px-6">Peixe Pescado</th>
                      <th className="py-4 px-6">Valor da Aposta</th>
                      <th className="py-4 px-6">Multiplicador</th>
                      <th className="py-4 px-6">Ganho Recebido</th>
                      <th className="py-4 px-6">Data & Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500 italic">Você ainda não pescou nenhuma rodada. Vá ao lago!</td>
                      </tr>
                    ) : (
                      history.map((row) => {
                        const isWin = row.multiplier > 0;
                        return (
                          <tr key={row.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-6 font-mono text-[11px] text-gray-400">#{row.id.substring(0, 8)}</td>
                            <td className="py-4 px-6 font-extrabold text-white flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                row.multiplier === 0 ? 'bg-gray-600' :
                                row.multiplier >= 10 ? 'bg-gradient-to-r from-pink-500 to-yellow-300' :
                                row.multiplier >= 5 ? 'bg-junina-gold' : 'bg-blue-500'
                              }`} />
                              {row.fishType}
                            </td>
                            <td className="py-4 px-6 text-gray-300 font-semibold">R$ {row.betAmount.toFixed(2)}</td>
                            <td className="py-4 px-6">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                isWin ? 'bg-junina-gold/10 text-junina-gold border border-junina-gold/25' : 'bg-gray-800 text-gray-500'
                              }`}>
                                {row.multiplier.toFixed(1)}x
                              </span>
                            </td>
                            <td className={`py-4 px-6 font-black ${isWin ? 'text-junina-green' : 'text-gray-500'}`}>
                              R$ {row.winAmount.toFixed(2)}
                            </td>
                            <td className="py-4 px-6 text-gray-400">
                              {new Date(row.createdAt).toLocaleDateString('pt-BR')} {new Date(row.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* 2. ABA FINANCEIRA */}
        {activeTab === 'financial' && (
          <div className="flex flex-col gap-6 w-full animate-fade-in">
            
            {/* Tabela de Transações */}
            <div className="glass-premium rounded-3xl overflow-hidden border border-white/5 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-junina-blue-deep/60 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-white/5">
                      <th className="py-4 px-6">ID da Transação</th>
                      <th className="py-4 px-6">Tipo</th>
                      <th className="py-4 px-6">Método</th>
                      <th className="py-4 px-6">Valor</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Data & Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {financialHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500 italic">Nenhuma transação financeira registrada.</td>
                      </tr>
                    ) : (
                      financialHistory.map((row) => {
                        const isDeposit = row.type === 'deposit';
                        const isPending = row.status === 'pending';
                        const isApproved = row.status === 'approved';

                        return (
                          <tr key={row.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-6 font-mono text-[11px] text-gray-400">#{row.id.substring(0, 8)}</td>
                            <td className="py-4 px-6 font-extrabold text-white">
                              <span className="flex items-center gap-1.5">
                                {isDeposit ? (
                                  <>
                                    <ArrowUpCircle className="w-4 h-4 text-green-400 shrink-0" />
                                    <span>Depósito</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowDownCircle className="w-4 h-4 text-blue-400 shrink-0" />
                                    <span>Saque</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-gray-400 font-bold uppercase tracking-wider">PIX</td>
                            <td className="py-4 px-6 font-black text-white">R$ {row.amount.toFixed(2)}</td>
                            <td className="py-4 px-6">
                              {isPending && (
                                <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 text-[9px] font-black uppercase tracking-wider">
                                  Pendente
                                </span>
                              )}
                              {isApproved && (
                                <span className="px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/25 text-[9px] font-black uppercase tracking-wider">
                                  Aprovado
                                </span>
                              )}
                              {row.status === 'rejected' && (
                                <span className="px-2.5 py-0.5 rounded-full bg-junina-red/10 text-junina-red border border-junina-red/25 text-[9px] font-black uppercase tracking-wider">
                                  Recusado
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-gray-400">
                              {new Date(row.createdAt).toLocaleDateString('pt-BR')} {new Date(row.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </JuninaBackground>
  );
}
