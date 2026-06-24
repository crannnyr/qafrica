import { useState, useEffect } from 'react';
import { Globe, Instagram, Facebook, Twitter, Youtube, MessageCircle, Phone, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

const SOCIAL_FIELDS = [
  { key: 'instagram', label: 'Instagram',     icon: Instagram,     placeholder: 'https://instagram.com/yourstore', color: 'text-pink-500' },
  { key: 'facebook',  label: 'Facebook',      icon: Facebook,      placeholder: 'https://facebook.com/yourstore',  color: 'text-blue-600' },
  { key: 'twitter',   label: 'X (Twitter)',   icon: Twitter,       placeholder: 'https://x.com/yourstore',         color: 'text-gray-800' },
  { key: 'tiktok',    label: 'TikTok',        icon: MessageCircle, placeholder: 'https://tiktok.com/@yourstore',   color: 'text-gray-900' },
  { key: 'whatsapp',  label: 'WhatsApp',      icon: Phone,         placeholder: 'https://wa.me/2348012345678',     color: 'text-green-500' },
  { key: 'youtube',   label: 'YouTube',       icon: Youtube,       placeholder: 'https://youtube.com/@yourstore',  color: 'text-red-500' },
] as const;

export default function SocialTab() {
  const { currentStore, updateStore } = useStoreStore();

  const [socialData, setSocialData] = useState({
    instagram:      currentStore?.social_links?.instagram  || '',
    facebook:       currentStore?.social_links?.facebook   || '',
    twitter:        currentStore?.social_links?.twitter    || '',
    tiktok:         currentStore?.social_links?.tiktok     || '',
    whatsapp:       currentStore?.social_links?.whatsapp   || '',
    youtube:        currentStore?.social_links?.youtube    || '',
    group_chat_url: currentStore?.group_chat_url           || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    setSocialData({
      instagram:      currentStore.social_links?.instagram  || '',
      facebook:       currentStore.social_links?.facebook   || '',
      twitter:        currentStore.social_links?.twitter    || '',
      tiktok:         currentStore.social_links?.tiktok     || '',
      whatsapp:       currentStore.social_links?.whatsapp   || '',
      youtube:        currentStore.social_links?.youtube    || '',
      group_chat_url: currentStore.group_chat_url           || '',
    });
  }, [currentStore]);

  const handleSave = async () => {
    if (!currentStore?.id) return;
    setIsSaving(true);
    const { group_chat_url, ...links } = socialData;
    const social_links = Object.fromEntries(
      Object.entries(links).filter(([, v]) => v.trim() !== '')
    );
    const result = await updateStore(currentStore.id, {
      social_links,
      group_chat_url: group_chat_url.trim() || null,
    } as any);
    if (result.success) toast.success('Social links saved');
    else toast.error(result.error || 'Failed to save social links');
    setIsSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
          <Globe className="w-5 h-5 text-sky-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Social Links</h2>
          <p className="text-sm text-gray-500">Only links you fill in will appear in your store footer</p>
        </div>
      </div>

      <div className="space-y-4">
        {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder, color }) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <input
                type="url"
                value={socialData[key]}
                onChange={e => setSocialData(prev => ({ ...prev, [key]: e.target.value }))}
                className="input-custom text-sm"
                placeholder={placeholder}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Group Chat Link</p>
          <p className="text-xs text-gray-500 mt-0.5">
            When dropshippers import your products, they'll see an option to join your group chat for promotional content, videos, and updates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-4 h-4 text-orange-500" />
          </div>
          <input
            type="url"
            value={socialData.group_chat_url}
            onChange={e => setSocialData(prev => ({ ...prev, group_chat_url: e.target.value }))}
            className="input-custom flex-1 text-sm"
            placeholder="https://chat.whatsapp.com/... or t.me/..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Social Links</>}
        </Button>
      </div>
    </div>
  );
}