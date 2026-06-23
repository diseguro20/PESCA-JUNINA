"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useGame, Multiplier } from '../../context/GameContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { HeaderHUD } from '../../components/HeaderHUD';
import { 
  ShieldAlert, 
  Users, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Settings2, 
  FileSpreadsheet, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  Save, 
  Coins, 
  HelpCircle,
  Eye,
  Plus,
  Minus
} from 'lucide-react';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { 
    wallet,
    refreshAllData,
    approveDeposit,
    rejectDeposit,
    approveWithdrawal,
    rejectWithdrawal,
    toggleUserStatus,
    updateGameSettings
  } = useGame();
  
  const router = useRouter();

  // Estados locais do Admin carregados via REST API
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'users' | 'game' | 'logs'>('deposits');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados para Ajuste de Saldo
  const [addBalanceUserId, setAddBalanceUserId] = useState<string | null>(null);
  const [addBalanceAmount, setAddBalanceAmount] = useState<string>('');
  const [addBalanceType, setAddBalanceType] = useState<'add' | 'subtract'>('add');
  const [addingBalance, setAddingBalance] = useState(false);

  const handleAddBalance = async (targetUid: string, email: string) => {
    if (!user) {
      setErrorMsg("Sessão expirada. Por favor, faça login novamente.");
      return;
    }
    const val = parseFloat(addBalanceAmount);
    if (isNaN(val) || val <= 0) {
      setErrorMsg("Por favor, digite um valor numérico válido e maior que zero para alterar o saldo.");
      return;
    }

    setAddingBalance(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUid: user.uid,
          targetUid,
          amount: val,
          type: addBalanceType
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao alterar saldo');
      }

      setSuccessMsg(`${addBalanceType === 'subtract' ? 'Removido' : 'Adicionado'} R$ ${val.toFixed(2)} de saldo para o jogador ${email} com sucesso!`);
      setAddBalanceUserId(null);
      setAddBalanceAmount('');
      loadAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || "Falha ao alterar saldo.");
    } finally {
      setAddingBalance(false);
    }
  };

  // Estados de Configuração do Jogo
  const [minBetInput, setMinBetInput] = useState('1.00');
  const [maxBetInput, setMaxBetInput] = useState('500.00');
  const [multipliersList, setMultipliersList] = useState<Multiplier[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Redirecionamento e Segurança
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Carregar dados administrativos detalhados do backend
  const loadAdminData = async () => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    try {
      const res = await fetch(`/api/game/data?uid=${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setAdminData(data);
        setMinBetInput(String(data.settings?.minBet || 1.00));
        setMaxBetInput(String(data.settings?.maxBet || 500.00));
        setMultipliersList(data.multipliers || []);
      } else {
        setErrorMsg("Erro ao carregar dados do painel admin.");
      }
    } catch (e) {
      setErrorMsg("Erro na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadAdminData();
    }
  }, [user]);

  if (authLoading || !user) return null;

  // Se o usuário não for administrador, barra o acesso
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen w-full bg-junina-blue-deep flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-gradient-to-b from-junina-red/20 to-junina-blue-deep rounded-3xl border border-junina-red p-8 text-center flex flex-col items-center shadow-2xl relative z-20">
          <ShieldAlert className="w-16 h-16 text-junina-red mb-4 animate-bounce" />
          <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">ACESSO NEGADO</h2>
          <p className="text-sm text-gray-300 mb-6 leading-relaxed">
            Você não possui permissões administrativas para acessar a barraca de controle. O evento foi registrado para auditoria.
          </p>
          <button
            onClick={() => router.push('/game')}
            className="w-full py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-xl hover:brightness-105 active:scale-95 transition-all text-xs"
          >
            VOLTAR AO LAGO DE PESCA
          </button>
        </div>
      </div>
    );
  }

  // Ações de Depósitos
  const handleApproveDeposit = async (depId: string) => {
    try {
      await approveDeposit(depId);
      setSuccessMsg("Depósito aprovado com sucesso!");
      loadAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao aprovar depósito");
    }
  };

  const handleRejectDeposit = async (depId: string) => {
    try {
      await rejectDeposit(depId);
      setSuccessMsg("Depósito recusado com sucesso.");
      loadAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao recusar depósito");
    }
  };

  // Ações de Saques
  const handleApproveWithdrawal = async (witId: string) => {
    try {
      await approveWithdrawal(witId);
      setSuccessMsg("Saque aprovado e saldo liquidado!");
      loadAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao aprovar saque");
    }
  };

  const handleRejectWithdrawal = async (witId: string) => {
    try {
      await rejectWithdrawal(witId);
      setSuccessMsg("Saque recusado e saldo estornado para o jogador.");
      loadAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao recusar saque");
    }
  };

  // Ações de Bloqueio de Usuários
  const handleToggleUser = async (targetUid: string, currentStatus: string) => {
    try {
      await toggleUserStatus(targetUid, currentStatus);
      setSuccessMsg("Status do usuário atualizado!");
      loadAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao alterar status do usuário");
    }
  };

  // Ações de Salvamento de Regras do Jogo
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSavingSettings(true);
    
    const minVal = parseFloat(minBetInput);
    const maxVal = parseFloat(maxBetInput);

    if (isNaN(minVal) || isNaN(maxVal) || minVal <= 0 || maxVal <= minVal) {
      setErrorMsg("Limites de aposta inválidos.");
      setSavingSettings(false);
      return;
    }

    try {
      await updateGameSettings(minVal, maxVal, multipliersList);
      setSuccessMsg("Configurações do lago junino atualizadas com sucesso!");
      loadAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao salvar configurações.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMultiplierWeightChange = (index: number, weight: string) => {
    const parsed = parseInt(weight);
    setMultipliersList(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index].weight = isNaN(parsed) ? 0 : parsed;
      }
      return copy;
    });
  };

  // Filtragem rápida de dados locais
  const pendingDeposits = adminData?.allDeposits?.filter((d: any) => d.status === 'pending') || [];
  const pendingWithdrawals = adminData?.allWithdrawals?.filter((w: any) => w.status === 'pending') || [];
  const allUsers = adminData?.users || [];
  const auditLogs = adminData?.adminLogs || [];

  return (
    <JuninaBackground>
      <HeaderHUD />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:px-8 flex flex-col gap-6 relative z-20">
        
        {/* TÍTULO E BOTOES DE AVISOS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-junina-red" /> BARRACA DE CONTROLE (ADMIN)
            </h2>
            <p className="text-xs text-gray-400">Aprovação de pagamentos, bloqueios, auditoria de logs e configuração de payouts</p>
          </div>
        </div>

        {/* FEEDBACK DE SUCESSO/ERRO */}
        {errorMsg && (
          <div className="bg-junina-red/10 border border-junina-red/30 p-3 rounded-2xl text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-junina-green/10 border border-junina-green/30 p-3.5 rounded-2xl text-xs font-bold text-green-200">
            {successMsg}
          </div>
        )}

        {/* 1. CARDS DE MÉTRICAS GLOBAIS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full text-center">
          <div className="glass-premium p-4 rounded-2xl flex flex-col justify-center">
            <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Total de Pescadores</span>
            <span className="text-xl font-black text-white mt-1 flex items-center justify-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" /> {allUsers.length}
            </span>
          </div>
          <div className="glass-premium p-4 rounded-2xl flex flex-col justify-center">
            <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Depósitos Pendentes</span>
            <span className="text-xl font-black text-junina-gold mt-1 flex items-center justify-center gap-1.5">
              <ArrowUpCircle className="w-4 h-4 text-junina-gold" /> {pendingDeposits.length}
            </span>
          </div>
          <div className="glass-premium p-4 rounded-2xl flex flex-col justify-center">
            <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Saques Pendentes</span>
            <span className="text-xl font-black text-blue-400 mt-1 flex items-center justify-center gap-1.5">
              <ArrowDownCircle className="w-4 h-4 text-blue-400" /> {pendingWithdrawals.length}
            </span>
          </div>
          <div className="glass-premium p-4 rounded-2xl flex flex-col justify-center">
            <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Balanço do Caixa</span>
            <span className="text-xl font-black text-junina-green mt-1 flex items-center justify-center gap-1.5">
              <Coins className="w-4 h-4 text-junina-green" /> R$ {allUsers.reduce((sum: number, u: any) => sum + (u.balance || 0) + (u.lockedBalance || 0), 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* 2. SELETOR DE ABAS DO PAINEL */}
        <div className="flex bg-junina-blue-deep/60 rounded-2xl border border-white/10 p-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-5 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'deposits' ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" /> DEPÓSITOS ({pendingDeposits.length})
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-5 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'withdrawals' ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" /> SAQUES ({pendingWithdrawals.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'users' ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> USUÁRIOS ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('game')}
            className={`px-5 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'game' ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-4 h-4" /> CONFIGURAR LAGO
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-5 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'logs' ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> AUDITORIA
          </button>
        </div>

        {/* 3. CONTEÚDO DAS ABAS */}

        {/* ABA: DEPÓSITOS */}
        <div className={activeTab === 'deposits' ? 'block' : 'hidden'}>
          <div className="glass-premium rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-junina-blue-deep/60 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-white/5">
                    <th className="py-4 px-6">Jogador</th>
                    <th className="py-4 px-6">Valor</th>
                    <th className="py-4 px-6">Comprovante</th>
                    <th className="py-4 px-6">Solicitado em</th>
                    <th className="py-4 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {pendingDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 italic">Nenhum depósito pendente de aprovação.</td>
                    </tr>
                  ) : (
                    pendingDeposits.map((dep: any) => (
                      <tr key={dep.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 flex flex-col">
                          <span className="font-extrabold text-white">{dep.email}</span>
                          <span className="text-[10px] text-gray-500 font-mono">UID: {dep.uid.substring(0, 8)}...</span>
                        </td>
                        <td className="py-4 px-6 font-black text-junina-green">R$ {dep.amount.toFixed(2)}</td>
                        <td className="py-4 px-6">
                          <a 
                            href={dep.receiptUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs text-junina-gold hover:underline font-bold flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Recibo
                          </a>
                        </td>
                        <td className="py-4 px-6 text-gray-400">
                          {new Date(dep.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-4 px-6 text-right flex justify-end gap-2">
                          <button
                            onClick={() => handleApproveDeposit(dep.id)}
                            className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl transition-all"
                            title="Aprovar Saldo"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>
                          <button
                            onClick={() => handleRejectDeposit(dep.id)}
                            className="p-2 bg-junina-red/10 hover:bg-junina-red/20 text-junina-red border border-junina-red/25 rounded-xl transition-all"
                            title="Recusar Depósito"
                          >
                            <X className="w-4 h-4 stroke-[3]" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ABA: SAQUES */}
        <div className={activeTab === 'withdrawals' ? 'block' : 'hidden'}>
          <div className="glass-premium rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-junina-blue-deep/60 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-white/5">
                    <th className="py-4 px-6">Jogador</th>
                    <th className="py-4 px-6">Valor Solicitado</th>
                    <th className="py-4 px-6">Chave PIX</th>
                    <th className="py-4 px-6">Solicitado em</th>
                    <th className="py-4 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {pendingWithdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 italic">Nenhum saque pendente de aprovação.</td>
                    </tr>
                  ) : (
                    pendingWithdrawals.map((wit: any) => (
                      <tr key={wit.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 flex flex-col">
                          <span className="font-extrabold text-white">{wit.email}</span>
                          <span className="text-[10px] text-gray-500 font-mono">UID: {wit.uid.substring(0, 8)}...</span>
                        </td>
                        <td className="py-4 px-6 font-black text-blue-400">R$ {wit.amount.toFixed(2)}</td>
                        <td className="py-4 px-6 font-mono font-bold text-junina-gold truncate max-w-[150px]">{wit.pixKey}</td>
                        <td className="py-4 px-6 text-gray-400">
                          {new Date(wit.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-4 px-6 text-right flex justify-end gap-2">
                          <button
                            onClick={() => handleApproveWithdrawal(wit.id)}
                            className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl transition-all"
                            title="Aprovar e Liquidar"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(wit.id)}
                            className="p-2 bg-junina-red/10 hover:bg-junina-red/20 text-junina-red border border-junina-red/25 rounded-xl transition-all"
                            title="Recusar e Devolver Saldo"
                          >
                            <X className="w-4 h-4 stroke-[3]" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ABA: USUÁRIOS */}
        <div className={activeTab === 'users' ? 'block' : 'hidden'}>
          <div className="glass-premium rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-junina-blue-deep/60 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-white/5">
                    <th className="py-4 px-6">Nome / E-mail</th>
                    <th className="py-4 px-6">Privilégio</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Saldo Disponível</th>
                    <th className="py-4 px-6">Saldo Bloqueado</th>
                    <th className="py-4 px-6 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {allUsers.map((u: any) => (
                    <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 flex flex-col">
                        <span className="font-extrabold text-white">{u.name}</span>
                        <span className="text-[10px] text-gray-500">{u.email}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          u.role === 'admin' ? 'bg-junina-red/15 text-junina-red border border-junina-red/25' : 'bg-gray-800 text-gray-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          u.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/25' : 'bg-junina-red/10 text-junina-red border border-junina-red/25'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-white">
                        {addBalanceUserId === u.uid ? (
                          <div className="flex items-center gap-1.5 max-w-[170px]">
                            {addBalanceType === 'subtract' ? (
                              <span className="text-[10px] text-junina-red font-black">- R$</span>
                            ) : (
                              <span className="text-[10px] text-green-400 font-black">+ R$</span>
                            )}
                            <input
                              type="number"
                              step="0.01"
                              value={addBalanceAmount}
                              onChange={(e) => setAddBalanceAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-16 bg-white/5 border border-white/10 rounded-lg py-1 px-1.5 text-center text-xs text-white focus:outline-none focus:border-junina-gold font-mono"
                            />
                            <button
                              onClick={() => handleAddBalance(u.uid, u.email)}
                              disabled={addingBalance}
                              className="p-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-lg transition-colors cursor-pointer"
                              title="Confirmar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setAddBalanceUserId(null); setAddBalanceAmount(''); }}
                              className="p-1 bg-junina-red/20 hover:bg-junina-red/30 text-junina-red border border-junina-red/30 rounded-lg transition-colors cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>R$ {(u.balance || 0).toFixed(2)}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setAddBalanceUserId(u.uid); setAddBalanceType('add'); setAddBalanceAmount(''); }}
                                className="p-1 text-green-400 hover:text-white bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg transition-all cursor-pointer"
                                title="Adicionar Saldo"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => { setAddBalanceUserId(u.uid); setAddBalanceType('subtract'); setAddBalanceAmount(''); }}
                                className="p-1 text-junina-red hover:text-white bg-junina-red/10 hover:bg-junina-red/20 border border-junina-red/20 rounded-lg transition-all cursor-pointer"
                                title="Remover Saldo"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-gray-400">R$ {(u.lockedBalance || 0).toFixed(2)}</td>
                      <td className="py-4 px-6 text-right">
                        {u.uid !== user.uid ? (
                          <button
                            onClick={() => handleToggleUser(u.uid, u.status)}
                            className={`p-2 rounded-xl border transition-all ${
                              u.status === 'active' 
                                ? 'bg-junina-red/10 hover:bg-junina-red/20 text-junina-red border-junina-red/25' 
                                : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                            }`}
                            title={u.status === 'active' ? 'Bloquear Jogador' : 'Desbloquear Jogador'}
                          >
                            {u.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic">Você</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ABA: CONFIGURAR LAGO */}
        <div className={activeTab === 'game' ? 'block' : 'hidden'}>
          <form onSubmit={handleSaveSettings} className="glass-premium p-6 rounded-3xl flex flex-col gap-6">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Ajustes das Regras do Lago</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Min Bet */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-gray-300">Aposta Mínima (R$)</label>
                <input
                  type="number"
                  value={minBetInput}
                  onChange={(e) => setMinBetInput(e.target.value)}
                  className="w-full py-2.5 px-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none"
                  step="0.01"
                  required
                />
              </div>
              
              {/* Max Bet */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-gray-300">Aposta Máxima (R$)</label>
                <input
                  type="number"
                  value={maxBetInput}
                  onChange={(e) => setMaxBetInput(e.target.value)}
                  className="w-full py-2.5 px-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div className="w-full h-px bg-white/5" />

            {/* Configurar Pesos e Probabilidades */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-gray-300">Ajuste de Probabilidade dos Peixes (Pesos Relativos)</span>
                <span className="text-[10px] text-gray-500 italic">*Maior o peso, mais comum o resultado.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {multipliersList.map((m, idx) => (
                  <div key={idx} className="bg-junina-blue-deep/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        m.value === 0 ? 'bg-gray-600' :
                        m.value >= 10 ? 'bg-gradient-to-r from-pink-500 to-yellow-300' :
                        m.value >= 5 ? 'bg-junina-gold' : 'bg-blue-500'
                      }`} />
                      <span>{m.label} ({m.value}x)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-400 font-bold uppercase">Peso:</label>
                      <input
                        type="number"
                        value={m.weight}
                        onChange={(e) => handleMultiplierWeightChange(idx, e.target.value)}
                        className="w-16 py-1 px-2 bg-junina-blue-deep/80 rounded-lg border border-white/10 text-white text-center text-xs focus:border-junina-gold/50 focus:outline-none font-bold"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-4 bg-gradient-to-r from-junina-orange via-junina-gold to-junina-orange text-junina-wood-dark font-black rounded-xl hover:brightness-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 mt-4"
            >
              <Save className="w-4 h-4" /> {savingSettings ? 'SALVANDO REGRAS...' : 'SALVAR REGRAS DO LAGO'}
            </button>
          </form>
        </div>

        {/* ABA: AUDITORIA / LOGS */}
        <div className={activeTab === 'logs' ? 'block' : 'hidden'}>
          <div className="glass-premium rounded-3xl overflow-hidden border border-white/5 shadow-xl">
            <div className="overflow-x-auto animate-fade-in">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-junina-blue-deep/60 text-[10px] font-black uppercase text-gray-400 tracking-wider border-b border-white/5">
                    <th className="py-4 px-6">Administrador</th>
                    <th className="py-4 px-6">Ação</th>
                    <th className="py-4 px-6">Detalhes</th>
                    <th className="py-4 px-6">Registrado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500 italic">Nenhum evento registrado em auditoria.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 font-extrabold text-white">{log.adminEmail}</td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-0.5 rounded-full bg-junina-red/10 text-junina-red border border-junina-red/25 text-[9px] font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-300 font-medium">{log.details}</td>
                        <td className="py-4 px-6 text-gray-500 font-mono text-[11px]">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </JuninaBackground>
  );
}
