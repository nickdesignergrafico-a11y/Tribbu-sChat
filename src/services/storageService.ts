import { ref, uploadBytes, uploadBytesResumable, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Flag to indicate if remote Firebase Storage bucket is available.
 * If an operation fails with 404, network error, or timeout, this circuit-breaker
 * enables immediate local/base64 fallback without stalling the UI.
 */
let storageUnavailable = false;

function timeoutPromise<T>(ms: number, message = 'Storage timeout'): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

/**
 * Helper to convert File/Blob to Data URL fallback
 */
function getFallbackDataUrl(fileOrDataUrl: File | Blob | string): Promise<string> {
  if (typeof fileOrDataUrl === 'string') {
    return Promise.resolve(fileOrDataUrl);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(fileOrDataUrl);
  });
}

/**
 * Helper to determine file size in human-readable string
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Upload profile photo to Firebase Storage
 * Stored at: users/{userId}/profile_{timestamp}.jpg
 * Falls back immediately to compressed data URL if storage bucket is unavailable or times out (max 2s).
 */
export async function uploadProfilePhoto(
  userId: string,
  fileOrDataUrl: File | Blob | string
): Promise<string> {
  if (storageUnavailable) {
    return getFallbackDataUrl(fileOrDataUrl);
  }

  try {
    const timestamp = Date.now();
    const storageRef = ref(storage, `users/${userId}/profile_${timestamp}.jpg`);

    const doUpload = async (): Promise<string> => {
      if (typeof fileOrDataUrl === 'string') {
        if (fileOrDataUrl.startsWith('data:')) {
          const snapshot = await uploadString(storageRef, fileOrDataUrl, 'data_url');
          return await getDownloadURL(snapshot.ref);
        }
        return fileOrDataUrl;
      } else {
        const snapshot = await uploadBytes(storageRef, fileOrDataUrl, {
          contentType: fileOrDataUrl.type || 'image/jpeg'
        });
        return await getDownloadURL(snapshot.ref);
      }
    };

    // Strict 2000ms timeout prevents hanging UI on 'Salvando...'
    return await Promise.race([doUpload(), timeoutPromise<string>(2000)]);
  } catch (error) {
    storageUnavailable = true;
    console.warn('[Storage] Firebase Storage indisponível ou timeout, utilizando representação compacta:', error);
    return getFallbackDataUrl(fileOrDataUrl);
  }
}

/**
 * Upload chat media (image, audio, video, document) to Firebase Storage
 * Stored at: chats/{chatId}/{category}/{timestamp}_{filename}
 * Supports onProgress callback for real-time progress bar.
 */
export async function uploadChatMedia(
  chatId: string,
  fileOrBlob: File | Blob,
  category: 'image' | 'video' | 'audio' | 'document',
  originalFileName?: string,
  onProgress?: (percent: number) => void
): Promise<{ mediaUrl: string; fileName: string; fileSize: string }> {
  const fileName = originalFileName || `${category}_${Date.now()}`;
  const fileSize = formatBytes(fileOrBlob.size);

  if (storageUnavailable) {
    onProgress?.(30);
    const fallbackUrl = await getFallbackDataUrl(fileOrBlob);
    onProgress?.(100);
    return { mediaUrl: fallbackUrl, fileName, fileSize };
  }

  try {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `chats/${chatId}/${category}s/${Date.now()}_${sanitizedName}`;
    const storageRef = ref(storage, storagePath);

    const metadata = {
      contentType: fileOrBlob.type || (
        category === 'audio' ? 'audio/webm' :
        category === 'video' ? 'video/mp4' :
        category === 'image' ? 'image/jpeg' : 'application/octet-stream'
      )
    };

    onProgress?.(5);

    const uploadTaskPromise = new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, fileOrBlob, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress?.(Math.min(99, Math.max(5, progress)));
          }
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            onProgress?.(100);
            resolve(downloadUrl);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    const mediaUrl = await Promise.race([
      uploadTaskPromise,
      timeoutPromise<string>(2500, 'Upload chat media timeout')
    ]);

    return { mediaUrl, fileName, fileSize };
  } catch (error) {
    storageUnavailable = true;
    console.warn(`[Storage] Resumable upload for ${category} had issue, falling back to local representation:`, error);
    
    // Simulate progressive loading bar in fallback mode
    onProgress?.(35);
    await new Promise((r) => setTimeout(r, 60));
    onProgress?.(70);
    await new Promise((r) => setTimeout(r, 60));

    const fallbackUrl = await getFallbackDataUrl(fileOrBlob);
    onProgress?.(100);

    return { mediaUrl: fallbackUrl, fileName, fileSize };
  }
}

/**
 * Upload status media (photos, short videos) to Firebase Storage
 * Stored at: statuses/{userId}/{timestamp}_{filename}
 * Supports onProgress callback for real-time progress bar.
 */
export async function uploadStatusMedia(
  userId: string,
  fileOrBlob: File | Blob,
  mediaType: 'image' | 'video',
  originalFileName?: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (storageUnavailable) {
    onProgress?.(40);
    const fallbackUrl = await getFallbackDataUrl(fileOrBlob);
    onProgress?.(100);
    return fallbackUrl;
  }

  try {
    const timestamp = Date.now();
    const extension = mediaType === 'video' ? 'mp4' : 'jpg';
    const storagePath = `statuses/${userId}/${timestamp}_status.${extension}`;
    const storageRef = ref(storage, storagePath);

    const metadata = {
      contentType: fileOrBlob.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg')
    };

    onProgress?.(5);

    const uploadTaskPromise = new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, fileOrBlob, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress?.(Math.min(99, Math.max(5, progress)));
          }
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            onProgress?.(100);
            resolve(downloadUrl);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    return await Promise.race([
      uploadTaskPromise,
      timeoutPromise<string>(2500, 'Upload status media timeout')
    ]);
  } catch (error) {
    storageUnavailable = true;
    console.warn('[Storage] Status media upload fallback:', error);
    onProgress?.(40);
    await new Promise((r) => setTimeout(r, 60));
    onProgress?.(80);
    await new Promise((r) => setTimeout(r, 60));

    const fallbackUrl = await getFallbackDataUrl(fileOrBlob);
    onProgress?.(100);
    return fallbackUrl;
  }
}
