import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Camera, 
  Search, 
  MoreVertical, 
  Plus, 
  X, 
  Users, 
  Download, 
  MessageSquare, 
  CircleDashed, 
  Phone, 
  Settings, 
  LogOut, 
  Bookmark, 
  MessageSquarePlus,
  Archive,
  Check,
  Video,
  Play,
  Bot,
  Sparkles,
  Type,
  Megaphone,
  UserPlus,
  Shield,
  Contact
} from 'lucide-react';
import { Chat, UserSession, StatusItem, UserStatusGroup, TextStatusStyle } from '../types';
import CameraCaptureModal from './CameraCaptureModal';
import SettingsModal from './SettingsModal';
import NewCommunityModal from './NewCommunityModal';
import { StatusViewerModal } from './StatusViewerModal';
import { NewStatusModal } from './NewStatusModal';
import NewDirectChatModal from './NewDirectChatModal';
import NewTribbuModal from './NewTribbuModal';
import Contatos, { TribbuBalloonIcon } from './Contatos.jsx';
import { subscribeToStatuses, groupStatusesByUser, publishStatus, publishTextStatus } from '../services/statusService';
import { useBranding } from '../context/BrandingContext';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  user: UserSession;
  onLogout: () => void;
  onAddNewChat: (
    name: string, 
    isGroup: boolean,
    options?: {
      photoURL?: string;
      avatarColor?: string;
      avatarLetter?: string;
      members?: string[];
      contactPhoneNumber?: string;
      description?: string;
    }
  ) => void;
  onUpdateUserProfile: (updated: Partial<UserSession>) => Promise<void>;
  onInstallPwa?: () => void;
  canInstall?: boolean;
}

