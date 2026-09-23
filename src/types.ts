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
  profileCompleted?: boolean;
}

/**
 * Checks whether a user profile is fully completed with a chosen display name,
 * rather than an uncompleted profile or a raw phone number.
 */
export function isUserProfileComplete(userData?: any): boolean {
  if (!userData) return false;
  if (userData.profileCompleted === true) return true;

  const name = (userData.displayName || '').trim();
  if (!name) return false;

  // If the displayName is just a phone number, the profile is not yet completed
  const phoneDigits = (userData.phoneNumber || '').replace(/\D/g, '');
  const nameDigits = name.replace(/\D/g, '');

  if (name.startsWith('+') && nameDigits.length >= 8) return false;
  if (phoneDigits && nameDigits === phoneDigits) return false;
  if (/^\+?[\d\s\-()]+$/.test(name) && nameDigits.length >= 8) return false;

  return true;
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

