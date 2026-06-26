// src/pages/admin/AdminJumiaSettings.tsx
// Admin can update the 3 per-item logistics fee rates live.
// Changes take effect immediately for all new submissions (frontend fetches live).

import { useState, useEffect } from 'react';
import { supabase } from '@/services';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Fees {
  logistics_per_item: number;
  packaging_per_item: number;
  warehouse_per_item: number;
}

export default function AdminJumiaSettings() {
  const [fees, setFees] = useState<Fees>({ logistics_per_item: 50, packaging_per_item: 50, warehouse_per_item: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'jumia_logistics_fees')
        .single();
      if (data?.value) setFees(data.value as Fees);
      setIsLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: fees })
      .eq('key', 'jumia_logistics_fees');
    setIsSaving(false);
    if (error) { toast.error('Failed to save fee settings'); return; }
    toast.success('Fee rates updated — changes are live immediately');
  };

  const totalPerItem = fees.logistics_per_item + fees.packaging_per_item + fees.warehouse_per_item;

  if (isLoading) return <div className="p-12 text-center text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jumia Fee Settings</h1>
        <p className="text-gray-500 mt-1">Per-item rates charged for agent pickup. Changes take effect immediately for all users.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        {([
          ['logistics_per_item', 'Logistics (₦ per item)', 'Transport from seller to our Lagos facility and to Jumia VDO per sale.'],
          ['packaging_per_item', 'Packaging (₦ per item)', 'Packaging, labelling, and sealing each item before Jumia drop-off.'],
          ['warehouse_per_item', 'Warehouse (₦ per item)', 'Storage at our Lagos facility. Set to 0 to show as "Discounted — Free" to users.'],
        ] as [keyof Fees, string, string][]).map(([key, label, desc]) => (
          <div key={key}>
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
            <p className="text-xs text-gray-400 mb-2">{desc}</p>
            <input
              type="number"
              min={0}
              value={fees[key]}
              onChange={(e) => setFees((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
            />
            {key === 'warehouse_per_item' && fees[key] === 0 && (
              <p className="text-xs text-green-600 mt-1">Currently showing as "Discounted — Free" to users.</p>
            )}
          </div>
        ))}

        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Current total per item</p>
            <p className="text-xl font-bold text-gray-900">₦{totalPerItem.toLocaleString()}</p>
            <p className="text-xs text-gray-400">e.g. 20 items = ₦{(totalPerItem * 20).toLocaleString()}</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Rates</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
