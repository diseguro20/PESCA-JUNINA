"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { HeaderHUD } from '../../components/HeaderHUD';
import { 
  User, 
  Settings, 
  Shield, 
  Calendar, 
  Mail, 
  Trophy, 
  Star,
  Award,
  Lock,
  Check,
  TrendingUp,
  Anchor,
  Flame
} from 'lucide-react';

export default function ProfilePage() {
  const { user, updateName, loading: authLoading } = useAuth();
  const { history, deposits, refreshAllData } = useGame();
  const router = useRouter();

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirecionamento se deslogado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      setNewName(user.name);
    }
  }, [user, authLoading, router]);

  // Recarregar dados
  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user]);

  if (authLoading || !user) return null;

  // Cálculos de Estatísticas Pessoais
  const totalRounds = history.length;
  const wins = history.filter(r => r.multiplier > 0);
  const totalWins = wins.length;
  const maxMultiplier = history.reduce((max, curr) => curr.multiplier > max ? curr.multiplier : max, 0);
  const biggestWin = history.reduce((max, curr) => curr.winAmount > max ? curr.winAmount : max, 0);
  const totalSpent = history.reduce((acc, curr) => acc + curr.betAmount, 0);
  const totalReturned = history.reduce((acc, curr) => acc + curr.winAmount, 0);
  const netEarnings = totalReturned - totalSpent;

  // Verificação de Conquistas
  const achievements = [
    {
      id: 'first-cast',
      title: 'Primeiro Arremesso',
      desc: 'Jogou sua primeira linha no lago junino.',
      unlocked: totalRounds >= 1,
      icon: <Anchor className="w-5 h-5" />
    },
    {
      id: 'golden-catch',
      title: 'Fisgada de Ouro',
      desc: 'Capturou um peixe de multiplicador 5x ou maior.',
      unlocked: maxMultiplier >= 5,
      icon: <Star className="w-5 h-5" />
    },
    {
      id: 'lake-legend',
      title: 'Lenda do Lago',
      desc: 'Pescou o Peixe Lendário com Chapéu de Palha (10x+).',
      unlocked: maxMultiplier >= 10,
      icon: <Flame className="w-5 h-5" />
    },
    {
      id: 'experienced-fisher',
      title: 'Pescador Calejado',
      desc: 'Alcançou a marca de 25 pescarias realizadas.',
      unlocked: totalRounds >= 25,
      icon: <Award className="w-5 h-5" />
    },
    {
      id: 'first-deposit',
      title: 'Padrinho da Festa',
      desc: 'Registrou uma solicitação de depósito na carteira.',
      unlocked: deposits.length >= 1,
      icon: <TrendingUp className="w-5 h-5" />
    }
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(false);

    if (!newName.trim()) {
      setErrorMsg("O nome não pode ficar vazio.");
      return;
    }

    setSaving(true);
    try {
      await updateName(newName);
      setSuccessMsg(true);
      setEditing(false);
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao atualizar dados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <JuninaBackground>
      <HeaderHUD />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative z-20">
        
        {/* COLUNA 1: DADOS E PERFIL E CONFIGS (ESQUERDA) */}
        <div className="lg:col-span-1 flex flex-col gap-6 w-full">
          
          {/* Card Perfil Básico */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-junina-wood to-junina-gold flex items-center justify-center border-2 border-junina-gold shadow-lg mb-4">
              <span className="font-black text-2xl text-junina-wood-dark">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            
            <h3 className="text-xl font-black text-white">{user.name}</h3>
            <span className="px-3 py-0.5 rounded-full bg-junina-gold/10 text-junina-gold border border-junina-gold/25 text-[10px] uppercase font-black tracking-widest mt-1.5">
              {user.role === 'admin' ? 'Administrador' : 'Pescador Junino'}
            </span>

            <div className="w-full h-px bg-white/5 my-5" />

            {/* Metadados */}
            <div className="w-full flex flex-col gap-3 text-xs text-left">
              <div className="flex items-center gap-2.5 text-gray-300">
                <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-300">
                <Shield className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="capitalize">Status: <span className="text-junina-green font-bold">{user.status}</span></span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-300">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                <span>Membro desde: {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Form Alterar Nome */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-junina-gold" /> Configurações de Perfil
            </span>

            {errorMsg && <div className="text-xs text-junina-red font-bold mb-3">{errorMsg}</div>}
            {successMsg && <div className="text-xs text-junina-green font-bold mb-3">Nome alterado com sucesso!</div>}

            {editing ? (
              <form onSubmit={handleUpdateName} className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full py-2.5 px-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 bg-junina-gold text-junina-wood-dark font-extrabold rounded-xl text-xs hover:brightness-105 active:scale-95 transition-all"
                  >
                    {saving ? 'SALVANDO...' : 'SALVAR'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditing(false); setNewName(user.name); }}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 rounded-xl text-xs font-extrabold transition-all"
                  >
                    CANCELAR
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl border border-white/5 text-gray-300 hover:text-white transition-all"
              >
                ALTERAR NOME DE EXIBIÇÃO
              </button>
            )}
          </div>

        </div>

        {/* COLUNA 2: DASHBOARD DE MÈTRICAS (CENTRO) */}
        <div className="lg:col-span-1 flex flex-col gap-6 w-full">
          
          {/* Card Métricas e Lucro */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col gap-4">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-junina-gold animate-pulse" /> Suas Estatísticas de Jogo
            </span>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-junina-blue-deep/50 p-4 rounded-2xl border border-white/5 flex flex-col">
                <span className="text-[10px] text-gray-400 font-semibold">Total de Rodadas</span>
                <span className="text-lg font-black text-white mt-1">{totalRounds}</span>
              </div>
              <div className="bg-junina-blue-deep/50 p-4 rounded-2xl border border-white/5 flex flex-col">
                <span className="text-[10px] text-gray-400 font-semibold">Fisgadas (Vitórias)</span>
                <span className="text-lg font-black text-junina-gold mt-1">{totalWins}</span>
              </div>
              <div className="bg-junina-blue-deep/50 p-4 rounded-2xl border border-white/5 flex flex-col">
                <span className="text-[10px] text-gray-400 font-semibold">Maior Multiplicador</span>
                <span className="text-lg font-black text-blue-400 mt-1">{maxMultiplier}x</span>
              </div>
              <div className="bg-junina-blue-deep/50 p-4 rounded-2xl border border-white/5 flex flex-col">
                <span className="text-[10px] text-gray-400 font-semibold">Maior Ganho Único</span>
                <span className="text-lg font-black text-junina-green mt-1">R$ {biggestWin.toFixed(2)}</span>
              </div>
            </div>

            <div className="w-full h-px bg-white/5 my-1" />

            {/* Retorno Financeiro Pessoal */}
            <div className="flex flex-col bg-junina-blue-deep/60 p-4 rounded-2xl border border-white/5">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Balanço Líquido (Ganhos - Apostas)</span>
              <span className={`text-2xl font-black mt-2 ${netEarnings >= 0 ? 'text-junina-green' : 'text-junina-red'}`}>
                {netEarnings >= 0 ? '+' : ''}R$ {netEarnings.toFixed(2)}
              </span>
              <div className="flex justify-between text-[10px] text-gray-500 mt-3 font-semibold">
                <span>Total Apostado: R$ {totalSpent.toFixed(2)}</span>
                <span>Total Retornado: R$ {totalReturned.toFixed(2)}</span>
              </div>
            </div>

          </div>

        </div>

        {/* COLUNA 3: ACHIEVEMENTS / CONQUISTAS (DIREITA) */}
        <div className="lg:col-span-1 w-full flex flex-col gap-6">
          
          {/* Card Achievements */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                <Award className="w-4 h-4 text-junina-orange animate-pulse" /> Conquistas Caipiras
              </span>
              <span className="text-[10px] bg-junina-gold/15 border border-junina-gold/25 text-junina-gold px-2.5 py-0.5 rounded-full font-black">
                {unlockedCount}/{achievements.length} LIBERADAS
              </span>
            </div>

            {/* Lista de Conquistas */}
            <div className="flex flex-col gap-3">
              {achievements.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                    item.unlocked 
                      ? 'bg-junina-blue-deep/70 border-junina-gold/30 opacity-100 shadow-md shadow-junina-gold/5' 
                      : 'bg-junina-blue-deep/35 border-white/5 opacity-45'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    item.unlocked ? 'bg-junina-gold/15 text-junina-gold border border-junina-gold/20' : 'bg-gray-800 text-gray-500 border border-gray-700/50'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black text-white">{item.title}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{item.desc}</span>
                  </div>
                  <div className="ml-auto shrink-0">
                    {item.unlocked ? (
                      <div className="w-5 h-5 rounded-full bg-junina-green/10 border border-junina-green/45 text-junina-green flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <Lock className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </JuninaBackground>
  );
}
