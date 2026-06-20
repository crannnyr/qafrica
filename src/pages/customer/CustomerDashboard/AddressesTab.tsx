import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import AddAddressForm from './AddAddressForm';
import type { CustomerAddress } from '@/types';

export default function AddressesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showAddForm = searchParams.get('add') === 'true';
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { customer } = useCustomerAuthStore();

  useEffect(() => { if (customer) fetchAddresses(); }, [customer]);

  const fetchAddresses = async () => {
    if (!customer) return;
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customer.id)
        .order('is_default', { ascending: false });
      if (data && !error) setAddresses(data as CustomerAddress[]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    await supabase.from('customer_addresses').delete().eq('id', id);
    fetchAddresses();
  };

  const setDefault = async (id: string) => {
    if (!customer) return;
    await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customer.id);
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id);
    fetchAddresses();
  };

  const openAddForm = () => { searchParams.set('add', 'true'); setSearchParams(searchParams); };
  const closeAddForm = () => { searchParams.delete('add'); setSearchParams(searchParams); };

  return (
    <div className="space-y-4">
      {!showAddForm && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{addresses.length} address{addresses.length !== 1 ? 'es' : ''}</p>
          <Button size="sm" onClick={openAddForm}
            className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-3.5 h-3.5 mr-1" />Add
          </Button>
        </div>
      )}

      {showAddForm && customer && (
        <AddAddressForm
          customerId={customer.id}
          onCancel={closeAddForm}
          onSuccess={() => { closeAddForm(); fetchAddresses(); }}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !showAddForm && addresses.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No saved addresses</p>
        </div>
      ) : !showAddForm && (
        <div className="space-y-2">
          {addresses.map(address => (
            <div key={address.id}
              className={`border rounded-xl p-4 transition-colors ${address.is_default
                ? 'border-orange-300 bg-orange-50/30'
                : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{address.label || 'Address'}</span>
                    {address.is_default && (
                      <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded font-medium">Default</span>
                    )}
                  </div>
                  <p className="text-gray-600">{address.address_line1}</p>
                  <p className="text-gray-400">{address.city}, {address.state}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!address.is_default && (
                    <button onClick={() => setDefault(address.id)}
                      className="text-xs text-orange-600 font-medium px-2 py-1 rounded hover:bg-orange-50 transition-colors">
                      Set default
                    </button>
                  )}
                  <button onClick={() => handleDelete(address.id)}
                    className="text-xs text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}