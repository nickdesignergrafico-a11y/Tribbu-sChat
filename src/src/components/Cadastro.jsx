import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Camera, Upload, Trash2, User, Phone, CheckCircle2, Sparkles, MessageSquare, ArrowLeft } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import CameraCaptureModal from './CameraCaptureModal';
import { resizeAndCompressImage } from '../utils/imageUtils';
import { uploadProfilePhoto } from '../services/storageService';
import { useBranding } from '../context/BrandingContext';
import { isUserProfileComplete } from '../types';

export const AVATAR_COLORS = [
  '#06B6D4', // cyan-500
  '#10B981', // emerald-500
  '#3B82F6', // blue-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#F59E0B', // amber-500
  '#14B8A6', // teal-500
  '#6366F1'  // indigo-500
];

export default function Cadastro({ user, onComplete, onNavigate, onCancel }) {
  // Resolve current authenticated or pending user
  const currentUser = auth.currentUser;
  let storedPending = null;
  if (typeof window !== 'undefined') {
    try {
      const s = sessionStorage.getItem('tribbu_pending_user');
      if (s) storedPending = JSON.parse(s);
    } catch (_) {}
  }
  const storedPhone = typeof window !== 'undefined' ? (localStorage.getItem('tribbu_pending_phone') || '') : '';
  const effectiveUser = user || storedPending || currentUser;
  const initialPhone = effectiveUser?.phoneNumber || currentUser?.phoneNumber || storedPhone || (currentUser?.email?.includes('@zapchat.phone') ? ('+' + currentUser.email.replace('@zapchat.phone', '')) : '') || '';
  const initialUid = effectiveUser?.uid || currentUser?.uid || '';
  const rawDisplayName = effectiveUser?.displayName || currentUser?.displayName || '';
  const cleanInitialName = isUserProfileComplete({ displayName: rawDisplayName, phoneNumber: initialPhone }) ? rawDisplayName : '';

  const [displayName, setDisplayName] = useState(cleanInitialName);
  const [phone, setPhone] = useState(initialPhone);
  const [about, setAbout] = useState('Disponível na Tribbu');
  const [photoURL, setPhotoURL] = useState(effectiveUser?.photoURL || currentUser?.photoURL || null);
  const [selectedColor, setSelectedColor] = useState(() => {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  });
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { logoUrl } = useBranding();
  const fileInputRef = useRef(null);

  // Sync with auth user if not provided via props
  useEffect(() => {
    if (!initialPhone && auth.currentUser?.phoneNumber) {
      setPhone(auth.currentUser.phoneNumber);
    }
  }, [initialPhone]);

  // Dynamic initial calculation according to entities.json specification:
  // initial: first letter of displayName uppercase
  const trimmedName = displayName.trim();
  const calculatedInitial = (trimmedName.charAt(0) || 'U').toUpperCase();
  const dynamicAvatarColor = selectedColor || AVATAR_COLORS[(calculatedInitial.charCodeAt(0) || 0) % AVATAR_COLORS.length];

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await resizeAndCompressImage(file, 400, 400, 0.85);
        setPhotoURL(compressed);
        setError('');
      } catch {
        setError('Não foi possível processar a foto. Tente selecionar outra imagem.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!trimmedName) {
      setError('Por favor, informe seu Nome de Exibição.');
      return;
    }

    setIsSubmitting(true);

    try {
      const activeUser = auth.currentUser;
      const targetUid = activeUser?.uid || user?.uid || initialUid;

      if (!targetUid) {
        setError('Por favor, faça a validação do seu número por SMS no login antes de criar o perfil.');
        setIsSubmitting(false);
        return;
      }

      const cleanPhone = activeUser?.phoneNumber || phone || user?.phoneNumber || '+5511999999999';

      // 1. Upload foto de perfil para o Firebase Storage se o usuário escolheu uma imagem
      let finalPhotoURL = null;
      if (photoURL) {
        try {
          finalPhotoURL = await uploadProfilePhoto(targetUid, photoURL);
        } catch (storageErr) {
          console.warn('[Cadastro] Falha no upload ao Firebase Storage, usando representação inline:', storageErr);
          finalPhotoURL = photoURL;
        }
      }

      // 2. Conforme entities.json:
      // Se o usuário não escolher foto, aplica a regra automática gerando as iniciais e avatarColor
      const finalInitial = calculatedInitial;
      const finalAvatarColor = dynamicAvatarColor;
      const nowTimestamp = Date.now();
      const nowIso = new Date().toISOString();

      // 3. Atualiza Firebase Auth Profile
      if (activeUser) {
        try {
          await updateProfile(activeUser, {
            displayName: trimmedName,
            photoURL: finalPhotoURL || undefined
          });
        } catch (authErr) {
          console.warn('[Cadastro] Erro ao atualizar profile auth:', authErr);
        }
      }

      // 4. Grava dados do novo usuário no Firestore (vinculando ao phoneNumber autenticado)
      const userProfileData = {
        uid: targetUid,
        phoneNumber: cleanPhone,
        displayName: trimmedName,
        avatarColor: finalAvatarColor,
        initial: finalInitial,
        photoURL: finalPhotoURL || null,
        about: about.trim() || 'Disponível na Tribbu',
        lastSeen: nowTimestamp,
        isOnline: true,
        profileCompleted: true,
        createdAt: nowIso
      };

      const userDocRef = doc(db, 'users', targetUid);
      await setDoc(userDocRef, userProfileData, { merge: true });

      // Sincroniza com API backend se disponível
      let serverToken = '';
      try {
        const res = await fetch('/api/auth/phone-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: cleanPhone,
            displayName: trimmedName
          })
        });
        if (res.ok) {
          const data = await res.json();
          serverToken = data.token;
        }
      } catch (_) {}

      const idToken = serverToken || (activeUser ? await activeUser.getIdToken() : `token_${targetUid}`);

      const session = {
        uid: targetUid,
        phoneNumber: cleanPhone,
        displayName: trimmedName,
        initial: finalInitial,
        avatarColor: finalAvatarColor,
        photoURL: finalPhotoURL || undefined,
        about: about.trim() || 'Disponível na Tribbu',
        email: user?.email || activeUser?.email || undefined,
        profileCompleted: true
      };

      // Grava no localStorage para consistência imediata
      try {
        localStorage.setItem('zapchat_user', JSON.stringify(session));
        localStorage.setItem('zapchat_token', idToken);
      } catch (_) {}

      // 5. Navega para o chat principal (/chat)
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('tribbu_pending_user');
          localStorage.removeItem('tribbu_pending_phone');
        } catch (_) {}
        window.history.pushState(null, '', '/chat');
        window.dispatchEvent(new Event('popstate'));
        window.dispatchEvent(new CustomEvent('app-route-change', { detail: '/chat' }));
      }

      if (onComplete) {
        onComplete(session, idToken);
      }

      if (onNavigate) {
        onNavigate('/chat');
      }

    } catch (err) {
      console.error('[Cadastro] Erro ao salvar cadastro no Firestore:', err);
      setError(err?.message || 'Erro ao salvar os dados do perfil. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  const displayPhone = phone || user?.phoneNumber || currentUser?.phoneNumber || '';

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-slate-950 p-4 selection:bg-cyan-500/20 relative overflow-hidden font-sans">
      {/* Mesh Gradient Glows - Fundo Escuro com Detalhes Ciano Neon */}
      <div className="absolute -top-24 -left-24 w-[460px] h-[460px] bg-cyan-500/15 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-[440px] bg-slate-900/85 rounded-3xl border border-cyan-500/25 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 text-white/90 z-10 relative shadow-cyan-950/70"
        id="cadastroScreen"
      >
        {/* Topo com a Logo Oficial Vertical */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-full max-w-[220px] mx-auto mb-3 flex items-center justify-center">
            <img
              src={logoUrl || '/icon/logo_oficial.png'}
              alt="Tribbu'sChat"
              className="w-full h-auto max-h-[70px] object-contain drop-shadow-[0_4px_20px_rgba(6,182,212,0.35)]"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target;
                if (target && !target.src.includes('/icon/logo_oficial.png')) {
                  target.src = '/icon/logo_oficial.png';
                }
              }}
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-semibold mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Criar Perfil na Tribbu</span>
          </div>

          {displayPhone ? (
            <div className="flex items-center gap-1.5 text-xs text-white/60 font-mono">
              <Phone className="w-3.5 h-3.5 text-cyan-400" />
              <span>{displayPhone}</span>
            </div>
          ) : null}

          <h2 className="text-xl font-black text-white mt-2 text-center tracking-tight">
            Cadastro de Perfil
          </h2>
          <p className="text-xs text-cyan-200/70 text-center mt-1">
            Escolha sua foto e digite seu nome de exibição
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border-l-4 border-red-500 rounded-xl text-xs text-red-200 font-medium animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Botão circular estilizado para upload da Foto de Perfil integrado ao Firebase Storage */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="relative group">
              {photoURL ? (
                /* Foto selecionada com borda em degradê ciano/esmeralda */
                <div className="w-28 h-28 rounded-full p-[2.5px] bg-gradient-to-tr from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_30px_rgba(6,182,212,0.4)] relative">
                  <div className="w-full h-full rounded-full overflow-hidden relative">
                    <img
                      src={photoURL}
                      alt="Foto de perfil selecionada"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoURL(null)}
                      className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-red-400 hover:text-red-300 cursor-pointer"
                      title="Remover foto de perfil"
                    >
                      <Trash2 className="w-7 h-7" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Botão circular estilizado com regra automática do entities.json gerando as iniciais */
                <div 
                  id="btnUploadFotoCirculo"
                  className="w-28 h-28 rounded-full p-[3px] bg-gradient-to-tr from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_28px_rgba(6,182,212,0.35)] relative cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  title="Clique para fazer upload da sua foto de perfil"
                >
                  <div 
                    className="w-full h-full rounded-full flex items-center justify-center text-white font-black text-3xl select-none transition-transform group-hover:scale-105"
                    style={{ backgroundColor: dynamicAvatarColor }}
                  >
                    {trimmedName ? calculatedInitial : <User className="w-12 h-12 text-white/80" />}
                  </div>

                  {/* Badge indicadora de câmera/upload no canto do círculo */}
                  <div className="absolute bottom-0 right-0 p-2 rounded-full bg-cyan-500 group-hover:bg-cyan-400 text-slate-950 shadow-md transition-transform group-hover:scale-110 flex items-center justify-center border-2 border-slate-900">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>

            {/* Ações de Foto */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                Tirar Selfie
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                Upload Foto
              </button>

              {photoURL && (
                <button
                  type="button"
                  onClick={() => setPhotoURL(null)}
                  className="p-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs transition-colors cursor-pointer"
                  title="Remover foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Regra automática do entities.json quando não houver foto */}
            {!photoURL ? (
              <p className="text-[11px] text-cyan-200/70 text-center flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                <span>Sem foto? As <strong>iniciais e cor oficial</strong> são geradas automaticamente.</span>
              </p>
            ) : (
              <p className="text-[11px] text-emerald-300/80 text-center">
                ✓ Foto integrada ao Firebase Storage.
              </p>
            )}

            {/* Seletor de cores do avatar para o caso sem foto */}
            {!photoURL && (
              <div className="pt-1 flex items-center gap-1.5">
                <span className="text-[10px] text-white/50 mr-1">Cor do avatar:</span>
                {AVATAR_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setSelectedColor(col)}
                    className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                      dynamicAvatarColor === col ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900' : 'hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col }}
                    title={`Selecionar cor ${col}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Input arredondado para digitar o 'Nome de Exibição' */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label 
                id="displayNameLabel" 
                htmlFor="displayNameInput" 
                className="text-xs font-bold text-white/90 block"
              >
                Nome de Exibição <span className="text-cyan-400">*</span>
              </label>
              <span className="text-[10px] text-cyan-300/70 font-mono">Obrigatório</span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-cyan-400">
                <User className="w-4 h-4" />
              </span>
              <input
                id="displayNameInput"
                type="text"
                required
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Digite seu Nome de Exibição"
                maxLength={40}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/60 transition-all font-medium"
              />
            </div>
            <p className="text-[10px] text-white/40">
              Este é o nome com o qual as pessoas vão te ver na Tribbu.
            </p>
          </div>

          {/* Recado Opcional */}
          <div className="space-y-1.5">
            <label 
              id="aboutLabel" 
              htmlFor="aboutInput" 
              className="text-xs font-semibold text-white/70 block"
            >
              Recado / Bio (opcional)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/40">
                <MessageSquare className="w-4 h-4" />
              </span>
              <input
                id="aboutInput"
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Ex: Disponível na Tribbu"
                maxLength={80}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/50 transition-all"
              />
            </div>
          </div>

          {/* Botão em degradê ciano escrito 'Entrar na Tribbu' */}
          <button
            id="btnEntrarTribbu"
            type="submit"
            disabled={isSubmitting || !trimmedName}
            className="w-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:via-teal-300 hover:to-emerald-300 text-slate-950 py-3.5 rounded-xl font-black text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Salvando Perfil...</span>
              </>
            ) : (
              <span>Entrar na Tribbu</span>
            )}
          </button>

          {/* Opção de voltar se necessário */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                if (onCancel) {
                  onCancel();
                } else if (onNavigate) {
                  onNavigate('/login');
                } else if (typeof window !== 'undefined') {
                  window.history.pushState(null, '', '/login');
                  window.location.reload();
                }
              }}
              className="text-xs text-white/40 hover:text-white/80 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Voltar para tela de login</span>
            </button>
          </div>
        </form>
      </motion.div>

      {/* Selfie Camera Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => {
          setPhotoURL(dataUrl);
          setError('');
        }}
        title="Tirar Foto de Perfil"
        isSelfie={true}
      />
    </div>
  );
}
