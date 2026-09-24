import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

interface SplashScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

export default function SplashScreen({ onComplete, durationMs = 2000 }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { logoUrl } = useBranding();

  useEffect(() => {
    const startTime = Date.now();
    const intervalMs = 25;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (elapsed >= durationMs) {
        clearInterval(timer);
        setIsFadingOut(true);
        // Allow a smooth 300ms exit fade-out before unmounting
        setTimeout(() => {
          onComplete();
        }, 320);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [durationMs, onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        key="tribbus-splash-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: isFadingOut ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617] select-none overflow-hidden font-sans"
        id="splashScreen"
      >
        {/* Deep navy & neon glow ambient background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[680px] h-[500px] sm:h-[680px] bg-gradient-to-tr from-cyan-500/15 via-blue-600/10 to-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Subtle grid pattern texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />

        {/* Centered Brand Content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 w-full max-w-lg text-center">
          {/* Main Logo Container with Smooth Fade-In and Scale */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center w-full"
          >
            {/* Logo Image */}
            <div className="relative w-full flex justify-center items-center py-2">
              {!imageError ? (
                <div className="relative w-full max-w-[320px] sm:max-w-[400px] md:max-w-[450px] group flex justify-center">
                  {/* Subtle ambient cyan/neon green back-glow */}
                  <div className="absolute inset-4 bg-gradient-to-r from-cyan-500/25 via-blue-500/20 to-emerald-500/25 rounded-3xl blur-2xl opacity-80 pointer-events-none animate-pulse" />
                  
                  <img
                    src={logoUrl || "/icon/logo_oficial.png"}
                    alt="Tribbu'sChat - A voz da sua Tribbu."
                    className="relative z-10 w-full h-auto max-h-[260px] sm:max-h-[300px] object-contain drop-shadow-[0_10px_35px_rgba(6,182,212,0.35)] transition-transform duration-700 hover:scale-[1.02]"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      if (logoUrl !== '/icon/logo_oficial.png') {
                        setImageError(false);
                      } else {
                        setImageError(true);
                      }
                    }}
                  />
                </div>
              ) : (
                /* Crisp Typography & Icon Fallback in case image asset is unreachable */
                <div className="flex flex-col items-center">
                  <div className="relative mb-5">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden shadow-2xl border-2 border-cyan-400/60 p-1 bg-gradient-to-br from-cyan-500/20 via-slate-900 to-emerald-500/25 flex items-center justify-center shadow-cyan-500/30">
                      <img
                        src="/icon/logo_oficial.png"
                        alt="Tribbu'sChat"
                        className="w-full h-full object-cover rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="absolute -bottom-2 right-1/2 translate-x-1/2 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-black text-[10px] px-3 py-0.5 rounded-full shadow-lg tracking-wider uppercase">
                      Oficial
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                    Tribbu'sChat
                  </h1>
                  <p className="text-sm sm:text-base font-semibold text-cyan-200/90 mt-1">
                    A voz da sua Tribbu.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Loading Indicator Area: Positioned below slogan */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="w-full flex flex-col items-center mt-6 sm:mt-8 max-w-[260px] sm:max-w-[300px]"
          >
            {/* Neon Progress Bar Track */}
            <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-cyan-500/20 shadow-inner">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 shadow-[0_0_12px_#06b6d4]"
                style={{ width: `${progress}%` }}
                transition={{ ease: 'linear' }}
              />
            </div>

            {/* Discreet Spinner & Status Subtitle */}
            <div className="flex items-center justify-center gap-2 mt-3.5 text-xs text-cyan-300/80 font-medium tracking-wide">
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span>Iniciando a sua Tribbu...</span>
            </div>
          </motion.div>
        </div>

        {/* Footer subtle brand watermark */}
        <div className="absolute bottom-6 text-[11px] text-white/30 font-medium tracking-wider uppercase">
          Tribbu'sChat • Conexão Segura
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
