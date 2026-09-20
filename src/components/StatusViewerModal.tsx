import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Pause, Play, Send, Volume2, VolumeX, Eye } from 'lucide-react';
import { UserStatusGroup, StatusItem } from '../types';
import { TextStatusCard } from './TextStatusCard';

interface StatusViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusGroups: UserStatusGroup[];
  initialGroupIndex: number;
  onReplyToStatus?: (targetUserPhone: string, text: string) => void;
  onMarkStatusViewed?: (statusId: string) => void;
}

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({
  isOpen,
  onClose,
  statusGroups,
  initialGroupIndex,
  onReplyToStatus,
  onMarkStatusViewed
}) => {
  const [currentGroupIdx, setCurrentGroupIdx] = useState(initialGroupIndex);
  const [currentStatusIdx, setCurrentStatusIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySentFeedback, setReplySentFeedback] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<any>(null);

  // Current active group and status item
  const currentGroup = statusGroups[currentGroupIdx];
  const currentStatus: StatusItem | undefined = currentGroup?.statuses[currentStatusIdx];

  // Sync initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentGroupIdx(initialGroupIndex);
      setCurrentStatusIdx(0);
      setProgress(0);
      setIsPaused(false);
    }
  }, [isOpen, initialGroupIndex]);

  // Mark status as viewed
  useEffect(() => {
    if (isOpen && currentStatus && onMarkStatusViewed) {
      onMarkStatusViewed(currentStatus.id);
    }
  }, [isOpen, currentStatus, onMarkStatusViewed]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(p => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentGroupIdx, currentStatusIdx, statusGroups]);

  // Progress timer for images (5 seconds) or video sync
  useEffect(() => {
    if (!isOpen || !currentStatus || isPaused) return;

    if (currentStatus.mediaType === 'image' || currentStatus.mediaType === 'text') {
      const stepMs = 50;
      const totalDuration = currentStatus.mediaType === 'text' ? 7000 : 5000;
      const increment = (stepMs / totalDuration) * 100;

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timerRef.current);
            handleNext();
            return 0;
          }
          return prev + increment;
        });
      }, stepMs);

      return () => clearInterval(timerRef.current);
    } else if (currentStatus.mediaType === 'video') {
      // Handled via video timeupdate listener
      return;
    }
  }, [isOpen, currentStatus, isPaused, currentGroupIdx, currentStatusIdx]);

  const handleNext = () => {
    setProgress(0);
    if (!currentGroup) return;

    if (currentStatusIdx < currentGroup.statuses.length - 1) {
      // Next status in same group
      setCurrentStatusIdx(prev => prev + 1);
    } else if (currentGroupIdx < statusGroups.length - 1) {
      // Next user group
      setCurrentGroupIdx(prev => prev + 1);
      setCurrentStatusIdx(0);
    } else {
      // Finished all statuses
      onClose();
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (currentStatusIdx > 0) {
      setCurrentStatusIdx(prev => prev - 1);
    } else if (currentGroupIdx > 0) {
      const prevGroup = statusGroups[currentGroupIdx - 1];
      setCurrentGroupIdx(prev => prev - 1);
      setCurrentStatusIdx(prevGroup ? prevGroup.statuses.length - 1 : 0);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && currentStatus?.mediaType === 'video') {
      const { currentTime, duration } = videoRef.current;
      if (duration > 0) {
        setProgress((currentTime / duration) * 100);
      }
    }
  };

  const handleVideoEnded = () => {
    handleNext();
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentGroup) return;

    if (onReplyToStatus) {
      onReplyToStatus(currentGroup.userPhone, `💬 Em resposta ao seu status: "${replyText.trim()}"`);
    }

    setReplyText('');
    setReplySentFeedback(true);
    setTimeout(() => setReplySentFeedback(false), 2000);
  };

  const formatTimeAgo = (timestamp: number) => {
    const diffMin = Math.floor((Date.now() - timestamp) / (1000 * 60));
    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `Há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Há ${diffHours}h`;
    return 'Ontem';
  };

  if (!isOpen || !currentGroup || !currentStatus) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-2 sm:p-4 select-none animate-in fade-in duration-200"
      id="statusViewerModal"
    >
      {/* Central Story Card (Instagram / WhatsApp styled) */}
      <div className="relative w-full max-w-[440px] h-full max-h-[92vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10 my-auto">
        
        {/* Top Segment Progress Bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {currentGroup.statuses.map((item, idx) => {
            let barWidth = '0%';
            if (idx < currentStatusIdx) {
              barWidth = '100%';
            } else if (idx === currentStatusIdx) {
              barWidth = `${progress}%`;
            }

            return (
              <div key={item.id} className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-75 ease-linear"
                  style={{ width: barWidth }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header Information */}
        <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center gap-2.5">
            {/* User Avatar */}
            {currentGroup.photoURL ? (
              <img 
                src={currentGroup.photoURL} 
                alt={currentGroup.userName} 
                className="w-10 h-10 rounded-full object-cover border-2 border-cyan-400/80 shadow-md"
              />
            ) : (
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm border-2 border-cyan-400/80 shadow-md"
                style={{ backgroundColor: currentGroup.avatarColor }}
              >
                {currentGroup.userName.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-white leading-none truncate max-w-[180px] sm:max-w-[220px]">
                {currentGroup.isMe ? 'Meu status' : currentGroup.userName}
              </p>
              <p className="text-[11px] text-white/75 mt-0.5 font-medium">
                {formatTimeAgo(currentStatus.timestamp)}
              </p>
            </div>
          </div>

          {/* Action buttons (Play/Pause, Sound, Close) */}
          <div className="flex items-center gap-1">
            {currentStatus.mediaType === 'video' && (
              <button
                type="button"
                onClick={() => setIsMuted(m => !m)}
                className="p-2 rounded-full hover:bg-black/30 text-white transition cursor-pointer"
                title={isMuted ? 'Ativar som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPaused(p => !p)}
              className="p-2 rounded-full hover:bg-black/30 text-white transition cursor-pointer"
              title={isPaused ? 'Reproduzir' : 'Pausar'}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/30 text-white transition cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Media Container with Left/Right Click Navigators */}
        <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden">
          {/* Left Click Area (Prev) */}
          <div 
            className="absolute left-0 top-16 bottom-20 w-1/3 z-20 cursor-pointer"
            onClick={handlePrev}
            title="Status anterior"
          />

          {/* Right Click Area (Next) */}
          <div 
            className="absolute right-0 top-16 bottom-20 w-1/3 z-20 cursor-pointer"
            onClick={handleNext}
            title="Próximo status"
          />

          {/* Center Pause/Resume on Click */}
          <div 
            className="absolute left-1/3 right-1/3 top-16 bottom-20 z-10 cursor-pointer"
            onClick={() => setIsPaused(p => !p)}
          />

          {/* Render Text Card, Video, or Image */}
          {currentStatus.mediaType === 'text' ? (
            <div className="w-full h-full flex items-center justify-center p-4 sm:p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
              <TextStatusCard status={currentStatus} showExpiration />
            </div>
          ) : currentStatus.mediaType === 'video' ? (
            <video
              ref={videoRef}
              src={currentStatus.mediaUrl}
              autoPlay
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              className="w-full h-full object-contain"
            />
          ) : (
            <img 
              src={currentStatus.mediaUrl} 
              alt={currentStatus.caption || 'Status'} 
              className="w-full h-full object-contain"
            />
          )}

          {/* Navigation Chevron Badges for Desktop */}
          {currentStatusIdx > 0 || currentGroupIdx > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-sm cursor-pointer border border-white/15"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-sm cursor-pointer border border-white/15"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Caption & Reply Bar */}
        <div className="relative z-30 bg-gradient-to-t from-black via-black/80 to-transparent p-4 flex flex-col gap-2">
          {/* Caption */}
          {currentStatus.caption && (
            <div className="text-center px-4 py-1.5 rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 text-white text-sm font-medium">
              {currentStatus.caption}
            </div>
          )}

          {/* Reply feedback toast */}
          {replySentFeedback && (
            <div className="text-center text-xs font-bold text-emerald-400 py-1 animate-in fade-in duration-150">
              ✓ Resposta enviada para {currentGroup.userName}!
            </div>
          )}

          {/* Reply Input (if not own status) */}
          {!currentGroup.isMe ? (
            <form onSubmit={handleSendReply} className="flex items-center gap-2 mt-1">
              <input 
                type="text" 
                placeholder={`Responder a ${currentGroup.userName}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-xs sm:text-sm text-white placeholder-white/50 focus:outline-none focus:border-cyan-400 transition"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-bold flex items-center justify-center disabled:opacity-40 transition-opacity cursor-pointer flex-shrink-0 shadow-md shadow-cyan-500/25"
                title="Enviar resposta"
              >
                <Send className="w-4 h-4 fill-slate-950 stroke-[2]" />
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2 py-1 text-xs text-cyan-200/80 font-medium">
              <Eye className="w-3.5 h-3.5" />
              <span>Seu status visível para contatos da Tribbu</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
