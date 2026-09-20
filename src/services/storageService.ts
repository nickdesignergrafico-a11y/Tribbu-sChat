import { ref, uploadBytes, uploadBytesResumable, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

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
 * Falls back to data URL if storage is unavailable.
 */
export async function uploadProfilePhoto(
  userId: string,
  fileOrDataUrl: File | Blob | string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const storageRef = ref(storage, `users/${userId}/profile_${timestamp}.jpg`);

    if (typeof fileOrDataUrl === 'string') {
      if (fileOrDataUrl.startsWith('data:')) {
        // Upload base64 data URL
        const snapshot = await uploadString(storageRef, fileOrDataUrl, 'data_url');
        return await getDownloadURL(snapshot.ref);
      }
      // If already a remote URL, return it directly
      return fileOrDataUrl;
    } else {
      // Upload Blob or File
      const snapshot = await uploadBytes(storageRef, fileOrDataUrl, {
        contentType: fileOrDataUrl.type || 'image/jpeg'
      });
      return await getDownloadURL(snapshot.ref);
    }
  } catch (error) {
    console.warn('[Storage] Firebase Storage upload failed, falling back to local/inline representation:', error);
    if (typeof fileOrDataUrl === 'string') {
      return fileOrDataUrl;
    }
    // Convert Blob/File to Data URL as resilient fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrDataUrl);
    });
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

    const mediaUrl = await new Promise<string>((resolve, reject) => {
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

    return { mediaUrl, fileName, fileSize };
  } catch (error) {
    console.warn(`[Storage] Resumable upload for ${category} had issue, falling back to FileReader:`, error);
    
    // Simulate progressive loading bar in fallback mode
    onProgress?.(25);
    await new Promise((r) => setTimeout(r, 120));
    onProgress?.(60);
    await new Promise((r) => setTimeout(r, 120));
    onProgress?.(90);

    const fallbackUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        onProgress?.(100);
        resolve(reader.result as string);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrBlob);
    });

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
  try {
    const timestamp = Date.now();
    const extension = mediaType === 'video' ? 'mp4' : 'jpg';
    const storagePath = `statuses/${userId}/${timestamp}_status.${extension}`;
    const storageRef = ref(storage, storagePath);

    const metadata = {
      contentType: fileOrBlob.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg')
    };

    onProgress?.(5);

    return await new Promise<string>((resolve, reject) => {
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
  } catch (error) {
    console.warn('[Storage] Status media upload fallback:', error);
    onProgress?.(30);
    await new Promise((r) => setTimeout(r, 100));
    onProgress?.(75);
    await new Promise((r) => setTimeout(r, 100));

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        onProgress?.(100);
        resolve(reader.result as string);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrBlob);
    });
  }
}
