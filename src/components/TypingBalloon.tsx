import React from 'react';
import { Mic } from 'lucide-react';
import { TypingIndicator } from '../services/typingService';

interface TypingBalloonProps {
  indicators: TypingIndicator[];
  isGroup?: boolean;
}

export const TypingBalloon: React.FC<TypingBalloonProps> = ({ indicators, isGroup }) => {
  if (!indicators || indicators.length === 0) return null;

  // Primary active indicator (or summarize if multiple in group)
  const primary = indicators[0];
  const isRecording = indicators.some((ind) => ind.state === 'recording');
  
  let labelText = '';
  if (indicators.length === 1) {
    const name = isGroup ? (primary.userName || primary.phoneNumber || 'Participante') : '';
    if (isRecording) {
      labelText = name ? `${name} está gravando áudio...` : 'gravando áudio...';
    } else {
      labelText = name ? `${name} está digitando...` : 'digitando...';
    }
  } else {
    // Multiple users typing
    const names = indicators.map((i) => i.userName || 'Alguém').slice(0, 2).join(', ');
    const countExtra = indicators.length - 2;
    const suffix = countExtra > 0 ? ` e mais ${countExtra}` : '';
    labelText = `${names}${suffix} estão ${isRecording ? 'gravando áudio...' : 'digitando...'}`;
  }

  return (
    <div 
      className="absolute bottom-20 left-4 sm:left-6 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none pointer-events-none"
      id="typingIndicatorBalloon"
    >
      <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 text-white rounded-2xl shadow-xl shadow-cyan-950/50 px-3.5 py-2 flex items-center gap-2.5 border-b-2 border-b-cyan-400">
        {/* Animated Three Dots in Official Logo Colors (Cyan, Blue, Green) */}
        <div className="flex items-center gap-1.5 px-0.5">
          {/* Dot 1: Ciano Neon */}
          <span 
            className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/80 animate-bounce"
            style={{ animationDuration: '900ms', animationDelay: '0ms' }}
          />
          {/* Dot 2: Azul Neon */}
          <span 
            className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/80 animate-bounce"
            style={{ animationDuration: '900ms', animationDelay: '200ms' }}
          />
          {/* Dot 3: Verde Esmeralda */}
          <span 
            className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-bounce"
            style={{ animationDuration: '900ms', animationDelay: '400ms' }}
          />
        </div>

        {/* Microphone icon if recording audio */}
        {isRecording && (
          <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse flex-shrink-0" />
        )}

        {/* Status Text */}
        <span className="text-xs font-semibold tracking-wide text-cyan-100/90 pr-1">
          {labelText}
        </span>
      </div>
    </div>
  );
};
