import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LogOut, Store, X, Check, ExternalLink } from 'lucide-react';
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
  const [showSellerModal, setShowSellerModal] = useState(false);
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
          <p className="font-semibold text-gray-900">{profileInfo.full_name}</p>
          <p className="text-sm text-gray-400">{customer.email}</p>
          <button onClick={() => setShowAvatarPresets(true)}
            className="text-xs text-orange-500 hover:text-orange-600 font-medium mt-0.5">
            Change photo
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {showAvatarPresets && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="avatar-presets-title">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="avatar-presets-title" className="text-base font-bold text-gray-900">Choose profile photo</h2>
                  <p className="mt-1 text-xs text-gray-500">Select a preset or upload your own image.</p>
                </div>
                <button type="button" onClick={() => setShowAvatarPresets(false)} aria-label="Close photo options" className="rounded-lg p-2 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-3">
                {PRESET_AVATARS.map((url, index) => (
                  <button key={url} type="button" disabled={uploadingAvatar} onClick={() => void saveAvatarPreset(url)} aria-label={`Choose preset photo ${index + 1}`} className={`relative aspect-square overflow-hidden rounded-full border-2 transition ${avatarUrl === url ? 'border-orange-500 ring-2 ring-orange-100' : 'border-transparent hover:border-orange-300'}`}>
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {avatarUrl === url && <span className="absolute inset-0 flex items-center justify-center bg-black/20"><Check className="h-5 w-5 text-white" /></span>}
                  </button>
                ))}
              </div>
              <button type="button" disabled={uploadingAvatar} onClick={() => { setShowAvatarPresets(false); fileInputRef.current?.click(); }} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <Camera className="h-4 w-4" /> {uploadingAvatar ? 'Saving photo…' : 'Upload from device'}
              </button>
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

      {/* Seller / dropship onboarding */ }
      <button type="button" onClick={() => setShowSellerModal(true)} className="group flex w-full items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left transition hover:bg-orange-100" style={{ animation: 'qafrica-seller-pulse 1.6s ease-in-out infinite' }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white"><Store className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-orange-900">Become a Seller</span>
          <span className="block text-xs text-orange-700">Get your own store and start dropshipping</span>
        </span>
        <ExternalLink className="h-4 w-4 text-orange-700" />
      </button>

      {showSellerModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="seller-onboarding-title">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-orange-500 p-5 text-white">
              <div>
                <h2 id="seller-onboarding-title" className="text-lg font-bold">Your store starts here</h2>
                <p className="mt-1 text-sm text-white/90">Become a seller or dropship products.</p>
              </div>
              <button type="button" onClick={() => setShowSellerModal(false)} aria-label="Close seller details" className="rounded-lg p-1 hover:bg-white/15"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                <p className="text-2xl font-black text-gray-900">₦5,000 <span className="text-sm font-semibold text-gray-500">/ 3 months</span></p>
                <p className="mt-1 text-sm text-gray-700">One subscription includes your personal online store, selling training, marketplace features and dropshipping access.</p>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">You will get your own store. After signing up, open the <strong className="text-gray-900">Marketplace</strong> section in the sidebar and complete the verification steps to activate your seller access.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowSellerModal(false)} className="h-11 flex-1 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Maybe later</button>
                <a href="https://qafrica.store" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-orange-500 px-3 text-sm font-bold text-white hover:bg-orange-600" onClick={() => setShowSellerModal(false)}>Route me, I'm ready</a>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes qafrica-seller-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); } 50% { box-shadow: 0 0 0 4px rgba(249,115,22,.2); } }`}</style>

      {/* Sign out */}
      <button
        onClick={async () => { await logout(); toast.success('Signed out'); navigate('/'); }}
        className="flex items-center gap-2 text-sm text-red-600 font-medium px-4 py-2.5 border border-red-200 rounded-xl hover:bg-red-50 transition-colors w-full justify-center">
        <LogOut className="w-4 h-4" />Sign Out
      </button>
    </div>
  );
}