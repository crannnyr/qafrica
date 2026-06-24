import { useState, useEffect } from 'react';
import { CreditCard, Banknote, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

export default function PaymentsTab() {
  const { currentStore, updateStore } = useStoreStore();

  const [paymentSettings, setPaymentSettings] = useState({
    payment_method:        (currentStore?.payment_method || 'paystack') as 'paystack' | 'direct_transfer',
    direct_bank_name:      currentStore?.direct_bank_name      || '',
    direct_account_number: currentStore?.direct_account_number || '',
    direct_account_name:   currentStore?.direct_account_name   || '',
    cod_enabled:           currentStore?.cod_enabled            || false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    setPaymentSettings({
      payment_method:        currentStore.payment_method        || 'paystack',
      direct_bank_name:      currentStore.direct_bank_name      || '',
      direct_account_number: currentStore.direct_account_number || '',
      direct_account_name:   currentStore.direct_account_name   || '',
      cod_enabled:           currentStore.cod_enabled            || false,
    });
  }, [currentStore]);

  const handleSave = async () => {
    if (!currentStore?.id) return;
    if (paymentSettings.payment_method === 'direct_transfer') {
      if (!paymentSettings.direct_bank_name || !paymentSettings.direct_account_number || !paymentSettings.direct_account_name) {
        toast.error('Please fill in all bank account details');
        return;
      }
      if (paymentSettings.direct_account_number.length < 10) {
        toast.error('Please enter a valid 10-digit account number');
        return;
      }
    }
    const updates = {
      ...paymentSettings,
      cod_enabled: paymentSettings.payment_method === 'direct_transfer' ? paymentSettings.cod_enabled : false,
    };
    setIsSaving(true);
    const result = await updateStore(currentStore.id, updates);
    if (result.success) toast.success('Payment settings saved');
    else toast.error(result.error || 'Failed to save payment settings');
    setIsSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
          <p className="text-sm text-gray-500">Control how customers pay in your store</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <button
          onClick={() => setPaymentSettings(p => ({ ...p, payment_method: 'paystack', cod_enabled: false }))}
          className={`p-4 rounded-xl border-2 text-left transition-all ${paymentSettings.payment_method === 'paystack' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900 text-sm">Paystack (Recommended)</span>
          </div>
          <p className="text-xs text-gray-500">Card, bank transfer, USSD. Funds held in escrow — buyer protected.</p>
        </button>
        <button
          onClick={() => setPaymentSettings(p => ({ ...p, payment_method: 'direct_transfer' }))}
          className={`p-4 rounded-xl border-2 text-left transition-all ${paymentSettings.payment_method === 'direct_transfer' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-gray-900 text-sm">Direct Bank Transfer</span>
          </div>
          <p className="text-xs text-gray-500">Customers pay directly to your account. No platform escrow.</p>
        </button>
      </div>

      {paymentSettings.payment_method === 'direct_transfer' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">Understand the limitations:</p>
              <ul className="space-y-1 text-amber-700 list-disc list-inside text-xs">
                <li>Customers shopping across multiple stores may be discouraged from paying all at once</li>
                <li>No escrow protection — disputes cannot be auto-resolved</li>
                <li>Dropshipped items always require Paystack regardless of this setting</li>
                <li>You are responsible for confirming payments manually</li>
              </ul>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Your Bank Account Details</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={paymentSettings.direct_bank_name}
                onChange={e => setPaymentSettings(p => ({ ...p, direct_bank_name: e.target.value }))}
                className="input-custom"
                placeholder="e.g. GTBank, Access Bank"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                value={paymentSettings.direct_account_number}
                onChange={e => setPaymentSettings(p => ({ ...p, direct_account_number: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                className="input-custom font-mono tracking-widest"
                placeholder="0123456789"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
              <input
                type="text"
                value={paymentSettings.direct_account_name}
                onChange={e => setPaymentSettings(p => ({ ...p, direct_account_name: e.target.value }))}
                className="input-custom"
                placeholder="John Doe"
              />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-gray-900 text-sm">Enable Cash on Delivery</p>
              <p className="text-xs text-gray-500 mt-0.5">Only for direct transfer. Recommended only if you personally handle deliveries.</p>
            </div>
            <button
              onClick={() => setPaymentSettings(p => ({ ...p, cod_enabled: !p.cod_enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${paymentSettings.cod_enabled ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${paymentSettings.cod_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Payment Settings'}
        </Button>
      </div>
    </div>
  );
}