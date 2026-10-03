// Custom domain for a store: buy a new one or connect one the owner already has.
// Payment is a Flutterwave bank transfer; the price is set and the payment confirmed on the
// server (supabase/functions/flutterwave, actions domain-start / domain-status). The browser
// never writes domain_requests or the store's domain fields itself.

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Clock, ExternalLink, Globe, Info, Loader2, Lock, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useStoreStore } from '@/stores';
import { supabase } from '@/services';
import { toast } from 'sonner';
import FlutterwavePayDialog from '@/components/payments/FlutterwavePayDialog';
import { checkDomainPayment, startDomainPayment } from '@/services/flutterwave';

// Must match DOMAIN_PRICES in supabase/functions/flutterwave/index.ts (the server decides the price).
const DOMAIN_PRICES = { com: 30000, shop: 12900, store: 12900, otherNew: 12900, connect: 7000 };

type DomainType = 'new' | 'existing';

type DomainRequest = {
  id: string;
  domain_name: string;
  domain_type: DomainType;
  status: string;
  payment_status: string;
  payment_provider: string | null;
  amount_paid: number;
  payment_reference: string | null;
  admin_notes: string | null;
  created_at: string;
  paid_at: string | null;
  approved_at: string | null;
  refunded_at: string | null;
};

const naira = (n: number) => `₦${Number(n).toLocaleString('en-NG')}`;
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

