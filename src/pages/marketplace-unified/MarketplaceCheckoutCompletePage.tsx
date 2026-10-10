import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/services';
import { useCartStore } from '@/stores';

type CheckoutStatus = 'checking' | 'paid' | 'failed' | 'fulfilment_error' | 'pending';

export default function MarketplaceCheckoutCompletePage() {
  const [params] = useSearchParams();
  const reference = params.get('ref') || '';
  const clearCart = useCartStore(s => s.clearCart);
  const [status, setStatus] = useState<CheckoutStatus>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!reference) { setStatus('failed'); return; }
    let cancelled = false;
    let timer: number | undefined;

    const check = async () => {
      // Confirmation is owner-checked by the Edge Function; forward the shopper
      // session explicitly so the payment can be verified and the cart reconciled.
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('marketplace-v2-checkout', {
        body: { action: 'confirm', reference },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (cancelled) return;

      if (!error && data?.status === 'paid') {
        try {
          const raw = sessionStorage.getItem('qafrica_marketplace_checkout_selection');
          const selection = raw ? JSON.parse(raw) as {
            product_cart_ids?: string[];
            china_cart_ids?: string[];
            china_product_ids?: string[];
          } : null;
          const cart = useCartStore.getState();
          const ids = new Set(selection?.product_cart_ids ?? []);
          const chinaCartIds = new Set(selection?.china_cart_ids ?? []);
          const chinaProductIds = new Set(selection?.china_product_ids ?? []);

          // Remove only the lines selected for this checkout. If selection
          // metadata is missing/corrupt, preserve the cart rather than deleting
          // unrelated items the shopper may have added.
          cart.items
            .filter(i =>
              ids.has(i.id) ||
              (i.sourceType === 'china_import' && (
                chinaCartIds.has(i.id) ||
                (!!i.sourceId && chinaProductIds.has(i.sourceId))
              ))
            )
            .forEach(i => cart.removeItem(i.id));

          sessionStorage.removeItem('qafrica_marketplace_checkout_selection');
          sessionStorage.removeItem('qafrica_import_checkout_selection');
        } catch {
          // Keep the cart intact if selection metadata cannot be read safely.
        }
        setStatus('paid');
        return;
      }

      if (data?.status === 'fulfilment_error') {
        setStatus('fulfilment_error');
        return;
      }
      if (data?.status === 'failed' || data?.status === 'amount_mismatch') {
        setStatus('failed');
        return;
      }
      if (attempt >= 59) { setStatus('pending'); return; }
      setAttempt(v => v + 1);
      timer = window.setTimeout(check, 2000);
    };

    void check();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [reference, attempt, clearCart]);

  if (status === 'paid') {
    return <Result icon={<CheckCircle2 className="h-9 w-9 text-green-600" />} title="Payment confirmed" text="Your marketplace order has been recorded. China Import items have also been sent into the existing import fulfilment flow." action={<Link to="/customer/dashboard" className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white">View my orders</Link>} />;
  }

  if (status === 'fulfilment_error') {
    return <Result
      icon={<AlertTriangle className="h-9 w-9 text-amber-600" />}
      title="Payment received — order needs attention"
      text={`Your payment was confirmed, but we could not finish creating the order. Do not pay again. Contact QAfrica support and provide reference ${reference} so the payment and order can be reconciled.`}
      action={<Link to="/customer/dashboard" className="rounded-xl border px-5 py-3 text-sm font-semibold text-gray-700">Go to my account</Link>}
    />;
  }

  if (status === 'failed') {
    return <Result title="We could not confirm this payment" text={`Reference: ${reference}. If your account was debited, do not pay again; contact QAfrica support with this reference.`} action={<Link to="/customer/dashboard" className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white">Go to my account</Link>} />;
  }

  return <Result
    icon={status === 'pending' ? <RefreshCw className="h-9 w-9 text-orange-500" /> : <Loader2 className="h-9 w-9 animate-spin text-orange-500" />}
    title={status === 'pending' ? 'Payment is still processing' : 'Confirming your payment…'}
    text={`Please keep this reference if you need support: ${reference}`}
    action={status === 'pending' ? <Link to="/customer/dashboard" className="rounded-xl border px-5 py-3 text-sm font-semibold text-gray-700">Go to my account</Link> : undefined}
  />;
}

function Result({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="min-h-screen bg-[#fafafa] px-6 py-16 flex items-center justify-center"><div className="mx-auto max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">{icon && <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">{icon}</div>}<h1 className="mt-5 text-2xl font-black text-gray-900">{title}</h1><p className="mt-2 text-sm leading-6 text-gray-500">{text}</p>{action && <div className="mt-6">{action}</div>}</div></div>;
}
