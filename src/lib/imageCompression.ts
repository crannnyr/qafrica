export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  targetSizeKb?: number;
}

/**
 * Compresses an image file using the Canvas API.
 * - Resizes to max 800px on longest side (preserving aspect ratio)
 * - Outputs WebP for photos, PNG for transparent images
 * - Multi-pass: keeps reducing quality until targetSizeKb is hit
 * - Falls back to best attempt if target can't be reached
 * - Never throws — always resolves with a usable file
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.6, targetSizeKb = 30 } = options;

  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width  = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      const isPng     = file.type === 'image/png';
      const outputType = isPng ? 'image/png' : 'image/webp';
      const outputExt  = isPng ? 'png' : 'webp';
      const targetBytes = targetSizeKb * 1024;

      // Multi-pass compression
      const tryCompress = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }

            const compressed = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, `.${outputExt}`),
              { type: outputType }
            );

            // Already under target — use it
            if (compressed.size <= targetBytes) {
              resolve(compressed);
              return;
            }

            // Try lower quality
            if (q > 0.1) {
              tryCompress(Math.max(q - 0.1, 0.1));
              return;
            }

            // Can't get smaller — use best attempt vs original
            resolve(compressed.size < file.size ? compressed : file);
          },
          outputType,
          q
        );
      };

      tryCompress(quality);
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
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