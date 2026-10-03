import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/services';
import { useCartStore } from '@/stores';

export default function MarketplaceCheckoutCompletePage() {
  const [params] = useSearchParams();
  const reference = params.get('ref') || '';
  const clearCart = useCartStore(s => s.clearCart);
  const [status, setStatus] = useState('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    const check = async () => {
      const { data, error } = await supabase.functions.invoke('marketplace-checkout', {
        body: { action: 'confirm', reference },
      });
      if (cancelled) return;
      if (!error && data?.status === 'paid') {
        clearCart();
        setStatus('paid');
        return;
      }
      if (data?.status === 'failed' || data?.status === 'amount_mismatch' || data?.status === 'fulfilment_error') {
        setStatus('failed');
        return;
      }
      if (attempt >= 14) {
        setStatus('pending');
        return;
      }
      setAttempt(v => v + 1);
      timer = window.setTimeout(check, 2000);
    };
    void check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [reference, attempt, clearCart]);

  if (status === 'paid') {
    return (
      <div className="min-h-screen bg-[#fafafa] px-6 py-16">
        <div className="mx-auto max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50"><CheckCircle2 className="h-9 w-9 text-green-600" /></div>
          <h1 className="mt-5 text-2xl font-black text-gray-900">Payment confirmed</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">Your marketplace order has been recorded. China Import items have also been sent into the existing import fulfilment flow.</p>
          <Link to="/customer/dashboard" className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white">View my orders</Link>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-[#fafafa] px-6 py-16">
        <div className="mx-auto max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-gray-900">We could not confirm this payment</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">Reference: {reference}</p>
          <Link to="/stores-v2/checkout" className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white">Return to checkout</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        {status === 'pending' ? <RefreshCw className="mx-auto h-9 w-9 text-orange-500" /> : <Loader2 className="mx-auto h-9 w-9 animate-spin text-orange-500" />}
        <h1 className="mt-5 text-xl font-black text-gray-900">{status === 'pending' ? 'Payment is still processing' : 'Confirming your payment…'}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">Please keep this reference if you need support: {reference}</p>
        {status === 'pending' && <Link to="/customer/dashboard" className="mt-6 inline-flex rounded-xl border px-5 py-3 text-sm font-semibold text-gray-700">Go to my orders</Link>}
      </div>
    </div>
  );
}
