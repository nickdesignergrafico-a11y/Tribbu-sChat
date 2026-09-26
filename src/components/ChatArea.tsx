import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  MoreVertical, 
  Smile, 
  Paperclip, 
  Mic, 
  Send, 
  ArrowLeft,
  Image,
  FileText,
  MapPin,
  User as UserIcon,
  Check,
  CheckCheck,
  Users,
  Link2,
  Info,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Download,
  ExternalLink,
  Eye,
  X,
  File,
  Smartphone,
  MessageCircle,
  Phone,
  Trash2,
  Square,
  Video,
  Plus,
  Bot,
  Sparkles,
  Music,
  Megaphone,
  Clock
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Chat, Message, UserSession, StatusItem, TextStatusStyle } from '../types';
import { resizeAndCompressImage } from '../utils/imageUtils';
import GroupInfoModal from './GroupInfoModal';
import ShareContactModal from './ShareContactModal';
import { TypingBalloon } from './TypingBalloon';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { ChatVideoPlayer } from './ChatVideoPlayer';
import { TextStatusCard, getTimeRemaining } from './TextStatusCard';
import { NewStatusModal } from './NewStatusModal';
import { uploadChatMedia, formatBytes } from '../services/storageService';
import { publishTextStatus } from '../services/statusService';
import { setTypingStatus, clearTypingStatus, subscribeToChatTyping, TypingIndicator } from '../services/typingService';

interface UploadProgressInfo {
  active: boolean;
  fileName: string;
  category: 'image' | 'video' | 'audio' | 'document';
  percent: number;
  fileSize?: string;
}

interface ChatAreaProps {
  chat: Chat | null;
  currentUser?: UserSession | null;
  onSendMessage: (
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
  ) => void;
  onSendAttachment?: (type: 'image' | 'video' | 'document' | 'location' | 'contact') => void;
  onDeleteMessage?: (messageId: string) => void;
  onBackToSidebar: () => void;
  onRevokeInvite?: (chatId: string) => Promise<string | void>;
}

const COMMON_EMOJIS = ['😂', '👍', '❤️', '🙏', '🎉', '🔥', '😍', '🚀', '💡', '👏', '🎂', '🌟', '🤔', '😢', '👀', '💩', '🍻', '✨'];

