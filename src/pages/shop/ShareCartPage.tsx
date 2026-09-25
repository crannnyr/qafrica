// /cart/share: turn the selected cart items into a pay-for-me link.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Share2, MessageCircle, ShieldCheck } from 'lucide-react';
import { useCartStore, useCustomerAuthStore } from '@/stores';
import CONFIG from '@/lib/config';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { Field, InfoButton, PageHeader } from './ui';
import { naira } from './format';
import { CHECKOUT_SELECTION_KEY } from './CartPage';
import { createSharedCart, loadSavedDetails, saveDetails, shareUrl } from './checkoutApi';

const STATES: string[] = (CONFIG as unknown as { NIGERIAN_STATES: string[] }).NIGERIAN_STATES ?? [];

export default function ShareCartPage() {
  useForceLightMode();
  const allItems = useCartStore((s) => s.items);
  const { customer } = useCustomerAuthStore();
  const items = useMemo(() => {
    try {
      const ids: string[] = JSON.parse(sessionStorage.getItem(CHECKOUT_SELECTION_KEY) ?? 'null');
      if (Array.isArray(ids) && ids.length) {
        const picked = allItems.filter((i) => ids.includes(i.id));
        if (picked.length) return picked;
      }
    } catch { /* ignore */ }
    return allItems;
  }, [allItems]);

  const saved = useMemo(() => loadSavedDetails(), []);
  const [name, setName] = useState(saved.customer?.name ?? customer?.full_name ?? '');
  const [email, setEmail] = useState(saved.customer?.email ?? customer?.email ?? '');
  const [phone, setPhone] = useState(saved.customer?.phone ?? customer?.phone ?? '');
  const [address, setAddress] = useState(saved.delivery?.address ?? '');
  const [city, setCity] = useState(saved.delivery?.city ?? '');
  const [state, setState] = useState(saved.delivery?.state ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const recipient = { name: name.trim(), email: email.trim(), phone: phone.trim() };
    const delivery = { address: address.trim(), city: city.trim(), state };
    const r = await createSharedCart(items, recipient, delivery, note.trim());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    saveDetails({ customer: recipient, delivery });
    setResult({ code: r.code, amount: r.amount });
  };

  if (!items.length) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader title="Ask someone to pay" back="/cart" />
        <p className="p-10 text-center text-[13px] text-gray-600">Your cart is empty. <Link to="/stores" className="underline">Browse products</Link></p>
      </div>
    );
  }

  if (result) {
    const url = shareUrl(result.code);
    const message = `Hi! Could you help me pay for my QAFRICA cart (${naira(result.amount)})? It's safe: you pay through QAFRICA and it's delivered to me. ${url}`;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
    };
    return (
      <div className="min-h-screen bg-white">
        <PageHeader title="Your payment link" back="/cart" />
        <div className="max-w-md mx-auto p-5">
          <p className="text-[13px] text-gray-600">Send this link to anyone. They can pay {naira(result.amount)} without an account, and the order is delivered to you.</p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-300 p-2 pl-3">
            <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{url.replace(/^https?:\/\//, '')}</span>
            <button type="button" onClick={copy} className="h-9 px-3 rounded-md bg-gray-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="h-11 rounded-lg bg-[#25D366] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <button
              type="button"
              onClick={() => (navigator.share ? navigator.share({ title: 'Help me pay for my cart', text: message, url }).catch(() => {}) : copy())}
              className="h-11 rounded-lg border border-gray-900 text-[13px] font-semibold inline-flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" /> More options
            </button>
          </div>
          <ul className="mt-6 space-y-2 text-[12px] text-gray-600">
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-[#1A7F37] shrink-0" aria-hidden />They only see your first name, city, the items and your note. Never your address or phone.</li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-[#1A7F37] shrink-0" aria-hidden />The link works for 7 days and stops once someone pays.</li>
            <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-[#1A7F37] shrink-0" aria-hidden />Prices are re-checked when they pay, so the total can change if a seller updates a price.</li>
          </ul>
          <p className="mt-5 text-[12px] text-gray-500">Keep the items in your cart. They'll be removed automatically once the order is paid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-10">
      <PageHeader title="Ask someone to pay" back="/cart" />
      <form onSubmit={create} className="max-w-md mx-auto space-y-2 pt-2">
        <section className="bg-white px-4 py-4">
          <h2 className="text-[14px] font-semibold flex items-center gap-1.5">
            How it works
            <InfoButton title="Pay-for-me links">
              <p>We create a private link for the {items.length} item{items.length === 1 ? '' : 's'} you selected. Anyone you send it to can pay through QAFRICA, and the order is delivered to you.</p>
              <p>Only share it with people you trust to help. Never send money outside QAFRICA.</p>
            </InfoButton>
          </h2>
          <p className="mt-1 text-[12px] text-gray-600">Enter where the order should be delivered. The person paying won't see your address or phone number.</p>
        </section>
        <section className="bg-white px-4 py-4 space-y-3">
          <Field id="name" label="Your full name" value={name} onChange={setName} autoComplete="name" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="email" label="Your email" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field id="phone" label="Your phone" type="tel" inputMode="tel" value={phone} onChange={setPhone} autoComplete="tel" />
          </div>
          <Field id="address" label="Delivery address" value={address} onChange={setAddress} autoComplete="street-address" placeholder="House number and street" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="city" label="City / area" value={city} onChange={setCity} />
            <div>
              <label htmlFor="state" className="block text-[12px] font-medium text-gray-700 mb-1">State</label>
              <select id="state" value={state} onChange={(e) => setState(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-gray-300 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Choose…</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </section>
        <section className="bg-white px-4 py-4">
          <label htmlFor="note" className="block text-[12px] font-medium text-gray-700 mb-1">Note <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} rows={3} placeholder="e.g. Birthday wish list 🎂" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <p className="mt-1 text-[11px] text-gray-400">{note.length}/280 · No phone numbers, bank details or links.</p>
        </section>
        {error && <p className="px-4 text-[13px] text-[#C4320A]" role="alert">{error}</p>}
        <div className="px-4 pt-2">
          <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-gray-900 text-white text-[14px] font-semibold disabled:opacity-50">
            {busy ? 'Creating link…' : 'Create payment link'}
          </button>
        </div>
      </form>
    </div>
  );
}
