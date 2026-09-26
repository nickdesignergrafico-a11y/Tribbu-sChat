import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Chat, Message, UserSession, isUserProfileComplete } from './types';
import { INITIAL_CHATS, TRIBBU_AI_CHAT, TRIBBU_AI_CHAT_ID } from './initialData';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import JoinGroupModal from './components/JoinGroupModal';
import { uploadProfilePhoto } from './services/storageService';
import { navigate } from './utils/navigation';

// Helper to strictly ensure Tribbu AI is always permanently available in the chat list
function ensureTribbuAIPresent(chatList: Chat[]): Chat[] {
  const hasAI = chatList.some(c => c.id === TRIBBU_AI_CHAT_ID || c.name === 'Tribbu AI');
  if (!hasAI) {
    return [TRIBBU_AI_CHAT, ...chatList];
  }
  return chatList.map(c => (c.id === TRIBBU_AI_CHAT_ID || c.name === 'Tribbu AI') ? { ...c, isAI: true } : c);
}

// Helper to normalize phone numbers for reliable comparison
export function normalizePhone(p?: string): string {
  return (p || '').replace(/\D/g, '');
}

export function isSamePhoneNumber(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.length >= 8) {
    return na.endsWith(nb) || nb.endsWith(na);
  }
  return false;
}