export default function ChatArea({ 
  chat, 
  currentUser = null,
  onSendMessage, 
  onSendAttachment,
  onDeleteMessage,
  onBackToSidebar,
  onRevokeInvite
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [searchInChat, setSearchInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<{ url: string; name: string } | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo | null>(null);
  const [showShareContactModal, setShowShareContactModal] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [activeDeleteMsgId, setActiveDeleteMsgId] = useState<string | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

  const handleMessagePressStart = (msgId: string) => {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setActiveDeleteMsgId(msgId);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch (_) {}
      }
    }, 420);
  };

  const handleMessagePressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleConfirmDeleteMessage = (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDeleteMessage) {
      onDeleteMessage(msgId);
    }
    setActiveDeleteMsgId(null);
    longPressTriggeredRef.current = false;
  };
  
  // Active "Aviso da Tribbu" (24h) for Groups and Channels
  const [groupNotice, setGroupNotice] = useState<StatusItem | null>(null);
  const [isNoticeMinimized, setIsNoticeMinimized] = useState<boolean>(false);
  const [showFullNoticeModal, setShowFullNoticeModal] = useState<boolean>(false);
  const [showCreateNoticeModal, setShowCreateNoticeModal] = useState<boolean>(false);

  // Sync active notice for the current group / channel
  useEffect(() => {
    if (!chat || (!chat.isGroup && !chat.isCommunity)) {
      setGroupNotice(null);
      return;
    }

    const now = Date.now();

    // 1. Check direct active notice on chat object
    if (chat.activeNotice && (!chat.activeNotice.expiresAt || chat.activeNotice.expiresAt > now)) {
      setGroupNotice(chat.activeNotice);
    }

    // 2. Real-time query to statuses in Firestore (single-field orderBy to avoid composite index error)
    try {
      const q = query(
        collection(db, 'statuses'),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let found: StatusItem | null = null;
        const currentNow = Date.now();

        snapshot.forEach((docSnap) => {
          const item = { id: docSnap.id, ...docSnap.data() } as StatusItem;
          if (
            !found &&
            item.isTribbuNotice &&
            item.expiresAt &&
            item.expiresAt > currentNow &&
            (item.targetGroupId === chat.id || item.targetGroupName === chat.name || !item.targetGroupId)
          ) {
            found = item;
          }
        });

        if (found) {
          setGroupNotice(found);
        } else if (chat.activeNotice && (!chat.activeNotice.expiresAt || chat.activeNotice.expiresAt > currentNow)) {
          setGroupNotice(chat.activeNotice);
        } else {
          // Default demo announcement for active group channel
          setGroupNotice({
            id: `notice_${chat.id}`,
            userId: 'tribbu-official',
            userName: 'Tribbu Oficial',
            userPhone: '+55 11 99900-1122',
            avatarColor: '#06B6D4',
            mediaUrl: '',
            mediaType: 'text',
            textContent: `⚡ Bem-vindos ao canal ${chat.name}! Avisos oficiais e comunicados da equipe ficam visíveis aqui por 24 horas.`,
            textStyle: {
              themeId: 'tribbu-alert',
              badge: '📢 Aviso da Tribbu'
            },
            isTribbuNotice: true,
            targetGroupId: chat.id,
            targetGroupName: chat.name,
            timestamp: now - 1000 * 60 * 30,
            expiresAt: now + 1000 * 60 * 60 * 23.5
          });
        }
      }, () => {
        // Fallback demo notice
        if (chat.activeNotice && (!chat.activeNotice.expiresAt || chat.activeNotice.expiresAt > now)) {
          setGroupNotice(chat.activeNotice);
        }
      });

      return () => unsubscribe();
    } catch {
      // Fallback
    }
  }, [chat?.id, chat?.isGroup, chat?.isCommunity, chat?.activeNotice]);

  const handlePublishGroupNotice = async (
    textContent: string,
    style: TextStatusStyle,
    _isTribbuNotice?: boolean,
    _targetGroupId?: string,
    _targetGroupName?: string
  ) => {
    if (!currentUser || !chat) return;
    const newStatus = await publishTextStatus(
      {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        phoneNumber: currentUser.phoneNumber,
        avatarColor: currentUser.avatarColor,
        photoURL: currentUser.photoURL
      },
      textContent,
      style,
      true,
      chat.id,
      chat.name
    );
    setGroupNotice(newStatus);
    setIsNoticeMinimized(false);

    // Also send an announcement message to the chat feed
    onSendMessage(`📢 *Aviso da Tribbu (Válido por 24h):*\n\n"${textContent}"`, {
      type: 'text',
      mediaType: 'text'
    });
  };

  // Real-time typing / recording indicators from Firestore
  const [typingIndicators, setTypingIndicators] = useState<TypingIndicator[]>([]);
  const typingTimeoutRef = useRef<any>(null);

  // Real-time audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  // Roll Screen & Scroll Tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const prevMessagesCountRef = useRef(chat?.messages?.length || 0);

  // Monitor scroll position
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // User is scrolled up if more than 120px from bottom
    const isScrolledUp = distanceFromBottom > 120;
    setShowScrollBottom(isScrolledUp);
    
    // User is far down enough to offer scroll to top
    setShowScrollTop(scrollTop > 240);

    // If back near bottom, reset unread badge
    if (!isScrolledUp) {
      setUnreadWhileScrolled(0);
    }
  };

  // Close image lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedImageModal) {
        setSelectedImageModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageModal]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior
      });
      setUnreadWhileScrolled(0);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Scroll effect on chat change or message arrival
  useEffect(() => {
    if (!chat) return;
    const currentCount = chat?.messages?.length || 0;
    const prevCount = prevMessagesCountRef.current;
    prevMessagesCountRef.current = currentCount;

    // Check if user is currently near bottom
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom <= 140 || currentCount <= 1) {
      // Near bottom: auto scroll
      scrollToBottom('smooth');
    } else if (currentCount > prevCount) {
      // User is reading older messages: increment badge
      setUnreadWhileScrolled(prev => prev + (currentCount - prevCount));
    }
  }, [chat?.id, chat?.messages]);

  // Real-time Firestore typing indicators listener
  useEffect(() => {
    if (!chat?.id || !currentUser?.uid) {
      setTypingIndicators([]);
      return;
    }

    const unsubscribe = subscribeToChatTyping(chat.id, currentUser.uid, (indicators) => {
      setTypingIndicators(indicators);
    });

    return () => {
      unsubscribe();
      if (currentUser?.uid && chat?.id) {
        clearTypingStatus(chat.id, currentUser.uid);
      }
    };
  }, [chat?.id, currentUser?.uid]);

  // Initial scroll when opening a chat
  useEffect(() => {
    if (chat?.id) {
      setTimeout(() => scrollToBottom('auto'), 50);
    }
  }, [chat?.id]);

  if (!chat) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-950/40 relative">
        <div className="max-w-md text-center p-8 flex flex-col items-center select-none text-white/90">
          <div className="w-64 h-40 mb-6 bg-cover bg-no-repeat opacity-[0.15]" style={{
            backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`
          }} />
          <h3 className="text-xl font-semibold text-white mb-2">Tribbu'sChat Pro</h3>
          <p className="text-sm text-white/50 leading-relaxed max-w-xs">
            Envie e receba mensagens com sincronização em tempo real e crie grupos facilmente.
          </p>
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-cyan-300 font-medium bg-cyan-500/10 px-3.5 py-1.5 rounded-full border border-cyan-500/25 shadow-sm">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            Sincronização em tempo real
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!chat?.id || !currentUser?.uid) return;

    if (val.trim()) {
      setTypingStatus(chat.id, currentUser, 'typing');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (currentUser?.uid && chat?.id) {
          clearTypingStatus(chat.id, currentUser.uid);
        }
      }, 2500);
    } else {
      clearTypingStatus(chat.id, currentUser.uid);
    }
  };

  const handleSend = () => {
    if (inputText.trim()) {
      if (currentUser?.uid && chat?.id) {
        clearTypingStatus(chat.id, currentUser.uid);
      }
      onSendMessage(inputText.trim(), { type: 'text' });
      setInputText('');
      setShowEmojiPicker(false);
      setTimeout(() => scrollToBottom('smooth'), 50);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    const input = document.getElementById('chatInput');
    if (input) {
      input.focus();
    }
  };

  // Real attachment handlers & openers
  const handleOpenDocument = (mediaUrl?: string, fileName?: string) => {
    if (!mediaUrl) return;
    try {
      const a = document.createElement('a');
      a.href = mediaUrl;
      a.download = fileName || 'documento';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      window.open(mediaUrl, '_blank');
    }
  };

  const getFileBadge = (fileName?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return { bg: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'PDF' };
    }
    if (['doc', 'docx', 'txt'].includes(ext)) {
      return { bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: ext.toUpperCase() };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return { bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: ext.toUpperCase() };
    }
    if (['zip', 'rar', '7z'].includes(ext)) {
      return { bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: ext.toUpperCase() };
    }
    return { bg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', label: ext ? ext.toUpperCase() : 'DOC' };
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingUpload(true);
    setShowAttachmentMenu(false);

    // If a video file was selected via image picker, route to video handler
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
    const category = isVideo ? 'video' : 'image';

    const caption = inputText.trim();
    if (caption) setInputText('');

    setUploadProgress({
      active: true,
      fileName: file.name,
      category,
      percent: 5,
      fileSize: formatBytes(file.size)
    });

    if (isVideo) {
      try {
        const uploadRes = await uploadChatMedia(
          chat.id, 
          file, 
          'video', 
          file.name,
          (percent) => {
            setUploadProgress(prev => prev ? { ...prev, percent } : null);
          }
        );
        onSendMessage(caption, {
          type: 'video',
          mediaType: 'video',
          mediaUrl: uploadRes.mediaUrl,
          fileName: file.name,
          fileSize: uploadRes.fileSize
        });
        setTimeout(() => scrollToBottom('smooth'), 50);
      } catch (err) {
        console.warn('Storage video upload fallback:', err);
      } finally {
        setTimeout(() => setUploadProgress(null), 350);
        setIsProcessingUpload(false);
        e.target.value = '';
      }
      return;
    }

    try {
      // 1. Compress image for optimal preview
      setUploadProgress(prev => prev ? { ...prev, percent: 15 } : null);
      const compressedDataUrl = await resizeAndCompressImage(file, 1024, 1024, 0.85);

      // 2. Upload to Firebase Storage with progress tracking
      let finalUrl = compressedDataUrl;
      let finalSize = formatBytes(file.size);

      try {
        const uploadRes = await uploadChatMedia(
          chat.id, 
          file, 
          'image', 
          file.name,
          (percent) => {
            setUploadProgress(prev => prev ? { ...prev, percent: Math.max(15, percent) } : null);
          }
        );
        if (uploadRes.mediaUrl) {
          finalUrl = uploadRes.mediaUrl;
          finalSize = uploadRes.fileSize;
        }
      } catch (err) {
        console.warn('Storage upload fallback:', err);
      }

      onSendMessage(caption, {
        type: 'image',
        mediaType: 'image',
        mediaUrl: finalUrl,
        fileName: file.name,
        fileSize: finalSize
      });
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        onSendMessage(caption, {
          type: 'image',
          mediaType: 'image',
          mediaUrl: reader.result as string,
          fileName: file.name,
          fileSize: formatBytes(file.size)
        });
        setTimeout(() => scrollToBottom('smooth'), 50);
      };
      reader.readAsDataURL(file);
    } finally {
      setTimeout(() => setUploadProgress(null), 350);
      setIsProcessingUpload(false);
      e.target.value = '';
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingUpload(true);
    setShowAttachmentMenu(false);

    const caption = inputText.trim();
    if (caption) setInputText('');

    setUploadProgress({
      active: true,
      fileName: file.name,
      category: 'video',
      percent: 5,
      fileSize: formatBytes(file.size)
    });

    try {
      // Upload video file directly to Firebase Storage with live progress
      const uploadRes = await uploadChatMedia(
        chat.id, 
        file, 
        'video', 
        file.name,
        (percent) => {
          setUploadProgress(prev => prev ? { ...prev, percent } : null);
        }
      );
      onSendMessage(caption, {
        type: 'video',
        mediaType: 'video',
        mediaUrl: uploadRes.mediaUrl,
        fileName: file.name,
        fileSize: uploadRes.fileSize
      });
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (err) {
      console.warn('Storage video upload fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        onSendMessage(caption, {
          type: 'video',
          mediaType: 'video',
          mediaUrl: reader.result as string,
          fileName: file.name,
          fileSize: formatBytes(file.size)
        });
        setTimeout(() => scrollToBottom('smooth'), 50);
      };
      reader.readAsDataURL(file);
    } finally {
      setTimeout(() => setUploadProgress(null), 350);
      setIsProcessingUpload(false);
      e.target.value = '';
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingUpload(true);
    setShowAttachmentMenu(false);

    setUploadProgress({
      active: true,
      fileName: file.name,
      category: 'audio',
      percent: 5,
      fileSize: formatBytes(file.size)
    });

    try {
      // Upload device audio directly to Firebase Storage
      const uploadRes = await uploadChatMedia(
        chat.id, 
        file, 
        'audio', 
        file.name,
        (percent) => {
          setUploadProgress(prev => prev ? { ...prev, percent } : null);
        }
      );
      onSendMessage('', {
        type: 'audio',
        mediaType: 'audio',
        mediaUrl: uploadRes.mediaUrl,
        fileName: file.name,
        fileSize: uploadRes.fileSize
      });
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (err) {
      console.warn('Storage audio upload fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        onSendMessage('', {
          type: 'audio',
          mediaType: 'audio',
          mediaUrl: reader.result as string,
          fileName: file.name,
          fileSize: formatBytes(file.size)
        });
        setTimeout(() => scrollToBottom('smooth'), 50);
      };
      reader.readAsDataURL(file);
    } finally {
      setTimeout(() => setUploadProgress(null), 350);
      setIsProcessingUpload(false);
      e.target.value = '';
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachmentMenu(false);
    setIsProcessingUpload(true);

    setUploadProgress({
      active: true,
      fileName: file.name,
      category: 'document',
      percent: 5,
      fileSize: formatBytes(file.size)
    });

    try {
      const uploadRes = await uploadChatMedia(
        chat.id, 
        file, 
        'document', 
        file.name,
        (percent) => {
          setUploadProgress(prev => prev ? { ...prev, percent } : null);
        }
      );
      onSendMessage('', {
        type: 'document',
        mediaType: 'document',
        mediaUrl: uploadRes.mediaUrl,
        fileName: file.name,
        fileSize: uploadRes.fileSize
      });
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch {
      const formattedSize = formatBytes(file.size);
      const reader = new FileReader();
      reader.onload = () => {
        onSendMessage('', {
          type: 'document',
          mediaType: 'document',
          mediaUrl: reader.result as string,
          fileName: file.name,
          fileSize: formattedSize
        });
        setTimeout(() => scrollToBottom('smooth'), 50);
      };
      reader.readAsDataURL(file);
    } finally {
      setTimeout(() => setUploadProgress(null), 350);
      setIsProcessingUpload(false);
      e.target.value = '';
    }
  };

  // Real voice audio recording with MediaRecorder and Firebase Storage
  const handleStartAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      if (currentUser && chat?.id) {
        setTypingStatus(chat.id, currentUser, 'recording');
      }

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Permissão de microfone indisponível no momento
    }
  };

  const handleStopAudioRecording = (shouldSend: boolean) => {
    if (!mediaRecorderRef.current) return;

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    recorder.onstop = async () => {
      // Release microphone tracks
      recorder.stream.getTracks().forEach((track) => track.stop());

      if (shouldSend && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsProcessingUpload(true);
        try {
          const { mediaUrl, fileSize } = await uploadChatMedia(
            chat.id,
            audioBlob,
            'audio',
            `audio_${Date.now()}.webm`
          );

          const mins = Math.floor(recordingSeconds / 60);
          const secs = (recordingSeconds % 60).toString().padStart(2, '0');

          onSendMessage('', {
            type: 'audio',
            mediaType: 'audio',
            mediaUrl,
            fileSize,
            fileName: `Áudio (${mins}:${secs})`
          });
          setTimeout(() => scrollToBottom('smooth'), 50);
        } catch {
          // Fallback silencioso para upload de áudio
        } finally {
          setIsProcessingUpload(false);
        }
      }

      if (currentUser?.uid && chat?.id) {
        clearTypingStatus(chat.id, currentUser.uid);
      }
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
      mediaRecorderRef.current = null;
    };

    recorder.stop();
  };

  const handleSendLocation = () => {
    setShowAttachmentMenu(false);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const mapUrl = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
          onSendMessage(`📍 Localização compartilhada`, {
            type: 'location',
            mediaUrl: mapUrl
          });
          setTimeout(() => scrollToBottom('smooth'), 50);
        },
        () => {
          if (onSendAttachment) {
            onSendAttachment('location');
          } else {
            onSendMessage('📍 Localização (GPS não disponível)', { type: 'location' });
          }
        }
      );
    } else {
      if (onSendAttachment) {
        onSendAttachment('location');
      } else {
        onSendMessage('📍 Localização compartilhada', { type: 'location' });
      }
    }
  };

  const handleSendContact = () => {
    setShowAttachmentMenu(false);
    setShowShareContactModal(true);
  };

  const handleConfirmSendContact = (contact: { name: string; phone: string }) => {
    onSendMessage(`👤 Contato: ${contact.name} • ${contact.phone}`, {
      type: 'contact',
      contactName: contact.name,
      contactPhone: contact.phone
    });
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  // Filter messages if search inside chat is active
  const rawMessages = Array.isArray(chat?.messages) ? chat.messages : [];
  const displayedMessages = chatSearchQuery.trim()
    ? rawMessages.filter(msg => msg && msg.text && msg.text.toLowerCase().includes(chatSearchQuery.toLowerCase()))
    : rawMessages;

  return (
    <div className="w-full flex-1 flex flex-col h-full bg-slate-950/40 relative overflow-hidden">
      {/* Background doodle image */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
          backgroundRepeat: 'repeat',
          backgroundSize: '360px'
        }}
      />

      {/* Chat Header */}
      <div className="h-18 bg-white/[0.03] px-4 md:px-6 py-2 flex items-center justify-between border-b border-white/10 z-10 relative select-none flex-shrink-0">
        <div 
          onClick={() => {
            if (chat.isGroup) {
              setShowGroupInfo(true);
            }
          }}
          className={`flex items-center gap-3 min-w-0 ${chat.isGroup ? 'cursor-pointer hover:opacity-90' : ''}`}
        >
          {/* Back arrow directly to the left of the profile photo */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBackToSidebar();
            }}
            className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 hover:bg-white/10 active:bg-white/20 rounded-full transition-colors focus:outline-none cursor-pointer text-white/80 hover:text-white flex items-center justify-center flex-shrink-0"
            title="Voltar para as conversas"
            id="backToConversationsBtn"
          >
            <ArrowLeft className="w-5 h-5 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          {/* Contact Avatar / Profile Photo */}
          <div 
            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-base relative shadow-md overflow-hidden"
            style={{ backgroundColor: chat.avatarColor || '#06B6D4' }}
          >
            {chat.isAI || chat.id === 'tribbu-ai' ? (
              <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-[#041a24] to-slate-950 flex items-center justify-center relative border-2 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]">
                <Bot className="w-5 h-5 text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,1)] stroke-[2.4]" />
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-cyan-400 border-2 border-slate-950 rounded-full shadow-[0_0_8px_rgba(6,182,212,1)] animate-pulse" />
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
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            )}
          </div>

          {/* Contact Details */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white text-[15px] truncate">
                {chat.name}
              </h4>
              {(chat.isAI || chat.id === 'tribbu-ai') && (
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm shadow-cyan-500/20">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                  Tribbu AI
                </span>
              )}
              {chat.isGroup && (
                <span className="text-[10px] bg-white/10 text-white/70 px-1.5 py-0.5 rounded font-normal hidden sm:inline-block">
                  Grupo
                </span>
              )}
            </div>
            <span className={`text-xs font-medium truncate block ${chat.statusText === 'digitando...' ? 'text-cyan-400 animate-pulse' : 'text-white/50'}`}>
              {chat.statusText}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 text-white/60">
          {/* Quick Action: Post Tribbu Notice for Groups */}
          {(chat.isGroup || chat.isCommunity) && (
            <button
              onClick={() => setShowCreateNoticeModal(true)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 text-cyan-200 text-xs font-semibold border border-cyan-400/40 transition-all cursor-pointer shadow-sm shadow-cyan-500/15"
              title="Postar Aviso da Tribbu no grupo (visível por 24 horas)"
            >
              <Megaphone className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span className="hidden sm:inline">Aviso (24h)</span>
            </button>
          )}

          {/* Group Invite Link Quick Action Button */}
          {chat.isGroup && (
            <button
              onClick={() => setShowGroupInfo(true)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/25 transition-all cursor-pointer shadow-sm shadow-cyan-500/10"
              title="Convidar para o grupo via link ou QR Code"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Convidar</span>
            </button>
          )}

          {/* Search inside chat button */}
          <button 
            onClick={() => {
              setSearchInChat(!searchInChat);
              if (searchInChat) setChatSearchQuery('');
            }}
            className={`p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none cursor-pointer ${searchInChat ? 'text-cyan-400' : ''}`}
            title="Pesquisar mensagens"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Group info button */}
          {chat.isGroup && (
            <button 
              onClick={() => setShowGroupInfo(true)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none cursor-pointer text-white/70 hover:text-white"
              title="Dados do grupo"
            >
              <Info className="w-5 h-5" />
            </button>
          )}

          {/* Options Menu Toggle */}
          <div className="relative">
            <button 
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none cursor-pointer"
              title="Mais opções"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showOptionsMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowOptionsMenu(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-1.5 z-40 text-sm animate-in fade-in zoom-in-95 duration-150 text-white">
                  {(chat.isGroup || chat.isCommunity) && (
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setShowCreateNoticeModal(true);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2 cursor-pointer text-cyan-300 font-medium"
                    >
                      <Megaphone className="w-4 h-4 text-cyan-400" />
                      Criar Aviso da Tribbu (24h)
                    </button>
                  )}
                  {chat.isGroup ? (
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setShowGroupInfo(true);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-cyan-400" />
                      Dados do Grupo
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      scrollToTop();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2 cursor-pointer text-white/80"
                  >
                    <ChevronUp className="w-4 h-4 text-white/60" />
                    Ir para o início
                  </button>
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      scrollToBottom('smooth');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2 cursor-pointer text-white/80"
                  >
                    <ChevronDown className="w-4 h-4 text-white/60" />
                    Ir para mensagens recentes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Optional Search Bar in active conversation */}
      {searchInChat && (
        <div className="bg-slate-900/90 border-b border-white/10 px-4 py-2 flex items-center gap-2 z-10 animate-in slide-in-from-top-2 duration-150">
          <Search className="w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Pesquisar nesta conversa..."
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
            autoFocus
          />
          {chatSearchQuery && (
            <button
              onClick={() => setChatSearchQuery('')}
              className="text-xs text-white/40 hover:text-white px-1.5 py-0.5"
            >
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Pinned "Avisos da Tribbu" (24h) Banner for Groups & Channels */}
      {groupNotice && (chat.isGroup || chat.isCommunity) && (
        <div className="px-3 sm:px-6 pt-3 pb-1 z-10 flex-shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
          {isNoticeMinimized ? (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/90 border border-cyan-400/30 backdrop-blur-md shadow-md text-xs">
              <div 
                className="flex items-center gap-2 cursor-pointer hover:text-cyan-300 transition-colors"
                onClick={() => setIsNoticeMinimized(false)}
              >
                <Megaphone className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-bold text-white/90">📢 Aviso da Tribbu (24h)</span>
                <span className="text-[11px] text-cyan-300 font-mono">({getTimeRemaining(groupNotice.expiresAt)})</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNoticeMinimized(false)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline flex items-center gap-1"
              >
                Expandir <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative group rounded-2xl p-[1.5px] bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_22px_rgba(6,182,212,0.3)] transition-all duration-200">
              <div className="relative rounded-2xl p-3 sm:p-3.5 bg-gradient-to-r from-slate-950 via-[#07131e] to-slate-950 backdrop-blur-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white overflow-hidden border border-white/5">
                {/* Ambient glow decoration */}
                <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-cyan-500/15 blur-2xl pointer-events-none" />

                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-400/40 text-cyan-400 flex-shrink-0 shadow-inner">
                    <Megaphone className="w-4 h-4 text-cyan-300 animate-bounce" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-gradient-to-r from-cyan-500/25 to-emerald-500/25 text-cyan-300 border border-cyan-400/50 shadow-sm">
                        📢 AVISO DA TRIBBU • 24H
                      </span>
                      {groupNotice.userName && (
                        <span className="text-[11px] text-white/70">
                          por <strong className="text-white/95">{groupNotice.userName}</strong>
                        </span>
                      )}
                      <span className="text-[10px] text-cyan-300 font-mono flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded-full border border-white/10">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {getTimeRemaining(groupNotice.expiresAt)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-white/95 leading-snug line-clamp-2">
                      "{groupNotice.textContent || groupNotice.caption}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFullNoticeModal(true)}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 transition cursor-pointer flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Ver Cartão</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsNoticeMinimized(true)}
                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Minimizar aviso"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Container (Roll Screen) */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onClick={() => {
          if (activeDeleteMsgId) setActiveDeleteMsgId(null);
        }}
        className="flex-1 overflow-y-auto px-[5%] py-6 flex flex-col gap-3.5 z-10 relative custom-scrollbar scroll-smooth"
      >
        {/* Empty state if chat has no messages */}
        {displayedMessages.length === 0 && !chatSearchQuery && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto select-none">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 shadow-lg shadow-cyan-500/10">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <h4 className="text-base font-semibold text-white mb-1">Nenhuma mensagem ainda</h4>
            <p className="text-xs text-white/50 max-w-xs leading-relaxed">
              Envie a primeira mensagem para começar a bater papo com <span className="text-white/80 font-medium">{chat.name}</span>.
            </p>
          </div>
        )}

        {/* Message bubbles */}
        {displayedMessages.map((msg) => {
          const isMe = msg.sender === 'me';

          // Accurate media detection supporting Firebase Storage URLs and explicit types
          const isVideo = msg.type === 'video' || msg.mediaType === 'video' || (!!msg.mediaUrl && (
            /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(msg.mediaUrl) ||
            msg.mediaUrl.toLowerCase().includes('/videos%2f') ||
            msg.mediaUrl.toLowerCase().includes('/videos/') ||
            msg.mediaUrl.toLowerCase().includes('category=video')
          ));

          const isAudio = msg.type === 'audio' || msg.mediaType === 'audio' || (!!msg.mediaUrl && (
            /\.(weba|mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(msg.mediaUrl) ||
            msg.mediaUrl.toLowerCase().includes('/audios%2f') ||
            msg.mediaUrl.toLowerCase().includes('/audios/') ||
            msg.mediaUrl.toLowerCase().includes('category=audio')
          ));

          const isImage = !isVideo && !isAudio && (
            msg.type === 'image' || 
            msg.mediaType === 'image' || 
            (!!msg.mediaUrl && (
              msg.mediaUrl.startsWith('data:image') || 
              msg.mediaUrl.includes('images.unsplash.com') || 
              msg.mediaUrl.startsWith('blob:') ||
              /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(msg.mediaUrl) ||
              msg.mediaUrl.toLowerCase().includes('/images%2f') ||
              msg.mediaUrl.toLowerCase().includes('/images/') ||
              msg.mediaUrl.toLowerCase().includes('category=image')
            ))
          );

          const isDoc = !isImage && !isVideo && !isAudio && (
            msg.type === 'document' || 
            msg.mediaType === 'document' || 
            (!!msg.fileName && !isImage && !isVideo && !isAudio) || 
            (!!msg.mediaUrl && !isImage && !isVideo && !isAudio && !msg.mediaUrl.includes('google.com/maps'))
          );

          const isLocation = msg.type === 'location' || msg.mediaType === 'location' || msg.text?.includes('maps?q=') || msg.text?.includes('Localização');
          const isContact = msg.type === 'contact' || msg.mediaType === 'contact' || !!msg.contactPhone || (!!msg.text && (msg.text.includes('👤') || msg.text.startsWith('[Contato:')));
          const mapUrl = msg.mediaUrl || (msg.text?.match(/https?:\/\/[^\s]+/)?.[0]);
          const docBadge = isDoc ? getFileBadge(msg.fileName) : null;

          let displayContactName = msg.contactName;
          let displayContactPhone = msg.contactPhone;

          if (isContact && (!displayContactName || !displayContactPhone)) {
            if (msg.text) {
              if (msg.text.includes('•')) {
                const clean = msg.text.replace(/^👤\s*(Contato:)?\s*/i, '').replace(/\[|\]/g, '');
                const parts = clean.split('•');
                displayContactName = displayContactName || parts[0]?.trim();
                displayContactPhone = displayContactPhone || parts[1]?.trim();
              } else {
                displayContactName = displayContactName || msg.text.replace(/[👤\[\]]/g, '').replace(/^Contato:\s*/i, '').trim();
              }
            }
          }

          const isSelectedForDelete = activeDeleteMsgId === msg.id;

          return (
            <div
              key={msg.id}
              onMouseDown={() => handleMessagePressStart(msg.id)}
              onMouseUp={handleMessagePressEnd}
              onMouseLeave={handleMessagePressEnd}
              onTouchStart={() => handleMessagePressStart(msg.id)}
              onTouchEnd={handleMessagePressEnd}
              onTouchMove={handleMessagePressEnd}
              onTouchCancel={handleMessagePressEnd}
              onClick={(e) => {
                if (longPressTriggeredRef.current || isSelectedForDelete) {
                  e.stopPropagation();
                  longPressTriggeredRef.current = false;
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                longPressTriggeredRef.current = true;
                setActiveDeleteMsgId(msg.id);
              }}
              className={`max-w-[85%] sm:max-w-[70%] md:max-w-[62%] min-w-[100px] p-2.5 sm:p-3 rounded-2xl text-[14px] leading-relaxed shadow-sm relative break-words transition-all select-none ${
                isMe 
                  ? 'bg-cyan-950/70 border border-cyan-500/40 self-end rounded-tr-none text-white shadow-md shadow-cyan-950/30' 
                  : 'bg-slate-800/85 border border-white/10 self-start rounded-tl-none text-white'
              } ${isSelectedForDelete ? 'ring-2 ring-red-500/80 scale-[0.99]' : ''}`}
            >
              {/* Trash Icon Action Button on Long Press / Click & Hold */}
              {isSelectedForDelete && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute -top-3.5 ${isMe ? 'left-2' : 'right-2'} z-30 flex items-center gap-1 bg-slate-900/95 border border-red-500/50 rounded-full px-2.5 py-1 shadow-xl shadow-black/60 animate-in fade-in zoom-in-90 duration-150`}
                >
                  <button
                    type="button"
                    onClick={(e) => handleConfirmDeleteMessage(e, msg.id)}
                    className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-bold cursor-pointer pr-1"
                    title="Excluir mensagem"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.4]" />
                    <span>Excluir</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDeleteMsgId(null);
                    }}
                    className="p-0.5 text-white/50 hover:text-white rounded-full cursor-pointer"
                    title="Cancelar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Group message sender's name tag */}
              {!isMe && chat.isGroup && msg.senderName && (
                <p className="text-[11px] font-bold text-cyan-400 mb-1 select-none leading-none">
                  {msg.senderName}
                </p>
              )}

              {/* 1. PHOTO / IMAGE ATTACHMENT */}
              {isImage && msg.mediaUrl && (
                <div className="flex flex-col gap-1 mb-1">
                  <div 
                    className="relative group rounded-2xl overflow-hidden cursor-pointer border border-white/15 bg-black/40 shadow-lg"
                    onClick={() => {
                      if (longPressTriggeredRef.current || isSelectedForDelete) return;
                      setSelectedImageModal({ url: msg.mediaUrl!, name: msg.fileName || 'Foto' });
                    }}
                    title="Clique para abrir a foto em tela cheia"
                  >
                    <img 
                      src={msg.mediaUrl} 
                      alt={msg.fileName || 'Foto'} 
                      className="w-full max-h-80 object-cover rounded-2xl transition-all duration-300 group-hover:scale-[1.02] group-hover:brightness-95"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <span className="bg-slate-950/85 px-3.5 py-1.5 rounded-full text-xs text-white font-medium flex items-center gap-1.5 backdrop-blur-md shadow-lg border border-cyan-400/40">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        Visualizar foto em tela cheia
                      </span>
                    </div>

                    {/* Corner fast download */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const a = document.createElement('a');
                        a.href = msg.mediaUrl!;
                        a.download = msg.fileName || 'foto.jpg';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-slate-900/85 text-white/90 hover:text-slate-950 hover:bg-cyan-400 transition opacity-0 group-hover:opacity-100 shadow-md cursor-pointer border border-white/10"
                      title="Baixar imagem"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {msg.fileName && !msg.text && (
                    <p className="text-[11px] text-white/60 truncate px-1">{msg.fileName}</p>
                  )}
                </div>
              )}

              {/* 2. VIDEO ATTACHMENT PLAYER WITH CUSTOM CYAN PLAY BUTTON */}
              {isVideo && msg.mediaUrl && (
                <ChatVideoPlayer 
                  mediaUrl={msg.mediaUrl} 
                  fileName={msg.fileName} 
                  fileSize={msg.fileSize} 
                  isMe={isMe} 
                />
              )}

              {/* 2. DOCUMENT ATTACHMENT */}
              {isDoc && (
                <div 
                  onClick={() => {
                    if (longPressTriggeredRef.current || isSelectedForDelete) return;
                    handleOpenDocument(msg.mediaUrl, msg.fileName);
                  }}
                  className="bg-black/30 hover:bg-black/45 border border-white/10 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer group transition-all my-1 select-none"
                  title="Clique para abrir ou baixar o documento"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border text-xs font-bold flex-shrink-0 ${docBadge?.bg || 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'}`}>
                      {docBadge?.label || 'DOC'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate group-hover:text-cyan-300 transition-colors">
                        {msg.fileName || msg.text || 'Documento'}
                      </p>
                      <p className="text-[11px] text-white/50 flex items-center gap-1.5 mt-0.5">
                        <span>{msg.fileSize || 'Arquivo'}</span>
                        <span>•</span>
                        <span className="text-cyan-400 font-medium group-hover:underline flex items-center gap-0.5">
                          Abrir / Baixar
                        </span>
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDocument(msg.mediaUrl, msg.fileName);
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-emerald-400 group-hover:text-slate-950 text-white/80 flex items-center justify-center transition-all flex-shrink-0"
                    title="Baixar arquivo"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 3. LOCATION ATTACHMENT */}
              {isLocation && (
                <div className="bg-black/30 border border-white/10 rounded-xl p-3 my-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 flex-shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Localização compartilhada</p>
                      <p className="text-[11px] text-white/50">Coordenadas de GPS</p>
                    </div>
                  </div>
                  {mapUrl && (
                    <a 
                      href={mapUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/30 py-1.5 px-3 rounded-xl transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir no Google Maps
                    </a>
                  )}
                </div>
              )}

              {/* 4. CONTACT ATTACHMENT CARD (USING CELL PHONE NUMBER) */}
              {isContact && (
                <div className="bg-black/35 border border-white/10 rounded-xl p-3 sm:p-3.5 my-1 flex flex-col gap-3 min-w-[240px] sm:min-w-[270px]">
                  {/* Contact Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-300 text-sm flex-shrink-0 shadow shadow-cyan-500/10">
                      {(displayContactName || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate leading-tight">
                        {displayContactName || 'Contato'}
                      </p>
                      <p className="text-xs font-semibold text-cyan-300 font-mono mt-1 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{displayContactPhone || 'Celular não informado'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/10 w-full" />

                  {/* Contact Actions: Tribbu'sChat & Call/Copy */}
                  <div className="grid grid-cols-2 gap-2">
                    {displayContactPhone ? (
                      <a
                        href={`https://wa.me/55${displayContactPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer text-center"
                        title="Conversar no Tribbu'sChat"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Conversar</span>
                      </a>
                    ) : (
                      <div className="text-[11px] text-white/40 text-center py-1">Contato</div>
                    )}

                    {displayContactPhone ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (displayContactPhone) {
                            navigator.clipboard?.writeText(displayContactPhone);
                            setCopiedPhoneId(msg.id);
                            setTimeout(() => setCopiedPhoneId(null), 2000);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/90 border border-white/10 text-xs font-medium transition cursor-pointer"
                        title="Copiar número do celular"
                      >
                        {copiedPhoneId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Phone className="w-3.5 h-3.5" />
                            <span>Copiar / Ligar</span>
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              {/* 5. AUDIO MESSAGE (VOICE NOTE OR RECORDING) */}
              {isAudio && msg.mediaUrl && (
                <AudioMessagePlayer 
                  mediaUrl={msg.mediaUrl} 
                  isMe={isMe} 
                  senderPhotoURL={isMe ? currentUser?.photoURL : chat.photoURL}
                  senderName={isMe ? (currentUser?.displayName || 'Você') : (msg.senderName || chat.name)}
                  senderAvatarColor={isMe ? (currentUser?.avatarColor || '#06B6D4') : (chat.avatarColor || '#06B6D4')}
                />
              )}

              {/* 6. TEXT CONTENT / CAPTION */}
              {msg.text && 
                !msg.text.startsWith('[Arquivo:') && 
                !isLocation && 
                !isContact && 
                !isAudio && 
                !(isVideo && msg.text === msg.mediaUrl) &&
                !(isImage && msg.text === msg.mediaUrl) && (
                <p className="text-white/95 whitespace-pre-wrap">{msg.text}</p>
              )}

              {/* Time and Ticks Status footer */}
              <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/40 font-medium select-none">
                <span>{msg.time}</span>
                {isMe && (
                  msg.status === 'read' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-cyan-400 stroke-[2.5]" />
                  ) : msg.status === 'delivered' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-white/40 stroke-[2.5]" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-white/40 stroke-[2.5]" />
                  )
                )}
              </div>
            </div>
          );
        })}

        {chatSearchQuery && displayedMessages.length === 0 && (
          <div className="self-center bg-slate-900/90 border border-white/10 rounded-lg px-4 py-2 text-center text-xs text-white/50 max-w-xs mt-4">
            Nenhum resultado para "{chatSearchQuery}" nesta conversa.
          </div>
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Floating Roll Screen Controls */}
      {/* Quick Scroll to Top button when scrolled down */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="absolute top-20 right-6 z-20 p-2 bg-slate-900/80 hover:bg-slate-800 text-white/70 hover:text-white border border-white/10 rounded-full shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
          title="Rolar para o topo"
        >
          <ChevronUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      )}

      {/* Floating Scroll to Bottom (New Messages / Recents) button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-24 right-6 z-20 p-2.5 bg-slate-900/95 hover:bg-slate-800 text-cyan-400 border border-cyan-500/30 rounded-full shadow-2xl backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 relative animate-in fade-in zoom-in-90 duration-150"
          title="Rolar para o final (mensagens recentes)"
        >
          <ChevronDown className="w-5 h-5 stroke-[2.5]" />
          {unreadWhileScrolled > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow">
              {unreadWhileScrolled}
            </span>
          )}
        </button>
      )}

      {/* Interactive Emoji & Attachment overlays */}
      {showEmojiPicker && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setShowEmojiPicker(false)} />
          <div className="absolute bottom-[84px] left-6 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-3 z-30 w-72 animate-in fade-in slide-in-from-bottom-2 duration-150 text-white">
            <p className="text-xs font-semibold text-white/40 mb-2 select-none">Emojis Frequentes</p>
            <div className="grid grid-cols-6 gap-2">
              {COMMON_EMOJIS.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => addEmoji(emoji)}
                  className="text-2xl p-1 hover:bg-white/10 rounded transition cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showAttachmentMenu && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setShowAttachmentMenu(false)} />
          <div className="absolute bottom-[84px] left-12 sm:left-16 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl py-2 z-30 w-56 animate-in fade-in slide-in-from-bottom-2 duration-150 text-white backdrop-blur-md">
            <button
              id="attachMediaAllBtn"
              onClick={() => {
                setShowAttachmentMenu(false);
                mediaInputRef.current?.click();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-cyan-300 hover:bg-cyan-500/20 flex items-center gap-3 font-semibold cursor-pointer transition-colors border-b border-white/10"
              title="Selecione fotos ou vídeos do seu dispositivo"
            >
              <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Image className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="leading-tight">Fotos e Vídeos</span>
                <span className="text-[10px] text-cyan-400/80 font-normal">Galeria do dispositivo</span>
              </div>
            </button>
            <button
              onClick={() => {
                setShowAttachmentMenu(false);
                imageInputRef.current?.click();
              }}
              className="w-full text-left px-4 py-2 text-sm text-white/85 hover:bg-white/10 flex items-center gap-3 font-medium cursor-pointer transition-colors"
            >
              <Image className="w-4 h-4 text-cyan-400" />
              <span>Apenas Fotos</span>
            </button>
            <button
              onClick={() => {
                setShowAttachmentMenu(false);
                videoInputRef.current?.click();
              }}
              className="w-full text-left px-4 py-2 text-sm text-white/85 hover:bg-white/10 flex items-center gap-3 font-medium cursor-pointer transition-colors"
            >
              <Video className="w-4 h-4 text-emerald-400" />
              <span>Apenas Vídeos</span>
            </button>
            <button
              onClick={() => {
                setShowAttachmentMenu(false);
                handleStartAudioRecording();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 flex items-center gap-3 font-medium cursor-pointer transition-colors"
            >
              <Mic className="w-4.5 h-4.5 text-teal-400" />
              <span>Gravar Áudio</span>
            </button>
            <button
              onClick={() => {
                setShowAttachmentMenu(false);
                audioInputRef.current?.click();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 flex items-center gap-3 font-medium cursor-pointer transition-colors"
            >
              <Music className="w-4.5 h-4.5 text-sky-400" />
              <span>Áudio do Dispositivo</span>
            </button>
            <button
              onClick={() => {
                setShowAttachmentMenu(false);
                docInputRef.current?.click();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 flex items-center gap-3 font-medium cursor-pointer transition-colors"
            >
              <FileText className="w-4.5 h-4.5 text-indigo-400" />
              <span>Documento</span>
            </button>
            <div className="h-px bg-white/10 my-1 w-full" />
            <button
              onClick={() => {
                setShowAttachmentMenu(false);
                handleSendLocation();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 flex items-center gap-3 font-medium cursor-pointer transition-colors"
            >
              <MapPin className="w-4.5 h-4.5 text-red-400" />
              <span>Localização</span>
            </button>
            <button
              onClick={() => {
                setShowAttachmentMenu(false);
                handleSendContact();
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 flex items-center gap-3 font-medium cursor-pointer transition-colors"
            >
              <UserIcon className="w-4.5 h-4.5 text-sky-400" />
              <span>Contato</span>
            </button>
          </div>
        </>
      )}

      {/* Real-time Typing & Recording Indicator Balloon */}
      <TypingBalloon indicators={typingIndicators} isGroup={chat.isGroup} />

      {/* Bottom Text Input Field / Footer */}
      <div className="p-4 md:p-6 pt-2 bg-transparent border-t border-white/10 flex flex-col z-10 relative select-none">
        {/* Real-time upload progress bar for Firebase Storage */}
        {(isProcessingUpload || uploadProgress) && (
          <div className="mb-2.5 p-3 rounded-2xl bg-slate-900/95 border border-cyan-500/40 backdrop-blur-md shadow-xl shadow-cyan-950/40 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 flex-shrink-0">
                  {uploadProgress?.category === 'video' ? (
                    <Video className="w-4 h-4 animate-pulse" />
                  ) : uploadProgress?.category === 'image' ? (
                    <Image className="w-4 h-4 animate-pulse" />
                  ) : uploadProgress?.category === 'audio' ? (
                    <Mic className="w-4 h-4 animate-pulse" />
                  ) : (
                    <FileText className="w-4 h-4 animate-pulse" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs leading-tight">
                    {uploadProgress?.fileName || 'Enviando arquivo...'}
                  </p>
                  <p className="text-[11px] text-cyan-300/80 mt-0.5 font-medium flex items-center gap-1.5">
                    <span>Enviando para o Firebase Storage</span>
                    {uploadProgress?.fileSize && <span>• {uploadProgress.fileSize}</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono font-bold text-xs">
                <span className="text-emerald-400">
                  {uploadProgress ? `${uploadProgress.percent}%` : 'Carregando...'}
                </span>
              </div>
            </div>

            {/* Glowing animated progress track & bar */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 rounded-full transition-all duration-150 shadow-[0_0_12px_rgba(6,182,212,0.7)]"
                style={{ width: `${Math.max(5, uploadProgress?.percent || 15)}%` }}
              />
            </div>
          </div>
        )}

        {isRecordingAudio ? (
          /* Active Voice Recording Bar replacing text input */
          <div 
            id="activeVoiceRecordingBar"
            className="h-14 px-4 bg-slate-900/95 border-2 border-cyan-500/50 rounded-2xl flex items-center justify-between shadow-[0_0_20px_rgba(6,182,212,0.25)] animate-in fade-in duration-200"
          >
            {/* Pulsing red record badge + Timer */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"></span>
              </span>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-red-400 animate-pulse" />
                  Gravando áudio
                </span>
                <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-400/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                  {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Action Buttons: Trash / Cancel and Send */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btnCancelAudioRecording"
                onClick={() => handleStopAudioRecording(false)}
                className="p-2.5 rounded-xl text-red-400 hover:text-red-200 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer shadow-sm hover:shadow-red-500/20 active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
                title="Cancelar e apagar áudio"
                aria-label="Cancelar gravação"
              >
                <Trash2 className="w-4.5 h-4.5" />
                <span className="hidden sm:inline">Cancelar</span>
              </button>

              <button
                type="button"
                id="btnFinishAudioRecording"
                onClick={() => handleStopAudioRecording(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-cyan-500/30 active:scale-95"
                title="Finalizar e enviar áudio"
                aria-label="Enviar áudio gravado"
              >
                <Send className="w-4 h-4 fill-slate-950 stroke-[2.5]" />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="h-14 px-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
            <div className="flex items-center gap-1 text-white/60">
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowAttachmentMenu(false);
                }}
                className={`p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none cursor-pointer ${showEmojiPicker ? 'text-cyan-400' : ''}`}
                title="Emojis"
              >
                <Smile className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                id="btnAttachMedia"
                onClick={() => {
                  setShowAttachmentMenu(!showAttachmentMenu);
                  setShowEmojiPicker(false);
                }}
                className={`p-2 rounded-full transition-all focus:outline-none cursor-pointer flex items-center justify-center ${
                  showAttachmentMenu 
                    ? 'text-cyan-300 bg-cyan-500/25 ring-2 ring-cyan-400/60 shadow-md shadow-cyan-500/30' 
                    : 'text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 shadow-sm shadow-cyan-500/15'
                }`}
                title="Anexar foto, vídeo, gravar áudio ou documento"
                aria-label="Anexar mídia"
              >
                <Paperclip className="w-5 h-5 rotate-45 text-cyan-400" />
              </button>
            </div>

            {/* Input box */}
            <div className="flex-1 relative">
              <input
                id="chatInput"
                type="text"
                placeholder={chat.isAI || chat.id === 'tribbu-ai' ? "Mensagem para Tribbu AI (Gemini)..." : "Digite uma mensagem..."}
                value={inputText}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                className="w-full bg-transparent border-none text-sm text-white placeholder-white/30 focus:outline-none focus:ring-0 p-0"
                autoComplete="off"
              />
            </div>

            {/* Right side send button or Mic button */}
            <div className="flex items-center text-white/60">
              {inputText.trim() ? (
                <button
                  onClick={handleSend}
                  className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 transition-all flex items-center justify-center text-slate-950 font-bold flex-shrink-0 cursor-pointer shadow-md shadow-cyan-500/25"
                  title="Enviar mensagem"
                >
                  <Send className="w-4.5 h-4.5 fill-slate-950 stroke-[2.5]" />
                </button>
              ) : (
                <button
                  type="button"
                  id="btnRecordVoiceNote"
                  onClick={handleStartAudioRecording}
                  className="w-10 h-10 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 hover:border-cyan-300 text-cyan-400 hover:text-cyan-300 transition-all flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.4)] hover:shadow-[0_0_16px_rgba(6,182,212,0.6)] active:scale-95"
                  title="Gravar mensagem de voz (MediaRecorder)"
                  aria-label="Gravar mensagem de áudio"
                >
                  <Mic className="w-5 h-5 drop-shadow-[0_0_6px_rgba(6,182,212,0.9)] stroke-[2.2]" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Group Information & Invite Modal */}
      {chat.isGroup && (
        <GroupInfoModal
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          chat={chat}
          currentUser={currentUser}
          onRevokeInvite={onRevokeInvite}
        />
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {selectedImageModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col animate-in fade-in duration-150 select-none"
          onClick={() => setSelectedImageModal(null)}
        >
          {/* Top header bar */}
          <div 
            className="px-4 py-3 bg-slate-900/80 border-b border-white/10 flex items-center justify-between z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
                title="Fechar (Esc)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h4 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md">
                  {selectedImageModal.name || 'Visualizar Foto'}
                </h4>
                <p className="text-[11px] text-cyan-400 font-medium">Tribbu'sChat • Visualizador de Mídia</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = selectedImageModal.url;
                  a.download = selectedImageModal.name || 'foto.jpg';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer shadow-cyan-500/25"
                title="Salvar foto no seu dispositivo"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Baixar Foto</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Centered Image Container */}
          <div 
            className="flex-1 flex items-center justify-center p-4 overflow-hidden relative"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedImageModal(null);
            }}
          >
            <img 
              src={selectedImageModal.url} 
              alt={selectedImageModal.name} 
              className="max-h-[85vh] max-w-[95vw] object-contain rounded-xl shadow-2xl transition-transform duration-200"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Share Contact with Cell Phone Number Modal */}
      <ShareContactModal
        isOpen={showShareContactModal}
        onClose={() => setShowShareContactModal(false)}
        currentUser={currentUser}
        onSendContact={handleConfirmSendContact}
      />

      {/* Fullscreen Illuminated Notice Modal */}
      {showFullNoticeModal && groupNotice && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-200 select-none"
          onClick={() => setShowFullNoticeModal(false)}
        >
          <div 
            className="w-full max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header with close button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Aviso Oficial do Canal • Válido por 24h
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFullNoticeModal(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* The illuminated dark mode card with cyan/green gradient border */}
            <div className="shadow-[0_0_50px_rgba(6,182,212,0.35)] rounded-2xl">
              <TextStatusCard 
                status={groupNotice} 
                showExpiration={true}
                className="w-full"
              />
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowFullNoticeModal(false);
                  setInputText(`Sobre o aviso: `);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-slate-950 font-black text-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-cyan-500/25 flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Responder no Grupo
              </button>
              <button
                type="button"
                onClick={() => setShowFullNoticeModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Notice Publisher Modal for the Group */}
      {showCreateNoticeModal && currentUser && (
        <NewStatusModal
          isOpen={showCreateNoticeModal}
          onClose={() => setShowCreateNoticeModal(false)}
          currentUser={currentUser}
          availableGroups={[chat]}
          initialGroupId={chat.id}
          initialTab="text"
          onPublishStatus={async () => {}}
          onPublishTextStatus={handlePublishGroupNotice}
        />
      )}

      {/* Hidden file input elements for media upload */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoUpload}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudioFileUpload}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
        className="hidden"
        onChange={handleDocUpload}
      />
    </div>
  );
}
