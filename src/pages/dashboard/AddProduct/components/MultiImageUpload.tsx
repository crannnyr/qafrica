import { useState } from 'react';
import { Plus, X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { compressImage } from '@/lib/imageCompression';
import { useAuthStore } from '@/stores';

export function MultiImageUpload({
  value = [],
  onChange,
  maxImages = 5,
}: {
  value?: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const { user } = useAuthStore();
  const safeValue = Array.isArray(value) ? value : [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - safeValue.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    if (filesToUpload.length === 0) { toast.error(`Maximum ${maxImages} images allowed`); return; }

    setUploading(true);
    setCompressionInfo(null);
    const uploadedUrls: string[] = [];
    let totalOriginal = 0;
    let totalCompressed = 0;

    for (const rawFile of filesToUpload) {
      if (rawFile.size > 15 * 1024 * 1024) { toast.error(`${rawFile.name} is too large (max 15MB)`); continue; }
      const fileExt = rawFile.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) { toast.error(`${rawFile.name}: Invalid type`); continue; }

      totalOriginal += rawFile.size;
      const file = await compressImage(rawFile);
      totalCompressed += file.size;

      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${file.name.split('.').pop() || 'webp'}`;
      const filePath = `${user?.id || 'anon'}/${fileName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });

        if (uploadError) { toast.error(`Failed to upload ${rawFile.name}`); continue; }

        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        if (!data?.publicUrl?.startsWith('http')) { toast.error(`Invalid URL for ${rawFile.name}`); continue; }
        uploadedUrls.push(data.publicUrl.split('?')[0]);
      } catch { toast.error(`Error uploading ${rawFile.name}`); }
    }

    if (uploadedUrls.length > 0) {
      onChange([...safeValue, ...uploadedUrls]);
      const saving = Math.round((1 - totalCompressed / totalOriginal) * 100);
      setCompressionInfo(`${uploadedUrls.length} image(s) uploaded${totalOriginal > totalCompressed ? ` · ${saving}% smaller` : ''}`);
    }

    setUploading(false);
    e.target.value = '';
  };

  const removeImage = async (index: number) => {
    const urlToRemove = safeValue[index];
    try {
      const parts = new URL(urlToRemove).pathname.split('/');
      const bucketIdx = parts.indexOf('products');
      if (bucketIdx !== -1) await supabase.storage.from('products').remove([parts.slice(bucketIdx + 1).join('/')]);
    } catch {}
    onChange(safeValue.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {safeValue.map((url, index) => (
          <div key={`img-${index}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group border border-gray-200">
            <img src={url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
            <button type="button" onClick={() => removeImage(index)}
              className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
              <X className="w-3 h-3" />
            </button>
            {index === 0 && (
              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] rounded font-medium">
                Main
              </span>
            )}
          </div>
        ))}

        {safeValue.length < maxImages && (
          <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50 flex flex-col items-center justify-center cursor-pointer transition-colors">
            {uploading
              ? <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
              : <><Plus className="w-6 h-6 text-gray-400" /><span className="text-xs text-gray-400 mt-1">Add</span></>
            }
            <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploading} />
          </label>
        )}
      </div>

      {compressionInfo && (
        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> {compressionInfo}
        </p>
      )}
      <p className="text-xs text-gray-400">{safeValue.length}/{maxImages} images · First image is the main photo · Auto-compressed</p>
    </div>
  );
}