function cleanDomain(input: string) {
  return input.toLowerCase().trim().replace(/\s+/g, '').replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/\.$/, '').replace(/^www\./, '');
}
function priceFor(type: DomainType, domain: string) {
  if (type === 'existing') return DOMAIN_PRICES.connect;
  const tld = domain.split('.').pop() ?? '';
  if (tld === 'com') return DOMAIN_PRICES.com;
  if (tld === 'shop' || tld === 'store') return DOMAIN_PRICES.shop;
  return DOMAIN_PRICES.otherNew;
}
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function DomainPage() {
  const { currentStore, fetchStore } = useStoreStore();
  const { user } = useAuthStore();
  const isOwner = !!currentStore && !!user && currentStore.owner_id === user.id;

  const [requests, setRequests] = useState<DomainRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainType, setDomainType] = useState<DomainType>('new');
  const [input, setInput] = useState('');
  const [touched, setTouched] = useState(false);
  const [paying, setPaying] = useState<{ domain: string; type: DomainType } | null>(null);

  const storeId = currentStore?.id;
  const fetchRequests = useCallback(async (): Promise<DomainRequest[]> => {
    if (!storeId) return [];
    const { data, error } = await supabase
      .from('domain_requests')
      .select('id, domain_name, domain_type, status, payment_status, payment_provider, amount_paid, payment_reference, admin_notes, created_at, paid_at, approved_at, refunded_at')
      .eq('store_id', storeId)
      .neq('status', 'awaiting_payment')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) toast.error('Could not load your domain requests. Refresh the page to try again.');
    return (data ?? []) as DomainRequest[];
  }, [storeId]);

  const load = useCallback(async () => {
    setRequests(await fetchRequests());
    setLoading(false);
  }, [fetchRequests]);

  useEffect(() => {
    let alive = true;
    fetchRequests().then((rows) => { if (alive) { setRequests(rows); setLoading(false); } });
    return () => { alive = false; };
  }, [fetchRequests]);

  const active = requests.find((r) => ['pending', 'processing', 'connected', 'purchased'].includes(r.status) && r.payment_status !== 'refunded');
  const lastClosed = !active ? requests.find((r) => ['rejected', 'disconnected'].includes(r.status)) : undefined;

  const domain = cleanDomain(input);
  const valid = DOMAIN_RE.test(domain);
  const price = valid ? priceFor(domainType, domain) : null;
  const tld = valid ? domain.split('.').pop() : null;

  const onPaid = async () => {
    setPaying(null);
    setInput('');
    setTouched(false);
    toast.success('Payment received. We’ll set up your domain within 24–48 hours.');
    await Promise.all([load(), currentStore?.id ? fetchStore(currentStore.id) : Promise.resolve()]);
  };

  const startPay = () => {
    setTouched(true);
    if (!valid) return;
    setPaying({ domain, type: domainType });
  };

  if (!currentStore) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Custom domain</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Give your store its own web address, like <span className="font-medium text-gray-700 dark:text-gray-300">{currentStore.slug}.com</span>.
        </p>
      </header>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      ) : active ? (
        <ActiveRequest req={active} slug={currentStore.slug} onRefresh={load} />
      ) : (
        <>
          {lastClosed && <ClosedNotice req={lastClosed} />}

          {!isOwner ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 flex gap-3">
              <Lock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Only the store owner can buy or connect a domain. Ask them to sign in and open this page.</p>
            </div>
          ) : (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              {/* Choice */}
              <div className="p-5 sm:p-6">
                <div role="radiogroup" aria-label="Domain option" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 dark:bg-gray-900/60 p-1">
                  {([
                    ['new', 'Buy a new domain'],
                    ['existing', 'Connect one I own'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={domainType === value}
                      onClick={() => setDomainType(value)}
                      className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                        domainType === value
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                  {domainType === 'new'
                    ? 'We register the domain in your store’s name and set it up for you. Renewal reminders come from us each year.'
                    : `Already bought a domain from Namecheap, GoDaddy, Whogohost or another provider? We connect it for a one-time ${naira(DOMAIN_PRICES.connect)} setup fee.`}
                </p>

                {/* Address bar */}
                <label htmlFor="domain-input" className="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {domainType === 'new' ? 'The domain you want' : 'Your domain'}
                </label>
                <div className={`mt-1.5 flex items-center rounded-xl border bg-gray-50 dark:bg-gray-900/40 transition-colors focus-within:ring-2 focus-within:ring-orange-500/30 ${
                  touched && input && !valid ? 'border-red-300 dark:border-red-500/50' : 'border-gray-200 dark:border-gray-700 focus-within:border-orange-500'
                }`}>
                  <span className="pl-4 pr-1 flex items-center gap-1.5 text-gray-400 select-none">
                    <Lock className="w-4 h-4" /><span className="text-base hidden sm:inline">https://</span>
                  </span>
                  <input
                    id="domain-input"
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onBlur={() => setTouched(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter') startPay(); }}
                    placeholder={`${currentStore.slug || 'mystore'}.com`}
                    className="min-w-0 flex-1 bg-transparent py-3.5 pr-4 text-lg text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none"
                  />
                </div>
                {touched && input && !valid && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">Enter the full domain with its ending, like {currentStore.slug || 'mystore'}.com</p>
                )}

                {domainType === 'new' && (
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[['.com', DOMAIN_PRICES.com], ['.store', DOMAIN_PRICES.store], ['.shop', DOMAIN_PRICES.shop]].map(([ext, p]) => (
                      <div key={ext as string} className={`rounded-xl border px-2 py-2.5 ${tld && `.${tld}` === ext ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700'}`}>
                        <dt className="text-sm font-semibold text-gray-900 dark:text-white">{ext}</dt>
                        <dd className="text-xs text-gray-500 dark:text-gray-400">{naira(p as number)} first year</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              {/* Pay bar */}
              <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{domainType === 'new' ? (tld ? `.${tld} domain` : 'Price depends on the ending') : 'One-time setup fee'}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{price !== null ? naira(price) : '—'}</p>
                </div>
                <Button
                  onClick={startPay}
                  disabled={!input.trim()}
                  className="h-12 px-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  {price !== null ? `Pay ${naira(price)} by bank transfer` : 'Continue to payment'}
                </Button>
              </div>
            </section>
          )}

          {/* How it works: a real sequence, so it is numbered */}
          <section aria-labelledby="how-it-works" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6">
            <h2 id="how-it-works" className="font-semibold text-gray-900 dark:text-white">What happens next</h2>
            <ol className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex gap-3"><Step n={1} />You pay by bank transfer to a one-time Flutterwave account. It’s confirmed automatically.</li>
              <li className="flex gap-3"><Step n={2} />
                {domainType === 'new'
                  ? 'Our team registers the domain and links it to your store, usually within 24–48 hours.'
                  : 'Our team sends you the DNS settings to add at your domain provider, then links it once they’re in place.'}
              </li>
              <li className="flex gap-3"><Step n={3} />Your store opens on the new address. Links to {currentStore.slug} on QAFRICA keep working.</li>
            </ol>
            {domainType === 'new' && (
              <p className="mt-4 flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Info className="w-4 h-4 shrink-0" />
                If the domain is already taken, we’ll contact you within 24 hours with close alternatives or refund you in full.
              </p>
            )}
          </section>
        </>
      )}

      {paying && (
        <FlutterwavePayDialog
          start={() => startDomainPayment({ domain: paying.domain, domain_type: paying.type, store_id: currentStore.id })}
          check={checkDomainPayment}
          itemNoun="domain"
          planLabel={`${paying.type === 'new' ? 'New domain' : 'Connect domain'}: ${paying.domain}`}
          paidMessage="Your domain request is with our team."
          onClose={() => setPaying(null)}
          onPaid={onPaid}
        />
      )}
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 text-xs font-bold flex items-center justify-center">{n}</span>;
}

// ── A paid request in progress or live ─────────────────────────────────────────────────
function ActiveRequest({ req, slug, onRefresh }: { req: DomainRequest; slug: string; onRefresh: () => void }) {
  const live = req.status === 'connected';
  const stage = live ? 2 : req.status === 'processing' ? 1 : 0;
  const steps = ['Paid', req.domain_type === 'new' ? 'Registering' : 'Connecting', 'Live'];
  const unverified = req.payment_provider === 'paystack';

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-gray-500 dark:text-gray-400">{live ? 'Your store is live at' : 'Setting up'}</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white break-all">{req.domain_name}</p>
          </div>
          {live ? (
            <a href={`https://${req.domain_name}`} target="_blank" rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 px-3.5 py-2 text-sm font-semibold text-white">
              Visit <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button type="button" onClick={onRefresh} aria-label="Refresh status"
              className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress */}
        <ol className="mt-6 grid grid-cols-3" aria-label="Progress">
          {steps.map((label, i) => {
            const done = i < stage || live;
            const current = i === stage && !live;
            return (
              <li key={label} className="relative flex flex-col items-center text-center">
                {i > 0 && <span aria-hidden className={`absolute top-3.5 right-1/2 w-full h-0.5 ${i <= stage ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 ${
                  done ? 'bg-orange-500 text-white' : current ? 'bg-white dark:bg-gray-800 border-2 border-orange-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  {done ? <Check className="w-4 h-4" /> : current ? <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> : null}
                </span>
                <span className={`mt-2 text-xs font-medium ${done || current ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
              </li>
            );
          })}
        </ol>

        {!live && (
          <p className="mt-5 text-sm text-gray-600 dark:text-gray-300">
            {req.domain_type === 'existing'
              ? 'We’ll email you the DNS records to add at your domain provider. Until the domain is live, customers keep using your QAFRICA link.'
              : 'Registration usually takes 24–48 hours. Until then, customers keep using your QAFRICA link.'}
          </p>
        )}

        {req.admin_notes && (
          <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-4">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Message from QAFRICA</p>
            <p className="mt-1 text-sm text-blue-900 dark:text-blue-100 whitespace-pre-line">{req.admin_notes}</p>
          </div>
        )}

        {unverified && !live && (
          <p className="mt-4 flex gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" /> This request was paid with our old checkout. Our team is confirming the payment manually.
          </p>
        )}
      </div>

      <dl className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-5 sm:px-6 py-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-gray-500">Paid</dt><dd className="text-right font-medium text-gray-800 dark:text-gray-200">{naira(req.amount_paid)}{req.paid_at ? ` on ${fmtDate(req.paid_at)}` : ''}</dd>
        <dt className="text-gray-500">Reference</dt><dd className="text-right font-mono text-gray-800 dark:text-gray-200 truncate">{req.payment_reference ?? '—'}</dd>
        <dt className="text-gray-500">QAFRICA link</dt><dd className="text-right text-gray-800 dark:text-gray-200 truncate">qafrica.store/{slug}</dd>
      </dl>
    </section>
  );
}

function ClosedNotice({ req }: { req: DomainRequest }) {
  const refunded = req.payment_status === 'refunded';
  const owed = !refunded && ['paid', 'review'].includes(req.payment_status) && req.status === 'rejected';
  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 flex gap-3">
      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-red-900 dark:text-red-200">
          {req.status === 'disconnected' ? `${req.domain_name} was disconnected` : `We couldn’t set up ${req.domain_name}`}
        </p>
        {req.admin_notes && <p className="mt-1 text-red-800 dark:text-red-300 whitespace-pre-line">{req.admin_notes}</p>}
        {refunded && <p className="mt-1 flex items-center gap-1.5 text-red-800 dark:text-red-300"><CheckCircle2 className="w-4 h-4" /> Refunded {fmtDate(req.refunded_at)}</p>}
        {owed && <p className="mt-1 flex items-center gap-1.5 text-red-800 dark:text-red-300"><Clock className="w-4 h-4" /> Your {naira(req.amount_paid)} refund is on its way (3–5 working days).</p>}
        <p className="mt-2 text-red-700/80 dark:text-red-300/80 flex items-center gap-1.5"><Globe className="w-4 h-4" /> You can request another domain below.</p>
      </div>
    </div>
  );
}
