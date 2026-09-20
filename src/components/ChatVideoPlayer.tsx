import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Download } from 'lucide-react';

interface ChatVideoPlayerProps {
  mediaUrl: string;
  fileName?: string;
  fileSize?: string;
  isMe?: boolean;
}

export const ChatVideoPlayer: React.FC<ChatVideoPlayerProps> = ({
  mediaUrl,
  fileName,
  fileSize
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<any>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Video play error:', err);
      });
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = fileName || 'video.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isHovered) {
          setShowControls(false);
        }
      }, 2500);
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5 my-1 select-none">
      <div 
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden border border-cyan-500/30 bg-black shadow-lg group max-w-full cursor-pointer"
        onClick={() => togglePlay()}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (isPlaying) setShowControls(false);
        }}
      >
        {/* HTML5 Video Element */}
        <video
          ref={videoRef}
          src={mediaUrl}
          playsInline
          preload="metadata"
          className="w-full max-h-80 rounded-2xl bg-black object-contain block"
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
          }}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
            setShowControls(true);
          }}
        />

        {/* CUSTOM CYAN PLAY BUTTON (Prominent Center Overlay) */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-all duration-200">
            <button
              type="button"
              onClick={togglePlay}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-950/85 border-2 border-cyan-400 text-cyan-300 shadow-[0_0_24px_rgba(6,182,212,0.65)] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 hover:border-cyan-300 hover:shadow-[0_0_32px_rgba(6,182,212,0.9)] cursor-pointer group/btn"
              title="Reproduzir vídeo"
            >
              <Play className="w-7 h-7 fill-cyan-400 text-cyan-400 ml-1 transition-transform group-hover/btn:scale-110" />
            </button>
          </div>
        )}

        {/* TOP OVERLAY BAR (Filename & Download) */}
        <div 
          className={`absolute top-0 left-0 right-0 p-2.5 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white transition-opacity duration-200 z-20 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs font-semibold text-white/90 truncate max-w-[200px] sm:max-w-xs drop-shadow">
            {fileName || 'Vídeo'}
          </span>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-full bg-slate-900/80 text-white/80 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer border border-white/10"
            title="Baixar vídeo"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* BOTTOM INTEGRATED CONTROL BAR */}
        <div 
          className={`absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-1.5 transition-opacity duration-200 z-20 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Custom Cyan Progress Bar Slider */}
          <div className="relative flex items-center w-full group/slider">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer focus:outline-none accent-cyan-400"
              style={{
                background: `linear-gradient(to right, #06b6d4 0%, #10b981 ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`
              }}
            />
          </div>

          {/* Bottom Controls Row */}
          <div className="flex items-center justify-between text-xs text-white">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1 rounded-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-cyan-400" />
                ) : (
                  <Play className="w-4 h-4 fill-cyan-400 ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded-full text-white/70 hover:text-white transition cursor-pointer"
                title={isMuted ? 'Ativar som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <span className="text-[11px] font-mono text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1 rounded-full text-white/70 hover:text-cyan-400 transition cursor-pointer"
                title="Tela cheia"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info under Video */}
      <div className="flex items-center justify-between px-1 text-[11px] text-white/60">
        <span className="truncate max-w-[200px] text-cyan-400/90 font-medium">
          {fileName || 'Vídeo compartilhado'}
        </span>
        {fileSize && <span className="font-mono text-[10px] text-white/50">{fileSize}</span>}
      </div>
    </div>
  );
};
