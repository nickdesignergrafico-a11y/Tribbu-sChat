import React from 'react';
import { Megaphone, Sparkles, Clock, ShieldCheck, MessageSquareQuote } from 'lucide-react';
import { StatusItem, TextStatusStyle } from '../types';

interface TextStatusCardProps {
  status: Partial<StatusItem>;
  compact?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  showExpiration?: boolean;
  className?: string;
}

export const THEME_CONFIGS: Record<
  TextStatusStyle['themeId'],
  {
    name: string;
    description: string;
    bgGradient: string;
    glowColor: string;
    borderGradient: string;
    accentColor: string;
    badgeBg: string;
  }
> = {
  'tribbu-cyber': {
    name: 'Ciano Cyber',
    description: 'Dark Mode com aura ciano neon e esmeralda',
    bgGradient: 'from-slate-950 via-[#07131e] to-[#040d16]',
    glowColor: 'rgba(6, 182, 212, 0.45)',
    borderGradient: 'from-cyan-400 via-teal-400 to-emerald-400',
    accentColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
  },
  'emerald-glow': {
    name: 'Esmeralda Tribbu',
    description: 'Preto profundo com energia verde esmeralda',
    bgGradient: 'from-slate-950 via-[#071c18] to-[#04120e]',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    borderGradient: 'from-emerald-400 via-teal-300 to-cyan-400',
    accentColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
  },
  'obsidian-neon': {
    name: 'Obsidiana Elétrica',
    description: 'Preto absoluto com brilho de alta voltagem',
    bgGradient: 'from-black via-[#0a0f18] to-slate-950',
    glowColor: 'rgba(34, 211, 238, 0.55)',
    borderGradient: 'from-cyan-300 via-emerald-400 to-teal-400',
    accentColor: 'text-cyan-300',
    badgeBg: 'bg-cyan-400/20 text-cyan-200 border-cyan-300/50'
  },
  'midnight-aurora': {
    name: 'Aurora Boreal',
    description: 'Meia-noite espacial com gradiente atmosférico',
    bgGradient: 'from-slate-950 via-[#0a1526] to-[#081720]',
    glowColor: 'rgba(20, 184, 166, 0.45)',
    borderGradient: 'from-teal-400 via-cyan-400 to-emerald-400',
    accentColor: 'text-teal-300',
    badgeBg: 'bg-teal-500/15 text-teal-200 border-teal-500/40'
  },
  'tribbu-alert': {
    name: 'Aviso Máximo',
    description: 'Destaque prioritário para comunicados da Tribbu',
    bgGradient: 'from-slate-950 via-[#131b26] to-[#0b141d]',
    glowColor: 'rgba(6, 182, 212, 0.65)',
    borderGradient: 'from-cyan-400 via-emerald-300 to-teal-400',
    accentColor: 'text-cyan-400',
    badgeBg: 'bg-gradient-to-r from-cyan-500/25 to-emerald-500/25 text-cyan-300 border-cyan-400/50'
  }
};

export function getTimeRemaining(expiresAt?: number): string {
  if (!expiresAt) return '24h restantes';
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expirado';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${mins}m restantes`;
  }
  return `${mins}m restantes`;
}

