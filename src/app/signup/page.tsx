"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { Anchor, ArrowLeft, LockKeyhole } from 'lucide-react';
import { OWNER_EMAIL } from '../../lib/privateAccess';

export default function SignupPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/game');
    }
  }, [user, router]);

  return (
    <JuninaBackground>
      <div className="flex-1 w-full flex items-center justify-center p-6 relative z-20">
        <div className="w-full max-w-md rounded-3xl border border-junina-gold/25 glass-premium p-8 shadow-2xl relative overflow-hidden flex flex-col text-center">
          <div className="flex items-center gap-2 mb-8 justify-center select-none">
            <Anchor className="w-6 h-6 text-junina-gold animate-sway" />
            <span className="text-sm font-extrabold text-junina-gold tracking-widest uppercase">Pesca Online Junina</span>
          </div>

          <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-junina-red/10 border border-junina-red/30 flex items-center justify-center">
            <LockKeyhole className="w-7 h-7 text-junina-red" />
          </div>

          <h2 className="text-2xl font-black text-white mb-2">CADASTRO DESATIVADO</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Este site agora esta fechado para uso privado. O acesso fica disponivel somente para a conta {OWNER_EMAIL}.
          </p>

          <Link
            href="/login"
            className="w-full py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-8"
          >
            ENTRAR NA CONTA PRIVADA
          </Link>

          <Link href="/" className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-white transition-colors self-center mt-6 uppercase tracking-wider">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Inicio
          </Link>
        </div>
      </div>
    </JuninaBackground>
  );
}
