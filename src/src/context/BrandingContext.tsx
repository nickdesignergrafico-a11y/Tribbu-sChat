import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getSynchronousSavedLogo,
  subscribeToBranding,
  saveOfficialLogo,
  resetOfficialLogo,
  DEFAULT_LOGO_URL
} from '../services/brandingService';

interface BrandingContextType {
  logoUrl: string;
  isUpdatingLogo: boolean;
  logoTimestamp: number;
  updateLogo: (fileOrBase64: File | Blob | string, userPhone?: string) => Promise<{ success: boolean; message: string }>;
  resetLogo: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
  logoUrl: DEFAULT_LOGO_URL,
  isUpdatingLogo: false,
  logoTimestamp: Date.now(),
  updateLogo: async () => ({ success: false, message: '' }),
  resetLogo: async () => {}
});

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logoUrl, setLogoUrl] = useState<string>(() => getSynchronousSavedLogo());
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now());

  useEffect(() => {
    // Synchronize with Firestore real-time updates and LocalStorage
    const unsubscribe = subscribeToBranding((newLogoUrl) => {
      setLogoUrl(newLogoUrl);
      setLogoTimestamp(Date.now());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateLogo = useCallback(async (fileOrBase64: File | Blob | string, userPhone?: string) => {
    setIsUpdatingLogo(true);
    try {
      const res = await saveOfficialLogo(fileOrBase64, userPhone);
      if (res.success && res.logoUrl) {
        setLogoUrl(res.logoUrl);
        setLogoTimestamp(Date.now());
      }
      return { success: res.success, message: res.message };
    } catch (err: any) {
      console.error('Error updating logo:', err);
      return { success: false, message: err.message || 'Falha ao atualizar logotipo' };
    } finally {
      setIsUpdatingLogo(false);
    }
  }, []);

  const resetLogo = useCallback(async () => {
    setIsUpdatingLogo(true);
    try {
      await resetOfficialLogo();
      setLogoUrl(DEFAULT_LOGO_URL);
      setLogoTimestamp(Date.now());
    } finally {
      setIsUpdatingLogo(false);
    }
  }, []);

  return (
    <BrandingContext.Provider
      value={{
        logoUrl,
        isUpdatingLogo,
        logoTimestamp,
        updateLogo,
        resetLogo
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
