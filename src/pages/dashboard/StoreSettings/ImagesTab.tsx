import { useState, useEffect } from 'react';
import { Image as ImageIcon, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SingleImageUpload } from '@/components/ImageUpload';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

export default function ImagesTab() {
  const { currentStore, updateStore } = useStoreStore();

  const [formData, setFormData] = useState({
    logo_url:   currentStore?.logo_url   || '',
    banner_url: currentStore?.banner_url || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    setFormData({
      logo_url:   currentStore.logo_url   || '',
      banner_url: currentStore.banner_url || '',
    });
  }, [currentStore]);

  const handleSave = async () => {
    if (!currentStore?.id) return;
    setIsLoading(true);
    const result = await updateStore(currentStore.id, formData);
    if (result.success) toast.success('Images saved');
    else toast.error(result.error || 'Failed to save');
    setIsLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-pink-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Store Images</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Store Logo</label>
          <SingleImageUpload
            bucket="store-logos"
            folder={currentStore?.id || 'general'}
            value={formData.logo_url}
            onChange={url => setFormData({ ...formData, logo_url: url as string })}
            placeholder="Upload Logo"
          />
          <p className="text-xs text-gray-500 mt-2">Recommended: 400×400px</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Store Banner</label>
          <SingleImageUpload
            bucket="store-banners"
            folder={currentStore?.id || 'general'}
            value={formData.banner_url}
            onChange={url => setFormData({ ...formData, banner_url: url as string })}
            placeholder="Upload Banner"
          />
          <p className="text-xs text-gray-500 mt-2">Recommended: 1200×400px</p>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Images</>}
        </Button>
      </div>
    </div>
  );
}