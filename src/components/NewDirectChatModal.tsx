import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Phone, 
  User, 
  MessageSquare, 
  Sparkles, 
  Check, 
  AlertCircle,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserSession } from '../types';
import { formatPhoneDisplay, normalizePhoneNumber } from './LoginScreen';

interface NewDirectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  onStartDirectChat: (contact: {
    name: string;
    phoneNumber: string;
    photoURL?: string;
    avatarColor: string;
    avatarLetter: string;
  }) => void;
}

interface FoundUser {
  uid?: string;
  displayName: string;
  phoneNumber: string;
  photoURL?: string;
  avatarColor: string;
  initial: string;
  about?: string;
  isOnline?: boolean;
}

const AVATAR_COLORS = [
  '#06B6D4', '#0891B2', '#00E5FF', '#10B981', '#059669',
  '#14B8A6', '#0284C7', '#3B82F6', '#6366F1', '#F59E0B'
];

export default function NewDirectChatModal({
  isOpen,
  onClose,
  currentUser,
  onStartDirectChat
}: NewDirectChatModalProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Available registered contacts list in the Tribbu network
  const [recentUsers, setRecentUsers] = useState<FoundUser[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Fetch registered users from Firestore on mount so user can either search by chip or pick a contact
  useEffect(() => {
    if (!isOpen) return;

    const loadRegisteredUsers = async () => {
      setIsLoadingRecent(true);
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const list: FoundUser[] = [];
        usersSnap.forEach(docSnap => {
          const data = docSnap.data();
          const cleanPhone = data.phoneNumber || '';
          // Don't show current user themselves in the contact list
          if (cleanPhone && cleanPhone !== currentUser.phoneNumber && docSnap.id !== currentUser.uid) {
            list.push({
              uid: docSnap.id,
              displayName: data.displayName || cleanPhone,
              phoneNumber: cleanPhone,
              photoURL: data.photoURL,
              avatarColor: data.avatarColor || '#06B6D4',
              initial: data.initial || (data.displayName ? data.displayName.charAt(0).toUpperCase() : 'U'),
              about: data.about || 'Disponível na Tribbu',
              isOnline: data.isOnline
            });
          }
        });
        setRecentUsers(list);
      } catch (err) {
        console.error('Error loading registered users:', err);
      } finally {
        setIsLoadingRecent(false);
      }
    };

    loadRegisteredUsers();
  }, [isOpen, currentUser]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setPhoneInput(formatPhoneDisplay(raw));
    setFoundUser(null);
    setSearchAttempted(false);
    setErrorMessage('');
  };

  const handleSearchUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawDigits = phoneInput.replace(/\D/g, '');
    if (rawDigits.length < 8) {
      setErrorMessage('Digite um número de chip válido com DDD (mínimo 8 dígitos).');
      return;
    }

    setIsSearching(true);
    setSearchAttempted(true);
    setErrorMessage('');
    setFoundUser(null);

    const normalized = normalizePhoneNumber(phoneInput);

    try {
      // 1. Direct query on Firestore /users with phoneNumber
      const q = query(collection(db, 'users'), where('phoneNumber', '==', normalized));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const docSnap = querySnap.docs[0];
        const data = docSnap.data();
        setFoundUser({
          uid: docSnap.id,
          displayName: data.displayName || normalized,
          phoneNumber: data.phoneNumber || normalized,
          photoURL: data.photoURL,
          avatarColor: data.avatarColor || '#06B6D4',
          initial: data.initial || (data.displayName ? data.displayName.charAt(0).toUpperCase() : 'U'),
          about: data.about || 'Disponível na Tribbu',
          isOnline: data.isOnline
        });
        return;
      }

      // 2. Try match without '+' or with variations
      const rawMatch = query(collection(db, 'users'), where('phoneNumber', '==', rawDigits));
      const rawSnap = await getDocs(rawMatch);

      if (!rawSnap.empty) {
        const docSnap = rawSnap.docs[0];
        const data = docSnap.data();
        setFoundUser({
          uid: docSnap.id,
          displayName: data.displayName || normalized,
          phoneNumber: data.phoneNumber || normalized,
          photoURL: data.photoURL,
          avatarColor: data.avatarColor || '#06B6D4',
          initial: data.initial || (data.displayName ? data.displayName.charAt(0).toUpperCase() : 'U'),
          about: data.about || 'Disponível na Tribbu',
          isOnline: data.isOnline
        });
        return;
      }

      // 3. Fallback: check all docs for partial phone digits match
      const allUsersSnap = await getDocs(collection(db, 'users'));
      let matchedDoc: any = null;
      allUsersSnap.forEach(d => {
        const phone = d.data().phoneNumber || '';
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits && (phoneDigits.includes(rawDigits) || rawDigits.includes(phoneDigits))) {
          matchedDoc = { id: d.id, ...d.data() };
        }
      });

      if (matchedDoc) {
        setFoundUser({
          uid: matchedDoc.id,
          displayName: matchedDoc.displayName || normalized,
          phoneNumber: matchedDoc.phoneNumber || normalized,
          photoURL: matchedDoc.photoURL,
          avatarColor: matchedDoc.avatarColor || '#06B6D4',
          initial: matchedDoc.initial || (matchedDoc.displayName ? matchedDoc.displayName.charAt(0).toUpperCase() : 'U'),
          about: matchedDoc.about || 'Disponível na Tribbu',
          isOnline: matchedDoc.isOnline
        });
      }
    } catch (err: any) {
      console.error('Error searching user:', err);
      setErrorMessage(err.message || 'Erro ao buscar usuário no Firestore.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartWithFoundUser = (target: FoundUser) => {
    onStartDirectChat({
      name: target.displayName,
      phoneNumber: target.phoneNumber,
      photoURL: target.photoURL,
      avatarColor: target.avatarColor,
      avatarLetter: target.initial
    });
    onClose();
  };

  const handleStartWithRawNumber = () => {
    const normalized = normalizePhoneNumber(phoneInput);
    const initial = normalized.slice(-2);
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    onStartDirectChat({
      name: formatPhoneDisplay(normalized) || normalized,
      phoneNumber: normalized,
      avatarColor: randomColor,
      avatarLetter: initial
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-slate-900/95 border border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.2)] rounded-3xl p-6 text-white relative overflow-hidden max-h-[90vh] flex flex-col"
          id="newDirectChatModal"
        >
          {/* Neon Top Glow Effect */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-sm shadow-cyan-500/20">
                <MessageSquare className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
                  Nova Conversa Individual
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                </h3>
                <p className="text-xs text-cyan-200/60 font-medium">
                  Busque o usuário pelo número de chip no Firestore
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchUser} className="pt-4 space-y-3 flex-shrink-0">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white/80 block" htmlFor="directPhoneInput">
                  Número de Chip / Telefone do Contato
                </label>
                <span className="text-[10px] text-cyan-400/70 font-mono">Ex: +55 (11) 99999-9999</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-cyan-400/70">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="directPhoneInput"
                  type="tel"
                  autoFocus
                  required
                  placeholder="+55 (11) 99999-9999"
                  value={phoneInput}
                  onChange={handlePhoneChange}
                  className="w-full pl-10 pr-24 py-2.5 bg-slate-950/70 border border-cyan-500/30 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all font-mono tracking-wide"
                />
                <button
                  type="submit"
                  disabled={isSearching || !phoneInput.trim()}
                  className="absolute inset-y-1 right-1 px-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Buscar
                    </>
                  )}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border-l-4 border-red-500 rounded-xl text-xs text-red-200 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </form>

          {/* Search Result Display */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
            {foundUser && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-gradient-to-b from-cyan-950/40 to-slate-950/70 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.25)] space-y-3"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Usuário Encontrado no Firestore
                  </span>
                  {foundUser.isOnline && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 rounded-full border border-emerald-500/30 text-emerald-300">
                      Online
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3.5">
                  <div 
                    className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-lg text-white border border-cyan-400/50 shadow-inner flex-shrink-0"
                    style={{ backgroundColor: foundUser.avatarColor }}
                  >
                    {foundUser.photoURL ? (
                      <img 
                        src={foundUser.photoURL} 
                        alt={foundUser.displayName} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{foundUser.initial}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-base text-white truncate">
                      {foundUser.displayName}
                    </h4>
                    <p className="text-xs font-mono text-cyan-300/80">
                      {formatPhoneDisplay(foundUser.phoneNumber)}
                    </p>
                    <p className="text-[11px] text-white/50 truncate mt-0.5">
                      {foundUser.about}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartWithFoundUser(foundUser)}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  Iniciar Conversa Agora
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {searchAttempted && !foundUser && !isSearching && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 text-center space-y-3"
              >
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center justify-center mx-auto">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">Nenhum cadastro com este chip</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    O número {phoneInput} ainda não concluiu o onboarding no Tribbu'sChat.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStartWithRawNumber}
                  className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Iniciar conversa mesmo assim
                </button>
              </motion.div>
            )}

            {/* List of Contacts in the Tribbu network */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-cyan-300/80 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  Contatos na Rede Tribbu ({recentUsers.length})
                </span>
                {isLoadingRecent && (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                )}
              </div>

              {recentUsers.length > 0 ? (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {recentUsers.map((u) => (
                    <div
                      key={u.phoneNumber}
                      onClick={() => handleStartWithFoundUser(u)}
                      className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/40 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs border border-white/10 overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: u.avatarColor }}
                        >
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{u.initial}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                            {u.displayName}
                          </p>
                          <p className="text-[10px] font-mono text-white/40 truncate">
                            {formatPhoneDisplay(u.phoneNumber)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Conversar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !isLoadingRecent && (
                  <p className="text-xs text-white/40 text-center py-3">
                    Nenhum outro usuário cadastrado no momento. Convide amigos pelo link ou digite o número do chip acima!
                  </p>
                )
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
