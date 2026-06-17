"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { Anchor, Mail, AlertTriangle, ArrowLeft, Send } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email) {
      setError("Por favor, informe o seu e-mail.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(email);
      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao enviar o link de redefinição.");
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

          <h2 className="text-2xl font-black text-white text-center mb-1">RECUPERAR ACESSO</h2>
          <p className="text-gray-400 text-xs text-center mb-6">Enviaremos um link de redefinição de senha para o seu e-mail</p>

          {/* Banner de erro */}
          {error && (
            <div className="bg-junina-red/10 border border-junina-red/30 p-3 rounded-2xl flex items-start gap-2.5 mb-5 animate-fade-in text-left">
              <AlertTriangle className="w-5 h-5 text-junina-red shrink-0 mt-0.5" />
              <span className="text-xs text-red-200 font-semibold">{error}</span>
            </div>
          )}

          {/* Banner de sucesso */}
          {success && (
            <div className="bg-junina-green/10 border border-junina-green/30 p-3.5 rounded-2xl flex items-start gap-2.5 mb-5 animate-fade-in text-left">
              <span className="text-xs text-green-200 font-semibold">
                Sucesso! Se o e-mail estiver cadastrado, você receberá um link com as instruções para redefinir sua senha.
              </span>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Email */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Seu E-mail Cadastrado</label>
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

            {/* Botão Enviar */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-2"
            >
              {submitting ? 'ENVIANDO...' : 'ENVIAR LINK DE ACESSO'} <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Links adicionais */}
          <div className="text-center mt-8 text-xs text-gray-400 font-medium">
            Lembrou da senha?{' '}
            <Link href="/login" className="text-junina-gold font-bold hover:underline">
              Voltar ao Login
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
