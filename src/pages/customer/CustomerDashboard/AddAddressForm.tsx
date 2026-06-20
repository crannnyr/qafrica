import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { toast } from 'sonner';

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
];

const ic = "w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm transition-colors";

interface Props {
  customerId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function AddAddressForm({ customerId, onCancel, onSuccess }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    label: '', name: '', phone: '',
    address_line1: '', address_line2: '',
    city: '', state: '', country: 'Nigeria',
    postal_code: '', is_default: false,
  });

  const set = (field: string, value: any) => setFormData(p => ({ ...p, [field]: value }));

  const validateAddress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.functions.invoke('shipbubble-validate-address', {
      body: {
        address: {
          full_name: formData.name,
          email: user?.email,
          phone: formData.phone,
          address: formData.address_line1,
          city: formData.city,
          state: formData.state,
          country: formData.country || 'Nigeria',
        },
      },
    });
    if (error || !data?.success || !data?.data?.address_code)
      throw new Error(data?.error || 'Address validation failed');
    return data.data.address_code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.address_line1 || !formData.city || !formData.state) {
      toast.error('Please fill in required fields');
      return;
    }
    setIsLoading(true);
    try {
      const addressCode = await validateAddress();
      if (formData.is_default) {
        await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);
      }
      const { error } = await supabase.from('customer_addresses').insert({
        customer_id: customerId,
        label: formData.label || 'Home',
        name: formData.name,
        phone: formData.phone,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2 || null,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postal_code: formData.postal_code || null,
        is_default: formData.is_default,
        shipbubble_address_code: addressCode,
        shipbubble_validated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success('Address saved');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save address');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="border border-gray-100 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-gray-900 text-sm">New Address</p>
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={formData.label} onChange={e => set('label', e.target.value)}
          placeholder="Label (Home, Office...)" className={ic} />
        <div className="grid grid-cols-2 gap-3">
          <input type="text" value={formData.name} onChange={e => set('name', e.target.value)}
            placeholder="Full name *" className={ic} required />
          <input type="tel" value={formData.phone} onChange={e => set('phone', e.target.value)}
            placeholder="Phone *" className={ic} required />
        </div>
        <input type="text" value={formData.address_line1} onChange={e => set('address_line1', e.target.value)}
          placeholder="Street address *" className={ic} required />
        <div className="grid grid-cols-2 gap-3">
          <input type="text" value={formData.city} onChange={e => set('city', e.target.value)}
            placeholder="City *" className={ic} required />
          <select value={formData.state} onChange={e => set('state', e.target.value)} className={ic} required>
            <option value="">State *</option>
            {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={formData.is_default} onChange={e => set('is_default', e.target.checked)}
            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
          Set as default
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-8 text-xs">Cancel</Button>
          <Button type="submit" disabled={isLoading} className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white">
            {isLoading
              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Save Address'}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}