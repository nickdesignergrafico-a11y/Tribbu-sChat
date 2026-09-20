import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Link2, 
  Copy, 
  Check, 
  QrCode, 
  RefreshCw, 
  Share2, 
  Users, 
  ShieldCheck, 
  Calendar,
  User,
  Info
} from 'lucide-react';
import { Chat, UserSession } from '../types';
import { formatPhoneDisplay } from './LoginScreen';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat;
  currentUser: UserSession | null;
  onRevokeInvite?: (chatId: string) => Promise<string | void>;
}

export default function GroupInfoModal({
  isOpen,
  onClose,
  chat,
  currentUser,
  onRevokeInvite
}: GroupInfoModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);

  const inviteCode = chat.inviteCode || chat.id;
  const basePath = typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}`
    : 'https://zapchat.app';
  const inviteUrl = `${basePath}/?invite=${inviteCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&color=020617&bgcolor=ffffff&data=${encodeURIComponent(inviteUrl)}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const input = document.createElement('input');
        input.value = inviteUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silent handle
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Convite para o grupo ${chat.name} no Tribbu'sChat`,
          text: `Entre no grupo "${chat.name}" no Tribbu'sChat usando o link de convite:`,
          url: inviteUrl,
        });
      } catch {
        // Fallback to copy
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleRevoke = async () => {
    if (!onRevokeInvite) return;
    if (!confirm('Deseja realmente redefinir o link de convite? O link anterior deixará de funcionar imediatamente.')) {
      return;
    }

    setIsRevoking(true);
    try {
      await onRevokeInvite(chat.id);
      setRevokeSuccess(true);
      setTimeout(() => setRevokeSuccess(false), 3000);
    } catch {
      // Handled silently
    } finally {
      setIsRevoking(false);
    }
  };

  if (!isOpen) return null;

  const isAdmin = !chat.createdBy || 
    (currentUser?.phoneNumber && chat.createdBy === currentUser.phoneNumber) || 
    (currentUser?.email && chat.createdBy === currentUser.email);
  const currentPhoneOrId = currentUser?.phoneNumber || currentUser?.displayName || 'Você';
  const memberList = chat.members && chat.members.length > 0 
    ? chat.members 
    : [currentPhoneOrId];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white text-base">Dados do Grupo</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Group Profile Card */}
            <div className="flex flex-col items-center text-center p-5 rounded-xl bg-white/[0.03] border border-white/5">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl mb-3 border-2 border-white/20"
                style={{ backgroundColor: chat.avatarColor }}
              >
                {chat.avatarLetter}
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{chat.name}</h2>
              <p className="text-xs text-white/50">
                Grupo • {memberList.length} {memberList.length === 1 ? 'participante' : 'participantes'}
              </p>
              {chat.description && (
                <p className="text-sm text-white/70 mt-3 px-4 py-2 bg-white/[0.02] rounded-lg border border-white/5 max-w-full">
                  {chat.description}
                </p>
              )}
            </div>

            {/* Invite via Link Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <Link2 className="w-4 h-4 text-cyan-400" />
                  <span>Convidar para o grupo via link</span>
                </div>
                {isAdmin && (
                  <span className="text-[11px] text-cyan-300 font-semibold px-2 py-0.5 bg-cyan-500/10 rounded-md border border-cyan-500/30">
                    Admin
                  </span>
                )}
              </div>

              <p className="text-xs text-white/50 leading-relaxed">
                Qualquer pessoa com o Tribbu'sChat pode usar este link para entrar neste grupo. Compartilhe apenas com pessoas de confiança.
              </p>

              {/* Link Box */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-white/10">
                <div className="flex-1 truncate text-xs font-mono text-white/80 px-2 select-all">
                  {inviteUrl}
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    copied 
                      ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/25' 
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-md shadow-cyan-500/25"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar Link
                </button>

                <button
                  onClick={() => setShowQrModal(true)}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer border border-white/5"
                >
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  Exibir QR Code
                </button>
              </div>

              {/* Admin Revoke Link Option */}
              {isAdmin && onRevokeInvite && (
                <div className="pt-2">
                  <button
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRevoking ? 'animate-spin' : ''}`} />
                    <span>{isRevoking ? 'Redefinindo...' : 'Redefinir link de convite'}</span>
                  </button>
                  {revokeSuccess && (
                    <p className="text-[11px] text-center text-emerald-400 mt-1 font-medium">
                      ✓ Novo link gerado! O link anterior foi cancelado.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Participants List */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span className="font-semibold text-white/90">Participantes ({memberList.length})</span>
                <span className="text-[11px]">Criptografia de ponta a ponta</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {memberList.map((member, index) => {
                  const isCurrent = (currentUser?.phoneNumber && member === currentUser.phoneNumber) || 
                                    (currentUser?.email && member === currentUser.email) ||
                                    (member === 'Você');
                  const isGroupCreator = member === chat.createdBy || (!chat.createdBy && index === 0);
                  const displayMember = member.startsWith('+') || /^\d{9,}/.test(member)
                    ? formatPhoneDisplay(member)
                    : member;
                  const initial = displayMember.charAt(0).toUpperCase();

                  return (
                    <div 
                      key={member + index}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">
                            {isCurrent ? `${displayMember} (Você)` : displayMember}
                          </p>
                          <p className="text-[10px] text-white/40">
                            {isCurrent ? "Online no Tribbu'sChat" : 'Membro'}
                          </p>
                        </div>
                      </div>
                      {isGroupCreator && (
                        <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/25">
                          Admin do grupo
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </motion.div>

        {/* QR Code Sub-Modal */}
        {showQrModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl flex flex-col items-center"
            >
              <div className="flex items-center justify-between w-full mb-4">
                <span className="text-sm font-semibold text-white">QR Code do Grupo</span>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="p-1 text-white/50 hover:text-white rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* QR Image Container */}
              <div className="bg-white p-4 rounded-2xl shadow-inner mb-4 flex items-center justify-center relative min-h-[220px]">
                {!qrLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-800 text-xs font-medium animate-pulse">
                    Carregando QR Code...
                  </div>
                )}
                <img 
                  src={qrCodeUrl} 
                  alt={`QR Code do grupo ${chat.name}`} 
                  className={`w-52 h-52 object-contain transition-opacity duration-300 ${qrLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setQrLoaded(true)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://chart.googleapis.com/chart?cht=qr&chs=260x260&chl=${encodeURIComponent(inviteUrl)}&choe=UTF-8`;
                    setQrLoaded(true);
                  }}
                />
              </div>

              <p className="text-xs text-white/60 mb-5 leading-relaxed">
                Aponte a câmera do celular para este QR code para entrar no grupo <strong className="text-white">{chat.name}</strong>.
              </p>

              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-md shadow-cyan-500/25"
              >
                Concluído
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
