// Marketplace switch: a store chooses to list its products on the QAFRICA marketplace (/stores).
// While it's on, the Marketplace Seller Agreement applies (48-hour ready-to-ship, strikes,
// 5% late-cancel penalty). Stores that only sell on their own site keep buyer protection
// but no strikes or fees. Requirements are checked on the server (marketplace_readiness).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Loader2, Store, ShieldCheck, Clock, AlertTriangle, ExternalLink, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { useStoreStore } from '@/stores';

type Check = { key: string; ok: boolean; have?: number; need?: number };
type Readiness = { enabled: boolean; agreed_at: string | null; checks: Check[] };

const CHECK_COPY: Record<string, { label: string; fix: string; href: string }> = {
  paid_plan:      { label: 'A paid plan',                 fix: 'See plans',        href: '/dashboard/subscription' },
  email_verified: { label: 'Your email confirmed',        fix: 'Confirm email',    href: '/dashboard/settings?tab=account' },
  logo:           { label: 'A store logo',                fix: 'Add a logo',       href: '/dashboard/settings?tab=images' },
  products:       { label: 'At least 5 active products',  fix: 'Add products',     href: '/dashboard/products/add' },
  not_blocked:    { label: 'Store in good standing',      fix: 'Contact support',  href: '/dashboard/settings' },
};

const RULES = [
  { icon: Clock, title: 'Ready to ship within 48 hours', body: 'Mark each paid order "Ready to ship" within 48 hours. Sundays and public holidays don\'t count.' },
  { icon: AlertTriangle, title: 'Late orders are cancelled at 72 hours', body: 'The buyer is refunded, and 5% of the order value is charged from your wallet as a coupon for the buyer.' },
  { icon: ShieldCheck, title: 'Strikes reset after 90 days', body: '3 strikes hide your products for 7 days; 5 remove you for 30 days; 7 suspend the store for review. You can appeal within 7 days.' },
  { icon: Percent, title: '7% fee on marketplace sales only', body: 'Sales that come from your own store link stay at 0%.' },
];

export default function SellOnMarketplacePage() {
  const { currentStore } = useStoreStore();
  const [data, setData] = useState<Readiness | null>(null);
  const [loadError, setLoadError] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const storeId = currentStore?.id;
  useEffect(() => {
    if (!storeId) return;
    let alive = true;
    supabase.rpc('marketplace_readiness', { p_store_id: storeId }).then(({ data: r, error }) => {
      if (!alive) return;
      if (error) setLoadError('We could not load your marketplace status. Please refresh.');
      else { setLoadError(''); setData(r as Readiness); }
    });
    return () => { alive = false; };
  }, [storeId, reloadKey]);
  const load = () => setReloadKey((k) => k + 1);

  const setEnabled = async (on: boolean) => {
    if (!currentStore?.id) return;
    if (!on && !confirm('Take your products off the marketplace? Shoppers can still buy from your own store link.')) return;
    setBusy(true);
    const { data: res, error } = await supabase.rpc('set_marketplace_enabled', { p_store_id: currentStore.id, p_enabled: on, p_agree: agree });
    setBusy(false);
    if (error || !res?.ok) {
      toast.error(res?.reason === 'must_agree' ? 'Tick the agreement first.' : res?.reason === 'not_ready' ? 'A few things are still missing (see the checklist).' : 'Could not update. Please try again.');
      return;
    }
    toast.success(on ? 'You are on the marketplace. New products appear after a quick review.' : 'Your products are off the marketplace.');
    setAgree(false);
    load();
  };

  const checks = data?.checks ?? [];
  const ready = checks.length > 0 && checks.every((c) => c.ok);
  const on = !!data?.enabled;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sell on the QAFRICA Marketplace</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Your store link always works. Switch this on to also show your products to shoppers browsing the QAFRICA marketplace.
        </p>
      </div>

      {loadError && <p className="text-sm text-red-600" role="alert">{loadError}</p>}
      {!data && !loadError && <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}

      {data && (
        <>
          {/* Status */}
          <section className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${on ? 'border-green-200 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30' : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700'}`}>
            <Store className={`w-8 h-8 shrink-0 ${on ? 'text-green-600' : 'text-gray-400'}`} />
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white">{on ? 'Your store is on the marketplace' : 'Your store is not on the marketplace'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {on
                  ? `Agreed to the seller rules${data.agreed_at ? ` on ${new Date(data.agreed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. The rules below apply to your orders.`
                  : 'Only people with your store link can find your products.'}
              </p>
            </div>
            {on ? (
              <div className="flex gap-2">
                <Link to="/stores" target="_blank" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 text-sm">View <ExternalLink className="w-3.5 h-3.5" /></Link>
                <Button variant="outline" size="sm" onClick={() => setEnabled(false)} disabled={busy}>Switch off</Button>
              </div>
            ) : null}
          </section>

          {/* Checklist */}
          {!on && (
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">What you need first</h2>
              <ul className="space-y-2.5">
                {checks.map((c) => {
                  const copy = CHECK_COPY[c.key] ?? { label: c.key, fix: 'Fix', href: '/dashboard' };
                  return (
                    <li key={c.key} className="flex items-center gap-3">
                      {c.ok ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <Circle className="w-5 h-5 text-gray-300 shrink-0" />}
                      <span className={`flex-1 text-sm ${c.ok ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                        {copy.label}
                        {c.key === 'products' && !c.ok && typeof c.have === 'number' && <span className="text-gray-500"> ({c.have} of {c.need})</span>}
                      </span>
                      {!c.ok && <Link to={copy.href} className="text-sm font-medium text-orange-600 hover:underline">{copy.fix}</Link>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Rules */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white">Marketplace seller rules</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">These apply only while you're on the marketplace. Buyers are protected by escrow either way.</p>
            <ul className="grid sm:grid-cols-2 gap-4">
              {RULES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <Icon className="w-5 h-5 mt-0.5 shrink-0 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              Also: original products only, stock kept accurate, photos that match the item (main photo on a plain white background), all payments through QAFRICA checkout, and replies to buyers within 24 hours.{' '}
              <Link to="/terms-of-service" className="text-orange-600 underline underline-offset-2">Full terms</Link>
            </p>

            {!on && (
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700 space-y-4">
                <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
                  <input type="checkbox" className="mt-0.5 w-4 h-4 accent-orange-500" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  I agree to the Marketplace Seller Rules, including the 5% charge on orders cancelled for not shipping within 72 hours.
                </label>
                <Button onClick={() => setEnabled(true)} disabled={!ready || !agree || busy} className="bg-orange-500 hover:bg-orange-600 text-white">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Put my store on the marketplace'}
                </Button>
                {!ready && <p className="text-xs text-gray-500">Finish the checklist above to switch on.</p>}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
