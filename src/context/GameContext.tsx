"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db, isDemoMode } from '../lib/firebase';

export interface Wallet {
  balance: number;
  lockedBalance: number;
  updatedAt: string;
}

export interface GameRound {
  id: string;
  uid: string;
  userName: string;
  betAmount: number;
  winAmount: number;
  multiplier: number;
  fishType: string;
  createdAt: string;
}

export interface Deposit {
  id: string;
  uid: string;
  email: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Withdrawal {
  id: string;
  uid: string;
  email: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  pixKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Multiplier {
  value: number;
  label: string;
  color: string;
  weight: number;
}

export interface AdminLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  details: string;
  createdAt: string;
}

interface GameContextType {
  wallet: Wallet | null;
  history: GameRound[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  rankings: any[];
  multipliers: Multiplier[];
  adminLogs: AdminLog[];
  usersList: any[];
  minBet: number;
  maxBet: number;
  loading: boolean;
  playFishingRound: (betAmount: number) => Promise<any>;
  createDepositRequest: (amount: number, receiptUrl?: string) => Promise<any>;
  createWithdrawalRequest: (amount: number, pixKey: string) => Promise<void>;
  // Métodos Admin
  approveDeposit: (depositId: string) => Promise<void>;
  rejectDeposit: (depositId: string) => Promise<void>;
  approveWithdrawal: (withdrawalId: string) => Promise<void>;
  rejectWithdrawal: (withdrawalId: string) => Promise<void>;
  toggleUserStatus: (uid: string, currentStatus: string) => Promise<void>;
  updateGameSettings: (minBet: number, maxBet: number, multipliers: Multiplier[]) => Promise<void>;
  refreshAllData: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [history, setHistory] = useState<GameRound[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [multipliers, setMultipliers] = useState<Multiplier[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [minBet, setMinBet] = useState(1.00);
  const [maxBet, setMaxBet] = useState(500.00);
  const [loading, setLoading] = useState(true);

  // Função para recarregar dados via REST (especial para Modo Demo ou atualizações forçadas)
  const refreshAllData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/game/data?uid=${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setWallet(data.wallet);
        setHistory(data.history);
        setDeposits(data.deposits);
        setWithdrawals(data.withdrawals);
        setRankings(data.rankings);
        setMultipliers(data.multipliers);
        setMinBet(data.settings?.minBet || 1.00);
        setMaxBet(data.settings?.maxBet || 500.00);

        if (user.role === 'admin') {
          setAdminLogs(data.adminLogs || []);
          setUsersList(data.users || []);
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
    }
  };

  // Efeito de escuta em tempo real (Firebase) ou fetch inicial (Demo)
  useEffect(() => {
    if (!user) {
      setWallet(null);
      setHistory([]);
      setDeposits([]);
      setWithdrawals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (isDemoMode) {
      // No modo demonstração, carregamos os dados do mockDb via API Next.js
      refreshAllData().then(() => setLoading(false));
      
      // Simular atualização a cada 10 segundos
      const interval = setInterval(refreshAllData, 10000);
      return () => clearInterval(interval);
    }

    // --- ESCUTAS EM TEMPO REAL DO FIREBASE ---
    
    // 1. Escuta da Carteira do Usuário
    const walletRef = doc(db, 'wallets', user.uid);
    const unsubWallet = onSnapshot(walletRef, (docSnap) => {
      if (docSnap.exists()) {
        setWallet(docSnap.data() as Wallet);
      }
      setLoading(false);
    }, () => setLoading(false));

    // 2. Escuta do Histórico de Partidas
    const roundsRef = collection(db, 'gameRounds');
    const qRounds = query(
      roundsRef, 
      where('uid', '==', user.uid), 
      orderBy('createdAt', 'desc'), 
      limit(50)
    );
    const unsubRounds = onSnapshot(qRounds, (snap) => {
      const items: GameRound[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as GameRound);
      });
      setHistory(items);
    });

    // 3. Escuta dos Depósitos do Usuário
    const depositsRef = collection(db, 'deposits');
    const qDeposits = query(
      depositsRef, 
      where('uid', '==', user.uid), 
      orderBy('createdAt', 'desc')
    );
    const unsubDeposits = onSnapshot(qDeposits, (snap) => {
      const items: Deposit[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as Deposit);
      });
      setDeposits(items);
    });

    // 4. Escuta dos Saques do Usuário
    const withdrawalsRef = collection(db, 'withdrawals');
    const qWithdrawals = query(
      withdrawalsRef, 
      where('uid', '==', user.uid), 
      orderBy('createdAt', 'desc')
    );
    const unsubWithdrawals = onSnapshot(qWithdrawals, (snap) => {
      const items: Withdrawal[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as Withdrawal);
      });
      setWithdrawals(items);
    });

