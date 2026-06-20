import { supabase } from './supabase';
import { compressImage } from '@/lib/imageCompression';

export const storageService = {
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(path, file, { cacheControl: '3600', upsert: true });
    return { data, error };
  },

  async uploadImage(bucket: string, file: File, folder: string = '') {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt) return { url: null, error: new Error('Invalid file: no extension') };

    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExts.includes(fileExt)) return { url: null, error: new Error('File type not allowed') };

    let fileToUpload = file;
    try {
      if (bucket === 'store-logos') {
        fileToUpload = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.85 });
      } else if (bucket === 'store-banners') {
        fileToUpload = await compressImage(file, { maxWidth: 1200, maxHeight: 400, quality: 0.82 });
      } else {
        fileToUpload = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
      }
    } catch {
      fileToUpload = file;
    }

    const compressedExt = fileToUpload.name.split('.').pop()?.toLowerCase() || fileExt;
    const filePath = [
      folder,
      `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${compressedExt}`,
    ].filter(Boolean).join('/');

    const { error: uploadError } = await supabase
      .storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileToUpload.type,
      });

    if (uploadError) {
      console.error('[storageService] Upload error:', uploadError);
      return { url: null, error: uploadError };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

    if (!data?.publicUrl || !data.publicUrl.startsWith('http')) {
      return { url: null, error: new Error('Failed to generate valid public URL') };
    }

    return { url: data.publicUrl.split('?')[0], error: null };
  },

  async uploadMultipleImages(bucket: string, files: File[], folder: string = '') {
    const results = await Promise.all(files.map(f => this.uploadImage(bucket, f, folder)));
    return {
      urls:   results.filter(r => r.url).map(r => r.url!),
      errors: results.filter(r => r.error).map(r => r.error),
    };
  },

  async getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    return { error };
  },

  async deleteFiles(bucket: string, paths: string[]) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    return { error };
  },
};