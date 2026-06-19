import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { useCustomerAuthStore } from '@/stores';
import { toast } from 'sonner';

const ic = "w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm transition-colors";

export default function ProfileTab() {
  const { customer, updateProfile, logout } = useCustomerAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(customer?.avatar_url || '');
  const [formData, setFormData] = useState({
    full_name: customer?.full_name || '',
    phone: customer?.phone || '',
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;
    if (!file.type.startsWith('image/')) { toast.error('Images only'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `avatars/${customer.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('customers').update({ avatar_url: publicUrl }).eq('id', customer.id);
      setAvatarUrl(publicUrl);
      toast.success('Photo updated');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    const result = await updateProfile(formData);
    if (result.success) { toast.success('Profile updated'); setIsEditing(false); }
    else toast.error(result.error || 'Update failed');
  };

  if (!customer) return null;

  return (
    <div className="space-y-5 max-w-md">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
          <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-orange-500">
                {customer.full_name?.charAt(0) ?? '?'}
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingAvatar
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Camera className="w-4 h-4 text-white" />
            }
          </div>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{customer.full_name}</p>
          <p className="text-sm text-gray-400">{customer.email}</p>
          <button onClick={() => fileInputRef.current?.click()}
            className="text-xs text-orange-500 hover:text-orange-600 font-medium mt-0.5">
            Change photo
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      </div>

      {/* Info card */}
      <div className="border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900 text-sm">Personal Info</p>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)}
              className="text-xs text-orange-500 hover:text-orange-600 font-medium">Edit</button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-3">
            <input type="text" value={formData.full_name}
              onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
              placeholder="Full name" className={ic} />
            <input type="tel" value={formData.phone}
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              placeholder="Phone number" className={ic} />
            <div className="flex gap-2">
              <Button onClick={handleSave}
                className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white">Save</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}
                className="h-8 text-xs px-4">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {[
              ['Name',         customer.full_name],
              ['Email',        customer.email],
              ['Phone',        customer.phone || 'Not set'],
              ['Member since', customer.created_at ? new Date(customer.created_at).getFullYear().toString() : '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-900 font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={async () => { await logout(); toast.success('Signed out'); navigate('/'); }}
        className="flex items-center gap-2 text-sm text-red-600 font-medium px-4 py-2.5 border border-red-200 rounded-xl hover:bg-red-50 transition-colors w-full justify-center">
        <LogOut className="w-4 h-4" />Sign Out
      </button>
    </div>
  );
}