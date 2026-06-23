import { useState, useEffect } from 'react';
import { Palette, Moon, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DarkModeToggle from '@/components/DarkModeToggle';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

export default function BrandingTab() {
  const { currentStore, updateStore } = useStoreStore();

  const [formData, setFormData] = useState({
    primary_color:   currentStore?.primary_color   || '#F97316',
    secondary_color: currentStore?.secondary_color || '#FED7AA',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    setFormData({
      primary_color:   currentStore.primary_color   || '#F97316',
      secondary_color: currentStore.secondary_color || '#FED7AA',
    });
  }, [currentStore]);

  const handleSave = async () => {
    if (!currentStore?.id) return;
    setIsLoading(true);
    const result = await updateStore(currentStore.id, formData);
    if (result.success) toast.success('Branding saved');
    else toast.error(result.error || 'Failed to save');
    setIsLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <Palette className="w-5 h-5 text-purple-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={formData.primary_color}
              onChange={e => setFormData({ ...formData, primary_color: e.target.value })}
              className="w-12 h-12 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={formData.primary_color}
              onChange={e => setFormData({ ...formData, primary_color: e.target.value })}
              className="input-custom flex-1"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={formData.secondary_color}
              onChange={e => setFormData({ ...formData, secondary_color: e.target.value })}
              className="w-12 h-12 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={formData.secondary_color}
              onChange={e => setFormData({ ...formData, secondary_color: e.target.value })}
              className="input-custom flex-1"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Moon className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Appearance</p>
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900 text-sm">Dark Mode</p>
            <p className="text-xs text-gray-500">Toggle between light and dark theme for your dashboard</p>
          </div>
          <DarkModeToggle />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Branding</>}
        </Button>
      </div>
    </div>
  );
}