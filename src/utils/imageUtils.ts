/**
 * Image processing utilities for camera capture and mobile photo uploads.
 * Automatically resizes and compresses photos to ensure smooth performance
 * and prevent Firestore document size overflow.
 */

export function resizeAndCompressImage(
  fileOrBlob: Blob | File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao processar a imagem'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserving dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Contexto 2D indisponível'));
          return;
        }

        // Draw and compress to JPEG
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}
