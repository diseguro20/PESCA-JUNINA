import React, { useEffect, useState } from 'react';

export const JuninaBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stars, setStars] = useState<Array<{ id: number; top: number; left: number; size: number; delay: number }>>([]);
  const [sparks, setSparks] = useState<Array<{ id: number; left: number; size: number; duration: number; delay: number }>>([]);

  useEffect(() => {
    // Gerar estrelas aleatórias
    const generatedStars = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      top: Math.random() * 60, // Apenas na metade superior da tela
      left: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 3,
    }));
    setStars(generatedStars);

    // Gerar fagulhas da fogueira
    const generatedSparks = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: 45 + Math.random() * 10, // Concentradas no centro
      size: Math.random() * 3 + 2,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 5,
    }));
    setSparks(generatedSparks);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-junina-blue-deep to-junina-blue-dark text-white flex flex-col">
      {/* 1. Céu Estrelado */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute bg-white rounded-full opacity-60 animate-pulse"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
            }}
          />
        ))}
      </div>

      {/* 2. Bandeirinhas Animadas no Topo */}
      <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-10 flex flex-col justify-start">
        {/* Cordão das Bandeirinhas */}
        <svg className="w-full h-10 overflow-visible" viewBox="0 0 1000 40" preserveAspectRatio="none">
          <path d="M0,5 Q250,35 500,5 T1000,5" fill="none" stroke="#543417" strokeWidth="2" />
        </svg>
        <div className="absolute top-0 left-0 right-0 flex justify-between px-4 overflow-hidden select-none">
          {Array.from({ length: 24 }).map((_, i) => {
            const colors = ['bg-junina-red', 'bg-junina-gold', 'bg-junina-orange', 'bg-junina-green', 'bg-blue-500', 'bg-pink-500'];
            const color = colors[i % colors.length];
            const delay = (i * 0.1).toFixed(2);
            return (
              <div
                key={i}
                className={`w-6 h-8 ${color} animate-sway relative origin-top`}
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 70%, 0% 100%)',
                  animationDelay: `${delay}s`,
                  transform: 'rotate(-2deg)',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 3. Lanternas Iluminadas (Laterais) */}
      <div className="absolute top-10 left-6 pointer-events-none z-10 hidden md:block select-none">
        <div className="animate-sway origin-top flex flex-col items-center">
          <div className="w-0.5 h-10 bg-junina-wood" />
          <svg className="w-12 h-16 animate-glow text-junina-gold fill-junina-gold" viewBox="0 0 100 130">
            {/* Desenho da lanterna junina hexagonal de papel */}
            <polygon points="50,10 90,50 90,80 50,120 10,80 10,50" stroke="#f77f00" strokeWidth="4" />
            <polygon points="50,20 80,52 80,78 50,110 20,78 20,52" fill="#ffd166" opacity="0.9" />
            <line x1="50" y1="10" x2="50" y2="120" stroke="#f77f00" strokeWidth="4" />
            <line x1="10" y1="50" x2="90" y2="80" stroke="#f77f00" strokeWidth="2" />
            <line x1="10" y1="80" x2="90" y2="50" stroke="#f77f00" strokeWidth="2" />
          </svg>
        </div>
      </div>

      <div className="absolute top-12 right-8 pointer-events-none z-10 hidden md:block select-none">
        <div className="animate-sway origin-top flex flex-col items-center" style={{ animationDelay: '0.7s' }}>
          <div className="w-0.5 h-8 bg-junina-wood" />
          <svg className="w-10 h-14 animate-glow text-junina-orange fill-junina-orange" viewBox="0 0 100 130">
            <polygon points="50,10 90,50 90,80 50,120 10,80 10,50" stroke="#e63946" strokeWidth="4" />
            <polygon points="50,20 80,52 80,78 50,110 20,78 20,52" fill="#f77f00" opacity="0.9" />
            <line x1="50" y1="10" x2="50" y2="120" stroke="#e63946" strokeWidth="4" />
          </svg>
        </div>
      </div>

      {/* 4. Fogueira Animada no Canto Inferior Direito (Apenas Desktop) */}
      <div className="absolute bottom-4 right-10 pointer-events-none z-10 hidden lg:flex flex-col items-center select-none">
        {/* Chamas */}
        <div className="relative w-24 h-28 flex justify-center items-end">
          {/* Chama Externa */}
          <div className="absolute w-20 h-24 bg-junina-orange rounded-full filter blur-sm opacity-60 animate-flame origin-bottom" style={{ animationDelay: '0.2s' }} />
          {/* Chama Média */}
          <div className="absolute w-14 h-20 bg-junina-gold rounded-full filter blur-xs opacity-80 animate-flame origin-bottom" style={{ animationDelay: '0.4s' }} />
          {/* Chama Interna */}
          <div className="absolute w-8 h-12 bg-junina-red rounded-full opacity-90 animate-flame origin-bottom" />
        </div>
        {/* Lenha de Madeira */}
        <div className="relative w-28 h-6 flex justify-center mt-[-10px]">
          <div className="w-24 h-4 bg-junina-wood-dark rounded-full border border-junina-wood rotate-[-5deg] shadow-lg absolute" />
          <div className="w-24 h-4 bg-junina-wood rounded-full border border-junina-wood-light rotate-[5deg] shadow-lg absolute" />
        </div>
        {/* Brilho da Fogueira na Terra */}
        <div className="w-36 h-4 bg-junina-orange/20 rounded-full filter blur-md mt-1" />
      </div>

      {/* 5. Partículas/Fagulhas subindo (Apenas Desktop) */}
      <div className="absolute bottom-20 right-10 w-36 h-96 pointer-events-none z-10 overflow-hidden hidden lg:block">
        {sparks.map((spark) => (
          <div
            key={spark.id}
            className="absolute rounded-full bg-junina-gold"
            style={{
              bottom: '-10px',
              left: `${spark.left - 45}%`,
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              opacity: Math.random() * 0.7 + 0.3,
              boxShadow: '0 0 6px rgba(255, 209, 102, 0.8)',
              animation: `rise ${spark.duration}s linear infinite`,
              animationDelay: `${spark.delay}s`,
            }}
          />
        ))}
        <style jsx global>{`
          @keyframes rise {
            0% {
              bottom: 0%;
              transform: translateX(0) scale(1);
              opacity: 1;
            }
            50% {
              transform: translateX(${Math.random() * 20 - 10}px) scale(0.8);
            }
            100% {
              bottom: 100%;
              transform: translateX(${Math.random() * 40 - 20}px) scale(0.2);
              opacity: 0;
            }
          }
        `}</style>
      </div>

      {/* Conteúdo Principal da Página */}
      <main className="flex-1 w-full flex flex-col z-10">
        {children}
      </main>
    </div>
  );
};
