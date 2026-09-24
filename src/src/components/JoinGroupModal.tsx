import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, X, ShieldCheck, AlertCircle } from 'lucide-react';

interface GroupPreviewData {
  id: string;
  name: string;
  avatarColor: string;
  avatarLetter: string;
  description: string;
  memberCount: number;
  createdAt?: string;
  createdBy?: string;
}

interface JoinGroupModalProps {
  isOpen: boolean;
  inviteCode: string;
  groupPreview: GroupPreviewData | null;
  isLoading: boolean;
  error?: string | null;
  onJoin: () => Promise<void>;
  onCancel: () => void;
}

export default function JoinGroupModal({
  isOpen,
  inviteCode,
  groupPreview,
  isLoading,
  error,
  onJoin,
  onCancel
}: JoinGroupModalProps) {
  const [isJoining, setIsJoining] = useState(false);

  if (!isOpen) return null;

  const handleJoinClick = async () => {
    setIsJoining(true);
    try {
      await onJoin();
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white text-base">Convite para Grupo</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 text-center space-y-5">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-white/60">Buscando informações do grupo...</p>
              </div>
            ) : error ? (
              <div className="py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-white">Não foi possível entrar no grupo</h4>
                <p className="text-xs text-white/60 max-w-xs mx-auto">{error}</p>
                <div className="pt-4">
                  <button
                    onClick={onCancel}
                    className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : groupPreview ? (
              <>
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl mx-auto border-2 border-white/20"
                  style={{ backgroundColor: groupPreview.avatarColor }}
                >
                  {groupPreview.avatarLetter}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{groupPreview.name}</h3>
                  <p className="text-xs text-cyan-400 font-semibold">
                    Grupo no Tribbu'sChat • {groupPreview.memberCount} {groupPreview.memberCount === 1 ? 'participante' : 'participantes'}
                  </p>
                  {groupPreview.description && (
                    <p className="text-xs text-white/60 mt-3 px-4 py-2 bg-white/[0.03] rounded-lg border border-white/5">
                      {groupPreview.description}
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-white/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Você terá acesso às mensagens em tempo real</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={onCancel}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleJoinClick}
                    disabled={isJoining}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/25 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isJoining ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        Entrando...
                      </>
                    ) : (
                      'Entrar no Grupo'
                    )}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
