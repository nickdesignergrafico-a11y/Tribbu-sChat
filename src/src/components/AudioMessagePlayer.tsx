import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface AudioMessagePlayerProps {
  mediaUrl: string;
  isMe?: boolean;
  senderPhotoURL?: string;
  senderName?: string;
  senderAvatarColor?: string;
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({
  mediaUrl,
  isMe,
  senderPhotoURL,
  senderName,
  senderAvatarColor = '#06B6D4'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(mediaUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [mediaUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const initial = (senderName || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3 py-1.5 px-1 min-w-[240px] sm:min-w-[280px] max-w-full select-none">
      {/* Sender Avatar / Photo with Mic badge */}
      <div className="relative flex-shrink-0">
        <div 
          className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center border border-white/20 shadow-md"
          style={{ backgroundColor: senderAvatarColor }}
        >
          {senderPhotoURL ? (
            <img 
              src={senderPhotoURL} 
              alt={senderName || 'Foto do usuário'} 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-white font-bold text-sm tracking-wider">
              {initial}
            </span>
          )}
        </div>
        {/* Neon cyan microphone badge on avatar */}
        <span 
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-slate-900 border border-cyan-400 flex items-center justify-center shadow-[0_0_6px_rgba(6,182,212,0.9)]"
          title="Mensagem de voz"
        >
          <Mic className="w-2.5 h-2.5 text-cyan-300 stroke-[2.5]" />
        </span>
      </div>

      {/* Play / Pause Button in Dark Mode with Neon Cyan glow */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md flex-shrink-0 active:scale-95 ${
          isMe
            ? 'bg-slate-950 text-cyan-400 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.35)] hover:border-cyan-300 hover:text-cyan-300'
            : 'bg-slate-900 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.4)] hover:bg-slate-850 hover:text-cyan-200'
        }`}
        title={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current stroke-[2.5]" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5 stroke-[2.5]" />
        )}
      </button>

      {/* Waveform & Continuous Progress Bar Slider */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div className="relative flex flex-col justify-center w-full group">
          {/* Simulated Waveform Bars */}
          <div className="w-full flex items-center gap-[2px] sm:gap-1 h-5 px-0.5">
            {[35, 65, 30, 85, 55, 95, 40, 75, 50, 70, 90, 30, 60, 80, 40, 85, 50, 70, 45, 80].map((height, i) => {
              const barProgress = (i / 20) * 100;
              const isFilled = progressPercent >= barProgress;
              return (
                <span
                  key={i}
                  className={`flex-1 rounded-full transition-colors duration-150 ${
                    isFilled
                      ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.7)]'
                      : 'bg-white/20'
                  }`}
                  style={{ height: `${Math.max(16, height * 0.22)}px` }}
                />
              );
            })}
          </div>

          {/* Smooth Neon Progress Track Bar */}
          <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden mt-1 border border-white/10 relative">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 rounded-full transition-all duration-100 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>

          {/* Hidden range input for seeking */}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10"
            title="Avançar / Retroceder áudio"
          />
        </div>

        {/* Time display: Current / Total */}
        <div className="flex items-center justify-between text-[11px] font-mono font-medium text-white/70 px-0.5 leading-none">
          <span className="text-cyan-400 font-semibold">{formatTime(currentTime)}</span>
          <span className="text-white/40">{formatTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
};