type TabType = 'chats' | 'status' | 'communities' | 'calls';
type FilterType = 'all' | 'direct' | 'groups' | 'unread' | 'favorites';

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  user,
  onLogout,
  onAddNewChat,
  onUpdateUserProfile,
  onInstallPwa,
  canInstall
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const { logoUrl } = useBranding();

  // Modals
  const [showMenu, setShowMenu] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewDirectChatModal, setShowNewDirectChatModal] = useState(false);
  const [showContatosModal, setShowContatosModal] = useState(false);
  const [showNewTribbuModal, setShowNewTribbuModal] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showPwaInfoModal, setShowPwaInfoModal] = useState(false);

  // Form states
  const [newChatName, setNewChatName] = useState('');
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [cameraFeedback, setCameraFeedback] = useState<string | null>(null);

  // Real-time Status System
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [showStatusViewer, setShowStatusViewer] = useState(false);
  const [statusViewerGroupIndex, setStatusViewerGroupIndex] = useState(0);
  const [statusViewerGroups, setStatusViewerGroups] = useState<UserStatusGroup[]>([]);
  const [showNewStatusModal, setShowNewStatusModal] = useState(false);
  const [viewedStatusIds, setViewedStatusIds] = useState<Set<string>>(() => new Set());

  // Subscribe to real-time statuses from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToStatuses((allStatuses) => {
      setStatuses(allStatuses);
    });
    return () => unsubscribe();
  }, []);

  // Group statuses into "My status" and "Contact updates"
  const { myGroup, contactGroups } = useMemo(() => {
    const currentUid = user.uid || `user_${user.phoneNumber}`;
    return groupStatusesByUser(statuses, currentUid, viewedStatusIds);
  }, [statuses, user, viewedStatusIds]);

  const handleMyStatusClick = () => {
    if (myGroup && myGroup.statuses.length > 0) {
      // Open story viewer to watch own status!
      setStatusViewerGroups([myGroup, ...contactGroups]);
      setStatusViewerGroupIndex(0);
      setShowStatusViewer(true);
    } else {
      // No active status, prompt to create one
      setShowNewStatusModal(true);
    }
  };

  const handleAddStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowNewStatusModal(true);
  };

  const handleContactStatusClick = (index: number) => {
    const allGroups = myGroup && myGroup.statuses.length > 0 ? [myGroup, ...contactGroups] : contactGroups;
    const targetIdx = myGroup && myGroup.statuses.length > 0 ? index + 1 : index;
    setStatusViewerGroups(allGroups);
    setStatusViewerGroupIndex(targetIdx);
    setShowStatusViewer(true);
  };

  const handlePublishStatus = async (
    fileOrDataUrl: File | string, 
    mediaType: 'image' | 'video', 
    caption?: string,
    onProgress?: (percent: number) => void
  ) => {
    const newStatus = await publishStatus(
      {
        uid: user.uid,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        avatarColor: user.avatarColor,
        photoURL: user.photoURL
      },
      fileOrDataUrl,
      mediaType,
      caption,
      onProgress
    );
    setStatuses(prev => [newStatus, ...prev]);
  };

  const handlePublishTextStatus = async (
    textContent: string,
    style: TextStatusStyle,
    isTribbuNotice?: boolean,
    targetGroupId?: string,
    targetGroupName?: string
  ) => {
    const newStatus = await publishTextStatus(
      {
        uid: user.uid,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        avatarColor: user.avatarColor,
        photoURL: user.photoURL
      },
      textContent,
      style,
      isTribbuNotice,
      targetGroupId,
      targetGroupName
    );
    setStatuses(prev => [newStatus, ...prev]);
  };

  const handleMarkStatusViewed = (statusId: string) => {
    setViewedStatusIds(prev => {
      const next = new Set(prev);
      next.add(statusId);
      return next;
    });
  };

  const handleReplyToStatus = (targetUserPhone: string, text: string) => {
    const matchingChat = chats.find(c => 
      c.name.includes(targetUserPhone) || 
      c.statusText?.includes(targetUserPhone)
    );
    if (matchingChat) {
      onSelectChat(matchingChat.id);
    }
    setShowStatusViewer(false);
  };

  // Filter chats by tab, filter pills, and search
  const filteredChats = chats.filter((chat) => {
    // Search matching
    const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Filter pills matching
    if (activeFilter === 'unread') {
      return chat.unreadCount > 0;
    }
    if (activeFilter === 'direct') {
      return !chat.isGroup && !chat.isCommunity;
    }
    if (activeFilter === 'groups') {
      return chat.isGroup || chat.isCommunity;
    }
    if (activeFilter === 'favorites') {
      return !!chat.isFavorite;
    }
    return true;
  });

  const directChats = useMemo(() => {
    const direct = filteredChats.filter(c => !c.isGroup && !c.isCommunity);
    const aiChat = direct.find(c => c.isAI || c.id === 'tribbu-ai');
    const others = direct.filter(c => !c.isAI && c.id !== 'tribbu-ai');
    return aiChat ? [aiChat, ...others] : others;
  }, [filteredChats]);

  const groupChats = useMemo(() => {
    return filteredChats.filter(c => c.isGroup || c.isCommunity);
  }, [filteredChats]);

  const totalUnread = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const handleToggleSearch = () => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchTerm('');
      }
      return next;
    });
  };

  const handleStartDirectChat = (contact: {
    name: string;
    phoneNumber: string;
    photoURL?: string;
    avatarColor: string;
    avatarLetter: string;
  }) => {
    onAddNewChat(contact.name, false, {
      contactPhoneNumber: contact.phoneNumber,
      photoURL: contact.photoURL,
      avatarColor: contact.avatarColor,
      avatarLetter: contact.avatarLetter,
      members: [user.phoneNumber, contact.phoneNumber]
    });
    setShowNewDirectChatModal(false);
  };

  const handleCreateTribbu = async (groupData: {
    name: string;
    photoURL?: string;
    avatarColor: string;
    avatarLetter: string;
    members: string[];
    description?: string;
  }) => {
    onAddNewChat(groupData.name, true, {
      photoURL: groupData.photoURL,
      avatarColor: groupData.avatarColor,
      avatarLetter: groupData.avatarLetter,
      members: groupData.members,
      description: groupData.description
    });
    setShowNewTribbuModal(false);
  };

  const handleCreateChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChatName.trim()) {
      onAddNewChat(newChatName.trim(), isGroupChat);
      setNewChatName('');
      setIsGroupChat(false);
      setShowNewChatModal(false);
    }
  };

  const handleCreateCommunitySubmit = (name: string, description: string) => {
    onAddNewChat(name, true);
    setShowCommunityModal(false);
  };

  const handleCameraPhotoCaptured = async (photoDataUrl: string) => {
    try {
      await onUpdateUserProfile({ photoURL: photoDataUrl });
      setCameraFeedback('Foto salva como sua nova foto de perfil!');
      setTimeout(() => setCameraFeedback(null), 3500);
    } catch {
      setCameraFeedback('Não foi possível atualizar a foto.');
      setTimeout(() => setCameraFeedback(null), 3500);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col h-full bg-slate-900/90 z-20 relative overflow-hidden select-none">
      {/* Toast Feedback */}
      {cameraFeedback && (
        <div className="absolute top-16 left-4 right-4 z-50 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          {cameraFeedback}
        </div>
      )}

      {/* Top Bar */}
      <div className="h-16 bg-slate-900/95 px-4 md:px-5 flex items-center justify-between border-b border-white/10 flex-shrink-0">
        {/* Brand Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden border border-cyan-400/40 p-0.5 bg-slate-950 flex items-center justify-center flex-shrink-0 shadow-sm shadow-cyan-500/20">
            <img 
              src={logoUrl} 
              alt="Tribbu'sChat" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('/icon/logo_oficial.png')) {
                  target.src = '/icon/logo_oficial.png';
                }
              }}
            />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent hover:opacity-95 transition-opacity">
            Tribbu'sChat
          </h1>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1 sm:gap-2 text-white/80">
          {/* Camera Icon - Tire foto ou selfie */}
          <button 
            type="button"
            onClick={() => setShowCameraModal(true)}
            className="p-2 hover:bg-white/10 active:bg-white/15 rounded-full transition-colors cursor-pointer text-white/80 hover:text-white"
            title="Tirar foto ou selfie com a câmera"
            id="topBarCameraBtn"
          >
            <Camera className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Search Icon (Lupa para pesquisa) */}
          <button 
            type="button"
            onClick={handleToggleSearch}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isSearchOpen 
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40' 
                : 'hover:bg-white/10 text-white/80 hover:text-white'
            }`}
            title="Pesquisar conversas (Lupa)"
            id="topBarSearchBtn"
          >
            <Search className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Profile Photo / Avatar - Clicking opens Settings */}
          <button 
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="relative p-0.5 rounded-full hover:ring-2 hover:ring-cyan-400 transition-all cursor-pointer focus:outline-none"
            title="Meu perfil e configurações"
            id="topBarProfileAvatarBtn"
          >
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Meu Perfil" 
                className="w-8 h-8 rounded-full object-cover border border-white/20"
              />
            ) : (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.initial}
              </div>
            )}
          </button>

          {/* Three Dots Menu (menu de tres pontinho) */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-white/10 active:bg-white/15 rounded-full transition-colors cursor-pointer text-white/80 hover:text-white"
              title="Mais opções"
              id="topBarThreeDotsMenuBtn"
            >
              <MoreVertical className="w-5 h-5 stroke-[2.2]" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-56 bg-slate-900 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-white text-sm">
                  {/* Nova conversa individual */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowNewDirectChatModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer text-white/90 hover:text-white font-medium"
                    id="menuNewDirectChatBtn"
                  >
                    <UserPlus className="w-4 h-4 text-cyan-400" />
                    Nova conversa individual
                  </button>

                  {/* Lista de Contatos da Tribbu com Cruzamento de Dados */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowContatosModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer text-white/90 hover:text-white font-medium"
                    id="menuContatosBtn"
                  >
                    <Contact className="w-4 h-4 text-cyan-400" />
                    Contatos da Tribbu
                  </button>

                  {/* Nova Tribbu */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowNewTribbuModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer text-white/90 hover:text-white font-medium"
                    id="menuNewTribbuBtn"
                  >
                    <Shield className="w-4 h-4 text-teal-400" />
                    Nova Tribbu (Grupo)
                  </button>

                  {/* Nova comunidade */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowCommunityModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer text-white/90 hover:text-white font-medium"
                    id="menuNewCommunityBtn"
                  >
                    <Users className="w-4 h-4 text-emerald-400" />
                    Nova comunidade
                  </button>

                  {/* Mensagens favoritas */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setActiveFilter(activeFilter === 'favorites' ? 'all' : 'favorites');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer text-white/90 hover:text-white"
                  >
                    <Bookmark className="w-4 h-4 text-amber-400" />
                    Mensagens favoritas
                  </button>

                  {/* Configurações */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowSettingsModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-3 cursor-pointer text-white/90 hover:text-white font-medium"
                    id="menuSettingsBtn"
                  >
                    <Settings className="w-4 h-4 text-slate-300" />
                    Configurações
                  </button>

                  {/* Instalar App (PWA) */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      if (onInstallPwa && canInstall) {
                        onInstallPwa();
                      } else {
                        setShowPwaInfoModal(true);
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-cyan-500/10 flex items-center gap-3 cursor-pointer text-cyan-300 font-medium border-t border-white/10 mt-1"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    Instalar aplicativo (PWA)
                  </button>

                  {/* Desconectar / Sair */}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      if (confirm('Deseja realmente sair do Tribbu\'sChat?')) {
                        onLogout();
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-500/10 text-red-400 flex items-center gap-3 cursor-pointer border-t border-white/10"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Search Input (quando a lupa for acionada ou para busca contínua) */}
      {isSearchOpen && (
        <div className="p-3 bg-white/[0.02] border-b border-white/10 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="bg-white/5 border border-white/15 px-3.5 py-2 rounded-xl flex items-center gap-2.5">
            <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Pesquisar conversas ou mensagens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm text-white placeholder-white/30 p-0 focus:ring-0"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-white/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchTerm('');
              }}
              className="text-xs text-white/50 hover:text-white pl-1 cursor-pointer font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Prominent Neon Action Buttons: Nova Conversa Individual & Nova Tribbu */}
      <div className="p-2.5 grid grid-cols-2 gap-2.5 bg-slate-950/80 border-b border-cyan-500/20 flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowNewDirectChatModal(true)}
          className="py-2.5 px-3 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-400/50 hover:border-cyan-300 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.18)] hover:shadow-[0_0_22px_rgba(6,182,212,0.38)] flex items-center justify-center gap-2 transition-all text-xs font-bold cursor-pointer group active:scale-98"
          id="btnNewDirectChat"
          title="Iniciar nova conversa individual buscando pelo número do chip"
        >
          <UserPlus className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform flex-shrink-0" />
          <span className="truncate">Nova Conversa</span>
        </button>

        <button
          type="button"
          onClick={() => setShowNewTribbuModal(true)}
          className="py-2.5 px-3 rounded-xl bg-teal-950/60 hover:bg-teal-900/70 border border-teal-400/50 hover:border-teal-300 text-teal-200 shadow-[0_0_15px_rgba(20,184,166,0.18)] hover:shadow-[0_0_22px_rgba(20,184,166,0.38)] flex items-center justify-center gap-2 transition-all text-xs font-bold cursor-pointer group active:scale-98"
          id="btnNewTribbu"
          title="Criar nova Tribbu (grupo) com foto, nome e membros"
        >
          <Shield className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform flex-shrink-0" />
          <span className="truncate">Nova Tribbu</span>
        </button>
      </div>

      {/* Filter Pills: Todas, Individuais, Tribbus, Não lidas, Favoritas */}
      <div className="px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/5 flex-shrink-0 bg-slate-900/40">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 font-bold shadow-sm shadow-cyan-500/20'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-transparent'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setActiveFilter('direct')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeFilter === 'direct'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 font-bold shadow-sm shadow-cyan-500/20'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-transparent'
          }`}
        >
          Individuais {chats.filter(c => !c.isGroup && !c.isCommunity).length > 0 && `(${chats.filter(c => !c.isGroup && !c.isCommunity).length})`}
        </button>
        <button
          onClick={() => setActiveFilter('groups')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeFilter === 'groups'
              ? 'bg-teal-500/25 text-teal-300 border border-teal-400/50 font-bold shadow-sm shadow-teal-500/20'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-transparent'
          }`}
        >
          Tribbus {chats.filter(c => c.isGroup || c.isCommunity).length > 0 && `(${chats.filter(c => c.isGroup || c.isCommunity).length})`}
        </button>
        <button
          onClick={() => setActiveFilter('unread')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeFilter === 'unread'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 font-bold shadow-sm shadow-cyan-500/20'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-transparent'
          }`}
        >
          Não lidas {totalUnread > 0 && `(${totalUnread})`}
        </button>
        <button
          onClick={() => setActiveFilter('favorites')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeFilter === 'favorites'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 font-bold shadow-sm shadow-cyan-500/20'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-transparent'
          }`}
        >
          Favoritas
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto relative">
        {activeTab === 'chats' && (
          <>
            {/* HORIZONTAL STATUS STORIES BAR AT THE TOP OF THE CONTACTS LIST */}
            <div className="border-b border-white/10 bg-slate-950/40 px-3 py-2.5 select-none" id="statusBarContainer">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.9)]" />
                  Status
                </span>
                {contactGroups.some(g => g.hasUnread) && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                    Novos stories
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-0.5 scroll-smooth">
                {/* 1. Meu Status */}
                <div 
                  onClick={handleMyStatusClick}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                  title="Meu status - Toque para visualizar ou adicionar novo"
                >
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-full p-[2.5px] transition-all duration-200 group-hover:scale-105 ${
                      myGroup && myGroup.statuses.length > 0
                        ? 'bg-gradient-to-tr from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'p-[2px] border-2 border-dashed border-cyan-400/50 hover:border-cyan-300'
                    }`}>
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName}
                          className="w-full h-full rounded-full object-cover border-2 border-slate-950 bg-slate-900"
                        />
                      ) : (
                        <div 
                          className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-sm border-2 border-slate-950"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {user.initial}
                        </div>
                      )}
                    </div>

                    {/* Plus badge for adding status to Firebase Storage */}
                    <button
                      type="button"
                      onClick={handleAddStatusClick}
                      className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 rounded-full flex items-center justify-center font-black text-xs border-2 border-slate-950 shadow-md hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                      title="Adicionar foto ou vídeo ao Meu Status"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  </div>
                  <span className="text-[11px] font-semibold text-white/90 group-hover:text-cyan-300 transition-colors truncate max-w-[64px] text-center leading-tight">
                    Meu status
                  </span>
                </div>

                {/* 2. Contacts Statuses */}
                {contactGroups.map((group, index) => {
                  const isUnread = group.hasUnread;
                  const latestStatus = group.statuses[group.statuses.length - 1];
                  const isVideo = latestStatus?.mediaType === 'video';
                  const isText = latestStatus?.mediaType === 'text';
                  const isNotice = !!latestStatus?.isTribbuNotice;

                  return (
                    <div
                      key={group.userId}
                      onClick={() => handleContactStatusClick(index)}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                      title={`${group.userName} (${group.statuses.length} status)`}
                    >
                      <div className="relative">
                        {/* Se houver um status novo, a borda do círculo usa o degradê ciano e verde da logo */}
                        <div className={`w-14 h-14 rounded-full p-[2.5px] transition-all duration-200 group-hover:scale-105 ${
                          isUnread
                            ? 'bg-gradient-to-tr from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                            : 'p-[2px] bg-slate-700/60'
                        }`}>
                          {group.photoURL ? (
                            <img 
                              src={group.photoURL} 
                              alt={group.userName}
                              className="w-full h-full rounded-full object-cover border-2 border-slate-950 bg-slate-900"
                            />
                          ) : (
                            <div 
                              className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-sm border-2 border-slate-950"
                              style={{ backgroundColor: group.avatarColor }}
                            >
                              {group.userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Status type indicator badges */}
                        {isNotice ? (
                          <span className="absolute bottom-0 right-0 w-4 h-4 bg-slate-950 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-400/60 text-[9px] shadow" title="Aviso da Tribbu">
                            <Megaphone className="w-2.5 h-2.5 text-emerald-300" />
                          </span>
                        ) : isText ? (
                          <span className="absolute bottom-0 right-0 w-4 h-4 bg-slate-950 text-cyan-400 rounded-full flex items-center justify-center border border-cyan-400/60 text-[9px] shadow" title="Status em Texto">
                            <Type className="w-2.5 h-2.5 text-cyan-300" />
                          </span>
                        ) : isVideo ? (
                          <span className="absolute bottom-0 right-0 w-4 h-4 bg-slate-950 text-cyan-400 rounded-full flex items-center justify-center border border-cyan-400/40 text-[9px] shadow">
                            <Play className="w-2 h-2 fill-cyan-400" />
                          </span>
                        ) : null}
                      </div>

                      <span className={`text-[11px] font-medium truncate max-w-[64px] text-center leading-tight transition-colors ${
                        isUnread ? 'text-white font-semibold' : 'text-white/60 group-hover:text-white'
                      }`}>
                        {group.userName.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Archived chats row */}
            <div 
              onClick={() => alert('Conversas arquivadas: Nenhuma conversa arquivada no momento.')}
              className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 text-white/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-cyan-400 bg-cyan-500/10">
                <Archive className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-white">Arquivadas</span>
              </div>
            </div>

            {/* Conversation List with Separated Direct and Group Sections */}
            <div className="space-y-4 p-2">
              {filteredChats.length > 0 ? (
                <>
                  {/* SEÇÃO 1: CONVERSAS INDIVIDUAIS */}
                  {(activeFilter === 'all' || activeFilter === 'direct' || activeFilter === 'favorites' || (activeFilter === 'unread' && directChats.some(c => c.unreadCount > 0))) && directChats.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold tracking-wider uppercase text-cyan-300 select-none">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] animate-pulse" />
                          <span>Conversas Individuais</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-[10px] text-cyan-300 font-bold border border-cyan-500/30">
                          {directChats.length}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {directChats.map((chat) => {
                          const hasMessages = chat.messages && chat.messages.length > 0;
                          const lastMsg = hasMessages ? chat.messages[chat.messages.length - 1] : null;
                          const isActive = chat.id === activeChatId;
                          const isTyping = chat.statusText === 'digitando...';

                          return (
                            <div
                              key={chat.id}
                              onClick={() => onSelectChat(chat.id)}
                              className={`flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer transition-all duration-200 relative group ${
                                isActive 
                                  ? 'bg-gradient-to-r from-cyan-950/70 via-slate-900/90 to-slate-900/80 border border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.35)] text-white' 
                                  : 'hover:bg-white/[0.06] border border-white/5 hover:border-cyan-500/30'
                              }`}
                            >
                              {/* Avatar with Online indicator */}
                              <div 
                                className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-base relative shadow-inner overflow-hidden border ${
                                  isActive ? 'border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 'border-white/10'
                                }`}
                                style={{ backgroundColor: chat.avatarColor || '#06B6D4' }}
                              >
                                {chat.isAI || chat.id === 'tribbu-ai' ? (
                                  <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-[#041a24] to-slate-950 flex items-center justify-center relative border-2 border-cyan-400 shadow-[0_0_14px_rgba(6,182,212,0.55)]">
                                    <Bot className="w-6 h-6 text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,1)] stroke-[2.4]" />
                                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-cyan-400 border-2 border-slate-950 rounded-full shadow-[0_0_8px_rgba(6,182,212,1)] animate-pulse" />
                                  </div>
                                ) : chat.photoURL ? (
                                  <img 
                                    src={chat.photoURL} 
                                    alt={chat.name} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{chat.avatarLetter}</span>
                                )}
                                {chat.online && !(chat.isAI || chat.id === 'tribbu-ai') && (
                                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.9)]" title="Online" />
                                )}
                              </div>

                              {/* Info block */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`font-bold text-[14px] sm:text-[15px] truncate ${isActive ? 'text-cyan-200' : 'text-white'}`}>
                                      {chat.name}
                                    </span>
                                    {!chat.isGroup && !chat.isAI && chat.id !== 'tribbu-ai' && (
                                      <TribbuBalloonIcon className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.85)] flex-shrink-0" />
                                    )}
                                    {(chat.isAI || chat.id === 'tribbu-ai') && (
                                      <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-cyan-500/40 tracking-wider flex items-center gap-0.5 flex-shrink-0 shadow-sm shadow-cyan-500/20">
                                        <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                                        IA
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-white/40 font-medium flex-shrink-0 ml-2">
                                    {lastMsg ? lastMsg.time : ''}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between">
                                  {isTyping ? (
                                    <span className="text-xs font-semibold text-cyan-400 animate-pulse">
                                      digitando...
                                    </span>
                                  ) : (
                                    <p className="text-xs text-white/50 truncate pr-2">
                                      {lastMsg ? (
                                        <>
                                          {lastMsg.sender === 'me' && (
                                            <span className="text-cyan-400 font-semibold mr-1">Você:</span>
                                          )}
                                          {lastMsg.text}
                                        </>
                                      ) : (
                                        <span className="italic text-white/30">Nenhuma mensagem</span>
                                      )}
                                    </p>
                                  )}

                                  {/* Unread badge */}
                                  {chat.unreadCount > 0 && (
                                    <span className="min-w-[18px] h-[18px] bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center px-1 shadow-sm shadow-cyan-500/30">
                                      {chat.unreadCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SEÇÃO 2: TRIBBUS & GRUPOS COLETIVOS */}
                  {(activeFilter === 'all' || activeFilter === 'groups' || activeFilter === 'favorites' || (activeFilter === 'unread' && groupChats.some(c => c.unreadCount > 0))) && groupChats.length > 0 && (
                    <div className="space-y-1 pt-2">
                      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold tracking-wider uppercase text-teal-300 select-none">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.9)] animate-pulse" />
                          <span>Tribbus & Canais Coletivos</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-[10px] text-teal-300 font-bold border border-teal-500/30">
                          {groupChats.length}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {groupChats.map((chat) => {
                          const hasMessages = chat.messages && chat.messages.length > 0;
                          const lastMsg = hasMessages ? chat.messages[chat.messages.length - 1] : null;
                          const isActive = chat.id === activeChatId;
                          const isTyping = chat.statusText === 'digitando...';

                          return (
                            <div
                              key={chat.id}
                              onClick={() => onSelectChat(chat.id)}
                              className={`flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer transition-all duration-200 relative group ${
                                isActive 
                                  ? 'bg-gradient-to-r from-teal-950/70 via-slate-900/90 to-slate-900/80 border border-teal-400 shadow-[0_0_18px_rgba(20,184,166,0.35)] text-white' 
                                  : 'hover:bg-white/[0.06] border border-white/5 hover:border-teal-500/30'
                              }`}
                            >
                              {/* Avatar with Group Icon or photo */}
                              <div 
                                className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-base relative shadow-inner overflow-hidden border ${
                                  isActive ? 'border-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.6)]' : 'border-white/10'
                                }`}
                                style={{ backgroundColor: chat.avatarColor || '#0D9488' }}
                              >
                                {chat.photoURL ? (
                                  <img 
                                    src={chat.photoURL} 
                                    alt={chat.name} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Users className="w-6 h-6 text-white stroke-[2.2]" />
                                )}
                              </div>

                              {/* Info block */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`font-bold text-[14px] sm:text-[15px] truncate ${isActive ? 'text-teal-200' : 'text-white'}`}>
                                      {chat.name}
                                    </span>
                                    <span className="bg-teal-500/15 text-teal-300 text-[10px] font-bold px-1.5 py-0.2 rounded-md border border-teal-500/30 flex items-center gap-1 flex-shrink-0">
                                      <Users className="w-2.5 h-2.5" />
                                      {chat.members?.length ? `${chat.members.length} membros` : 'Tribbu'}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-white/40 font-medium flex-shrink-0 ml-2">
                                    {lastMsg ? lastMsg.time : ''}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between">
                                  {isTyping ? (
                                    <span className="text-xs font-semibold text-teal-400 animate-pulse">
                                      alguém está digitando...
                                    </span>
                                  ) : (
                                    <p className="text-xs text-white/50 truncate pr-2">
                                      {lastMsg ? (
                                        <>
                                          {lastMsg.sender === 'me' && (
                                            <span className="text-teal-400 font-semibold mr-1">Você:</span>
                                          )}
                                          {lastMsg.sender === 'them' && lastMsg.senderName && (
                                            <span className="text-white/70 font-medium mr-1">{lastMsg.senderName}:</span>
                                          )}
                                          {lastMsg.text}
                                        </>
                                      ) : (
                                        <span className="italic text-white/30">Nenhuma mensagem</span>
                                      )}
                                    </p>
                                  )}

                                  {/* Unread badge */}
                                  {chat.unreadCount > 0 && (
                                    <span className="min-w-[18px] h-[18px] bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center px-1 shadow-sm shadow-teal-500/30">
                                      {chat.unreadCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empty state when filter has no matches in its category */}
                  {activeFilter === 'direct' && directChats.length === 0 && (
                    <div className="p-8 text-center text-white/40">
                      Nenhuma conversa individual encontrada.
                    </div>
                  )}
                  {activeFilter === 'groups' && groupChats.length === 0 && (
                    <div className="p-8 text-center text-white/40">
                      Nenhuma Tribbu ou grupo encontrado.
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-white/40 flex flex-col items-center justify-center my-6">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                    <MessageSquarePlus className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-white/90">
                    {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa aqui'}
                  </p>
                  <p className="text-xs text-white/40 mt-1 max-w-[240px]">
                    Toque nos botões acima para iniciar uma conversa individual ou criar uma nova Tribbu.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Status Tab Content */}
        {activeTab === 'status' && (
          <div className="p-4 space-y-4 relative">
            {/* My Status Section */}
            <div 
              onClick={handleMyStatusClick}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer border border-white/10 transition-colors group"
            >
              <div className="relative">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName} 
                    className={`w-12 h-12 rounded-full object-cover p-0.5 ${
                      myGroup && myGroup.statuses.length > 0 
                        ? 'border-2 border-cyan-400 shadow-md shadow-cyan-500/20' 
                        : 'border border-white/20'
                    }`} 
                  />
                ) : (
                  <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base ${
                      myGroup && myGroup.statuses.length > 0 
                        ? 'border-2 border-cyan-400 shadow-md shadow-cyan-500/20' 
                        : 'border border-white/20'
                    }`} 
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.initial}
                  </div>
                )}
                
                {/* Add Status '+' button */}
                <button
                  type="button"
                  onClick={handleAddStatusClick}
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 rounded-full flex items-center justify-center font-black text-xs border-2 border-slate-900 shadow-sm hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                  title="Novo status"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Meu status</span>
                  {myGroup && myGroup.statuses.length > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      {myGroup.statuses.length} ativo{myGroup.statuses.length > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
                <p className="text-xs text-white/50 truncate mt-0.5">
                  {myGroup && myGroup.statuses.length > 0
                    ? 'Toque para ver seus status'
                    : 'Toque para adicionar uma foto ou vídeo'}
                </p>
              </div>
            </div>

            {/* Recent Updates from Contacts */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs font-bold text-cyan-200/70 uppercase tracking-wider">
                  Atualizações recentes
                </p>
                <span className="text-[11px] font-medium text-white/40">
                  {contactGroups.length} contato{contactGroups.length !== 1 ? 's' : ''}
                </span>
              </div>

              {contactGroups.length > 0 ? (
                <div className="space-y-1.5">
                  {contactGroups.map((group, index) => {
                    const latestStatus = group.statuses[group.statuses.length - 1];
                    const isUnread = group.hasUnread;

                    const diffMin = Math.floor((Date.now() - latestStatus.timestamp) / (1000 * 60));
                    const timeAgo = diffMin < 1 
                      ? 'Agora' 
                      : diffMin < 60 
                      ? `Há ${diffMin} min` 
                      : `Há ${Math.floor(diffMin / 60)}h`;

                    return (
                      <div
                        key={group.userId}
                        onClick={() => handleContactStatusClick(index)}
                        className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/10 transition-colors"
                      >
                        {/* Avatar with unread gradient ring or read border */}
                        <div className="relative">
                          <div className={`w-12 h-12 rounded-full p-[2px] ${
                            isUnread 
                              ? 'bg-gradient-to-tr from-cyan-400 via-teal-400 to-emerald-400 shadow-md shadow-cyan-500/20' 
                              : 'bg-white/20'
                          }`}>
                            {group.photoURL ? (
                              <img 
                                src={group.photoURL} 
                                alt={group.userName} 
                                className="w-full h-full rounded-full object-cover border-2 border-slate-950" 
                              />
                            ) : (
                              <div 
                                className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-sm border-2 border-slate-950"
                                style={{ backgroundColor: group.avatarColor }}
                              >
                                {group.userName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Video badge if latest status is a video */}
                          {latestStatus.mediaType === 'video' && (
                            <span className="absolute bottom-0 right-0 w-4 h-4 bg-slate-900 text-cyan-400 rounded-full flex items-center justify-center border border-white/20 text-[9px]">
                              <Play className="w-2 h-2 fill-cyan-400" />
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-sm text-white truncate">
                              {group.userName}
                            </p>
                            <span className="text-[11px] text-white/45 font-medium">
                              {timeAgo}
                            </span>
                          </div>
                          <p className="text-xs text-white/50 truncate mt-0.5">
                            {latestStatus.caption || (latestStatus.mediaType === 'video' ? 'Vídeo compartilhado' : 'Foto compartilhada')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 px-4 bg-white/[0.02] rounded-2xl border border-white/5">
                  <p className="text-xs text-white/50">
                    Nenhuma atualização recente no momento.
                  </p>
                  <p className="text-[11px] text-white/30 mt-1">
                    Quando seus contatos publicarem fotos ou vídeos, eles aparecerão aqui.
                  </p>
                </div>
              )}
            </div>

            {/* Quick action button to add status */}
            <button
              type="button"
              onClick={() => setShowNewStatusModal(true)}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500/15 to-emerald-500/15 hover:from-cyan-500/25 hover:to-emerald-500/25 border border-cyan-500/30 text-cyan-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>Publicar foto ou vídeo no Status</span>
            </button>
          </div>
        )}

        {/* Communities Tab Content */}
        {activeTab === 'communities' && (
          <div className="p-4 space-y-4">
            <div 
              onClick={() => setShowCommunityModal(true)}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 cursor-pointer transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 font-bold flex items-center justify-center shadow-md">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-white">Nova comunidade</p>
                <p className="text-xs text-cyan-200/80">Reúna seus grupos em um único espaço</p>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Suas comunidades</p>
              {chats.filter(c => c.isCommunity).length > 0 ? (
                chats.filter(c => c.isCommunity).map(com => (
                  <div 
                    key={com.id}
                    onClick={() => onSelectChat(com.id)}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer flex items-center gap-3 mb-2"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                      {com.avatarLetter}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{com.name}</p>
                      <p className="text-xs text-white/50">{com.statusText}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/40 italic">Você ainda não faz parte de nenhuma comunidade.</p>
              )}
            </div>
          </div>
        )}

        {/* Calls Tab Content */}
        {activeTab === 'calls' && (
          <div className="p-6 text-center space-y-3 my-auto">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/40 mx-auto">
              <Phone className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-sm text-white">Nenhuma chamada recente</h4>
            <p className="text-xs text-white/50 max-w-xs mx-auto">
              Para fazer chamadas de voz e vídeo com criptografia de ponta a ponta, inicie uma chamada a partir de uma conversa.
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) at Bottom Right */}
      {activeTab === 'chats' && (
        <button
          type="button"
          onClick={() => {
            setIsGroupChat(false);
            setShowNewChatModal(true);
          }}
          className="absolute bottom-20 right-4 w-14 h-14 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 active:scale-95 text-slate-950 rounded-2xl shadow-xl flex items-center justify-center cursor-pointer transition-all shadow-cyan-500/30 hover:shadow-cyan-400/50 z-30 font-bold"
          title="Nova conversa"
          id="fabNewChatBtn"
        >
          <MessageSquarePlus className="w-6 h-6 stroke-[2.4]" />
        </button>
      )}

      {/* Bottom Navigation Bar (Conversas, Status, Comunidades, Ligações) */}
      <div className="h-16 bg-slate-950/95 border-t border-white/10 px-4 flex items-center justify-around flex-shrink-0 z-30">
        {/* Conversas Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors cursor-pointer relative ${
            activeTab === 'chats' ? 'text-cyan-400 font-semibold' : 'text-white/50 hover:text-white'
          }`}
          title="Conversas"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 stroke-[2.2]" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-2 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 text-[9px] font-black rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center shadow-sm">
                {totalUnread}
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold mt-1">Conversas</span>
        </button>

        {/* Status Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'status' ? 'text-cyan-400 font-semibold' : 'text-white/50 hover:text-white'
          }`}
          title="Status"
        >
          <CircleDashed className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[11px] font-semibold mt-1">Status</span>
        </button>

        {/* Comunidades Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('communities')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'communities' ? 'text-cyan-400 font-semibold' : 'text-white/50 hover:text-white'
          }`}
          title="Comunidades"
        >
          <Users className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[11px] font-semibold mt-1">Comunidades</span>
        </button>

        {/* Ligações Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('calls')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'calls' ? 'text-cyan-400 font-semibold' : 'text-white/50 hover:text-white'
          }`}
          title="Ligações"
        >
          <Phone className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[11px] font-semibold mt-1">Ligações</span>
        </button>
      </div>

      {/* Modal - Nova Conversa / Novo Grupo */}
      {showNewChatModal && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border-t border-white/10 p-5 rounded-t-2xl shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-lg">
                {isGroupChat ? 'Criar Novo Grupo' : 'Iniciar Nova Conversa'}
              </h3>
              <button 
                onClick={() => setShowNewChatModal(false)}
                className="p-1 hover:bg-white/10 rounded-full cursor-pointer text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChatSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/50 block mb-1">
                  {isGroupChat ? 'Nome do Grupo' : 'Nome do Contato ou Conversa'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isGroupChat ? 'Ex: Família, Projetos, Churrasco...' : 'Ex: João Carlos, Dra. Amanda...'}
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                  maxLength={30}
                  autoFocus
                />
              </div>

              {/* Toggle group chat */}
              <div className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  id="isGroup"
                  checked={isGroupChat}
                  onChange={(e) => setIsGroupChat(e.target.checked)}
                  className="w-4 h-4 text-cyan-400 bg-white/5 border-white/10 rounded accent-cyan-400 cursor-pointer"
                />
                <label htmlFor="isGroup" className="text-sm font-medium text-white/80 cursor-pointer">
                  Criar como Grupo de Conversa
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="flex-1 border border-white/10 rounded-lg py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 rounded-lg py-2.5 text-sm font-extrabold shadow-md cursor-pointer transition-all shadow-cyan-500/25"
                >
                  {isGroupChat ? 'Criar Grupo' : 'Iniciar Conversa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Nova Comunidade */}
      <NewCommunityModal
        isOpen={showCommunityModal}
        onClose={() => setShowCommunityModal(false)}
        onCreateCommunity={handleCreateCommunitySubmit}
      />

      {/* Modal - Configurações (Settings) */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        user={user}
        onUpdateProfile={onUpdateUserProfile}
        onLogout={onLogout}
        onInstallPwa={onInstallPwa}
        canInstall={canInstall}
      />

      {/* Modal - Câmera para tirar foto ou selfie */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCameraPhotoCaptured}
        title="Câmera do Tribbu'sChat"
        isSelfie={true}
      />

      {/* Modal - Informações de Instalação PWA */}
      {showPwaInfoModal && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md flex flex-col justify-center items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-cyan-500/20 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-white text-center relative shadow-cyan-950/50">
            <button 
              onClick={() => setShowPwaInfoModal(false)}
              className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden shadow-2xl border-2 border-cyan-400/40 p-1 bg-slate-950 flex items-center justify-center glow-gradient">
              <img 
                src={logoUrl} 
                alt="Tribbu'sChat Icon" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('/icon/logo_oficial.png')) {
                    target.src = '/icon/logo_oficial.png';
                  }
                }}
              />
            </div>

            <h3 className="text-lg font-extrabold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent mb-1">
              Instalar Tribbu'sChat
            </h3>
            <p className="text-xs text-white/60 mb-5 leading-relaxed">
              Instale o Tribbu'sChat diretamente na tela de início do seu celular para ter a experiência completa e ágil de um aplicativo nativo.
            </p>

            <div className="space-y-2.5 text-left text-xs bg-white/5 p-3.5 rounded-xl border border-white/10 mb-5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">1</span>
                <p className="text-white/80">No Chrome/Android: Toque no menu <strong>⋮</strong> e selecione <strong>Instalar aplicativo</strong></p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">2</span>
                <p className="text-white/80">No iPhone (iOS): Toque em <strong>Compartilhar</strong> e selecione <strong>Adicionar à Tela de Início</strong></p>
              </div>
            </div>

            <button
              onClick={() => setShowPwaInfoModal(false)}
              className="w-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black py-2.5 rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-cyan-500/25"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Full-screen Story Status Viewer Modal */}
      <StatusViewerModal
        isOpen={showStatusViewer}
        onClose={() => setShowStatusViewer(false)}
        statusGroups={statusViewerGroups}
        initialGroupIndex={statusViewerGroupIndex}
        onReplyToStatus={handleReplyToStatus}
        onMarkStatusViewed={handleMarkStatusViewed}
      />

      {/* New Status Publisher Modal */}
      <NewStatusModal
        isOpen={showNewStatusModal}
        onClose={() => setShowNewStatusModal(false)}
        currentUser={user}
        availableGroups={chats}
        onPublishStatus={handlePublishStatus}
        onPublishTextStatus={handlePublishTextStatus}
      />

      {/* Modal - Nova Conversa Individual (busca de chip no Firestore) */}
      <NewDirectChatModal
        isOpen={showNewDirectChatModal}
        onClose={() => setShowNewDirectChatModal(false)}
        currentUser={user}
        onStartDirectChat={handleStartDirectChat}
      />

      {/* Modal - Lista de Contatos com Cruzamento de Dados e Ícone Tribbu */}
      <Contatos
        isOpen={showContatosModal}
        onClose={() => setShowContatosModal(false)}
        currentUser={user}
        onStartDirectChat={handleStartDirectChat}
        onSelectContact={handleStartDirectChat}
      />

      {/* Modal - Nova Tribbu (Criação de grupo com upload de foto e membros) */}
      <NewTribbuModal
        isOpen={showNewTribbuModal}
        onClose={() => setShowNewTribbuModal(false)}
        currentUser={user}
        onCreateTribbu={handleCreateTribbu}
      />
    </div>
  );
}
