import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, Check, X, Upload, AlertCircle } from 'lucide-react';
import { resizeAndCompressImage } from '../utils/imageUtils';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string) => void;
  title?: string;
  isSelfie?: boolean;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title = 'Tirar Foto',
  isSelfie = true,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(isSelfie ? 'user' : 'environment');
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  // Check if multiple camera devices exist
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      if (videoDevices.length > 1) {
        setHasMultipleCameras(true);
      }
    }).catch(() => {});
  }, []);

  // Start camera stream when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPhoto(null);
      setError(null);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async (mode: 'user' | 'environment') => {
    stopCamera();
    setError(null);
    setIsCameraActive(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Acesso à câmera não é suportado pelo seu navegador.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      let msg = 'Não foi possível acessar a câmera do dispositivo.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão para usar a câmera foi negada. Permita o acesso ou envie uma foto do celular.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera encontrada no dispositivo. Você pode enviar uma foto da sua galeria.';
      }
      setError(msg);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    // Crop to square for profile photo / avatar
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front camera/selfie mode for natural mirror preview
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    // Compress using utility
    canvas.toBlob(async (blob) => {
      if (blob) {
        try {
          const compressed = await resizeAndCompressImage(blob, 400, 400, 0.85);
          setCapturedPhoto(compressed);
          stopCamera();
        } catch (_) {
          const fallback = canvas.toDataURL('image/jpeg', 0.85);
          setCapturedPhoto(fallback);
          stopCamera();
        }
      }
    }, 'image/jpeg', 0.9);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await resizeAndCompressImage(file, 400, 400, 0.85);
        setCapturedPhoto(compressed);
        stopCamera();
      } catch (err) {
        setError('Não foi possível carregar a imagem selecionada.');
      }
    }
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera(facingMode);
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-base">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          {capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Foto Capturada"
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${!isCameraActive ? 'hidden' : ''}`}
              />

              {/* Viewfinder guide circle */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-3/4 h-3/4 rounded-full border-2 border-dashed border-cyan-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
                </div>
              )}

              {/* Loading / Error overlay */}
              {!isCameraActive && !error && (
                <div className="flex flex-col items-center gap-2 text-white/60 p-4 text-center">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs">Iniciando câmera...</p>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center gap-3 text-white/70 p-6 text-center">
                  <AlertCircle className="w-10 h-10 text-amber-400" />
                  <p className="text-xs leading-relaxed">{error}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-xl text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-md shadow-cyan-500/25"
                  >
                    <Upload className="w-4 h-4" />
                    Escolher da Galeria / Celular
                  </button>
                </div>
              )}
            </>
          )}

          {/* Hidden File Input for mobile upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Controls footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between gap-3">
          {capturedPhoto ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tirar Outra
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Usar Esta Foto
              </button>
            </>
          ) : (
            <>
              {/* Option to upload from gallery */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Carregar foto do dispositivo"
              >
                <Upload className="w-5 h-5" />
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                disabled={!isCameraActive}
                onClick={handleTakeSnapshot}
                className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center p-1 cursor-pointer shadow-lg shadow-cyan-500/30"
                title="Tirar foto"
              >
                <div className="w-13 h-13 rounded-full border-2 border-slate-900 bg-white" />
              </button>

              {/* Flip camera button */}
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-3 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Trocar câmera (Frontal / Traseira)"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
