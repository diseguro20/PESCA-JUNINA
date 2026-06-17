"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { Anchor, KeyRound, Mail, AlertTriangle, ArrowLeft, ArrowRight, UserCheck, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirecionar se já logado
  useEffect(() => {
    if (user) {
      router.push('/game');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/game');
    } catch (err: any) {
      setError(err.message || "E-mail ou senha incorretos.");
    } finally {
      setSubmitting(false);
    }
  };

  // Atalho de login rápido para testes locais
  const handleFastLogin = async (role: 'user' | 'admin') => {
    setError(null);
    setSubmitting(true);
    const targetEmail = role === 'admin' ? 'admin@pesca.com' : 'chico@pesca.com';
    try {
      await login(targetEmail, '123456');
      router.push('/game');
    } catch (err: any) {
      setError(err.message || "Erro no login rápido.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <JuninaBackground>
      <div className="flex-1 w-full flex items-center justify-center p-6 relative z-20">
        
        <div className="w-full max-w-md rounded-3xl border border-junina-gold/25 glass-premium p-8 shadow-2xl relative overflow-hidden flex flex-col">
          
          {/* Logo Pequeno */}
          <div className="flex items-center gap-2 mb-8 justify-center select-none">
            <Anchor className="w-6 h-6 text-junina-gold animate-sway" />
            <span className="text-sm font-extrabold text-junina-gold tracking-widest uppercase">Pesca Online Junina</span>
          </div>

          <h2 className="text-2xl font-black text-white text-center mb-1">ENTRAR NA BARRACA</h2>
          <p className="text-gray-400 text-xs text-center mb-6">Informe seus dados para acessar o lago</p>

          {/* Banner de erro */}
          {error && (
            <div className="bg-junina-red/10 border border-junina-red/30 p-3 rounded-2xl flex items-start gap-2.5 mb-5 animate-fade-in text-left">
              <AlertTriangle className="w-5 h-5 text-junina-red shrink-0 mt-0.5" />
              <span className="text-xs text-red-200 font-semibold">{error}</span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Email */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">E-mail</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full py-3 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                />
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Senha */}
            <div className="flex flex-col gap-1.5 text-left">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Senha</label>
                <Link href="/forgot-password" className="text-[10px] font-bold text-junina-gold hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-3 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                />
                <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-2"
            >
              {submitting ? 'ENTRANDO...' : 'ENTRAR NA CONTA'}
            </button>
          </form>

          {/* Atalho de teste (Login Rápido) */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-2.5">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">Login de Teste Rápido (Sem Firebase)</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleFastLogin('user')}
                type="button"
                className="py-2.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/30 text-blue-300 font-extrabold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" /> Chico Bento
              </button>
              <button
                onClick={() => handleFastLogin('admin')}
                type="button"
                className="py-2.5 bg-junina-red/10 hover:bg-junina-red/15 border border-junina-red/30 text-junina-red font-extrabold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin Caipira
              </button>
            </div>
          </div>

          {/* Links adicionais */}
          <div className="text-center mt-6 text-xs text-gray-400 font-medium">
            Ainda não tem conta?{' '}
            <Link href="/signup" className="text-junina-gold font-bold hover:underline">
              Cadastre-se na Festa!
            </Link>
          </div>

          {/* Botão Voltar */}
          <Link href="/" className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-white transition-colors self-center mt-6 uppercase tracking-wider">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Início
          </Link>

        </div>

      </div>
    </JuninaBackground>
  );
}
