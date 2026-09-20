import { collection, doc, setDoc, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { StatusItem, UserStatusGroup, TextStatusStyle } from '../types';
import { uploadStatusMedia } from './storageService';

// Dynamic demo statuses with valid 24h expiration window
export const getDemoStatuses = (): StatusItem[] => {
  const now = Date.now();
  return [
    {
      id: 'demo-status-1',
      userId: 'user-lucas',
      userName: 'Lucas Silva',
      userPhone: '+55 11 98877-6655',
      avatarColor: '#06B6D4',
      mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      mediaType: 'image',
      caption: 'Configurando a infraestrutura da nossa Tribbu! 🚀⚡',
      timestamp: now - 1000 * 60 * 45, // 45 min ago
      expiresAt: now + 1000 * 60 * 60 * 23.25
    },
    {
      id: 'demo-status-2',
      userId: 'user-mariana',
      userName: 'Mariana Costa',
      userPhone: '+55 21 97766-5544',
      avatarColor: '#10B981',
      mediaUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tree-branches-in-the-breeze-1188-large.mp4',
      mediaType: 'video',
      caption: 'Pausa para um café e respirar ar puro 🌿☕',
      timestamp: now - 1000 * 60 * 120, // 2 hours ago
      expiresAt: now + 1000 * 60 * 60 * 22
    },
    {
      id: 'demo-status-3',
      userId: 'user-mariana',
      userName: 'Mariana Costa',
      userPhone: '+55 21 97766-5544',
      avatarColor: '#10B981',
      mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
      mediaType: 'image',
      caption: 'Fim de tarde maravilhoso!',
      timestamp: now - 1000 * 60 * 90,
      expiresAt: now + 1000 * 60 * 60 * 22.5
    },
    {
      id: 'demo-status-4',
      userId: 'user-tribbu-hq',
      userName: 'Tribbu Comunidade',
      userPhone: '+55 11 99900-1122',
      avatarColor: '#06B6D4',
      mediaUrl: '',
      mediaType: 'text',
      textContent: '⚡ Bem-vindos aos canais da Tribbu! Este é um Aviso Oficial com validade de 24 horas. Fique atento às novidades da nossa comunidade.',
      textStyle: {
        themeId: 'tribbu-cyber',
        fontFamily: 'sans',
        badge: '📢 Aviso da Tribbu'
      },
      isTribbuNotice: true,
      targetGroupName: 'Geral',
      timestamp: now - 1000 * 60 * 30, // 30 min ago
      expiresAt: now + 1000 * 60 * 60 * 23.5
    }
  ];
};

export const DEMO_STATUSES = getDemoStatuses();

/**
 * Filter statuses that have not expired yet (strict 24-hour expiration rule)
 */
export function filterActiveStatuses(statuses: StatusItem[]): StatusItem[] {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  return statuses.filter((item) => {
    if (item.expiresAt) {
      return item.expiresAt > now;
    }
    return now - item.timestamp < ONE_DAY_MS;
  });
}

/**
 * Group flat list of status items by userId
 */
export function groupStatusesByUser(
  statuses: StatusItem[],
  currentUserId?: string,
  viewedIds: Set<string> = new Set()
): { myGroup: UserStatusGroup | null; contactGroups: UserStatusGroup[] } {
  // Only process active, non-expired statuses
  const activeStatuses = filterActiveStatuses(statuses);
  const groupsMap = new Map<string, UserStatusGroup>();

  activeStatuses.forEach((item) => {
    const isMe = currentUserId ? item.userId === currentUserId : false;
    const isViewed = viewedIds.has(item.id);

    if (!groupsMap.has(item.userId)) {
      groupsMap.set(item.userId, {
        userId: item.userId,
        userName: item.userName,
        userPhone: item.userPhone,
        avatarColor: item.avatarColor,
        photoURL: item.photoURL,
        isMe,
        hasUnread: !isViewed,
        statuses: [{ ...item, viewed: isViewed }]
      });
    } else {
      const g = groupsMap.get(item.userId)!;
      g.statuses.push({ ...item, viewed: isViewed });
      if (!isViewed) g.hasUnread = true;
    }
  });

  let myGroup: UserStatusGroup | null = null;
  const contactGroups: UserStatusGroup[] = [];

  groupsMap.forEach((group) => {
    // Sort each user's statuses chronologically
    group.statuses.sort((a, b) => a.timestamp - b.timestamp);
    if (group.isMe) {
      myGroup = group;
    } else {
      contactGroups.push(group);
    }
  });

  // Sort contact groups: unread first, then by latest status
  contactGroups.sort((a, b) => {
    if (a.hasUnread && !b.hasUnread) return -1;
    if (!a.hasUnread && b.hasUnread) return 1;
    const lastA = a.statuses[a.statuses.length - 1]?.timestamp || 0;
    const lastB = b.statuses[b.statuses.length - 1]?.timestamp || 0;
    return lastB - lastA;
  });

  return { myGroup, contactGroups };
}

/**
 * Publish a new status to Firebase Storage and Firestore
 * Automatically sets 24-hour expiration timestamp.
 */
export async function publishStatus(
  user: { uid?: string; displayName: string; phoneNumber: string; avatarColor: string; photoURL?: string },
  fileOrDataUrl: File | Blob | string,
  mediaType: 'image' | 'video',
  caption?: string,
  onProgress?: (percent: number) => void
): Promise<StatusItem> {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const expiresAt = now + ONE_DAY_MS; // Strict 24h expiration
  const statusId = `status_${now}_${Math.random().toString(36).substring(2, 8)}`;
  const userId = user.uid || `user_${user.phoneNumber}`;

  // 1. Upload media to Firebase Storage with progress tracking
  let mediaUrl = '';
  if (typeof fileOrDataUrl === 'string') {
    onProgress?.(50);
    mediaUrl = fileOrDataUrl;
    onProgress?.(100);
  } else {
    mediaUrl = await uploadStatusMedia(userId, fileOrDataUrl, mediaType, undefined, onProgress);
  }

  const newStatus: StatusItem = {
    id: statusId,
    userId,
    userName: user.displayName || user.phoneNumber,
    userPhone: user.phoneNumber,
    avatarColor: user.avatarColor,
    photoURL: user.photoURL,
    mediaUrl,
    mediaType,
    caption: caption || '',
    timestamp: now,
    expiresAt
  };

  // 2. Persist to Firestore with 24-hour expiration
  try {
    const statusDocRef = doc(db, 'statuses', statusId);
    await setDoc(statusDocRef, {
      ...newStatus,
      expiresAt,
      createdAt: new Date(now).toISOString()
    });
  } catch (error) {
    console.warn('[StatusService] Firestore save fallback:', error);
  }

  return newStatus;
}

/**
 * Publish a modern Dark Mode Text Status (or Tribbu Notice for a group/channel)
 * Automatically sets 24-hour expiration timestamp.
 */
export async function publishTextStatus(
  user: { uid?: string; displayName: string; phoneNumber: string; avatarColor: string; photoURL?: string },
  textContent: string,
  style: TextStatusStyle,
  isTribbuNotice?: boolean,
  targetGroupId?: string,
  targetGroupName?: string
): Promise<StatusItem> {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const expiresAt = now + ONE_DAY_MS;
  const statusId = `status_txt_${now}_${Math.random().toString(36).substring(2, 8)}`;
  const userId = user.uid || `user_${user.phoneNumber}`;

  const newStatus: StatusItem = {
    id: statusId,
    userId,
    userName: user.displayName || user.phoneNumber,
    userPhone: user.phoneNumber,
    avatarColor: user.avatarColor,
    photoURL: user.photoURL,
    mediaUrl: '',
    mediaType: 'text',
    textContent: textContent.trim(),
    textStyle: style,
    isTribbuNotice: !!isTribbuNotice,
    targetGroupId: targetGroupId || undefined,
    targetGroupName: targetGroupName || undefined,
    timestamp: now,
    expiresAt
  };

  // 1. Persist to Firestore statuses collection
  try {
    const statusDocRef = doc(db, 'statuses', statusId);
    await setDoc(statusDocRef, {
      ...newStatus,
      expiresAt,
      createdAt: new Date(now).toISOString()
    });
  } catch (error) {
    console.warn('[StatusService] Firestore text status save fallback:', error);
  }

  // 2. If it is targeted to a group channel, also persist the active notice to the group document
  if (isTribbuNotice && targetGroupId) {
    try {
      const groupDocRef = doc(db, 'chats', targetGroupId);
      await setDoc(groupDocRef, {
        activeNotice: newStatus
      }, { merge: true });
    } catch (e) {
      console.warn('[StatusService] Failed to set activeNotice on group doc:', e);
    }
  }

  return newStatus;
}

/**
 * Subscribe to status updates in real-time from Firestore
 * Automatically removes expired (24h+) items.
 */
export function subscribeToStatuses(callback: (statuses: StatusItem[]) => void): () => void {
  try {
    const colRef = collection(db, 'statuses');
    const q = query(colRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreStatuses: StatusItem[] = [];
        snapshot.forEach((docSnap) => {
          firestoreStatuses.push({ id: docSnap.id, ...docSnap.data() } as StatusItem);
        });

        // Merge with fresh demo statuses
        const demos = getDemoStatuses();
        const combined = [...firestoreStatuses];
        demos.forEach((demo) => {
          if (!combined.some((s) => s.id === demo.id)) {
            combined.push(demo);
          }
        });

        // Exclude expired (older than 24h)
        const activeOnly = filterActiveStatuses(combined);
        callback(activeOnly);
      },
      (error) => {
        console.debug('[StatusService] Using demo fallback due to:', error);
        callback(filterActiveStatuses(getDemoStatuses()));
      }
    );

    return unsubscribe;
  } catch {
    callback(filterActiveStatuses(getDemoStatuses()));
    return () => {};
  }
}
