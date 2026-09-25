// /checkout: one page. Totals always come from the server (checkout_quote); Pay goes to Nomba.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, ShieldCheck, AlertCircle, Tag, ChevronDown } from 'lucide-react';
import { useCartStore, useCustomerAuthStore } from '@/stores';
import CONFIG from '@/lib/config';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { EscrowExplainer, Field, InfoButton, PageHeader } from './ui';
import { naira } from './format';
import { CHECKOUT_SELECTION_KEY } from './CartPage';
import { createCheckout, fetchQuote, loadSavedDetails, rememberPending, saveDetails, type Quote } from './checkoutApi';

const STATES: string[] = (CONFIG as unknown as { NIGERIAN_STATES: string[] }).NIGERIAN_STATES ?? [];

export default function CheckoutPage() {
  useForceLightMode();
  const [params] = useSearchParams();
  const allItems = useCartStore((s) => s.items);
  const { customer } = useCustomerAuthStore();

  // Which cart lines: ?store=slug (store "Buy now"), else the cart selection, else everything
  const items = useMemo(() => {
    const slug = params.get('store');
    if (slug) return allItems.filter((i) => i.storeSlug === slug);
    try {
      const ids: string[] = JSON.parse(sessionStorage.getItem(CHECKOUT_SELECTION_KEY) ?? 'null');
      if (Array.isArray(ids) && ids.length) {
        const picked = allItems.filter((i) => ids.includes(i.id));
        if (picked.length) return picked;
      }
    } catch { /* ignore */ }
    return allItems;
  }, [allItems, params]);

  const saved = useMemo(() => loadSavedDetails(), []);
  const [name, setName] = useState(saved.customer?.name ?? customer?.full_name ?? '');
  const [email, setEmail] = useState(saved.customer?.email ?? customer?.email ?? '');
  const [phone, setPhone] = useState(saved.customer?.phone ?? customer?.phone ?? '');
  const [address, setAddress] = useState(saved.delivery?.address ?? '');
  const [city, setCity] = useState(saved.delivery?.city ?? '');
  const [state, setState] = useState(saved.delivery?.state ?? '');
  const [landmark, setLandmark] = useState(saved.delivery?.landmark ?? '');
  const [coupons, setCoupons] = useState<Record<string, string>>({});
  const [couponOpen, setCouponOpen] = useState<Record<string, boolean>>({});
  const [couponDraft, setCouponDraft] = useState<Record<string, string>>({});

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const reqId = useRef(0);

  const itemsKey = items.map((i) => `${i.id}:${i.quantity}`).join('|');
  useEffect(() => {
    if (!items.length) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      setQuoting(true);
      fetchQuote(items, state || null, coupons)
        .then((q) => id === reqId.current && setQuote(q))
        .catch(() => id === reqId.current && setFormError('Could not load prices. Check your connection.'))
        .finally(() => id === reqId.current && setQuoting(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, state, JSON.stringify(coupons)]);

  const blocking = (quote?.errors ?? []).filter((e) => e.code !== 'no_delivery' || state);
  const canPay = !!quote?.ok && !quoting && !paying;

  const pay = async () => {
    setFormError(null);
    const fe: Record<string, string> = {};
    if (name.trim().length < 2) fe.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) fe.email = 'Enter a valid email address';
    if (!/^\+?\d{10,14}$/.test(phone.replace(/[^\d+]/g, ''))) fe.phone = 'Enter a valid phone number';
    if (address.trim().length < 5) fe.address = 'Enter your street address';
    if (!city.trim()) fe.city = 'Enter your city or area';
    if (!state) fe.state = 'Choose your state';
    setErrors(fe);
    if (Object.keys(fe).length) {
      document.getElementById(Object.keys(fe)[0])?.focus();
      return;
    }
    setPaying(true);
    const details = {
      customer: { name: name.trim(), email: email.trim(), phone: phone.trim() },
      delivery: { address: address.trim(), city: city.trim(), state, landmark: landmark.trim() },
    };
    saveDetails(details);
    const res = await createCheckout(items, { ...details, coupons, return_slug: params.get('store') });
    if (!res.ok) {
      setPaying(false);
      if (res.field_errors) setErrors(res.field_errors);
      if (res.quote) setQuote(res.quote);
      setFormError(res.error);
      return;
    }
    rememberPending(res.reference, items.map((i) => i.id), details.customer.email);
    window.location.href = res.checkout_link;
  };

  if (!items.length) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader title="Checkout" back="/cart" />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-[15px] font-semibold">Nothing to check out</p>
          <Link to="/stores" className="mt-5 inline-flex h-10 px-6 items-center rounded-lg bg-gray-900 text-white text-[13px] font-semibold">Browse products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-28">
      <PageHeader title="Checkout" back="/cart" right={<span className="pr-3 inline-flex items-center gap-1 text-[11px] text-gray-500"><Lock className="w-3.5 h-3.5" aria-hidden />Secure</span>} />

      <div className="max-w-2xl mx-auto space-y-2 pt-2">
        {/* Contact */}
        <section className="bg-white px-4 py-4" aria-labelledby="h-contact">
          <h2 id="h-contact" className="text-[14px] font-semibold mb-3 flex items-center gap-1.5">
            Your details
            <InfoButton title="Why we need these">
              <p>We send your receipt and tracking link to your email, and the seller may call this number to arrange delivery.</p>
              <p>You don't need an account to buy.</p>
            </InfoButton>
          </h2>
          <div className="space-y-3">
            <Field id="name" label="Full name" value={name} onChange={setName} error={errors.name} autoComplete="name" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="email" label="Email" type="email" inputMode="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
              <Field id="phone" label="Phone" type="tel" inputMode="tel" value={phone} onChange={setPhone} error={errors.phone} autoComplete="tel" placeholder="0803 000 0000" />
            </div>
          </div>
        </section>

        {/* Delivery */}
        <section className="bg-white px-4 py-4" aria-labelledby="h-delivery">
          <h2 id="h-delivery" className="text-[14px] font-semibold mb-3 flex items-center gap-1.5">
            Delivery address
            <InfoButton title="How delivery works">
              <p>Each seller delivers their own items to you. Delivery fees are set by each seller for your state.</p>
              <p>If you order from more than one store, your items may arrive separately.</p>
            </InfoButton>
          </h2>
          <div className="space-y-3">
            <Field id="address" label="Street address" value={address} onChange={setAddress} error={errors.address} autoComplete="street-address" placeholder="House number and street" />
            <div className="grid grid-cols-2 gap-3">
              <Field id="city" label="City / area" value={city} onChange={setCity} error={errors.city} autoComplete="address-level2" />
              <div>
                <label htmlFor="state" className="block text-[12px] font-medium text-gray-700 mb-1">State</label>
                <select
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  aria-invalid={!!errors.state}
                  className={`w-full h-11 px-3 rounded-lg border bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.state ? 'border-[#C4320A]' : 'border-gray-300'}`}
                >
                  <option value="">Choose…</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.state && <p className="mt-1 text-[12px] text-[#C4320A]">{errors.state}</p>}
              </div>
            </div>
            <Field id="landmark" label="Nearest landmark" optional value={landmark} onChange={setLandmark} placeholder="e.g. opposite First Bank" />
          </div>
        </section>

        {/* Order summary per store */}
        {(quote?.stores ?? []).map((s) => (
          <section key={s.store_id} className="bg-white px-4 py-4" aria-label={`Items from ${s.store_name}`}>
            <p className="text-[13px] font-semibold mb-2">{s.store_name}</p>
            <ul className="space-y-2.5">
              {s.items.map((l) => (
                <li key={`${l.product_id}-${JSON.stringify(l.variant_options)}`} className="flex gap-3">
                  <div className="w-14 h-14 rounded-md bg-gray-100 overflow-hidden shrink-0">{l.image && <img src={l.image} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] line-clamp-1">{l.name}</p>
                    {l.variant_options && <p className="text-[12px] text-gray-500 truncate">{Object.values(l.variant_options).join(' / ')}</p>}
                    <p className="text-[12px] text-gray-500">Qty {l.quantity}</p>
                  </div>
                  <p className="text-[13px] font-semibold tabular-nums">{naira(l.total_price)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-gray-600">Items</span><span className="tabular-nums">{naira(s.subtotal)}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery</span>
                <span className="tabular-nums">{!state ? <span className="text-gray-400">Choose your state</span> : s.delivery_fee == null ? <span className="text-[#C4320A]">Not available</span> : s.delivery_fee === 0 ? 'Free' : naira(s.delivery_fee)}</span>
              </div>
              {s.coupon_discount > 0 && (
                <div className="flex justify-between text-[#1A7F37]"><span>Discount ({s.coupon_code})</span><span className="tabular-nums">−{naira(s.coupon_discount)}</span></div>
              )}
            </div>

            {/* Coupon */}
            <div className="mt-2">
              {couponOpen[s.store_id] ? (
                <form
                  className="flex gap-2 mt-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setCoupons((c) => ({ ...c, [s.store_id]: (couponDraft[s.store_id] ?? '').trim() }));
                  }}
                >
                  <input
                    aria-label={`Promo code for ${s.store_name}`}
                    value={couponDraft[s.store_id] ?? ''}
                    onChange={(e) => setCouponDraft((d) => ({ ...d, [s.store_id]: e.target.value.toUpperCase() }))}
                    placeholder="Promo code"
                    className="flex-1 h-9 px-3 rounded-lg border border-gray-300 text-[13px] uppercase focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button type="submit" className="h-9 px-4 rounded-lg border border-gray-900 text-[13px] font-semibold">Apply</button>
                </form>
              ) : (
                <button type="button" onClick={() => setCouponOpen((o) => ({ ...o, [s.store_id]: true }))} className="inline-flex items-center gap-1 text-[12px] text-gray-600">
                  <Tag className="w-3.5 h-3.5" aria-hidden /> Have a promo code? <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                </button>
              )}
              {s.coupon_message && <p className="mt-1 text-[12px] text-[#C4320A]">{s.coupon_message}</p>}
            </div>
          </section>
        ))}

        {blocking.length > 0 && (
          <div className="mx-4 rounded-lg bg-[#FFF4F0] border border-[#FFD8CC] p-3" role="alert">
            {blocking.map((e, i) => (
              <p key={i} className="flex items-start gap-1.5 text-[12px] text-[#C4320A]"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />{e.message}</p>
            ))}
            <Link to="/cart" className="mt-2 inline-block text-[12px] font-semibold underline">Edit cart</Link>
          </div>
        )}

        <div className="px-4 pt-2 pb-4 flex items-start gap-2 text-[12px] text-gray-500">
          <ShieldCheck className="w-4 h-4 text-[#1A7F37] shrink-0" aria-hidden />
          <span>Your payment is held by QAFRICA and released to the seller only after delivery. <InfoButton title="Buyer protection"><EscrowExplainer /></InfoButton></span>
        </div>
        {formError && <p className="px-4 text-[13px] text-[#C4320A]" role="alert">{formError}</p>}
      </div>

      {/* Pay bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-2xl mx-auto h-16 px-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[11px] text-gray-500">Total</p>
            <p className="text-[17px] font-bold leading-tight tabular-nums">{quote ? naira(quote.amount) : '…'}</p>
          </div>
          <button
            type="button"
            onClick={pay}
            disabled={!canPay && !!state}
            aria-busy={paying}
            className="h-11 px-6 rounded-lg bg-gray-900 text-white text-[14px] font-semibold disabled:opacity-40 inline-flex items-center gap-2"
          >
            <Lock className="w-4 h-4" aria-hidden />
            {paying ? 'Opening payment…' : 'Pay securely'}
          </button>
        </div>
      </div>
    </div>
  );
}
