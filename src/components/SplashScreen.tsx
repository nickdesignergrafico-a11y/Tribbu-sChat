import React from 'react';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 text-white select-none">
      {/* Container com efeito de pulso na Logo */}
      <div className="flex flex-col items-center space-y-6 animate-pulse">
        <div className="w-28 h-28 md:w-36 md:h-36 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl flex items-center justify-center">
          {/* Logo oficial configurada no servidor */}
          <img 
            src="/tribbus-splash-logo.png" 
            alt="Tribbu'sChat Logo" 
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback para a logo padrão do Tribbus caso necessário
              e.currentTarget.src = "/icon/logo_oficial.png";
            }}
          />
        </div>

        {/* Nome do Aplicativo */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wider bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
            Tribbu'sChat
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 font-medium tracking-wide">
            A voz da sua Tribbu
          </p>
        </div>
      </div>

      {/* Barra de progresso/carregamento sutil no rodapé */}
      <div className="absolute bottom-12 w-48 h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full w-full animate-pulse" />
      </div>
    </div>
  );
}