export const TextStatusCard: React.FC<TextStatusCardProps> = ({
  status,
  compact = false,
  onAction,
  actionLabel,
  showExpiration = true,
  className = ''
}) => {
  const themeKey = (status.textStyle?.themeId || 'tribbu-cyber') as TextStatusStyle['themeId'];
  const theme = THEME_CONFIGS[themeKey] || THEME_CONFIGS['tribbu-cyber'];
  const isTribbuNotice = !!status.isTribbuNotice;
  const content = status.textContent || status.caption || '';
  const badgeText = status.textStyle?.badge || (isTribbuNotice ? 'Aviso da Tribbu' : 'Status Tribbu');

  if (compact) {
    return (
      <div 
        className={`relative group rounded-2xl p-[1.5px] bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-200 hover:shadow-[0_0_28px_rgba(6,182,212,0.45)] cursor-pointer ${className}`}
        onClick={onAction}
      >
        <div className={`relative rounded-2xl px-4 py-3 bg-gradient-to-r ${theme.bgGradient} backdrop-blur-xl flex items-center justify-between gap-3 text-white overflow-hidden`}>
          {/* Ambient Glow */}
          <div 
            className="absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-40 pointer-events-none"
            style={{ backgroundColor: theme.glowColor }}
          />

          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-slate-900/90 border border-cyan-400/40 text-cyan-400 flex-shrink-0 shadow-inner">
              {isTribbuNotice ? <Megaphone className="w-4 h-4 animate-bounce" /> : <Sparkles className="w-4 h-4" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${theme.badgeBg}`}>
                  {badgeText}
                </span>
                {status.targetGroupName && (
                  <span className="text-[11px] text-emerald-300 font-medium truncate max-w-[140px]">
                    • {status.targetGroupName}
                  </span>
                )}
                {showExpiration && (
                  <span className="text-[10px] text-white/50 flex items-center gap-1 font-mono ml-auto flex-shrink-0">
                    <Clock className="w-3 h-3 text-cyan-400/70" />
                    {getTimeRemaining(status.expiresAt)}
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-white/95 line-clamp-2 leading-snug">
                "{content}"
              </p>
            </div>
          </div>

          {actionLabel && (
            <button
              type="button"
              className="hidden sm:flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 transition cursor-pointer flex-shrink-0"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full Modern Dark Mode Card with Illuminated Cyan/Green Borders
  return (
    <div className={`relative w-full max-w-md mx-auto select-none p-3 ${className}`}>
      {/* Outer Illuminated Border Glow with exact logo gradient */}
      <div 
        className="relative rounded-3xl p-[2.5px] bg-gradient-to-tr from-cyan-400 via-teal-400 to-emerald-400 transition-all duration-300 shadow-[0_0_40px_rgba(6,182,212,0.38)]"
        style={{
          boxShadow: `0 0 45px ${theme.glowColor}, 0 0 15px rgba(16, 185, 129, 0.25)`
        }}
      >
        {/* Inner Card (Dark Mode with Obsidian Backdrop) */}
        <div className={`relative rounded-[22px] bg-gradient-to-b ${theme.bgGradient} p-6 sm:p-7 backdrop-blur-2xl flex flex-col justify-between min-h-[380px] overflow-hidden text-white border border-white/10`}>
          {/* Subtle Ambient Radial Backdrops */}
          <div 
            className="absolute -top-14 -left-14 w-44 h-44 rounded-full blur-3xl opacity-35 pointer-events-none"
            style={{ backgroundColor: theme.glowColor }}
          />
          <div className="absolute -bottom-14 -right-14 w-44 h-44 rounded-full blur-3xl opacity-25 bg-emerald-500 pointer-events-none" />

          {/* Top Header Row */}
          <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-900/90 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-md">
                {isTribbuNotice ? (
                  <Megaphone className="w-4 h-4 text-cyan-300" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="flex flex-col">
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border w-fit ${theme.badgeBg}`}>
                  {badgeText}
                </span>
                {status.targetGroupName && (
                  <span className="text-[11px] text-white/60 mt-0.5">
                    Canal: <strong className="text-white/90">{status.targetGroupName}</strong>
                  </span>
                )}
              </div>
            </div>

            {showExpiration && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-white/10 text-[11px] font-mono text-cyan-300/90 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{getTimeRemaining(status.expiresAt)}</span>
              </div>
            )}
          </div>

          {/* Center Message Body with High Typography Contrast */}
          <div className="relative z-10 my-auto py-6 flex flex-col items-center justify-center text-center">
            <MessageSquareQuote className="w-8 h-8 text-cyan-400/30 mb-3" />
            <p 
              className={`font-semibold tracking-tight text-white drop-shadow-md leading-relaxed ${
                content.length < 80 
                  ? 'text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-emerald-100' 
                  : content.length < 160
                  ? 'text-lg sm:text-xl font-bold text-white/95'
                  : 'text-base sm:text-lg font-medium text-white/90'
              }`}
            >
              {content || 'Status em texto da Tribbu...'}
            </p>
          </div>

          {/* Footer with Author Information & 24h Assurance */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {status.photoURL ? (
                <img 
                  src={status.photoURL} 
                  alt={status.userName || 'Autor'} 
                  className="w-8 h-8 rounded-full object-cover border border-cyan-400/60"
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs border border-white/20"
                  style={{ backgroundColor: status.avatarColor || '#06B6D4' }}
                >
                  {(status.userName || 'T').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-white/95 truncate text-xs flex items-center gap-1">
                  {status.userName || 'Membro da Tribbu'}
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 inline" />
                </span>
                <span className="text-[10px] text-white/50">
                  {status.timestamp ? new Date(status.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400/90 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Visível por 24h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
