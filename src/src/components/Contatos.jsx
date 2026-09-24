import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  UserPlus, 
  Phone, 
  User, 
  MessageSquare, 
  Check, 
  Share2, 
  Sparkles, 
  Loader2,
  Trash2,
  ExternalLink,
  Plus
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useBranding } from '../context/BrandingContext';

/**
 * Ícone oficial de verificação do Tribbu'sChat utilizando a imagem oficial /icon/ic_tribbus.png
 * com fallback dinâmico em SVG.
 */
export function TribbuBalloonIcon({ className = "w-5 h-5", title = "Usuário cadastrado no Tribbu'sChat" }) {
  const [hasError, setHasError] = useState(false);

  if (!hasError) {
    return (
      <img
        src="/icon/ic_tribbus.png"
        alt="Verificado Tribbu'sChat"
        className={`${className} object-contain drop-shadow-[0_0_6px_rgba(6,182,212,0.85)] flex-shrink-0 select-none`}
        title={title}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      title={title}
      aria-label={title}
    >
      <defs>
        <linearGradient id="tribbuBalloonGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="50%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <filter id="tribbuGlowEffect" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#06B6D4" floodOpacity="0.85" />
        </filter>
      </defs>
      <path 
        d="M12 3C6.477 3 2 6.925 2 11.765C2 14.542 3.47 16.993 5.75 18.52V21.5L9.12 19.98C10.04 20.32 11.01 20.53 12 20.53C17.523 20.53 22 16.605 22 11.765C22 6.925 17.523 3 12 3Z" 
        fill="url(#tribbuBalloonGrad)" 
        filter="url(#tribbuGlowEffect)" 
      />
      <path 
        d="M14.2 8.6C13.6 8.0 12.8 7.6 11.8 7.6C9.6 7.6 7.8 9.35 7.8 11.5C7.8 13.65 9.6 15.4 11.8 15.4C12.8 15.4 13.6 15.0 14.2 14.4" 
        stroke="#020617" 
        strokeWidth="2.2" 
        strokeLinecap="round" 
      />
    </svg>
  );
}

/**
 * Badge elegante com o mini ícone Tribbu para identificação visual rápida
 */
export function TribbuUserBadge({ showLabel = true, className = "" }) {
  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-[10px] font-semibold tracking-wide shadow-[0_0_10px_rgba(6,182,212,0.25)] select-none ${className}`}
      title="Este contato já usa o Tribbu'sChat"
    >
      <TribbuBalloonIcon className="w-3.5 h-3.5 flex-shrink-0" />
      {showLabel && <span>Usa Tribbu</span>}
    </span>
  );
}

// Normaliza números de telefone para cruzar dados com precisão
export function normalizePhoneDigits(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

// Formata o telefone para exibição elegante no padrão brasileiro ou internacional
export function formatPhone(phone) {
  if (!phone) return '';
  const digits = normalizePhoneDigits(phone);
  
  if (digits.length === 13 && digits.startsWith('55')) {
    // +55 (DD) 9XXXX-XXXX
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    // (DD) 9XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    // (DD) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (phone.startsWith('+')) {
    return phone;
  }
  return `+${phone}`;
}

const DEFAULT_LOCAL_CONTACTS = [
  { id: 'c1', name: 'Lucas Silva', phone: '+5511988887777', note: 'Desenvolvedor' },
  { id: 'c2', name: 'Mariana Souza', phone: '+5521977776666', note: 'Design e UX' },
  { id: 'c3', name: 'Carlos Eduardo', phone: '+5563992624090', note: 'Tribbu Core' },
  { id: 'c4', name: 'Beatriz Costa', phone: '+5531966665555', note: 'Comunidade' },
  { id: 'c5', name: 'Gabriel Santos', phone: '+5541955554444', note: 'Marketing' }
];

export default function Contatos({
  isOpen = true,
  onClose = undefined,
  currentUser = null,
  onSelectContact = undefined,
  onStartDirectChat = undefined
}) {
  const { logoUrl } = useBranding();

  // Lista local de contatos mantida no localStorage
  const [contacts, setContacts] = useState(() => {
    try {
      const saved = localStorage.getItem('tribbus_contacts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return DEFAULT_LOCAL_CONTACTS;
  });

  // Mapa de usuários registrados no Firestore (/users) para cruzamento de dados em tempo real
  const [registeredUsersMap, setRegisteredUsersMap] = useState(new Map());
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);

  // Estados de busca e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'tribbu' | 'invite'

  // Estados do formulário de novo contato
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(null);

  // Salva no localStorage sempre que a lista de contatos mudar
  useEffect(() => {
    try {
      localStorage.setItem('tribbus_contacts', JSON.stringify(contacts));
    } catch (_) {}
  }, [contacts]);

  // Lógica de Cruzamento de Dados:
  // Escuta em tempo real a coleção /users do Firestore e mapeia por telefone normalizado
  useEffect(() => {
    let isMounted = true;
    try {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;
          const userMap = new Map();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const uid = docSnap.id;
            const phone = data.phoneNumber || '';
            const digits = normalizePhoneDigits(phone);

            if (digits) {
              const profileInfo = {
                uid,
                displayName: data.displayName || 'Usuário Tribbu',
                phoneNumber: phone,
                digits,
                photoURL: data.photoURL || null,
                avatarColor: data.avatarColor || '#06B6D4',
                initial: data.initial || (data.displayName ? data.displayName.charAt(0).toUpperCase() : 'U'),
                about: data.about || 'Disponível na Tribbu',
                isOnline: !!data.isOnline,
                profileCompleted: !!data.profileCompleted
              };

              // Mapeia tanto pelos dígitos completos quanto sem o código de país (55)
              userMap.set(digits, profileInfo);
              if (digits.startsWith('55') && digits.length > 2) {
                userMap.set(digits.slice(2), profileInfo);
              }
            }
          });

          setRegisteredUsersMap(userMap);
          setIsLoadingFirestore(false);
        },
        (error) => {
          console.warn('[Contatos] Conexão com Firestore /users:', error);
          if (isMounted) setIsLoadingFirestore(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.warn('[Contatos] Falha ao inicializar listener de /users:', err);
      setIsLoadingFirestore(false);
    }
  }, []);

  // Helper para checagem rápida se um número de telefone está cadastrado no Firestore
  const checkIsTribbuUser = (phone) => {
    if (!phone) return null;
    const digits = normalizePhoneDigits(phone);
    if (!digits) return null;

    // Busca exata
    if (registeredUsersMap.has(digits)) {
      return registeredUsersMap.get(digits);
    }

    // Busca sem DDI 55
    if (digits.startsWith('55') && registeredUsersMap.has(digits.slice(2))) {
      return registeredUsersMap.get(digits.slice(2));
    }

    // Busca adicionando DDI 55
    if (!digits.startsWith('55') && registeredUsersMap.has('55' + digits)) {
      return registeredUsersMap.get('55' + digits);
    }

    return null;
  };

  // Processa a lista com os dados cruzados do Firestore
  const enrichedContacts = useMemo(() => {
    return contacts.map((c) => {
      const tribbuUser = checkIsTribbuUser(c.phone);
      return {
        ...c,
        isTribbuUser: !!tribbuUser,
        tribbuProfile: tribbuUser || null,
        displayPhone: formatPhone(c.phone)
      };
    });
  }, [contacts, registeredUsersMap]);

  // Contatos filtrados pela busca e aba selecionada
  const filteredContacts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return enrichedContacts.filter((c) => {
      const matchesSearch = 
        !term || 
        c.name.toLowerCase().includes(term) || 
        c.phone.includes(term) ||
        (c.note && c.note.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (filterType === 'tribbu') {
        return c.isTribbuUser;
      }
      if (filterType === 'invite') {
        return !c.isTribbuUser;
      }
      return true;
    });
  }, [enrichedContacts, searchTerm, filterType]);

  // Contagem de usuários já cadastrados no Tribbu'sChat
  const totalTribbuUsersCount = useMemo(() => {
    return enrichedContacts.filter((c) => c.isTribbuUser).length;
  }, [enrichedContacts]);

  // Adicionar novo contato na agenda
  const handleAddContact = (e) => {
    e.preventDefault();
    setAddError('');

    const cleanName = newName.trim();
    const cleanPhoneDigits = normalizePhoneDigits(newPhone);

    if (!cleanName) {
      setAddError('Por favor, digite o nome do contato.');
      return;
    }
    if (cleanPhoneDigits.length < 8) {
      setAddError('Por favor, informe um número de telefone válido com DDD.');
      return;
    }

    const formattedWithPlus = newPhone.startsWith('+') ? newPhone.trim() : (cleanPhoneDigits.startsWith('55') ? `+${cleanPhoneDigits}` : `+55${cleanPhoneDigits}`);

    // Verifica se já existe
    const exists = contacts.some(
      (c) => normalizePhoneDigits(c.phone) === cleanPhoneDigits
    );
    if (exists) {
      setAddError('Já existe um contato com esse número de telefone na lista.');
      return;
    }

    const newContactItem = {
      id: `contact_${Date.now()}`,
      name: cleanName,
      phone: formattedWithPlus,
      note: 'Adicionado recentemente'
    };

    setContacts((prev) => [newContactItem, ...prev]);
    setNewName('');
    setNewPhone('');
    setShowAddForm(false);
  };

  // Remover contato da agenda
  const handleDeleteContact = (id, e) => {
    e.stopPropagation();
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  // Iniciar conversa com o contato
  const handleStartChat = (contact) => {
    if (onStartDirectChat) {
      onStartDirectChat({
        name: contact.tribbuProfile?.displayName || contact.name,
        phoneNumber: contact.tribbuProfile?.phoneNumber || contact.phone,
        photoURL: contact.tribbuProfile?.photoURL || undefined,
        avatarColor: contact.tribbuProfile?.avatarColor || '#06B6D4',
        avatarLetter: contact.tribbuProfile?.initial || (contact.name.charAt(0).toUpperCase() || 'U')
      });
      if (onClose) onClose();
    } else if (onSelectContact) {
      onSelectContact(contact);
      if (onClose) onClose();
    }
  };

  // Convidar amigo por link / WhatsApp
  const handleInviteFriend = (contact, e) => {
    e.stopPropagation();
    const inviteText = `Olá ${contact.name}! Venha conversar comigo no Tribbu'sChat. Baixe o app e conecte-se direto pelo seu número: ${window.location.origin}`;
    
    // Tenta copiar link ou abrir WhatsApp web
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(inviteText);
        setCopyFeedback(contact.id);
        setTimeout(() => setCopyFeedback(null), 2500);
      }
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${normalizePhoneDigits(contact.phone)}&text=${encodeURIComponent(inviteText)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-[500px] h-[90vh] max-h-[720px] bg-slate-900/90 border border-cyan-500/25 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-white relative shadow-cyan-950/80 font-sans"
        id="contatosScreen"
      >
        {/* Header com a identidade visual e o logotipo do Tribbu'sChat */}
        <div className="p-4 sm:p-5 border-b border-cyan-500/20 bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)] flex-shrink-0">
                <TribbuBalloonIcon className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.9)]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
                  <span>Lista de Contatos</span>
                  {isLoadingFirestore ? (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-semibold">
                      {totalTribbuUsersCount} na Tribbu
                    </span>
                  )}
                </h3>
                <p className="text-xs text-white/60">
                  Cruzamento automático com a rede Tribbu'sChat
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className={`p-2 rounded-xl transition-all border cursor-pointer ${
                  showAddForm 
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white'
                }`}
                title="Adicionar novo contato à agenda"
              >
                <Plus className="w-4 h-4" />
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Barra de Pesquisa */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou número..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950/70 border border-cyan-500/25 rounded-xl text-white placeholder-white/40 text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-sans"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Filtros em Pílulas */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              Todos ({enrichedContacts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('tribbu')}
              className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === 'tribbu'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <TribbuBalloonIcon className="w-3.5 h-3.5" />
              <span>No Tribbu'sChat ({totalTribbuUsersCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('invite')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filterType === 'invite'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              Convidar ({enrichedContacts.length - totalTribbuUsersCount})
            </button>
          </div>
        </div>

        {/* Formulário Retrátil para Adicionar Contato */}
        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddContact}
              className="p-4 bg-slate-950/90 border-b border-cyan-500/30 overflow-hidden flex-shrink-0 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                  Novo Contato na Agenda
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-white/50 hover:text-white text-xs"
                >
                  Cancelar
                </button>
              </div>

              {addError && (
                <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome do contato"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-cyan-500/30 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                    autoFocus
                  />
                </div>

                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+55 (DDD) Celular"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-cyan-500/30 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              {/* Checagem prévia em tempo real enquanto digita o número */}
              {newPhone.length >= 10 && (
                <div className="text-[11px] flex items-center gap-1.5">
                  {checkIsTribbuUser(newPhone) ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <TribbuBalloonIcon className="w-3.5 h-3.5" />
                      ✓ Número já usa o Tribbu'sChat! O ícone ciano será exibido automaticamente.
                    </span>
                  ) : (
                    <span className="text-white/50">
                      Este número ainda não tem cadastro no Tribbu'sChat. Você poderá convidá-lo.
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Salvar Contato
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Lista de Contatos com Cruzamento de Dados */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center justify-center mx-auto">
                <User className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">Nenhum contato encontrado</p>
              <p className="text-xs text-white/50 max-w-xs mx-auto">
                {searchTerm
                  ? `Nenhum contato coincide com "${searchTerm}".`
                  : 'Nenhum contato disponível nesta categoria.'}
              </p>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Novo Contato
              </button>
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isTribbu = contact.isTribbuUser;
              const profile = contact.tribbuProfile;
              const avatarColor = profile?.avatarColor || '#06B6D4';
              const initialLetter = profile?.initial || (contact.name.charAt(0).toUpperCase() || 'U');

              return (
                <div
                  key={contact.id}
                  onClick={() => handleStartChat(contact)}
                  className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isTribbu
                      ? 'bg-slate-950/70 hover:bg-cyan-950/30 border-cyan-500/30 hover:border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                      : 'bg-slate-950/40 hover:bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Avatar do Contato */}
                  <div className="relative flex-shrink-0">
                    <div 
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm text-white overflow-hidden border border-white/20 shadow-inner"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {profile?.photoURL ? (
                        <img 
                          src={profile.photoURL} 
                          alt={contact.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{initialLetter}</span>
                      )}
                    </div>

                    {/* Mini selo no avatar se for usuário do Tribbu */}
                    {isTribbu && (
                      <div 
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-950 border border-cyan-400 flex items-center justify-center shadow-[0_0_8px_rgba(6,182,212,0.9)]"
                        title="Usuário ativo no Tribbu'sChat"
                      >
                        <TribbuBalloonIcon className="w-3 h-3 text-cyan-400" />
                      </div>
                    )}
                  </div>

                  {/* Informações do Contato com o Ícone Oficial de Verificação ao lado do nome */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-sm text-white truncate max-w-[200px]">
                        {profile?.displayName || contact.name}
                      </h4>

                      {/* Se o número de telefone já existir cadastrado no banco, renderize uma tag <img> apontando para o nosso ícone customizado de verificação no caminho /icon/ic_tribbus.png (ajustado para tamanho pequeno) bem ao lado do nome do usuário. Se o número não existir, não exiba o ícone. */}
                      {isTribbu && (
                        <img 
                          src="/icon/ic_tribbus.png" 
                          alt="Tribbu'sChat" 
                          className="w-4 h-4 sm:w-4.5 sm:h-4.5 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.85)] flex-shrink-0 select-none inline-block align-middle ml-1"
                          title="Usuário cadastrado no Tribbu'sChat"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.src.includes('/icon/logo_oficial.png')) {
                              target.src = '/icon/logo_oficial.png';
                            }
                          }}
                        />
                      )}
                    </div>

                    <p className="text-xs font-mono text-cyan-300/80 truncate mt-0.5">
                      {contact.displayPhone}
                    </p>

                    <p className="text-[11px] text-white/50 truncate mt-0.5">
                      {profile?.about || contact.note || (isTribbu ? 'Disponível no Tribbu\'sChat' : 'Ainda não está na Tribbu')}
                    </p>
                  </div>

                  {/* Ação: Iniciar Conversa ou Convidar */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isTribbu ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartChat(contact);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Abrir chat no Tribbu'sChat"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Conversar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleInviteFriend(contact, e)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Convidar amigo para entrar no Tribbu'sChat"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{copyFeedback === contact.id ? 'Copiado!' : 'Convidar'}</span>
                      </button>
                    )}

                    {/* Botão de excluir contato manual */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteContact(contact.id, e)}
                      className="p-1.5 text-white/30 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Remover contato da lista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="p-3 bg-slate-950/80 border-t border-cyan-500/20 flex items-center justify-between text-[11px] text-white/50 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <TribbuBalloonIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>O ícone indica cadastro verificado no Firestore</span>
          </div>
          <span className="font-mono text-cyan-400/80">Tribbu'sChat v2</span>
        </div>
      </motion.div>
    </div>
  );
}
