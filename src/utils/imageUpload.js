import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase.js';

/**
 * Compress an image file using client-side canvas.
 * Resizes large images to max dimension and outputs optimized WebP or JPEG.
 *
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @param {number} quality
 * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
 */
export async function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('கோப்பைப் படிக்க முடியவில்லை (Failed to read file)'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('படத்தை ஏற்ற முடியவில்லை (Failed to load image)'));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = maxHeight;
            height = Math.round((img.height * width) / img.width);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas context உருவாக்க முடியவில்லை'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first, fallback to jpeg
        const mimeType = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl, width, height });
            } else {
              // Fallback to dataUrl conversion if blob fails
              fetch(dataUrl)
                .then(res => res.blob())
                .then(b => resolve({ blob: b, dataUrl, width, height }))
                .catch(reject);
            }
          },
          mimeType,
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload an image from local media.
 * Tries Firebase Storage first. If Storage fails or is unavailable,
 * falls back to an optimized base64 Data URL so the user is never blocked.
 *
 * @param {File} file
 * @param {(progress: number) => void} [onProgress]
 * @returns {Promise<{ url: string, isStorage: boolean, fileName: string }>}
 */
export async function uploadLocalImage(file, onProgress) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('தயவுசெய்து சரியான படக் கோப்பைத் தேர்ந்தெடுக்கவும் (JPG, PNG, WEBP)');
  }

  // Compress image client-side first
  const { blob, dataUrl } = await compressImage(file, 1400, 1400, 0.8);

  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
  const timestamp = Date.now();
  const storagePath = `kavithaigal/${timestamp}_${cleanName}`;

  if (onProgress) onProgress(30);

  try {
    if (storage) {
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: blob.type || 'image/jpeg',
      });
      if (onProgress) onProgress(80);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      if (onProgress) onProgress(100);
      return { url: downloadUrl, isStorage: true, fileName: file.name };
    }
  } catch (err) {
    console.warn('Firebase Storage upload failed, falling back to optimized inline data URL:', err);
  }

  // Fallback to compressed base64 dataUrl (under 800KB)
  if (onProgress) onProgress(100);
  return { url: dataUrl, isStorage: false, fileName: file.name };
}

/**
 * Format bytes to readable string (e.g. 240 KB)
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