// Helper to strictly deduplicate messages by ID or by same-sender content within a 5-second window
function deduplicateMessages(messages: Message[]): Message[] {
  const seenIds = new Set<string>();
  const result: Message[] = [];

  for (const msg of messages) {
    if (!msg || !msg.id) continue;
    if (seenIds.has(msg.id)) continue;

    // Check for near-identical duplicate from same sender (e.g. optimistic vs server vs firestore)
    const isDuplicate = result.some(existing => {
      if (existing.id === msg.id) return true;
      const sameSender = (existing.sender === msg.sender) || 
                         isSamePhoneNumber(existing.senderPhoneNumber, msg.senderPhoneNumber) ||
                         (existing.senderEmail && msg.senderEmail && existing.senderEmail === msg.senderEmail);
      if (!sameSender) return false;

      const timeDiff = Math.abs((existing.timestamp || 0) - (msg.timestamp || 0));
      const sameText = (existing.text || '').trim() === (msg.text || '').trim();
      const sameMedia = existing.mediaUrl === msg.mediaUrl && existing.type === msg.type;
      
      // If same content within 6 seconds, consider it the same message
      return (sameText || sameMedia) && timeDiff < 6000;
    });

    if (!isDuplicate) {
      seenIds.add(msg.id);
      result.push(msg);
    }
  }

  return result.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

interface MainChatAppProps {
  userSession?: UserSession | null;
  onLogout?: () => void;
}

export default function App({ userSession, onLogout }: MainChatAppProps = {}) {
  const [user, setUser] = useState<UserSession | null>(() => {
    if (userSession && isUserProfileComplete(userSession)) return userSession;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('zapchat_user');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && isUserProfileComplete(parsed)) return parsed;
        }
      } catch (_) {}
    }
    return null;
  });

  useEffect(() => {
    if (userSession && isUserProfileComplete(userSession)) {
      setUser(userSession);
    }
  }, [userSession]);

  const [chats, setChats] = useState<Chat[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zapchat_local_chats');
        if (saved) {
          const parsed = JSON.parse(saved);
          const hasOldMock = Array.isArray(parsed) && parsed.some(
            (c: any) => c.id === 'grupo-projetos' || c.id === 'amanda-silva' || c.id === 'suporte-zapchat' || c.id === 'familia' || c.id === 'marcos-vinicius'
          );
          if (hasOldMock) {
            localStorage.removeItem('zapchat_local_chats');
            return [TRIBBU_AI_CHAT];
          }
          const restored = parsed.map((c: any) => ({
            ...c,
            messages: deduplicateMessages(c.messages || [])
          }));
          return ensureTribbuAIPresent(restored);
        }
      } catch (_) {}
    }
    return [TRIBBU_AI_CHAT];
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(TRIBBU_AI_CHAT_ID);
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  // Group Invite Link states
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [groupPreview, setGroupPreview] = useState<any | null>(null);
  const [isCheckingInvite, setIsCheckingInvite] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);

  const lastSyncTimeRef = useRef<number>(0);
  const activeChatIdRef = useRef<string | null>(activeChatId);

  // Check URL query parameters for invite links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite');
      if (invite) {
        setPendingInviteCode(invite);
      }
    }
  }, []);

  // When user is logged in and there is a pending invite code, load preview
  useEffect(() => {
    if (!user || !pendingInviteCode) return;

    const fetchInvitePreview = async () => {
      setIsCheckingInvite(true);
      setInviteError(null);
      setShowJoinModal(true);

      try {
        let loadedData: any = null;
        try {
          const res = await fetch(`/api/invites/${pendingInviteCode}`);
          if (res.ok) {
            loadedData = await res.json();
          }
        } catch (_) {
          // Backend not reachable on static host
        }

        if (loadedData) {
          setGroupPreview(loadedData);
          return;
        }

        // Fallback: check local chats or Firestore
        const existingChat = chats.find(c => c.inviteCode === pendingInviteCode || c.id === pendingInviteCode);
        if (existingChat) {
          setGroupPreview({
            id: existingChat.id,
            name: existingChat.name,
            avatarColor: existingChat.avatarColor,
            avatarLetter: existingChat.avatarLetter,
            description: "Grupo no Tribbu'sChat",
            memberCount: 4,
            createdAt: 'Recente',
            createdBy: 'Administrador'
          });
          return;
        }

        try {
          const chatsSnap = await getDocs(collection(db, 'chats'));
          let foundChat: any = null;
          chatsSnap.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.inviteCode === pendingInviteCode || docSnap.id === pendingInviteCode) {
              foundChat = { id: docSnap.id, ...d };
            }
          });

          if (foundChat) {
            setGroupPreview({
              id: foundChat.id,
              name: foundChat.name,
              avatarColor: foundChat.avatarColor,
              avatarLetter: foundChat.avatarLetter,
              description: foundChat.description || "Grupo no Tribbu'sChat",
              memberCount: foundChat.members ? foundChat.members.length : 2,
              createdAt: foundChat.createdAt || 'Recente',
              createdBy: foundChat.createdBy || 'Administrador'
            });
            return;
          }
        } catch {
          // Silent fallback for Firestore invite check
        }

        // Default group fallback for valid preview
        setGroupPreview({
          id: 'grupo-projetos',
          name: 'Grupo de Projetos 🚀',
          avatarColor: '#06B6D4',
          avatarLetter: 'GP',
          description: "Grupo de desenvolvimento e colaboração Tribbu'sChat.",
          memberCount: 4,
          createdAt: 'Criado recentemente',
          createdBy: 'Administrador'
        });
      } catch (err: any) {
        setInviteError(err.message || 'Erro ao carregar convite.');
      } finally {
        setIsCheckingInvite(false);
      }
    };

    fetchInvitePreview();
  }, [user, pendingInviteCode, chats]);

  // Capture PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredInstallPrompt(null);
      }
    }
  };

  // Sync activeChatId ref for the polling interval closure
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // 1. Firebase Authentication Listener (Handles login persistence & /cadastro flow)
  useEffect(() => {
    let userProfileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (userProfileUnsubscribe) {
        userProfileUnsubscribe();
        userProfileUnsubscribe = null;
      }

      if (fbUser) {
        let existingSession: UserSession | null = null;
        try {
          const cached = localStorage.getItem('zapchat_user');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.uid === fbUser.uid || parsed.email === fbUser.email) && isUserProfileComplete(parsed)) {
              existingSession = parsed;
              setUser(parsed);
            } else {
              // Limpa cache que continha apenas número de telefone ou perfil incompleto
              localStorage.removeItem('zapchat_user');
            }
          }
        } catch (_) {}

        // Listen to Firestore doc /users/{uid} in real-time
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          userProfileUnsubscribe = onSnapshot(
            userDocRef,
            (docSnap) => {
              const data = docSnap.exists() ? docSnap.data() : null;
              if (docSnap.exists() && isUserProfileComplete(data)) {
                const phone = data?.phoneNumber || fbUser.phoneNumber || (fbUser.email?.includes('@zapchat.phone') ? ('+' + fbUser.email.replace('@zapchat.phone', '')) : undefined) || '+5511999999999';
                const name = data?.displayName;
                const session: UserSession = {
                  uid: fbUser.uid,
                  phoneNumber: phone,
                  displayName: name,
                  email: data?.email || fbUser.email || undefined,
                  initial: data?.initial || name.charAt(0).toUpperCase() || 'U',
                  avatarColor: data?.avatarColor || '#06B6D4',
                  photoURL: data?.photoURL || fbUser.photoURL || undefined,
                  profileCompleted: true
                };
                setUser(session);
                try {
                  localStorage.setItem('zapchat_user', JSON.stringify(session));
                } catch (_) {}

                if (window.location.pathname === '/login') {
                  navigate('/chat');
                }
              } else {
                // Perfil pendente na coleção /users: a coordenação de rotas é tratada pelo App.jsx
                setUser(null);
              }
            },
            () => {
              // Silencioso em caso de offline
            }
          );
        } catch {
          // Silencioso
        }
      } else {
        setUser(null);
      }
      setIsInitializing(false);
    });

    return () => {
      unsubscribe();
      if (userProfileUnsubscribe) {
        userProfileUnsubscribe();
      }
    };
  }, []);

  // 2. Fetch all chats once user is logged in
  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      const token = localStorage.getItem('zapchat_token');
      let loaded = false;

      try {
        const res = await fetch('/api/chats', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (res.ok) {
          const serverChats = await res.json();
          const mappedChats = serverChats.map((chat: any) => ({
            ...chat,
            messages: chat.messages.map((msg: any) => ({
              id: msg.id,
              sender: (msg.senderPhoneNumber && user.phoneNumber && msg.senderPhoneNumber === user.phoneNumber) ||
                      (msg.senderEmail && user.email && msg.senderEmail === user.email) ||
                      (msg.senderEmail === user.phoneNumber) ||
                      (msg.senderId && user.uid && msg.senderId === user.uid) ? 'me' : 'them',
              senderName: msg.senderName,
              senderPhoneNumber: msg.senderPhoneNumber,
              senderEmail: msg.senderEmail,
              senderId: msg.senderId,
              text: msg.text,
              time: msg.time,
              timestamp: msg.timestamp,
              status: msg.status,
              type: msg.type,
              mediaUrl: msg.mediaUrl,
              fileName: msg.fileName,
              fileSize: msg.fileSize,
              contactName: msg.contactName,
              contactPhone: msg.contactPhone
            }))
          }));

          const finalMapped = ensureTribbuAIPresent(mappedChats);
          setChats(finalMapped);
          lastSyncTimeRef.current = Date.now();
          loaded = true;
          if (finalMapped.length > 0) {
            setActiveChatId(curr => curr || finalMapped[0].id);
          }
          try {
            localStorage.setItem('zapchat_local_chats', JSON.stringify(finalMapped));
          } catch (_) {}
        }
      } catch {
        // Fallback for static hosting mode
      }

      if (!loaded) {
        // Fetch from Firestore or keep initialized chats
        try {
          const snap = await getDocs(collection(db, 'chats'));
          if (!snap.empty) {
            const fsChats: Chat[] = [];
            snap.forEach(d => {
              const chatData = d.data();
              fsChats.push({ 
                id: d.id, 
                ...chatData,
                messages: Array.isArray(chatData.messages) ? chatData.messages : []
              } as Chat);
            });
            const finalFs = ensureTribbuAIPresent(fsChats);
            setChats(finalFs);
            setActiveChatId(curr => curr || finalFs[0].id);
            try {
              localStorage.setItem('zapchat_local_chats', JSON.stringify(finalFs));
            } catch (_) {}
          } else {
            setChats([TRIBBU_AI_CHAT]);
            setActiveChatId(TRIBBU_AI_CHAT_ID);
          }
        } catch {
          // Graceful silent fallback
        }
      }
    };

    fetchChats();
  }, [user]);

  // 3. Optional Express backend polling (active in fullstack mode, automatically backs off in static/Netlify mode)
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    let intervalId: any;
    let failureCount = 0;

    const pollSync = async () => {
      const token = localStorage.getItem('zapchat_token');

      try {
        const res = await fetch(`/api/sync?since=${lastSyncTimeRef.current}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!res.ok) {
          failureCount++;
          if (failureCount >= 2 || res.status === 404) {
            // Static hosting mode detected (e.g. Netlify) or API endpoint not found.
            // Cease polling and rely on Firestore real-time snapshots.
            if (intervalId) clearInterval(intervalId);
          }
          return;
        }

        // Reset failure count on valid response
        failureCount = 0;
        const data = await res.json();
        if (!isMounted) return;

        // Update sync time
        lastSyncTimeRef.current = data.timestamp;

        // Sync new messages across chats
        if (data.messages && data.messages.length > 0) {
          setChats(prevChats => {
            let updated = false;
            const nextChats = prevChats.map(chat => {
              const chatMessages = data.messages.filter((m: any) => m.chatId === chat.id);
              if (chatMessages.length === 0) return chat;

              // Filter and map incoming messages from server
              const newMsgs = chatMessages.map((m: any) => ({
                id: m.id,
                sender: ((m.senderPhoneNumber && user.phoneNumber && m.senderPhoneNumber === user.phoneNumber) ||
                         (m.senderEmail && user.email && m.senderEmail === user.email) ||
                         (m.senderEmail === user.phoneNumber) ||
                         (m.senderId && user.uid && m.senderId === user.uid)) ? 'me' as const : 'them' as const,
                senderName: m.senderName,
                senderPhoneNumber: m.senderPhoneNumber,
                senderEmail: m.senderEmail,
                senderId: m.senderId,
                text: m.text,
                time: m.time,
                timestamp: m.timestamp,
                status: m.status,
                type: m.type,
                mediaUrl: m.mediaUrl,
                fileName: m.fileName,
                fileSize: m.fileSize,
                contactName: m.contactName,
                contactPhone: m.contactPhone
              }));

              const currentChatMsgs = Array.isArray(chat.messages) ? chat.messages : [];
              const merged = deduplicateMessages([...currentChatMsgs, ...newMsgs]);
              if (merged.length === currentChatMsgs.length) return chat;

              updated = true;
              const isCurrentlyActive = chat.id === activeChatIdRef.current;

              return {
                ...chat,
                messages: merged,
                unreadCount: isCurrentlyActive ? 0 : (chat.unreadCount || 0) + (merged.length - currentChatMsgs.length)
              };
            });

            return updated ? ensureTribbuAIPresent(nextChats) : prevChats;
          });
        }

        // Sync chats list (new conversations and online status updates)
        if (data.chats) {
          setChats(prevChats => {
            const mergedChats = [...prevChats];
            
            data.chats.forEach((serverChat: any) => {
              const existingIndex = mergedChats.findIndex(c => c.id === serverChat.id);
              
              if (existingIndex === -1) {
                // New chat created
                const clientChat: Chat = {
                  ...serverChat,
                  messages: (Array.isArray(serverChat.messages) ? serverChat.messages : []).map((m: any) => ({
                    id: m.id,
                    sender: (isSamePhoneNumber(m.senderPhoneNumber, user.phoneNumber) ||
                             (m.senderEmail && user.email && m.senderEmail === user.email) ||
                             (m.senderEmail === user.phoneNumber) ||
                             (m.senderId && user.uid && m.senderId === user.uid)) ? 'me' as const : 'them' as const,
                    senderName: m.senderName,
                    senderPhoneNumber: m.senderPhoneNumber,
                    text: m.text,
                    time: m.time,
                    timestamp: m.timestamp,
                    status: m.status
                  }))
                };
                mergedChats.unshift(clientChat);
              } else {
                // Update online status or status text
                mergedChats[existingIndex] = {
                  ...mergedChats[existingIndex],
                  statusText: serverChat.statusText,
                  online: serverChat.online
                };
              }
            });

            return ensureTribbuAIPresent(mergedChats);
          });
        }

      } catch {
        failureCount++;
        if (failureCount >= 2) {
          // Backend API is unreachable (e.g. running statically on Netlify or offline).
          // Stop polling gracefully without spamming the console.
          if (intervalId) clearInterval(intervalId);
        }
      }
    };

    intervalId = setInterval(pollSync, 1200);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [user]);

  // 3b. Real-time Firestore sync for active chat (enables instant messaging across devices and on Netlify static hosting)
  useEffect(() => {
    if (!user || !activeChatId || !auth.currentUser) return;

    try {
      const messagesRef = collection(db, 'chats', activeChatId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) return;
        const firestoreMsgs: Message[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          firestoreMsgs.push({
            id: docSnap.id,
            sender: (isSamePhoneNumber(data.senderPhoneNumber, user.phoneNumber) ||
                     (data.senderId && user.uid && data.senderId === user.uid) ||
                     (data.senderEmail && user.email && data.senderEmail === user.email) ||
                     (data.senderEmail === user.phoneNumber)) ? 'me' : 'them',
            senderName: data.senderName,
            senderPhoneNumber: data.senderPhoneNumber,
            senderEmail: data.senderEmail,
            senderId: data.senderId,
            text: data.text || '',
            time: data.time || '',
            timestamp: data.timestamp || Date.now(),
            status: data.status || 'sent',
            type: data.type || data.mediaType || 'text',
            mediaType: data.mediaType || data.type || 'text',
            mediaUrl: data.mediaUrl || (data.text && (data.text.startsWith('http://') || data.text.startsWith('https://') || data.text.startsWith('data:')) ? data.text : undefined),
            fileName: data.fileName || undefined,
            fileSize: data.fileSize || undefined,
            contactName: data.contactName || undefined,
            contactPhone: data.contactPhone || undefined
          });
        });

        if (firestoreMsgs.length > 0) {
          setChats(prev => {
            return prev.map(c => {
              if (c.id === activeChatId) {
                const currentMsgs = Array.isArray(c.messages) ? c.messages : [];
                return {
                  ...c,
                  messages: deduplicateMessages([...currentMsgs, ...firestoreMsgs])
                };
              }
              return c;
            });
          });
        }
      }, () => {
        // Silent catch for permissions or offline mode
      });

      return () => unsubscribe();
    } catch {
      // Handled silently
    }
  }, [user, activeChatId]);

  const handleLoginSuccess = (session: UserSession, token: string) => {
    setUser(session);
    localStorage.setItem('zapchat_user', JSON.stringify(session));
    localStorage.setItem('zapchat_token', token);
    setActiveChatId(TRIBBU_AI_CHAT_ID);
    setMobileShowChat(false);
    navigate('/chat');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Graceful sign out
    }
    setUser(null);
    setChats([]);
    setActiveChatId(null);
    setMobileShowChat(false);
    localStorage.removeItem('zapchat_user');
    localStorage.removeItem('zapchat_token');
    if (onLogout) {
      onLogout();
    }
    await navigate('/login');
  };

  const getFormattedTime = () => {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  };

  // 4. Send message securely to server and Firestore with synchronized ID
  const handleSendMessage = async (
    text: string,
    media?: {
      type?: 'text' | 'image' | 'video' | 'document' | 'location' | 'contact' | 'audio';
      mediaType?: 'text' | 'image' | 'video' | 'document' | 'location' | 'contact' | 'audio';
      mediaUrl?: string;
      fileName?: string;
      fileSize?: string;
      contactName?: string;
      contactPhone?: string;
    }
  ) => {
    if (!activeChatId || !user) return;

    const token = localStorage.getItem('zapchat_token');
    const timeString = getFormattedTime();
    const nowTimestamp = Date.now();
    // Unique message ID shared by Client, Express, and Firestore
    const messageId = `msg_${nowTimestamp}_${Math.random().toString(36).substring(2, 9)}`;

    const messageType = media?.type || media?.mediaType || 'text';
    const messageText = text?.trim() || (media?.mediaUrl ? media.mediaUrl : (media?.fileName ? `[Arquivo: ${media.fileName}]` : ''));

    const senderPhone = user.phoneNumber || '+5511999999999';
    const senderName = user.displayName || senderPhone;

    const newMessage: Message = {
      id: messageId,
      sender: 'me',
      senderName,
      senderPhoneNumber: senderPhone,
      senderEmail: user.email,
      senderId: user.uid,
      text: messageText,
      time: timeString,
      timestamp: nowTimestamp,
      status: 'sent',
      type: messageType,
      mediaType: messageType,
      mediaUrl: media?.mediaUrl,
      fileName: media?.fileName,
      fileSize: media?.fileSize,
      contactName: media?.contactName,
      contactPhone: media?.contactPhone
    };

    // A. Optimistic Update with shared messageId
    setChats(prev => {
      const next = prev.map(chat => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: deduplicateMessages([...chat.messages, newMessage])
          };
        }
        return chat;
      });
      try {
        localStorage.setItem('zapchat_local_chats', JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    // B. Save to Firestore subcollection chats/{activeChatId}/messages using setDoc with EXACT messageId
    try {
      await setDoc(doc(db, 'chats', activeChatId, 'messages', messageId), {
        id: messageId,
        text: messageText,
        senderPhoneNumber: senderPhone,
        senderName,
        senderId: user.uid || auth.currentUser?.uid || null,
        senderEmail: user.email || null,
        time: timeString,
        timestamp: nowTimestamp,
        status: 'sent',
        type: messageType,
        mediaType: messageType,
        mediaUrl: media?.mediaUrl || null,
        fileName: media?.fileName || null,
        fileSize: media?.fileSize || null,
        contactName: media?.contactName || null,
        contactPhone: media?.contactPhone || null
      });

      // Update parent chat summary in Firestore
      await setDoc(doc(db, 'chats', activeChatId), {
        lastMessage: messageType === 'image' ? '📷 Foto' : messageType === 'video' ? '🎥 Vídeo' : messageType === 'audio' ? '🎤 Mensagem de voz' : messageText,
        lastMessageTime: timeString,
        lastMessageTimestamp: nowTimestamp,
        updatedAt: nowTimestamp
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore message save notice:', err);
    }

    // C. Send message to backend Express server with the SAME messageId
    try {
      await fetch(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: messageId,
          text: messageText,
          senderPhoneNumber: senderPhone,
          senderName,
          senderId: user.uid,
          userEmail: user.email || senderPhone,
          type: messageType,
          mediaType: messageType,
          mediaUrl: media?.mediaUrl,
          fileName: media?.fileName,
          fileSize: media?.fileSize,
          contactName: media?.contactName,
          contactPhone: media?.contactPhone
        })
      });
    } catch {
      // Silent catch
    }

    // D. If sending to Tribbu AI, query Gemini API via /api/ai/chat and save response to Firestore
    const currentChat = chats.find(c => c.id === activeChatId);
    if (activeChatId === TRIBBU_AI_CHAT_ID || currentChat?.isAI) {
      // Set typing indicator for Tribbu AI
      setChats(prev => prev.map(c => (c.id === activeChatId ? { ...c, statusText: 'digitando...' } : c)));

      (async () => {
        try {
          const recentHistory = (currentChat?.messages || []).slice(-8).map(m => ({
            role: m.sender === 'me' ? 'user' : 'model',
            content: m.text || ''
          }));

          const aiResponse = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              message: messageText || (media?.mediaUrl ? '[Arquivo de mídia enviado]' : ''),
              senderPhoneNumber: senderPhone,
              history: recentHistory
            })
          });

          let replyText = 'Olá! Sou o Tribbu AI. Como posso te ajudar hoje no Tribbu\'sChat?';
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.reply) {
              replyText = aiData.reply;
            }
          }

          const aiMsgId = `msg_ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const aiTime = getFormattedTime();
          const aiTimestamp = Date.now();

          const aiMessage: Message = {
            id: aiMsgId,
            sender: 'them',
            senderName: 'Tribbu AI',
            senderPhoneNumber: 'tribbu-ai',
            text: replyText,
            time: aiTime,
            timestamp: aiTimestamp,
            status: 'read',
            type: 'text',
            mediaType: 'text'
          };

          // Save AI response to Firestore chats/messages
          try {
            await setDoc(doc(db, 'chats', activeChatId, 'messages', aiMsgId), {
              id: aiMsgId,
              text: replyText,
              senderPhoneNumber: 'tribbu-ai',
              senderName: 'Tribbu AI',
              senderId: 'tribbu-ai',
              time: aiTime,
              timestamp: aiTimestamp,
              status: 'read',
              type: 'text',
              mediaType: 'text'
            });

            // Update parent chat summary in Firestore
            await setDoc(doc(db, 'chats', activeChatId), {
              id: activeChatId,
              name: 'Tribbu AI',
              isAI: true,
              lastMessage: replyText,
              lastMessageTime: aiTime,
              lastMessageTimestamp: aiTimestamp,
              updatedAt: aiTimestamp
            }, { merge: true });
          } catch (fsErr) {
            console.warn('Firestore AI save fallback:', fsErr);
          }

          // Also save in local server if running
          try {
            await fetch(`/api/chats/${activeChatId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: aiMsgId,
                text: replyText,
                senderPhoneNumber: 'tribbu-ai',
                senderName: 'Tribbu AI',
                type: 'text'
              })
            });
          } catch (_) {}

          // Update local state with the AI reply
          setChats(prev => {
            const next = prev.map(c => {
              if (c.id === activeChatId) {
                const currentMsgs = Array.isArray(c.messages) ? c.messages : [];
                return {
                  ...c,
                  statusText: 'Tribbu AI • Assistente Inteligente Online',
                  messages: deduplicateMessages([...currentMsgs, aiMessage])
                };
              }
              return c;
            });
            try {
              localStorage.setItem('zapchat_local_chats', JSON.stringify(next));
            } catch (_) {}
            return next;
          });
        } catch (aiErr) {
          console.error('Error generating AI response:', aiErr);
          setChats(prev => prev.map(c => (c.id === activeChatId ? { ...c, statusText: 'Tribbu AI • Assistente Inteligente Online' } : c)));
        }
      })();
    }
  };

  const handleSendAttachment = (type: 'image' | 'document' | 'location' | 'contact' | 'video') => {
    if (!activeChatId) return;

    if (type === 'location') {
      handleSendMessage('📍 Localização compartilhada', { type: 'location' });
    } else if (type === 'contact') {
      const contactPhone = user?.phoneNumber || '+55 (11) 99999-9999';
      const contactName = user?.displayName || user?.phoneNumber || 'Contato';
      handleSendMessage(`👤 Contato: ${contactName} • ${contactPhone}`, { 
        type: 'contact',
        contactName,
        contactPhone
      });
    }
  };

  // 5. Create new chat on server and in Firestore
  const handleAddNewChat = async (
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
  ) => {
    if (!user) return;

    // Check if an existing 1-on-1 chat with this contact or phone already exists
    if (!isGroup && options?.contactPhoneNumber) {
      const existing = chats.find(c => 
        !c.isGroup && (
          c.name === name || 
          c.statusText?.includes(options.contactPhoneNumber!) ||
          (c.members && c.members.includes(options.contactPhoneNumber!))
        )
      );
      if (existing) {
        setActiveChatId(existing.id);
        setMobileShowChat(true);
        return;
      }
    }

    const token = localStorage.getItem('zapchat_token');
    let clientChat: Chat | null = null;

    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          name, 
          isGroup, 
          photoURL: options?.photoURL,
          avatarColor: options?.avatarColor,
          avatarLetter: options?.avatarLetter,
          members: options?.members,
          contactPhoneNumber: options?.contactPhoneNumber,
          description: options?.description,
          senderPhoneNumber: user.phoneNumber,
          userEmail: user.phoneNumber || user.email 
        })
      });

      if (res.ok) {
        const serverChat = await res.json();
        clientChat = {
          ...serverChat,
          photoURL: options?.photoURL || serverChat.photoURL,
          messages: serverChat.messages.map((m: any) => ({
            id: m.id,
            sender: ((m.senderPhoneNumber && user.phoneNumber && m.senderPhoneNumber === user.phoneNumber) ||
                     (m.senderEmail && user.email && m.senderEmail === user.email) ||
                     (m.senderEmail === user.phoneNumber) ||
                     (m.senderId && user.uid && m.senderId === user.uid)) ? 'me' as const : 'them' as const,
            senderName: m.senderName,
            senderPhoneNumber: m.senderPhoneNumber,
            text: m.text,
            time: m.time,
            timestamp: m.timestamp,
            status: m.status
          }))
        };
      }
    } catch {
      // Fallback for static mode
    }

    if (!clientChat) {
      const chatId = `chat-${Date.now()}`;
      const words = name.trim().split(' ').filter(Boolean);
      const avatarLetters = options?.avatarLetter || words.map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'TC';
      const inviteCode = isGroup ? `tribbu-${Math.random().toString(36).substring(2, 9)}` : undefined;
      const creatorPhone = user.phoneNumber || '+5511999999999';
      
      const resolvedMembers = options?.members && options.members.length > 0 
        ? Array.from(new Set([creatorPhone, ...options.members]))
        : (isGroup ? [creatorPhone] : (options?.contactPhoneNumber ? [creatorPhone, options.contactPhoneNumber] : [creatorPhone]));

      const welcomeText = isGroup 
        ? `Tribbu "${name}" criada com sucesso! Compartilhe ideias e mensagens com o grupo.` 
        : `Conversa com ${name} iniciada. Envie uma mensagem!`;

      const initialMessage: Message = {
        id: `msg-${Date.now()}`,
        sender: 'me',
        senderName: user.displayName || creatorPhone,
        senderPhoneNumber: creatorPhone,
        text: welcomeText,
        time: getFormattedTime(),
        timestamp: Date.now(),
        status: 'sent'
      };

      clientChat = {
        id: chatId,
        name,
        avatarColor: options?.avatarColor || '#06B6D4',
        avatarLetter: avatarLetters,
        photoURL: options?.photoURL,
        isGroup,
        statusText: isGroup ? `${resolvedMembers.length} participante${resolvedMembers.length > 1 ? 's' : ''}` : 'online',
        online: !isGroup,
        unreadCount: 0,
        inviteCode,
        createdBy: creatorPhone,
        members: resolvedMembers,
        description: options?.description,
        createdAt: new Date().toISOString(),
        messages: [initialMessage]
      };
    }

    // Register conversation entity in Firestore "chats" collection
    try {
      await setDoc(doc(db, 'chats', clientChat.id), {
        id: clientChat.id,
        name: clientChat.name,
        isGroup: clientChat.isGroup,
        avatarColor: clientChat.avatarColor,
        avatarLetter: clientChat.avatarLetter,
        photoURL: clientChat.photoURL || null,
        createdBy: user.phoneNumber || user.email || 'user',
        statusText: clientChat.statusText,
        online: clientChat.online,
        inviteCode: clientChat.inviteCode || null,
        members: clientChat.members || [user.phoneNumber],
        description: clientChat.description || null,
        createdAt: new Date().toISOString(),
        lastMessage: clientChat.messages?.[0]?.text || '',
        lastMessageTime: clientChat.messages?.[0]?.time || getFormattedTime(),
        lastMessageTimestamp: clientChat.messages?.[0]?.timestamp || Date.now(),
        unreadCount: 0
      });

      // Write initial message to Firestore subcollection
      if (clientChat.messages && clientChat.messages.length > 0) {
        const firstMsg = clientChat.messages[0];
        await addDoc(collection(db, 'chats', clientChat.id, 'messages'), {
          text: firstMsg.text,
          senderPhoneNumber: user.phoneNumber,
          senderName: user.displayName || user.phoneNumber,
          senderId: user.uid || null,
          time: firstMsg.time,
          timestamp: firstMsg.timestamp,
          status: 'sent'
        });
      }
    } catch (e) {
      console.error('Error creating chat in Firestore:', e);
    }

    setChats(prev => {
      const next = [clientChat!, ...prev];
      try {
        localStorage.setItem('zapchat_local_chats', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    setActiveChatId(clientChat.id);
    setMobileShowChat(true);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setMobileShowChat(true);

    // Clean unread count locally instantly
    setChats(prev => prev.map(chat => {
      if (chat.id === id) {
        return { ...chat, unreadCount: 0 };
      }
      return chat;
    }));
  };

  // 6. Join Group via Invite Link
  const handleJoinGroup = async () => {
    if (!user || !pendingInviteCode) return;

    const token = localStorage.getItem('zapchat_token');
    let clientChat: Chat | null = null;

    try {
      const res = await fetch(`/api/invites/${pendingInviteCode}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          senderPhoneNumber: user.phoneNumber,
          userEmail: user.phoneNumber || user.email 
        })
      });

      if (res.ok) {
        const serverChat = await res.json();
        clientChat = {
          ...serverChat,
          messages: serverChat.messages.map((m: any) => ({
            id: m.id,
            sender: ((m.senderPhoneNumber && user.phoneNumber && m.senderPhoneNumber === user.phoneNumber) ||
                     (m.senderEmail && user.email && m.senderEmail === user.email) ||
                     (m.senderEmail === user.phoneNumber) ||
                     (m.senderId && user.uid && m.senderId === user.uid)) ? 'me' as const : 'them' as const,
            senderName: m.senderName,
            senderPhoneNumber: m.senderPhoneNumber,
            text: m.text,
            time: m.time,
            timestamp: m.timestamp,
            status: m.status
          }))
        };
      }
    } catch {
      // Fallback for static mode
    }

    if (!clientChat) {
      const targetGroup = chats.find(c => c.inviteCode === pendingInviteCode || c.id === pendingInviteCode) || {
        id: groupPreview?.id || 'grupo-projetos',
        name: groupPreview?.name || 'Grupo de Projetos 🚀',
        avatarColor: groupPreview?.avatarColor || '#06B6D4',
        avatarLetter: groupPreview?.avatarLetter || 'GP',
        isGroup: true,
        statusText: 'Você e outros membros',
        online: true,
        unreadCount: 0,
        inviteCode: pendingInviteCode,
        messages: []
      };

      const joinMessage: Message = {
        id: `join-${Date.now()}`,
        sender: 'them',
        senderName: 'Sistema',
        text: `🎉 ${user.displayName || user.phoneNumber} entrou no grupo usando o link de convite.`,
        time: getFormattedTime(),
        timestamp: Date.now(),
        status: 'read'
      };

      clientChat = {
        ...targetGroup,
        messages: [...(targetGroup.messages || []), joinMessage]
      };
    }

    setChats(prev => {
      const filtered = prev.filter(c => c.id !== clientChat!.id);
      const next = [clientChat!, ...filtered];
      try {
        localStorage.setItem('zapchat_local_chats', JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    setActiveChatId(clientChat.id);
    setMobileShowChat(true);
    setShowJoinModal(false);
    setPendingInviteCode(null);

    // Clean URL params cleanly
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // 7. Revoke and generate new invite code for a group
  const handleRevokeInvite = async (chatId: string) => {
    const token = localStorage.getItem('zapchat_token');
    let newCode = `zap-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch(`/api/chats/${chatId}/revoke-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (res.ok) {
        const data = await res.json();
        newCode = data.inviteCode;
      }
    } catch {
      // Fallback
    }

    setChats(prev => {
      const next = prev.map(c => c.id === chatId ? { ...c, inviteCode: newCode } : c);
      try {
        localStorage.setItem('zapchat_local_chats', JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    try {
      await setDoc(doc(db, 'chats', chatId), { inviteCode: newCode }, { merge: true });
    } catch (_) {}

    return newCode;
  };

  const handleUpdateUserProfile = async (updated: Partial<UserSession>) => {
    if (!user) return;
    const uid = user.uid || auth.currentUser?.uid;

    let storagePhotoUrl = updated.photoURL;
    if (uid && updated.photoURL && (updated.photoURL.startsWith('data:') || updated.photoURL.startsWith('blob:'))) {
      try {
        storagePhotoUrl = await uploadProfilePhoto(uid, updated.photoURL);
      } catch {
        // Fallback to local data URL
      }
    }

    const updatedUser: UserSession = {
      ...user,
      ...updated,
      photoURL: storagePhotoUrl !== undefined ? storagePhotoUrl : user.photoURL
    };
    setUser(updatedUser);
    try {
      localStorage.setItem('zapchat_user', JSON.stringify(updatedUser));
    } catch (_) {}

    // Update in Firebase Auth (only set photoURL if it's a valid remote HTTP URL to prevent length limit issues)
    try {
      if (auth.currentUser) {
        const authPhotoUrl = (storagePhotoUrl && storagePhotoUrl.startsWith('http')) 
          ? storagePhotoUrl 
          : (user.photoURL && user.photoURL.startsWith('http') ? user.photoURL : undefined);
        await updateProfile(auth.currentUser, {
          displayName: updated.displayName || user.displayName,
          photoURL: authPhotoUrl
        });
      }
    } catch {
      // Handled silently
    }

    // Update in Firestore users collection
    if (uid) {
      try {
        const photoVal = storagePhotoUrl !== undefined ? (storagePhotoUrl || null) : (user.photoURL || null);
        await setDoc(doc(db, 'users', uid), {
          phoneNumber: updated.phoneNumber !== undefined ? updated.phoneNumber : (user.phoneNumber || null),
          displayName: updated.displayName || user.displayName || user.phoneNumber,
          initial: updated.initial || user.initial,
          avatarColor: user.avatarColor,
          photoURL: photoVal,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('[App] Erro ao sincronizar perfil no Firestore:', err);
      }
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 font-sans antialiased text-white select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p className="text-xs text-white/60 font-medium tracking-wide">Carregando conversas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 font-sans antialiased p-0 sm:p-2 md:p-3 lg:p-4 overflow-hidden relative selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Mesh Gradient Background Decoration */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Main App Container with Frosted Glass look - perfectly centered */}
      <div className="w-full max-w-[1600px] h-full sm:h-[calc(100vh-16px)] md:h-[calc(100vh-24px)] lg:h-[calc(100vh-32px)] max-h-screen mx-auto rounded-none sm:rounded-xl md:rounded-2xl border border-white/10 backdrop-blur-3xl bg-slate-900/70 shadow-2xl flex z-10 relative overflow-hidden text-white/90">
        
        {/* Left column (Sidebar): visible on desktop or when active chat is hidden on mobile */}
        <div className={`h-full flex-col ${mobileShowChat ? 'hidden md:flex' : 'flex w-full md:w-[360px] lg:w-[400px] xl:w-[430px]'} flex-shrink-0 border-r border-white/10`}>
          <Sidebar
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            user={user}
            onLogout={handleLogout}
            onAddNewChat={handleAddNewChat}
            onUpdateUserProfile={handleUpdateUserProfile}
            onInstallPwa={handleInstallPwa}
            canInstall={!!deferredInstallPrompt}
          />
        </div>

        {/* Right column (Chat Window): visible on desktop or when a chat is explicitly opened on mobile */}
        <div className={`h-full flex-1 flex flex-col ${!mobileShowChat ? 'hidden md:flex' : 'flex w-full'} min-w-0 overflow-hidden`}>
          <ChatArea
            chat={activeChat}
            currentUser={user}
            onSendMessage={handleSendMessage}
            onSendAttachment={handleSendAttachment}
            onBackToSidebar={() => setMobileShowChat(false)}
            onRevokeInvite={handleRevokeInvite}
          />
        </div>

      </div>

      {/* Join Group Invitation Modal Dialog */}
      {showJoinModal && pendingInviteCode && (
        <JoinGroupModal
          isOpen={showJoinModal}
          inviteCode={pendingInviteCode}
          groupPreview={groupPreview}
          isLoading={isCheckingInvite}
          error={inviteError}
          onJoin={handleJoinGroup}
          onCancel={() => {
            setShowJoinModal(false);
            setPendingInviteCode(null);
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }}
        />
      )}
    </div>
  );
}
