import { useState, useEffect } from 'react';
import { Store, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { supabase } from '@/services';
import { toast } from 'sonner';
import StoreUrlCard from './StoreUrlCard';

export default function GeneralTab() {
  const { currentStore, updateStore } = useStoreStore();

  const [formData, setFormData] = useState({
    name:        currentStore?.name        || '',
    description: currentStore?.description || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const [domainRequest, setDomainRequest] = useState<{
    admin_approved: boolean; status: string;
    domain_name: string; payment_status: string;
  } | null>(null);

  useEffect(() => {
    if (!currentStore) return;
    setFormData({
      name:        currentStore.name        || '',
      description: currentStore.description || '',
    });
  }, [currentStore]);

  useEffect(() => {
    if (currentStore?.id) fetchDomainRequestStatus();
  }, [currentStore?.id]);

  const fetchDomainRequestStatus = async () => {
    if (!currentStore?.id) return;
    const { data, error } = await supabase
      .from('domain_requests')
      .select('admin_approved, status, domain_name, payment_status')
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: false })
      .maybeSingle();
    if (!error && data) setDomainRequest(data);
    else setDomainRequest(null);
  };

  const handleSave = async () => {
    if (!currentStore?.id) return;
    setIsLoading(true);
    const result = await updateStore(currentStore.id, formData);
    if (result.success) toast.success('Settings saved');
    else toast.error(result.error || 'Failed to save');
    setIsLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Store className="w-5 h-5 text-orange-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">General</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="input-custom"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="input-custom min-h-[100px]"
          />
        </div>
      </div>

      <StoreUrlCard
        customDomain={currentStore?.custom_domain}
        domainStatus={currentStore?.domain_status}
        slug={currentStore?.slug}
        domainRequest={domainRequest}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
        </Button>
      </div>
    </div>
  );
}
