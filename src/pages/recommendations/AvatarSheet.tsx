// src/pages/recommendations/AvatarSheet.tsx
// Full profile picture flow: preview current photo (or fallback), upload a
// new one from device, save straight to the customer's profile.
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, Loader } from 'lucide-react';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import { fallbackAvatarColor, initialsFrom } from '@/lib/avatarFallback';
import { toast } from 'sonner';

export default function AvatarSheet({ onClose }: { onClose: () => void }) {
  const { customer, updateProfile } = useCustomerAuthStore();
  const [isUploading, setIsUploading] = useState(false);
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

  const bgColor = fallbackAvatarColor(customer?.id ?? 'x');
  const initials = initialsFrom(customer?.full_name);

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
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-900 text-lg">Profile Picture</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-lg"
              style={{ backgroundColor: customer?.avatar_url ? undefined : bgColor }}
            >
              {customer?.avatar_url ? (
                <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
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

          {!customer?.avatar_url && (
            <p className="text-xs text-gray-400 text-center">
              You haven't set a photo yet — this colour badge is just a placeholder until you do.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
