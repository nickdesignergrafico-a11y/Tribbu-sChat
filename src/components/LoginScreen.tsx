import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, Phone, CheckCircle2, RotateCcw, Upload, ChevronDown } from 'lucide-react';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserSession, isUserProfileComplete } from '../types';
import Cadastro from './Cadastro.jsx';
import { useBranding } from '../context/BrandingContext';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession, token: string) => void;
  onNavigateToCadastro?: (pendingUser: any) => void;
}

const AVATAR_COLORS = [
  '#06B6D4', '#0891B2', '#00E5FF', '#10B981', '#059669',
  '#14B8A6', '#0284C7', '#3B82F6', '#6366F1', '#F59E0B'
];

export const COUNTRY_CODES = [
  { code: '+55', name: 'Brasil', flag: '🇧🇷' },
  { code: '+1', name: 'Estados Unidos / Canadá', flag: '🇺🇸' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: '+34', name: 'Espanha', flag: '🇪🇸' },
  { code: '+44', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '+49', name: 'Alemanha', flag: '🇩🇪' },
  { code: '+33', name: 'França', flag: '🇫🇷' },
  { code: '+39', name: 'Itália', flag: '🇮🇹' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+595', name: 'Paraguai', flag: '🇵🇾' },
  { code: '+598', name: 'Uruguai', flag: '🇺🇾' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: '+57', name: 'Colômbia', flag: '🇨🇴' },
  { code: '+52', name: 'México', flag: '🇲🇽' },
  { code: '+81', name: 'Japão', flag: '🇯🇵' },
  { code: '+244', name: 'Angola', flag: '🇦🇴' },
  { code: '+258', name: 'Moçambique', flag: '🇲🇿' },
];

/**
 * Format raw local user input into phone representation: e.g. (11) 99999-9999 or (63) 99262-4090
 */
export function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Combines DDI + local phone digits into strict international E.164 format: e.g. +5563992624090
 */
export function buildFullPhoneNumber(countryCode: string, phone: string): string {
  const cleanCode = countryCode.trim().startsWith('+') ? countryCode.trim() : `+${countryCode.trim().replace(/\D/g, '')}`;
  const phoneDigits = phone.replace(/\D/g, '');
  const codeDigits = cleanCode.replace(/\D/g, '');

  if (!phoneDigits) return cleanCode;

  // Se o usuário digitou o DDI junto no input local, previne duplicação
  if (phoneDigits.startsWith(codeDigits) && phoneDigits.length > codeDigits.length + 8) {
    return `+${phoneDigits}`;
  }

  return `${cleanCode}${phoneDigits}`;
}

/**
 * Normalizes any phone input into international E.164 format
 */
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (raw.trim().startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  return `+${digits}`;
}

export default function LoginScreen({ onLoginSuccess, onNavigateToCadastro }: LoginScreenProps) {
  const [countryCode, setCountryCode] = useState('+55');
  const [phoneInput, setPhoneInput] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [pendingOnboardingUser, setPendingOnboardingUser] = useState<{
    uid: string;
    phoneNumber?: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logoSuccessMsg, setLogoSuccessMsg] = useState('');

  const { logoUrl, updateLogo, isUpdatingLogo, resetLogo } = useBranding();

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    // Limpa qualquer erro de expiração antigo e reseta o fluxo ao iniciar a tela
    setError('');
    setSuccess('');
    setIsCodeSent(false);
    setSmsCode('');

    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        } catch (_) {}
      }
    };
  }, []);

  const handleOfficialLogoUpload = async (file: File) => {
    if (!file) return;
    setLogoSuccessMsg('');
    try {
      const res = await updateLogo(file);
      if (res.success) {
        setLogoSuccessMsg('✓ Logotipo salvo com sucesso e gravado permanentemente na nuvem!');
        setTimeout(() => setLogoSuccessMsg(''), 6000);
      } else {
        alert(res.message || 'Erro ao atualizar logotipo.');
      }
    } catch (err: any) {
      alert('Falha ao atualizar logotipo: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneInput(formatPhoneDisplay(val));
    if (error) setError('');
  };

  // 1º Clique: Dispara o SMS com signInWithPhoneNumber do Firebase concatenando DDI + Telefone
  const handleSendSms = async () => {
    setError('');
    setSuccess('');

    const cleanPhone = buildFullPhoneNumber(countryCode, phoneInput);
    const localDigits = phoneInput.replace(/\D/g, '');

    // Validação mínima de 10 dígitos locais (DDD + 8 ou 9 números)
    if (localDigits.length < 10) {
      setError('Por favor, insira o número completo com DDD (mínimo 10 dígitos). Ex: (63) 99262-4090');
      return;
    }

    setIsLoading(true);

    try {
      // Limpa qualquer verificador anterior para evitar reutilização de estado expirado
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        } catch (_) {}
      }

      // Configura o verificador reCAPTCHA invisível vinculado ao botão de login
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'sign-in-button', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA resolvido com sucesso
        },
        'expired-callback': () => {
          setError('A validação de segurança expirou. Clique em "Reenviar código" para receber um novo SMS.');
        }
      });

      // Dispara o SMS através do signInWithPhoneNumber do Firebase com o número internacional completo (+55...)
      const confirmation = await signInWithPhoneNumber(auth, cleanPhone, recaptchaVerifierRef.current);
      confirmationResultRef.current = confirmation;
      setIsCodeSent(true);
      setSuccess(`Código SMS enviado para ${cleanPhone}! Digite o código de 6 números abaixo.`);
    } catch (err: any) {
      console.error('Erro no signInWithPhoneNumber do Firebase:', err);
      // Limpa o verificador em caso de falha para permitir nova tentativa
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        } catch (_) {}
      }

      if (err.code === 'auth/invalid-phone-number') {
        setError('Número de telefone inválido no formato internacional. Verifique o código do país e o número digitado.');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('Limite de envio de SMS atingido temporariamente. Aguarde alguns minutos e tente novamente.');
      } else if (err.code === 'auth/captcha-check-failed') {
        setError('Falha na validação de segurança. Tente reenviar o código.');
      } else {
        setError('Não foi possível enviar o código SMS no momento. Verifique os dados digitados e tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2º Clique: Valida o código SMS recebido usando confirmationResult.confirm
  const handleVerifyCode = async () => {
    setError('');
    setSuccess('');

    const cleanCode = smsCode.trim().replace(/\D/g, '');
    if (cleanCode.length < 6) {
      setError('O código de verificação SMS deve conter no mínimo 6 números.');
      return;
    }

    const cleanPhone = buildFullPhoneNumber(countryCode, phoneInput);
    setIsLoading(true);

    try {
      if (!confirmationResultRef.current) {
        setError('Nenhum envio de SMS ativo. Clique primeiro para enviar o código.');
        setIsCodeSent(false);
        setIsLoading(false);
        return;
      }

      // Validação real do código com o Firebase Auth
      const userCredential = await confirmationResultRef.current.confirm(cleanCode);
      const fbUser = userCredential.user;

      if (!fbUser) {
        throw new Error('Falha ao autenticar usuário com o código fornecido.');
      }

      // Consulta protegida com timeout na coleção /users do Firestore para saber se já é cadastrado
      let existingData: any = null;
      try {
        const fetchUserData = async () => {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const existingDoc = await getDoc(userDocRef);
          if (existingDoc.exists()) {
            return existingDoc.data();
          }

          // Se não encontrou pelo UID direto, tenta busca por número de telefone
          try {
            const q = query(collection(db, 'users'), where('phoneNumber', '==', cleanPhone));
            const snap = await getDocs(q);
            if (!snap.empty) {
              return snap.docs[0].data();
            }
          } catch (_) {}

          return null;
        };

        // Timeout seguro de 3.5 segundos para garantir que o usuário nunca fique travado
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
        existingData = await Promise.race([fetchUserData(), timeoutPromise]);
      } catch (firestoreErr) {
        console.warn('Verificação de usuário no Firestore com fallback rápido:', firestoreErr);
      }

      // SE FOR NOVO USUÁRIO (não cadastrado na coleção /users ou com perfil incompleto/sem nome definido):
      // Redireciona imediatamente para a tela de cadastro/criação de perfil (/cadastro)
      const isComplete = isUserProfileComplete(existingData);
      if (!isComplete) {
        setIsLoading(false);
        setSuccess('✓ Número SMS validado com sucesso! Abrindo tela de cadastro...');
        const pendingUser = {
          uid: fbUser.uid,
          phoneNumber: cleanPhone,
          email: fbUser.email || undefined,
          displayName: (existingData?.displayName && isUserProfileComplete(existingData)) ? existingData.displayName : undefined,
          photoURL: existingData?.photoURL || fbUser.photoURL || undefined
        };
        try {
          sessionStorage.setItem('tribbu_pending_user', JSON.stringify(pendingUser));
          localStorage.setItem('tribbu_pending_phone', cleanPhone);
        } catch (_) {}

        if (typeof window !== 'undefined') {
          window.history.pushState(null, '', '/cadastro');
          window.dispatchEvent(new Event('popstate'));
          window.dispatchEvent(new CustomEvent('app-route-change', { detail: '/cadastro' }));
        }
        // Ativa o estado local para renderização imediata do Cadastro no componente
        setPendingOnboardingUser(pendingUser);
        // Notifica o App pai para sincronizar o roteador global
        if (onNavigateToCadastro) {
          onNavigateToCadastro(pendingUser);
        }
        return;
      }

      // USUÁRIO EXISTENTE:
      // Já possui cadastro na coleção /users, redireciona imediatamente para a tela principal do chat (/chat)
      const resolvedDisplayName = existingData.displayName;
      const initial = existingData.initial || (resolvedDisplayName.charAt(0).toUpperCase() || 'U');
      const avatarColor = existingData.avatarColor || AVATAR_COLORS[0];
      const finalPhotoURL = existingData.photoURL || null;

      // Atualiza status online em background sem bloquear a navegação
      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        setDoc(userDocRef, {
          isOnline: true,
          lastSeen: Date.now()
        }, { merge: true }).catch(() => {});
      } catch (_) {}

      // Obtenção rápida de credenciais de sessão
      let idToken = '';
      try {
        idToken = await fbUser.getIdToken();
      } catch (_) {}

      const session: UserSession = {
        uid: fbUser.uid,
        phoneNumber: cleanPhone,
        displayName: resolvedDisplayName,
        initial,
        avatarColor,
        photoURL: finalPhotoURL || undefined,
        about: existingData.about || 'Disponível na Tribbu'
      };

      try {
        localStorage.setItem('zapchat_user', JSON.stringify(session));
        if (idToken) {
          localStorage.setItem('zapchat_token', idToken);
        }
      } catch (_) {}

      // Finaliza o loading imediatamente e executa o redirecionamento para o chat principal
      setIsLoading(false);
      setSuccess(`✓ Código validado! Bem-vindo, ${resolvedDisplayName}!`);
      onLoginSuccess(session, idToken);
      return;

    } catch (err: any) {
      console.error('Erro ao validar código SMS:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Código SMS incorreto. Verifique os 6 números recebidos no seu celular.');
      } else if (err.code === 'auth/code-expired') {
        setError('O código SMS expirou. Clique em reenviar para receber um novo código.');
      } else {
        setError(err.message || 'Falha ao validar o código SMS digitado.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCodeSent) {
      handleSendSms();
    } else {
      handleVerifyCode();
    }
  };

  // Se o usuário validou o SMS e é novo, exibe a tela de Cadastro em Dark Mode
  if (pendingOnboardingUser) {
    return (
      <Cadastro
        user={pendingOnboardingUser}
        onComplete={(session: UserSession, token: string) => {
          onLoginSuccess(session, token);
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/chat');
          }
        }}
        onNavigate={(path: string) => {
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', path);
          }
        }}
        onCancel={() => {
          setPendingOnboardingUser(null);
          setIsCodeSent(false);
          setSmsCode('');
          setError('');
          setSuccess('');
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/login');
          }
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-4 selection:bg-cyan-500/20 relative overflow-hidden font-sans">
      {/* Mesh Gradient Background Decoration */}
      <div className="absolute -top-24 -left-24 w-[450px] h-[450px] bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[140px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[420px] bg-slate-900/80 rounded-3xl border border-cyan-500/20 backdrop-blur-2xl shadow-2xl p-7 sm:p-8 text-white/90 z-10 relative shadow-cyan-950/60"
        id="loginScreen"
      >
        {/* Official Logo */}
        <div className="flex flex-col items-center mb-5 relative group/logo">
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto mb-2 flex items-center justify-center">
            <img 
              src={logoUrl} 
              alt="Tribbu'sChat - A voz da sua Tribbu." 
              className="w-full h-auto max-h-[140px] object-contain drop-shadow-[0_8px_25px_rgba(6,182,212,0.35)]"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('/icon/logo_oficial.png')) {
                  target.src = '/icon/logo_oficial.png';
                }
              }}
            />
          </div>

          <p className="text-xs text-cyan-200/70 text-center font-medium">
            Identifique-se com seu número de chip para validação por SMS
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border-l-4 border-red-500 rounded-xl text-xs text-red-200 font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-500/20 border-l-4 border-emerald-400 rounded-xl text-xs text-emerald-100 font-medium">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone Number & Country Code (DDI) Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white/70 block" htmlFor="phoneNumber">
                Número de Telefone / Chip (com DDD)
              </label>
              {isCodeSent ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCodeSent(false);
                    setSmsCode('');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                >
                  Alterar número
                </button>
              ) : (
                <span className="text-[10px] text-cyan-400/60 font-mono">Ex: (63) 99262-4090</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* DDI Country Code Selector */}
              <div className="relative w-[110px] shrink-0">
                <select
                  id="countryCode"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={isCodeSent || isLoading}
                  className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl py-2.5 pl-3 pr-7 text-sm text-cyan-300 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/60 transition-all cursor-pointer disabled:opacity-75"
                  title="Código do País (DDI)"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-slate-900 text-white text-xs">
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400/60 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Local Phone Input */}
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-cyan-400/60 pointer-events-none">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="phoneNumber"
                  type="tel"
                  required
                  disabled={isCodeSent || isLoading}
                  value={phoneInput}
                  onChange={handlePhoneChange}
                  placeholder="(63) 99262-4090"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/60 transition-all font-mono disabled:opacity-75"
                />
              </div>
            </div>

            <p className="text-[10px] text-white/40">
              Enviaremos um código SMS com 6 dígitos de validação para {countryCode} {phoneInput || 'seu número'}.
            </p>
          </div>

          {/* ETAPA 2: SMS Verification Code input (exibido apenas após o envio com sucesso) */}
          {isCodeSent && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/70 block" htmlFor="smsCode">
                  Código de Verificação SMS
                </label>
                <span className="text-[10px] text-cyan-300/80 flex items-center gap-1 font-mono">
                  6 dígitos numéricos
                </span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-cyan-400/60">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="smsCode"
                  type={showCode ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={smsCode}
                  onChange={(e) => {
                    setSmsCode(e.target.value.replace(/\D/g, ''));
                    if (error) setError('');
                  }}
                  placeholder="Digite o código recebido por SMS"
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-cyan-400/40 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/60 transition-all font-mono tracking-widest text-center"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/30 hover:text-cyan-400 focus:outline-none transition-colors cursor-pointer"
                  title={showCode ? 'Ocultar código' : 'Mostrar código'}
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SMS enviado para seu celular
                </span>
                <button
                  type="button"
                  onClick={handleSendSms}
                  disabled={isLoading}
                  className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reenviar código
                </button>
              </div>
            </div>
          )}

          {/* Invisible Firebase Phone Auth reCAPTCHA container */}
          <div id="recaptcha-container"></div>

          {/* Submit Button */}
          <button
            id="sign-in-button"
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:via-teal-300 hover:to-emerald-300 text-slate-950 py-3 rounded-xl font-black text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{!isCodeSent ? 'Enviando Código via SMS...' : 'Validando Código...'}</span>
              </span>
            ) : !isCodeSent ? (
              'Enviar Código via SMS'
            ) : (
              'Validar Código e Acessar'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
