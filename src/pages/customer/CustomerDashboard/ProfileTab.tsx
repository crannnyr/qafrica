import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LogOut, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import { toast } from 'sonner';
import { PRESET_AVATARS } from '@/lib/presetAvatars';

const ic = "w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm transition-colors";

export default function ProfileTab() {
  const { customer, logout } = useCustomerAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAvatarPresets, setShowAvatarPresets] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(customer?.avatar_url || '');
  const [profileInfo, setProfileInfo] = useState({ full_name: customer?.full_name || '', phone: customer?.phone || '', avatar_url: customer?.avatar_url || '', created_at: customer?.created_at || '' });
  const [formData, setFormData] = useState({ full_name: customer?.full_name || '', phone: customer?.phone || '' });

  useEffect(() => {
    if (!customer?.id) return;
    let active = true;
    void (async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;
      if (!active || authError || !user) return;
      const { data, error } = await supabase.from('profiles').select('full_name, phone, avatar_url, created_at, email').eq('id', user.id).maybeSingle();
      if (!active || error) return;
      const next = {
        full_name: data?.full_name?.trim() || user.user_metadata?.full_name || customer.full_name || '',
        phone: data?.phone?.trim() || user.user_metadata?.phone || customer.phone || '',
        avatar_url: data?.avatar_url || customer.avatar_url || '',
        created_at: data?.created_at || customer.created_at || '',
      };
      setProfileInfo(next);
      setAvatarUrl(next.avatar_url);
      setFormData({ full_name: next.full_name, phone: next.phone });
    })();
    return () => { active = false; };
  }, [customer?.id, customer?.full_name, customer?.phone]);

  const saveAvatarPreset = async (url: string) => {
    if (!customer) return;
    setUploadingAvatar(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error('Please sign in again.');
      const user = authData.user;
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email || customer.email,
        full_name: profileInfo.full_name || user.user_metadata?.full_name || customer.full_name || '',
        phone: profileInfo.phone || user.user_metadata?.phone || customer.phone || null,
        avatar_url: url,
      }, { onConflict: 'id' });
      if (error) throw error;
      setAvatarUrl(url);
      setProfileInfo(p => ({ ...p, avatar_url: url }));
      setShowAvatarPresets(false);
      toast.success('Profile photo updated');
    } catch (err: any) {
      toast.error(err.message || 'Could not update profile photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

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
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error('Please sign in again.');
      const user = authData.user;
      const { error: profileUpdateError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email || customer.email,
        full_name: profileInfo.full_name || user.user_metadata?.full_name || customer.full_name || '',
        phone: profileInfo.phone || user.user_metadata?.phone || customer.phone || null,
        avatar_url: publicUrl,
      }, { onConflict: 'id' });
      if (profileUpdateError) throw profileUpdateError;
      setAvatarUrl(publicUrl);
      setProfileInfo(p => ({ ...p, avatar_url: publicUrl }));
      toast.success('Photo updated');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!customer) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { toast.error('Please sign in again.'); return; }
    const { error } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email: authData.user.email || customer.email,
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim() || null,
      avatar_url: profileInfo.avatar_url || null,
    }, { onConflict: 'id' });
    if (error) { toast.error(error.message || 'Update failed'); return; }
    setProfileInfo(p => ({ ...p, full_name: formData.full_name.trim(), phone: formData.phone.trim() }));
    toast.success('Profile updated');
    setIsEditing(false);
  };

  if (!customer) return null;

  return (
    <div className="space-y-5 max-w-md">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative cursor-pointer group" onClick={() => setShowAvatarPresets(true)}>
          <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-orange-500">
                {profileInfo.full_name?.charAt(0) ?? '?'}
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
          {profileInfo.full_name?.trim()
            ? <p className="font-semibold text-gray-900">{profileInfo.full_name}</p>
            : <p className="font-semibold text-gray-900">{customer.email}</p>}
          <button onClick={() => setShowAvatarPresets(true)}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium mt-1">
            Change photo
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {showAvatarPresets && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="avatar-presets-title">
            <button type="button" aria-label="Close profile photo selector" className="absolute inset-0 h-full w-full cursor-default" onClick={() => setShowAvatarPresets(false)} />
            <div className="relative w-full max-w-2xl rounded-t-[28px] bg-white px-6 pt-6 pb-8 shadow-2xl" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
              <div className="mb-6 flex items-center justify-between">
                <h2 id="avatar-presets-title" className="text-lg font-bold text-gray-900">Profile Picture</h2>
                <button type="button" onClick={() => setShowAvatarPresets(false)} aria-label="Close photo options" className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><X className="h-6 w-6" /></button>
              </div>
              <div className="mb-8 flex justify-center">
                <div className="relative h-40 w-40 overflow-visible rounded-full border-4 border-white shadow-md">
                  <img src={avatarUrl || PRESET_AVATARS[0]} alt="Current profile photo" className="h-full w-full rounded-full object-cover" />
                  <span className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-orange-500 text-white"><Camera className="h-5 w-5" /></span>
                </div>
              </div>
              <button type="button" disabled={uploadingAvatar} onClick={() => fileInputRef.current?.click()} className="mb-8 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-orange-600 text-base font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                <Camera className="h-7 w-7" /> {uploadingAvatar ? 'Saving photo…' : 'Upload a Photo'}
              </button>
              <p className="mb-5 text-sm font-semibold text-gray-500">Or choose one of these</p>
              <div className="grid grid-cols-5 gap-3">
                {PRESET_AVATARS.map((url, index) => (
                  <button key={url} type="button" disabled={uploadingAvatar} onClick={() => void saveAvatarPreset(url)} aria-label={`Choose preset photo ${index + 1}`} className={`relative mx-auto aspect-square w-full max-w-[112px] overflow-hidden rounded-full border-2 transition ${avatarUrl === url ? 'border-orange-500 ring-2 ring-orange-100' : 'border-gray-100 hover:border-orange-300'} disabled:opacity-60`}>
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {avatarUrl === url && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20"><Check className="h-5 w-5 text-white" /></span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
              ['Name',         profileInfo.full_name],
              ['Email',        customer.email],
              ['Phone',        profileInfo.phone || 'Not set'],
              ['Member since', profileInfo.created_at ? new Date(profileInfo.created_at).getFullYear().toString() : '—'],
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