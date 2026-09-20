import { doc, collection, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface TypingIndicator {
  userId: string;
  userName: string;
  phoneNumber: string;
  state: 'typing' | 'recording';
  updatedAt: number;
}

/**
 * Set user's current status (typing or recording audio) in a Firestore chat
 */
export async function setTypingStatus(
  chatId: string,
  user: { uid?: string; displayName?: string; phoneNumber?: string },
  state: 'typing' | 'recording'
): Promise<void> {
  const resolvedUid = user?.uid || (user?.phoneNumber ? 'user_' + user.phoneNumber.replace(/\D/g, '') : '');
  if (!chatId || !resolvedUid) return;

  try {
    const typingDocRef = doc(db, 'chats', chatId, 'typing', resolvedUid);
    await setDoc(typingDocRef, {
      userId: resolvedUid,
      userName: user.displayName || user.phoneNumber || 'Participante',
      phoneNumber: user.phoneNumber || '',
      state,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (error) {
    // Silent fail in case of offline / permission issues
    console.debug('[TypingService] setTypingStatus warning:', error);
  }
}

/**
 * Remove user's typing/recording indicator from a chat
 */
export async function clearTypingStatus(chatId: string, userId: string): Promise<void> {
  if (!chatId || !userId) return;

  try {
    const typingDocRef = doc(db, 'chats', chatId, 'typing', userId);
    await deleteDoc(typingDocRef);
  } catch (error) {
    console.debug('[TypingService] clearTypingStatus warning:', error);
  }
}

/**
 * Real-time listener for active typing / recording members in a chat
 * Automatically filters out the current user and stale entries (> 7 seconds old)
 */
export function subscribeToChatTyping(
  chatId: string,
  currentUserId: string,
  callback: (indicators: TypingIndicator[]) => void
): () => void {
  if (!chatId) {
    callback([]);
    return () => {};
  }

  try {
    const typingColRef = collection(db, 'chats', chatId, 'typing');

    const unsubscribe = onSnapshot(
      typingColRef,
      (snapshot) => {
        const now = Date.now();
        const active: TypingIndicator[] = [];

        snapshot.forEach((docSnap) => {
          if (docSnap.id === currentUserId) return;
          const data = docSnap.data() as TypingIndicator;
          // Ignore stale typing indicators older than 7 seconds
          if (data && data.state && now - (data.updatedAt || 0) < 7000) {
            active.push(data);
          }
        });

        callback(active);
      },
      (error) => {
        console.debug('[TypingService] Snapshot listener warning:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.debug('[TypingService] subscribeToChatTyping caught:', error);
    callback([]);
    return () => {};
  }
}
