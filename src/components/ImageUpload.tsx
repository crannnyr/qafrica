import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { storageService } from '@/services/supabase';
import { toast } from 'sonner';

interface ImageUploadProps {
  bucket: string;
  folder?: string;
  value?: string | string[];
  onChange: (urls: string | string[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'auto';
}

export default function ImageUpload({
  bucket,
  folder = '',
  value,
  onChange,
  multiple = false,
  maxFiles = 5,
  maxSizeMB = 5,
  className = '',
  aspectRatio = 'auto',
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentImages = multiple
    ? (Array.isArray(value) ? value : [])
    : (value && typeof value === 'string' && value.startsWith('http') ? [value] : []);

  const aspectRatioClass = {
    square: 'aspect-square',
    landscape: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: 'aspect-auto',
  }[aspectRatio];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate file count
    if (multiple && currentImages.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} images allowed`);
      return;
    }

    // Validate file size
    const oversizedFiles = Array.from(files).filter(
      (f) => f.size > maxSizeMB * 1024 * 1024
    );
    if (oversizedFiles.length > 0) {
      toast.error(`Some files exceed ${maxSizeMB}MB limit`);
      return;
    }

    // Validate file type — check both MIME and extension
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const invalidFiles = Array.from(files).filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return !f.type.startsWith('image/') || !ext || !allowedExts.includes(ext);
    });
    if (invalidFiles.length > 0) {
      toast.error('Only image files are allowed (JPG, PNG, GIF, WebP)');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const filesToUpload = Array.from(files);
      const uploadedUrls: string[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];

        try {
          // Pass file directly — no ArrayBuffer/Blob conversion
          const { url, error } = await storageService.uploadImage(bucket, file, folder);

          if (error) {
            console.error(`[ImageUpload] Upload error for ${file.name}:`, error);
            toast.error(`Failed to upload ${file.name}`);
            continue;
          }

          // Strict URL validation before accepting
          if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            console.error(`[ImageUpload] Invalid URL returned for ${file.name}:`, url);
            toast.error(`Upload succeeded but URL is invalid for ${file.name}`);
            continue;
          }

          // Strip query params to keep URL clean
          const cleanUrl = url.split('?')[0];
          uploadedUrls.push(cleanUrl);
        } catch (fileErr) {
          console.error(`[ImageUpload] Exception uploading ${file.name}:`, fileErr);
          toast.error(`Error uploading ${file.name}`);
        }

        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }

      if (uploadedUrls.length > 0) {
        if (multiple) {
          onChange([...currentImages, ...uploadedUrls]);
        } else {
          onChange(uploadedUrls[0]);
        }
        toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
      }
    } catch (err) {
      console.error('[ImageUpload] Unexpected upload failure:', err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async (urlToRemove: string, index: number) => {
    try {
      const urlObj = new URL(urlToRemove);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.indexOf(bucket);

      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        await storageService.deleteFile(bucket, filePath);
      }
    } catch (err) {
      console.error('[ImageUpload] Delete error:', err);
      // Continue — still remove from UI
    }

    const newImages = currentImages.filter((_, i) => i !== index);
    onChange(multiple ? newImages : newImages[0] || '');
    toast.success('Image removed');
  };

  const canAddMore = multiple ? currentImages.length < maxFiles : currentImages.length === 0;

  return (
    <div className={className}>
      {/* Image Grid */}
      <div
        className={`grid gap-4 ${
          multiple
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
            : 'grid-cols-1 max-w-sm'
        }`}
      >
        <AnimatePresence>
          {currentImages.map((url, index) => (
            <motion.div
              key={`${url}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`relative group ${aspectRatioClass} bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden`}
            >
              <img
                src={url}
                alt={`Uploaded ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzczNzM3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJyb2tlbjwvdGV4dD48L3N2Zz4=';
                }}
              />

              {/* Remove Button */}
              <button
                onClick={() => handleRemove(url, index)}
                disabled={isUploading}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Upload Button */}
        {canAddMore && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`${aspectRatioClass} border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-orange-500 dark:hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(uploadProgress)}%
                </span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {multiple ? 'Add Image' : 'Upload Image'}
                </span>
              </>
            )}
          </motion.button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Helper Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {multiple
          ? `Upload up to ${maxFiles} images. Max ${maxSizeMB}MB each.`
          : `Max file size: ${maxSizeMB}MB. Supported: JPG, PNG, WebP.`}
      </p>
    </div>
  );
}

// Simple single image upload variant
export function SingleImageUpload({
  bucket,
  folder = '',
  value,
  onChange,
  className = '',
  placeholder = 'Upload Image',
}: Omit<ImageUploadProps, 'multiple' | 'maxFiles'> & { placeholder?: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size check
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Type check — both MIME and extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!file.type.startsWith('image/') || !fileExt || !allowedExts.includes(fileExt)) {
      toast.error('Only image files are allowed (JPG, PNG, GIF, WebP)');
      return;
    }

    setIsUploading(true);

    try {
      // Pass file directly — no ArrayBuffer/Blob conversion
      const { url, error } = await storageService.uploadImage(bucket, file, folder);

      if (error) {
        console.error('[SingleImageUpload] Upload error:', error);
        toast.error('Upload failed');
        return;
      }

      // Strict URL validation before accepting
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        console.error('[SingleImageUpload] Invalid URL returned:', url);
        toast.error('Upload succeeded but URL is invalid');
        return;
      }

      // Strip query params to keep URL clean
      const cleanUrl = url.split('?')[0];
      onChange(cleanUrl);
      toast.success('Image uploaded successfully');
    } catch (err) {
      console.error('[SingleImageUpload] Upload exception:', err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (value && typeof value === 'string') {
      try {
        const urlObj = new URL(value);
        const pathParts = urlObj.pathname.split('/');
        const bucketIndex = pathParts.indexOf(bucket);

        if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
          const filePath = pathParts.slice(bucketIndex + 1).join('/');
          await storageService.deleteFile(bucket, filePath);
        }
      } catch (err) {
        console.error('[SingleImageUpload] Delete error:', err);
        // Continue — still clear from UI
      }
    }
    onChange('');
  };

  return (
    <div className={className}>
      {value && typeof value === 'string' && value.startsWith('http') ? (
        <div className="relative group w-32 h-32">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-cover rounded-xl"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzczNzM3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJyb2tlbjwvdGV4dD48L3N2Zz4=';
            }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-orange-500 dark:hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                {placeholder}
              </span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}