// src/lib/imageCompression.ts

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Compresses an image file using the Canvas API.
 * - Resizes to max 1200px on longest side (preserving aspect ratio)
 * - Outputs WebP for photos, PNG for transparent images
 * - Falls back to original if compression doesn't reduce size
 * - Never throws — always resolves with a usable file
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.82 } = options;

  // Skip non-image or already tiny files
  if (!file.type.startsWith('image/') || file.size < 100 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Resize only if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Keep PNG for transparency, use WebP for everything else
      const isPng = file.type === 'image/png';
      const outputType = isPng ? 'image/png' : 'image/webp';
      const outputExt  = isPng ? 'png' : 'webp';

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }

          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, `.${outputExt}`),
            { type: outputType }
          );

          // Only use compressed version if it's actually smaller
          resolve(compressed.size < file.size ? compressed : file);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback to original
    };

    img.src = objectUrl;
  });
}

/**
 * Compresses multiple files in parallel.
 * Returns array in same order as input.
 */
export async function compressImages(
  files: File[],
  options?: CompressOptions
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, options)));
}

/**
 * Returns a human-readable size string e.g. "1.2 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}