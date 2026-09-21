import React, { useState, useRef } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Trash2, 
  User, 
  Phone,
  Bell, 
  Moon, 
  ShieldCheck, 
  Check, 
  LogOut,
  Smartphone,
  RotateCcw
} from 'lucide-react';
import { UserSession } from '../types';
import CameraCaptureModal from './CameraCaptureModal';
import { resizeAndCompressImage } from '../utils/imageUtils';
import { formatPhoneDisplay } from './LoginScreen';
import { useBranding } from '../context/BrandingContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserSession;
  onUpdateProfile: (updated: Partial<UserSession>) => Promise<void>;
  onLogout: () => void;
  onInstallPwa?: () => void;
  canInstall?: boolean;
}

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  onUpdateProfile,
  onLogout,
  onInstallPwa,
  canInstall
}: SettingsModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName || user.phoneNumber || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [photoURL, setPhotoURL] = useState<string | null>(user.photoURL || null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [logoUploadSuccess, setLogoUploadSuccess] = useState(false);

  const { logoUrl, updateLogo, isUpdatingLogo, resetLogo } = useBranding();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await updateLogo(file, user.phoneNumber);
      if (res.success) {
        setLogoUploadSuccess(true);
        setTimeout(() => setLogoUploadSuccess(false), 5000);
      } else {
        alert(res.message || 'Erro ao salvar logotipo');
      }
    } catch (err: any) {
      alert('Erro ao enviar imagem: ' + (err.message || 'Erro interno'));
    }
  };

  const handleMobileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await resizeAndCompressImage(file, 400, 400, 0.85);
        setPhotoURL(compressed);
      } catch (err) {
        alert('Erro ao carregar a imagem. Tente outro arquivo.');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      await onUpdateProfile({
        displayName: displayName.trim() || user.phoneNumber,
        phoneNumber: phoneNumber.trim() || user.phoneNumber,
        photoURL: photoURL || undefined
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 800);
    } catch {
      // Graceful fallback
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-white max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <h3 className="font-bold text-lg text-white">Configurações</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Profile Photo Section */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="relative group">
              {photoURL ? (
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-cyan-400 shadow-xl shadow-cyan-500/20 relative">
                  <img 
                    src={photoURL} 
                    alt="Foto de Perfil" 
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoURL(null)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-rose-400 cursor-pointer"
                    title="Remover foto"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div 
                  className="w-24 h-24 rounded-full flex items-center justify-center text-slate-950 font-bold text-3xl shadow-xl relative border-2 border-white/20"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.initial}
                </div>
              )}
            </div>

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Tirar Selfie
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Carregar do Celular
              </button>

              {photoURL && (
                <button
                  type="button"
                  onClick={() => setPhotoURL(null)}
                  className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors cursor-pointer"
                  title="Remover foto atual"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMobileUpload}
              />
            </div>
            <p className="text-[11px] text-white/40 text-center">
              Esta foto aparecerá nas conversas, status e grupos
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                Nome no Tribbu'sChat
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome visível"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>

            {/* Cell Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" />
                  Número de Celular / Chip (Tribbu'sChat)
                </span>
                <span className="text-[10px] text-white/40">Identificador da Conta</span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneDisplay(e.target.value))}
                placeholder="+55 (11) 99999-9999"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 font-mono"
              />
            </div>

            {/* Preferences */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-white/60" />
                  <span className="text-xs text-white/80">Sons de notificação</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={soundEnabled} 
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-white/80">Criptografia de ponta a ponta</span>
                </div>
                <span className="text-[10px] text-cyan-300 font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">Ativa</span>
              </div>
            </div>

            {/* Brand Official Logo - Nuvem Persistente */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Logotipo Oficial da Marca
                  </h4>
                  <p className="text-[10px] text-cyan-200/70">
                    Logotipo oficial estático do Tribbu'sChat
                  </p>
                </div>
              </div>

              {/* Preview of Official Logo */}
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-cyan-500/20 flex items-center justify-center">
                <img
                  src={logoUrl}
                  alt="Tribbu'sChat - Logotipo Oficial"
                  className="max-h-20 w-auto object-contain drop-shadow-[0_4px_16px_rgba(6,182,212,0.35)]"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('/icon/logo_oficial.png')) {
                      target.src = '/icon/logo_oficial.png';
                    }
                  }}
                />
              </div>
              {logoUploadSuccess && (
                <p className="text-[11px] text-emerald-400 font-semibold text-center animate-pulse">
                  ✓ Logotipo salvo com sucesso e sincronizado permanentemente!
                </p>
              )}
            </div>

            {/* App Installation */}
            {canInstall && (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-xs font-semibold text-cyan-300">Instalar no Celular</p>
                    <p className="text-[10px] text-white/50">Acesso rápido como app nativo</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onInstallPwa) onInstallPwa();
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  Instalar
                </button>
              </div>
            )}

            {/* Submit / Save */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 disabled:opacity-50"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  Salvo com Sucesso!
                </>
              ) : isSaving ? (
                'Salvando...'
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </form>

          {/* Logout Section */}
          <div className="pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                if (confirm('Deseja realmente sair da sua conta?')) {
                  onLogout();
                  onClose();
                }
              }}
              className="w-full py-2 px-3 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta (Logout)
            </button>
          </div>
        </div>
      </div>

      {/* Camera modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => {
          setPhotoURL(dataUrl);
        }}
        title="Tirar Foto do Perfil"
        isSelfie={true}
      />
    </div>
  );
}
