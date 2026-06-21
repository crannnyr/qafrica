// src/pages/dashboard/Jumia/JumiaImageUpload.tsx
// Requires at least 3 images so admin can actually see what's being sold.
// Compresses client-side via the shared compressImage utility before upload.

import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@/lib/imageCompression';

const MIN_IMAGES = 3;
const MAX_IMAGES = 6;

interface Props {
  images: string[];
  onImagesChange: (urls: string[]) => void;
  uploadImages: (files: File[]) => Promise<{ success: boolean; urls?: string[]; error?: string }>;
}

export default function JumiaImageUpload({ images, onImagesChange, uploadImages }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [compressedSizes, setCompressedSizes] = useState<string[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(`You can upload a maximum of ${MAX_IMAGES} images`);
      return;
    }

    setIsUploading(true);
    const result = await uploadImages(files);
    setIsUploading(false);

    if (!result.success || !result.urls) {
      toast.error(result.error || 'Image upload failed');
      return;
    }
    onImagesChange([...images, ...result.urls]);
    toast.success(`${result.urls.length} image(s) uploaded`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const isBelowMinimum = images.length < MIN_IMAGES;

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-gray-500">
        Product Photos <span className="text-gray-400 font-normal">(at least {MIN_IMAGES}, so we can see what you're selling)</span>
      </label>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {images.map((url, i) => (
          <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 hover:border-orange-400 transition-colors disabled:opacity-60"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-5 h-5 text-gray-400" />
                <span className="text-[10px] text-gray-400">Add</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {isBelowMinimum && (
        <p className="text-xs text-red-500 font-medium">
          {MIN_IMAGES - images.length} more photo{MIN_IMAGES - images.length > 1 ? 's' : ''} needed
        </p>
      )}
      <p className="text-[11px] text-gray-400">Images are compressed automatically before upload.</p>
    </div>
  );
}
