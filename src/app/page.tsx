"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { JuninaBackground } from '../components/JuninaBackground';
import { Anchor, Trophy, Coins, ShieldCheck, Flame, ArrowRight } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Se o usuário já estiver logado, redireciona diretamente para o jogo
  useEffect(() => {
    if (!loading && user) {
      router.push('/game');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-junina-blue-deep flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Anchor className="w-12 h-12 text-junina-gold animate-spin-slow stroke-[2.5]" />
          <span className="text-junina-gold font-bold tracking-widest text-sm uppercase">Entrando na quermesse...</span>
        </div>
      </div>
    );
  }

  return (
    <JuninaBackground>
      <div className="flex-1 max-w-6xl mx-auto px-6 py-12 flex flex-col justify-center items-center text-center relative z-20">
        
        {/* PEIXES DECORATIVOS FLUTUANDO NO CÉU DA QUERMESSE */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[25%] w-32 h-24 opacity-25 hidden md:block animate-swim-slow">
            <img src="/images/fish/fish_gold.png" alt="" className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
          </div>
          <div className="absolute top-[65%] w-28 h-20 opacity-15 hidden md:block animate-swim-slow" style={{ animationDelay: '-10s' }}>
            <img src="/images/fish/fish_azul.png" alt="" className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
          </div>
        </div>

        {/* LOGO E ANIMAÇÃO CENTRAL */}
        <div className="mb-6 animate-sway flex justify-center">
          <div className="p-5 bg-gradient-to-br from-junina-orange via-junina-gold to-junina-red rounded-3xl shadow-2xl relative shadow-junina-gold/30">
            <Anchor className="w-16 h-16 text-junina-wood-dark stroke-[2.5]" />
            <div className="absolute inset-0 bg-white/25 rounded-3xl animate-ping scale-75" style={{ animationDuration: '3.5s' }} />
          </div>
        </div>

        {/* CATCHY HEADLINE */}
        <h1 className="text-5xl md:text-8xl font-black tracking-tight leading-none mb-6 filter drop-shadow-[0_0_20px_rgba(255,209,102,0.35)]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-junina-gold via-junina-orange to-junina-red">
            PESCA ONLINE JUNINA
          </span>
        </h1>

        <p className="max-w-2xl text-base md:text-xl text-gray-300 font-bold leading-relaxed mb-10 text-shadow">
          A clássica pescaria de quermesse brasileira de um jeito premium, moderno e 100% online. 
          Cadastre-se hoje e <span className="text-junina-gold font-extrabold underline decoration-junina-orange decoration-2">ganhe 100 créditos</span> de simulação para fisgar os maiores peixes do lago caipira!
        </p>

        {/* BOTÕES DE CHAMADA DE AÇÃO (CTA) */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mb-20 justify-center relative z-30">
          <Link
            href="/signup"
            className="flex-1 py-4 bg-gradient-to-r from-junina-orange via-junina-gold to-junina-orange text-junina-wood-dark font-black rounded-2xl shadow-xl hover:shadow-junina-gold/30 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm md:text-base neon-border-gold cursor-pointer"
          >
            JOGAR GRÁTIS AGORA <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2 text-sm md:text-base cursor-pointer"
          >
            ENTRAR NA QUERMESSE
          </Link>
        </div>

        {/* BENEFÍCIOS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          
          {/* Card 1 */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col gap-3 neon-border-gold">
            <div className="w-12 h-12 rounded-2xl bg-junina-gold/10 flex items-center justify-center text-junina-gold shadow">
              <Coins className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white">Painel de Conquistas & Pontos</h3>
            <p className="text-sm text-gray-400 leading-relaxed font-semibold">
              Acompanhe seu saldo de pontos, recordes de tamanho de peixe e estatísticas de pescaria em tempo real com total clareza.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col gap-3 neon-border-orange animate-glow" style={{ animationDuration: '3s' }}>
            <div className="w-12 h-12 rounded-2xl bg-junina-orange/10 flex items-center justify-center text-junina-orange shadow">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-lg font-extrabold text-white">Lago Junino em Tempo Real</h3>
            <p className="text-sm text-gray-400 leading-relaxed font-semibold">
              Peixes animados em tempo real que nadam em profundidades diferentes. Capture o peixe dourado ou o lendário peixe caipira de chapéu de palha!
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col gap-3 neon-border-gold">
            <div className="w-12 h-12 rounded-2xl bg-junina-green/10 flex items-center justify-center text-junina-green shadow">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white">Segurança de Ponta</h3>
            <p className="text-sm text-gray-400 leading-relaxed font-semibold">
              Nada de processamento no lado do cliente. Todos os cálculos de pontuação, sorteios de peixes e validações ocorrem de forma segura no servidor.
            </p>
          </div>

        </div>

        {/* FOOTER */}
        <footer className="mt-24 text-xs text-gray-500 flex flex-col gap-2">
          <div className="flex justify-center gap-4 text-gray-400 font-bold">
            <span className="hover:text-junina-gold cursor-pointer transition-colors">Regras do Jogo</span>
            <span>•</span>
            <span className="hover:text-junina-gold cursor-pointer transition-colors">Termos de Uso</span>
            <span>•</span>
            <span className="hover:text-junina-gold cursor-pointer transition-colors">Suporte</span>
          </div>
          <span className="font-medium">© {new Date().getFullYear()} Pesca Online Junina. Desenvolvido para fins de demonstração premium.</span>
        </footer>

      </div>
    </JuninaBackground>
  );
}
