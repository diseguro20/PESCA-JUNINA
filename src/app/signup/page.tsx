"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { Anchor, KeyRound, Mail, AlertTriangle, ArrowLeft, User, CheckSquare } from 'lucide-react';

export default function SignupPage() {
  const { user, signup, loading } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      await signup(name, email, password);
      // Disparar evento do Meta Pixel (CompleteRegistration)
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'CompleteRegistration');
      }
      router.push('/game');
    } catch (err: any) {
      setError(err.message || "Erro ao efetuar cadastro. Tente outro e-mail.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <JuninaBackground>
      <div className="flex-1 w-full flex items-center justify-center p-6 relative z-20">
        
        <div className="w-full max-w-md rounded-3xl border border-junina-gold/25 glass-premium p-8 shadow-2xl relative overflow-hidden flex flex-col">
          
          {/* Logo Pequeno */}
          <div className="flex items-center gap-2 mb-6 justify-center select-none">
            <Anchor className="w-6 h-6 text-junina-gold animate-sway" />
            <span className="text-sm font-extrabold text-junina-gold tracking-widest uppercase">Pesca Online Junina</span>
          </div>

          <h2 className="text-2xl font-black text-white text-center mb-1">CADASTRAR PESCADOR</h2>
          <p className="text-gray-400 text-xs text-center mb-6">Preencha os campos para ganhar seus 100 créditos de simulação</p>

          {/* Banner de erro */}
          {error && (
            <div className="bg-junina-red/10 border border-junina-red/30 p-3 rounded-2xl flex items-start gap-2.5 mb-5 animate-fade-in text-left">
              <AlertTriangle className="w-5 h-5 text-junina-red shrink-0 mt-0.5" />
              <span className="text-xs text-red-200 font-semibold">{error}</span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            
            {/* Nome Completo */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Nome Completo</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Chico Bento"
                  className="w-full py-2.5 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                />
                <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">E-mail</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full py-2.5 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                />
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Senha */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Senha (mín. 6 dígitos)</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2.5 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                />
                <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Confirmar Senha */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Confirmar Senha</label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2.5 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                />
                <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Aceitar Termos */}
            <div className="flex items-center gap-2 mt-1">
              <input type="checkbox" defaultChecked className="accent-junina-gold w-4 h-4" required id="terms" />
              <label htmlFor="terms" className="text-[10px] text-gray-400 font-semibold cursor-pointer">
                Aceito as regras de jogo responsável da quermesse.
              </label>
            </div>

            {/* Botão Registrar */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-3"
            >
              {submitting ? 'CADASTRANDO...' : 'CADASTRAR E COMEÇAR A JOGAR'}
            </button>
          </form>

          {/* Links adicionais */}
          <div className="text-center mt-6 text-xs text-gray-400 font-medium">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-junina-gold font-bold hover:underline">
              Entrar na conta
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