    // 5. Escuta de Rankings Globais
    const rankingRef = collection(db, 'rankings');
    const qRanking = query(rankingRef, orderBy('biggestWin', 'desc'), limit(20));
    const unsubRanking = onSnapshot(qRanking, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => {
        items.push({ uid: d.id, ...d.data() });
      });
      setRankings(items);
    });

    // 6. Escuta de Multiplicadores e Configurações Globais
    const configRef = doc(db, 'settings', 'game');
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMinBet(data.minBet || 1.00);
        setMaxBet(data.maxBet || 500.00);
      }
    });

    const multRef = collection(db, 'multipliers');
    const qMult = query(multRef, orderBy('value', 'asc'));
    const unsubMult = onSnapshot(qMult, (snap) => {
      const items: Multiplier[] = [];
      snap.forEach((d) => {
        items.push(d.data() as Multiplier);
      });
      if (items.length > 0) setMultipliers(items);
    });

    // Escutas administrativas exclusivas
    let unsubAdminLogs = () => {};
    let unsubUsers = () => {};

    if (user.role === 'admin') {
      const logsRef = collection(db, 'adminLogs');
      const qLogs = query(logsRef, orderBy('createdAt', 'desc'), limit(100));
      unsubAdminLogs = onSnapshot(qLogs, (snap) => {
        const items: AdminLog[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as AdminLog);
        });
        setAdminLogs(items);
      });

      const usersRef = collection(db, 'users');
      unsubUsers = onSnapshot(usersRef, (snap) => {
        const items: any[] = [];
        snap.forEach((d) => {
          items.push({ uid: d.id, ...d.data() });
        });
        setUsersList(items);
      });
    }

    return () => {
      unsubWallet();
      unsubRounds();
      unsubDeposits();
      unsubWithdrawals();
      unsubRanking();
      unsubConfig();
      unsubMult();
      unsubAdminLogs();
      unsubUsers();
    };
  }, [user]);

  // Jogar Rodada
  const playFishingRound = async (betAmount: number) => {
    if (!user) throw new Error("Usuário não autenticado");
    if (betAmount < minBet || betAmount > maxBet) {
      throw new Error(`O valor da aposta deve ser entre R$ ${minBet.toFixed(2)} e R$ ${maxBet.toFixed(2)}`);
    }
    if (!wallet || wallet.balance < betAmount) {
      throw new Error("Saldo insuficiente!");
    }

    const res = await fetch('/api/game/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, betAmount })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao processar jogada');

    // Se estiver no modo demo, forçar atualização local
    if (isDemoMode) {
      await refreshAllData();
    }

    return data; // { winAmount, multiplier, fishType, fishColor, balance }
  };

  // Solicitar Depósito
  const createDepositRequest = async (amount: number, receiptUrl?: string) => {
    if (!user) throw new Error("Usuário não autenticado");
    if (amount <= 0) throw new Error("Valor inválido");

    const res = await fetch('/api/wallet/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, amount, receiptUrl })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao solicitar depósito');

    if (isDemoMode) {
      await refreshAllData();
    }
    return data;
  };

  // Solicitar Saque
  const createWithdrawalRequest = async (amount: number, pixKey: string) => {
    if (!user) throw new Error("Usuário não autenticado");
    if (amount <= 0) throw new Error("Valor inválido");
    if (!wallet || wallet.balance < amount) throw new Error("Saldo disponível insuficiente");

    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, amount, pixKey })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao solicitar saque');

    if (isDemoMode) {
      await refreshAllData();
    }
  };

  // ADMIN: Aprovar Depósito
  const approveDeposit = async (depositId: string) => {
    if (!user || user.role !== 'admin') throw new Error("Não autorizado");

    const res = await fetch('/api/admin/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUid: user.uid, depositId, action: 'approve' })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao aprovar depósito');
    }

    if (isDemoMode) await refreshAllData();
  };

  // ADMIN: Recusar Depósito
  const rejectDeposit = async (depositId: string) => {
    if (!user || user.role !== 'admin') throw new Error("Não autorizado");

    const res = await fetch('/api/admin/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUid: user.uid, depositId, action: 'reject' })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao recusar depósito');
    }

    if (isDemoMode) await refreshAllData();
  };

  // ADMIN: Aprovar Saque
  const approveWithdrawal = async (withdrawalId: string) => {
    if (!user || user.role !== 'admin') throw new Error("Não autorizado");

    const res = await fetch('/api/admin/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUid: user.uid, withdrawalId, action: 'approve' })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao aprovar saque');
    }

    if (isDemoMode) await refreshAllData();
  };

  // ADMIN: Recusar Saque
  const rejectWithdrawal = async (withdrawalId: string) => {
    if (!user || user.role !== 'admin') throw new Error("Não autorizado");

    const res = await fetch('/api/admin/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUid: user.uid, withdrawalId, action: 'reject' })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao recusar saque');
    }

    if (isDemoMode) await refreshAllData();
  };

  // ADMIN: Bloquear / Desbloquear Usuário
  const toggleUserStatus = async (targetUid: string, currentStatus: string) => {
    if (!user || user.role !== 'admin') throw new Error("Não autorizado");
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        adminUid: user.uid, 
        targetUid, 
        status: newStatus 
      })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao alterar status do usuário');
    }

    if (isDemoMode) await refreshAllData();
  };

  // ADMIN: Salvar Configurações do Jogo
  const updateGameSettings = async (newMin: number, newMax: number, newMultipliers: Multiplier[]) => {
    if (!user || user.role !== 'admin') throw new Error("Não autorizado");

    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        adminUid: user.uid, 
        minBet: newMin, 
        maxBet: newMax, 
        multipliers: newMultipliers 
      })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao salvar configurações');
    }

    if (isDemoMode) await refreshAllData();
  };

  return (
    <GameContext.Provider value={{
      wallet,
      history,
      deposits,
      withdrawals,
      rankings,
      multipliers,
      adminLogs,
      usersList,
      minBet,
      maxBet,
      loading,
      playFishingRound,
      createDepositRequest,
      createWithdrawalRequest,
      approveDeposit,
      rejectDeposit,
      approveWithdrawal,
      rejectWithdrawal,
      toggleUserStatus,
      updateGameSettings,
      refreshAllData
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame deve ser usado dentro de um GameProvider');
  }
  return context;
};
