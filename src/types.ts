export interface Message {
  id: string;
  sender: 'me' | 'them';
  senderName?: string;
  senderPhoneNumber?: string;
  senderEmail?: string;
  senderId?: string;
  text: string;
  time: string;
  timestamp: number; // For chronological sorting
  status?: 'sent' | 'delivered' | 'read';
  type?: 'text' | 'image' | 'video' | 'document' | 'location' | 'contact' | 'audio';
  mediaType?: 'text' | 'image' | 'video' | 'document' | 'location' | 'contact' | 'audio';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface Chat {
  id: string;
  name: string;
  avatarColor: string;
  avatarLetter: string;
  photoURL?: string;
  isGroup: boolean;
  isCommunity?: boolean;
  isAI?: boolean;
  statusText: string;
  online: boolean;
  messages: Message[];
  unreadCount: number;
  inviteCode?: string;
  createdBy?: string;
  members?: string[];
  description?: string;
  createdAt?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  activeNotice?: StatusItem;
}

export interface UserSession {
  uid?: string;
  phoneNumber: string;
  email?: string;
  displayName: string;
  initial: string;
  avatarColor: string;
  photoURL?: string;
  about?: string;
  createdAt?: string;
}

export interface TextStatusStyle {
  themeId: 'tribbu-cyber' | 'emerald-glow' | 'obsidian-neon' | 'midnight-aurora' | 'tribbu-alert';
  fontFamily?: 'sans' | 'display' | 'mono';
  badge?: string;
}

export interface StatusItem {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  avatarColor: string;
  photoURL?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'text';
  textContent?: string;
  textStyle?: TextStatusStyle;
  caption?: string;
  timestamp: number;
  expiresAt?: number;
  viewed?: boolean;
  isTribbuNotice?: boolean;
  targetGroupId?: string;
  targetGroupName?: string;
}

export interface UserStatusGroup {
  userId: string;
  userName: string;
  userPhone: string;
  avatarColor: string;
  photoURL?: string;
  isMe?: boolean;
  hasUnread?: boolean;
  statuses: StatusItem[];
}

