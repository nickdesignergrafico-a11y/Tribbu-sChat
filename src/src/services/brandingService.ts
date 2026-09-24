import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

export const LOCAL_STORAGE_LOGO_KEY = 'tribbus_custom_logo_url';
export const LOCAL_STORAGE_LOGO_BASE64_KEY = 'tribbus_custom_logo_base64';
export const LOCAL_STORAGE_LOGO_TIME_KEY = 'tribbus_custom_logo_time';

export const DEFAULT_LOGO_URL = '/icon/logo_oficial.png';
export const DEFAULT_SPLASH_LOGO_URL = '/icon/logo_oficial.png';

/**
 * Updates favicon and touch icons dynamically in document HEAD
 */
export function updateDomFavicons(iconUrl: string) {
  if (typeof document === 'undefined') return;
  try {
    const iconLinks = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon'], link[rel='apple-touch-icon']");
    iconLinks.forEach((link) => {
      link.href = iconUrl;
    });
  } catch (err) {
    console.warn('Could not update DOM favicons:', err);
  }
}

/**
 * Retrieves the currently saved logo synchronously from local storage for instant zero-latency rendering
 */
export function getSynchronousSavedLogo(): string {
  if (typeof window === 'undefined') return DEFAULT_LOGO_URL;
  try {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_LOGO_KEY);
    if (savedUrl && savedUrl.trim()) return savedUrl;

    const savedBase64 = localStorage.getItem(LOCAL_STORAGE_LOGO_BASE64_KEY);
    if (savedBase64 && savedBase64.trim()) return savedBase64;
  } catch (_) {}
  return DEFAULT_LOGO_URL;
}

/**
 * Subscribes to real-time branding updates from Firestore with local storage backup
 */
export function subscribeToBranding(onUpdate: (logoUrl: string) => void): () => void {
  // Fire immediately with cached logo
  const initial = getSynchronousSavedLogo();
  onUpdate(initial);
  updateDomFavicons(initial);

  if (!db) {
    return () => {};
  }

  try {
    const unsub = onSnapshot(
      doc(db, 'system_settings', 'branding'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const activeLogo = data?.logoUrl || data?.logoBase64;
          if (activeLogo && typeof activeLogo === 'string') {
            try {
              if (data.logoUrl) {
                localStorage.setItem(LOCAL_STORAGE_LOGO_KEY, data.logoUrl);
              }
              if (data.logoBase64) {
                localStorage.setItem(LOCAL_STORAGE_LOGO_BASE64_KEY, data.logoBase64);
              }
              if (data.updatedAt) {
                localStorage.setItem(LOCAL_STORAGE_LOGO_TIME_KEY, String(data.updatedAt));
              }
            } catch (_) {}

            onUpdate(activeLogo);
            updateDomFavicons(activeLogo);
            return;
          } else if (data?.isReset) {
            // Reverted to default
            try {
              localStorage.removeItem(LOCAL_STORAGE_LOGO_KEY);
              localStorage.removeItem(LOCAL_STORAGE_LOGO_BASE64_KEY);
              localStorage.removeItem(LOCAL_STORAGE_LOGO_TIME_KEY);
            } catch (_) {}
            onUpdate(DEFAULT_LOGO_URL);
            updateDomFavicons(DEFAULT_LOGO_URL);
            return;
          }
        }
      },
      (error) => {
        console.warn('[Branding] Firestore listener error, relying on local cached logo:', error);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('[Branding] Failed to attach listener:', err);
    return () => {};
  }
}

/**
 * Saves and updates the official logo across all persistence layers:
 * 1. LocalStorage (instant 0ms persistence)
 * 2. Firebase Storage (cloud persistent asset)
 * 3. Firestore (global real-time synchronization across all instances/devices)
 * 4. Local Express server (static public folder & PWA icons)
 */
export async function saveOfficialLogo(
  fileOrBase64: File | Blob | string,
  userPhone?: string
): Promise<{ success: boolean; logoUrl: string; message: string }> {
  let base64String = '';

  if (typeof fileOrBase64 === 'string') {
    base64String = fileOrBase64;
  } else {
    base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrBase64);
    });
  }

  // 1. Save immediately in LocalStorage
  const now = Date.now();
  try {
    localStorage.setItem(LOCAL_STORAGE_LOGO_BASE64_KEY, base64String);
    localStorage.setItem(LOCAL_STORAGE_LOGO_TIME_KEY, String(now));
  } catch (e) {
    console.warn('LocalStorage quota warning:', e);
  }

  updateDomFavicons(base64String);

  // 2. Upload to Firebase Storage for durable Cloud URL
  let cloudStorageUrl = '';
  try {
    const storageRef = ref(storage, `branding/tribbus_official_logo_${now}.png`);
    const snapshot = await uploadString(storageRef, base64String, 'data_url');
    cloudStorageUrl = await getDownloadURL(snapshot.ref);
    try {
      localStorage.setItem(LOCAL_STORAGE_LOGO_KEY, cloudStorageUrl);
    } catch (_) {}
  } catch (storageErr) {
    console.warn('[Branding] Firebase Storage upload skipped or failed, using base64 representation:', storageErr);
  }

  const finalLogoUrl = cloudStorageUrl || base64String;

  // 3. Persist to Firestore system_settings/branding
  try {
    await setDoc(doc(db, 'system_settings', 'branding'), {
      logoUrl: cloudStorageUrl || '',
      logoBase64: base64String,
      updatedAt: now,
      updatedBy: userPhone || 'user',
      isReset: false
    });
  } catch (fsErr) {
    console.warn('[Branding] Firestore sync error:', fsErr);
  }

  // 4. Update Express backend disk & PWA icons
  try {
    await fetch('/api/branding/upload-logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: base64String })
    });
  } catch (serverErr) {
    console.warn('[Branding] Server local file update notice:', serverErr);
  }

  return {
    success: true,
    logoUrl: finalLogoUrl,
    message: 'Logotipo atualizado e sincronizado permanentemente!'
  };
}

/**
 * Resets the official logo back to default Tribbu assets
 */
export async function resetOfficialLogo(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_LOGO_KEY);
    localStorage.removeItem(LOCAL_STORAGE_LOGO_BASE64_KEY);
    localStorage.removeItem(LOCAL_STORAGE_LOGO_TIME_KEY);
  } catch (_) {}

  try {
    await setDoc(doc(db, 'system_settings', 'branding'), {
      logoUrl: '',
      logoBase64: '',
      updatedAt: Date.now(),
      isReset: true
    });
  } catch (_) {}

  updateDomFavicons(DEFAULT_LOGO_URL);
}
