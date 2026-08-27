// src/pages/recommendations/AvatarSheet.tsx
// Full profile picture flow: preview current photo, upload a new one from
// device, OR pick from a set of real preset avatar images — genuine
// selectable options, not just a single fallback.
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, Loader, Check } from 'lucide-react';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import { fallbackAvatarColor, initialsFrom } from '@/lib/avatarFallback';
import { AvatarImage, isPresetAvatar, PRESET_AVATARS } from '@/lib/presetAvatars';
import { toast } from 'sonner';

export default function AvatarSheet({ onClose }: { onClose: () => void }) {
  const { customer, updateProfile } = useCustomerAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [savingPresetUrl, setSavingPresetUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `avatars/${customer.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { success, error } = await updateProfile({ avatar_url: publicUrl });
      if (!success) throw new Error(error);

      toast.success('Profile picture updated');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const choosePreset = async (url: string) => {
    if (!customer) return;
    setSavingPresetUrl(url);
    try {
      const { success, error } = await updateProfile({ avatar_url: url });
      if (!success) throw new Error(error);
      toast.success('Profile picture updated');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not update your picture. Please try again.');
    } finally {
      setSavingPresetUrl(null);
    }
  };

  const bgColor = fallbackAvatarColor(customer?.id ?? 'x');
  const initials = initialsFrom(customer?.full_name);
  const currentIsPreset = isPresetAvatar(customer?.avatar_url);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-900 text-lg">Profile Picture</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="relative">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-lg"
              style={{ backgroundColor: customer?.avatar_url ? undefined : bgColor }}
            >
              {customer?.avatar_url ? (
                <AvatarImage avatarUrl={customer.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-3xl font-bold">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 w-9 h-9 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center border-2 border-white transition-colors"
            >
              {isUploading ? <Loader className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? <Loader className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {isUploading ? 'Uploading…' : 'Upload a Photo'}
          </button>
        </div>

        {/* Preset picker — real, selectable images */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-3">Or choose one of these</p>
          <div className="grid grid-cols-4 gap-3">
            {PRESET_AVATARS.map((url) => {
              const isSelected = currentIsPreset && customer?.avatar_url === url;
              const isSaving = savingPresetUrl === url;
              return (
                <button
                  key={url}
                  onClick={() => choosePreset(url)}
                  disabled={savingPresetUrl !== null}
                  className="relative aspect-square rounded-full overflow-hidden border-2 bg-gray-100 transition-all disabled:opacity-50"
                  style={{ borderColor: isSelected ? '#F97316' : 'transparent' }}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {isSaving && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Loader className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                  {isSelected && !isSaving && (
                    <div className="absolute top-0.5 right-0.5 bg-orange-500 rounded-full p-0.5">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
