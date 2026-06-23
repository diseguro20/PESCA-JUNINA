import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { 
  Wallet as WalletIcon, 
  User, 
  Trophy, 
  History as HistoryIcon, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Coins,
  ShieldCheck,
  Lock,
  Anchor
} from 'lucide-react';

export const HeaderHUD: React.FC = () => {
  const { user, logout } = useAuth();
  const { wallet } = useGame();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const displayBalance = wallet?.balance ?? 0;
  const lockedBalance = wallet?.lockedBalance ?? 0;

  return (
    <header className="sticky top-0 z-50 w-full px-4 py-3 md:px-8 border-b border-junina-gold/30 glass shadow-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* LOGO */}
        <Link href="/game" className="flex items-center gap-2 select-none group">
          <div className="p-2 bg-gradient-to-br from-junina-orange via-junina-gold to-junina-red rounded-xl shadow-lg animate-sway shadow-junina-gold/25">
            <Anchor className="w-6 h-6 text-junina-wood-dark stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg md:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-junina-gold via-junina-orange to-junina-red group-hover:brightness-110 transition-all">
              PESCA ONLINE
            </span>
            <span className="text-xs font-bold tracking-widest text-junina-gold uppercase mt-[-4px]">
              Festa Junina
            </span>
          </div>
        </Link>

        {/* NAVEGAÇÃO DESKTOP */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link href="/game" className="flex items-center gap-1.5 text-sm font-extrabold text-gray-300 hover:text-junina-gold transition-colors">
            <Anchor className="w-4 h-4" /> Jogar
          </Link>
          <Link href="/wallet" className="flex items-center gap-1.5 text-sm font-extrabold text-gray-300 hover:text-junina-gold transition-colors">
            <WalletIcon className="w-4 h-4" /> Carteira
          </Link>
          <Link href="/history" className="flex items-center gap-1.5 text-sm font-extrabold text-gray-300 hover:text-junina-gold transition-colors">
            <HistoryIcon className="w-4 h-4" /> Histórico
          </Link>
          <Link href="/ranking" className="flex items-center gap-1.5 text-sm font-extrabold text-gray-300 hover:text-junina-gold transition-colors">
            <Trophy className="w-4 h-4" /> Ranking
          </Link>
          <Link href="/profile" className="flex items-center gap-1.5 text-sm font-extrabold text-gray-300 hover:text-junina-gold transition-colors">
            <User className="w-4 h-4" /> Perfil
          </Link>
          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-1.5 text-sm font-black text-junina-red hover:text-red-400 transition-colors animate-pulse">
              <ShieldCheck className="w-4 h-4" /> Painel Admin
            </Link>
          )}
        </nav>

        {/* HUD FINANCEIRO E USUÁRIO */}
        <div className="hidden md:flex items-center gap-4">
          
          {/* CARTEIRA RAPIDA */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 bg-junina-blue-deep/80 px-4 py-2 rounded-2xl border border-junina-gold/40 shadow-inner transition-all animate-neon-gold hover:border-junina-gold">
              <Coins className="w-4 h-4 text-junina-gold animate-bounce" />
              <span className="font-black text-junina-gold tracking-wide text-sm">
                R$ {displayBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            {/* SAQUE BLOQUEADO (Se houver) */}
            {lockedBalance > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1 mr-1">
                <Lock className="w-2.5 h-2.5 text-junina-red" />
                <span>Bloqueado: R$ {lockedBalance.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* PERFIL EXPANDIDO */}
          <div className="flex items-center gap-2 border-l border-gray-700/60 pl-4">
            <div className="flex flex-col text-right">
              <span className="text-sm font-extrabold text-white truncate max-w-[120px]">{user.name}</span>
              <span className="text-[10px] text-junina-gold uppercase font-bold tracking-widest flex items-center justify-end gap-1">
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-2.5 h-2.5 text-junina-red" />
                    <span className="text-junina-red">Admin</span>
                  </>
                ) : 'Pescador'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-junina-wood to-junina-gold flex items-center justify-center border border-junina-gold/45 shadow shadow-junina-gold/20 animate-glow">
              <span className="font-black text-sm text-junina-wood-dark">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <button 
              onClick={logout} 
              className="p-2 text-gray-400 hover:text-junina-red hover:bg-red-500/10 rounded-xl transition-all ml-1 cursor-pointer"
              title="Sair da Quermesse"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* HUD MOBILE (MOBILE ONLY) */}
        <div className="flex md:hidden items-center gap-2">
          {/* Carteira Rápida */}
          <div className="flex items-center gap-1 bg-junina-blue-deep/60 px-2.5 py-1 rounded-xl border border-junina-gold/20">
            <Coins className="w-3.5 h-3.5 text-junina-gold" />
            <span className="text-xs font-black text-junina-gold">
              R$ {displayBalance.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-junina-gold hover:bg-junina-gold/10 rounded-xl transition-colors"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

      </div>

      {/* BACKDROP OVERLAY FOR MOBILE DRAWER */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* DRAWER / MENU LATERAL MOBILE */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 w-full max-h-[calc(100vh-4.5rem)] overflow-y-auto no-scrollbar bg-gradient-to-b from-[#180e07] via-[#090f1d] to-[#040710] shadow-2xl border-b border-junina-gold/30 md:hidden animate-fade-in flex flex-col p-4 gap-4 z-50">
          
          {/* Usuário Mobile */}
          <div className="flex items-center gap-3 bg-junina-blue-deep/50 p-3 rounded-2xl border border-junina-gold/15">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-junina-wood to-junina-gold flex items-center justify-center border border-junina-gold/30">
              <span className="font-black text-base text-junina-wood-dark">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-white">{user.name}</span>
              <span className="text-xs text-gray-400 truncate max-w-[180px]">{user.email}</span>
            </div>
            {isAdmin && (
              <span className="ml-auto bg-junina-red/10 border border-junina-red/35 text-junina-red text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full">
                Admin
              </span>
            )}
          </div>

          {/* Saldos Mobile */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-junina-blue-deep/40 p-2.5 rounded-xl border border-junina-gold/10 flex flex-col">
              <span className="text-[10px] text-gray-400">Saldo Disponível</span>
              <span className="text-sm font-extrabold text-junina-gold">R$ {displayBalance.toFixed(2)}</span>
            </div>
            <div className="bg-junina-blue-deep/40 p-2.5 rounded-xl border border-junina-gold/10 flex flex-col">
              <span className="text-[10px] text-gray-400">Saldo Bloqueado</span>
              <span className="text-sm font-extrabold text-gray-400">R$ {lockedBalance.toFixed(2)}</span>
            </div>
          </div>

          {/* Links Mobile */}
          <div className="flex flex-col gap-1 mt-2">
            <Link 
              href="/game" 
              onClick={() => setIsOpen(false)} 
              className="flex items-center gap-3 p-3 text-sm font-bold text-gray-300 hover:text-junina-gold hover:bg-junina-gold/10 rounded-xl transition-all"
            >
              <Anchor className="w-5 h-5 text-junina-gold" /> Jogar Pescaria
            </Link>
            <Link 
              href="/wallet" 
              onClick={() => setIsOpen(false)} 
              className="flex items-center gap-3 p-3 text-sm font-bold text-gray-300 hover:text-junina-gold hover:bg-junina-gold/10 rounded-xl transition-all"
            >
              <WalletIcon className="w-5 h-5 text-junina-gold" /> Carteira Virtual
            </Link>
            <Link 
              href="/history" 
              onClick={() => setIsOpen(false)} 
              className="flex items-center gap-3 p-3 text-sm font-bold text-gray-300 hover:text-junina-gold hover:bg-junina-gold/10 rounded-xl transition-all"
            >
              <HistoryIcon className="w-5 h-5 text-junina-gold" /> Histórico Completo
            </Link>
            <Link 
              href="/ranking" 
              onClick={() => setIsOpen(false)} 
              className="flex items-center gap-3 p-3 text-sm font-bold text-gray-300 hover:text-junina-gold hover:bg-junina-gold/10 rounded-xl transition-all"
            >
              <Trophy className="w-5 h-5 text-junina-gold" /> Leaderboard / Ranking
            </Link>
            <Link 
              href="/profile" 
              onClick={() => setIsOpen(false)} 
              className="flex items-center gap-3 p-3 text-sm font-bold text-gray-300 hover:text-junina-gold hover:bg-junina-gold/10 rounded-xl transition-all"
            >
              <User className="w-5 h-5 text-junina-gold" /> Perfil do Jogador
            </Link>
            {isAdmin && (
              <Link 
                href="/admin" 
                onClick={() => setIsOpen(false)} 
                className="flex items-center gap-3 p-3 text-sm font-black text-junina-red hover:bg-red-500/10 rounded-xl transition-all border border-junina-red/25 mt-2"
              >
                <ShieldCheck className="w-5 h-5 text-junina-red" /> Painel Administrativo
              </Link>
            )}
          </div>

          {/* Botão Sair Mobile */}
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="flex items-center justify-center gap-2 p-3 text-sm font-bold text-gray-400 hover:text-junina-red hover:bg-red-500/5 rounded-xl border border-gray-700 transition-all mt-4"
          >
            <LogOut className="w-4 h-4" /> Sair da Quermesse
          </button>
        </div>
      )}
    </header>
  );
};
