import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Loader2, Lock, MapPin, Package, ShoppingBag, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services';
import { useCartStore, useCustomerAuthStore } from '@/stores';
import { syncMarketplaceImportCart } from '@/stores/marketplaceCartBridge';

const naira = (value: number) => `₦${Math.round(value).toLocaleString()}`;

type QuoteStore = { store_id: string; store_name: string; items: any[]; subtotal: number; delivery_fee: number; total: number; shipping_included?: boolean };

export default function MarketplaceCheckoutPage() {
  const navigate = useNavigate();
  const { customer, isAuthenticated, addresses, getDefaultAddress, fetchAddresses } = useCustomerAuthStore();
  const items = useCartStore(s => s.items);
  const [name, setName] = useState(customer?.full_name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [landmark, setLandmark] = useState('');
  const [quote, setQuote] = useState<{ stores: QuoteStore[]; amount: number } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const hasChinaImport = useMemo(() => items.some(i => i.sourceType === 'china_import'), [items]);

  useEffect(() => {
    syncMarketplaceImportCart();
  }, []);
  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/customer/login?return=/checkout', { replace: true }); return; }
    if (customer) { setName(customer.full_name ?? ''); setEmail(customer.email ?? ''); setPhone(customer.phone ?? ''); }
    void fetchAddresses();
  }, [isAuthenticated, customer?.id]);

  useEffect(() => {
    const saved = getDefaultAddress(); if (!saved) return;
    setAddress(v => v || saved.address_line1 || ''); setCity(v => v || saved.city || ''); setState(v => v || saved.state || ''); setLandmark(v => v || ''); setPhone(v => v || saved.phone || ''); setName(v => v || saved.name || '');
  }, [addresses.length]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!items.length || !state.trim()) { setQuote(null); return; }
      setLoadingQuote(true); setQuoteError('');
      const { data, error } = await supabase.functions.invoke('marketplace-checkout', { body: { action: 'quote', state: state.trim(), items: items.map(i => ({ source_type: i.sourceType ?? 'product', source_id: i.sourceId ?? i.productId, quantity: i.quantity, variant_options: i.variantOptions, attribution: i.attribution === 'marketplace' ? 'marketplace' : 'own' })) } });
      if (cancelled) return; setLoadingQuote(false);
      if (error || !data?.ok) { setQuote(null); setQuoteError(data?.errors?.[0]?.message ?? error?.message ?? 'Could not calculate checkout total'); return; }
      setQuote({ stores: data.stores ?? [], amount: Number(data.amount ?? 0) });
    };
    const timer = window.setTimeout(run, 250); return () => { cancelled = true; window.clearTimeout(timer); };
  }, [items, state]);

  const handleUseAddress = (id: string) => { const selected = addresses.find(a => a.id === id); if (!selected) return; setName(selected.name || name); setPhone(selected.phone || phone); setAddress(selected.address_line1 || ''); setCity(selected.city || ''); setState(selected.state || ''); setLandmark(''); };

  const handleCheckout = async () => {
    if (!quote?.amount) return;
    if (!name.trim() || !email.trim() || !phone.trim() || !address.trim() || !city.trim() || !state.trim()) { toast.error('Please complete your delivery and contact details'); return; }
    setProcessing(true);
    const { data, error } = await supabase.functions.invoke('marketplace-checkout', { body: { action: 'create', customer: { name: name.trim(), email: email.trim(), phone: phone.trim() }, delivery: { address: address.trim(), city: city.trim(), state: state.trim(), landmark: landmark.trim() }, items: items.map(i => ({ source_type: i.sourceType ?? 'product', source_id: i.sourceId ?? i.productId, quantity: i.quantity, variant_options: i.variantOptions, attribution: i.attribution === 'marketplace' ? 'marketplace' : 'own' })) } });
    if (error || !data?.checkout_link) { setProcessing(false); toast.error(data?.error ?? error?.message ?? 'Could not start payment'); return; }
    window.location.assign(data.checkout_link);
  };

  if (!isAuthenticated) return null;
  if (!items.length) return <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-6"><div className="text-center"><ShoppingBag className="mx-auto h-12 w-12 text-gray-300" /><h1 className="mt-4 text-xl font-bold text-gray-900">Your cart is empty</h1><Link to="/stores-v2" className="mt-5 inline-flex text-sm font-semibold text-orange-600">Back to marketplace</Link></div></div>;

  return <div className="min-h-screen bg-[#fafafa] pb-12">
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600"><ArrowLeft className="h-4 w-4" /> Marketplace</button><div className="flex items-center gap-2 text-sm font-bold text-gray-900"><img src="/qafrica-bag-logo.svg" alt="QAFRICA" className="h-8 w-8" />Checkout</div><div className="inline-flex items-center gap-1 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" /> Secure</div></div></header>
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
      <section className="space-y-5">
        <div className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h1 className="text-lg font-bold text-gray-900">Delivery details</h1><p className="mt-1 text-xs text-gray-500">One address is used for every item in this marketplace checkout.</p></div><MapPin className="h-5 w-5 text-orange-500" /></div>{addresses.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{addresses.slice(0,4).map(a => <button key={a.id} onClick={() => handleUseAddress(a.id)} className="rounded-full border px-3 py-1.5 text-xs text-gray-600 hover:border-orange-300">{a.label || a.city || 'Saved address'}</button>)}</div>}<div className="grid gap-3 sm:grid-cols-2"><Field label="Full name" value={name} onChange={setName}/><Field label="Phone number" value={phone} onChange={setPhone} inputMode="tel"/><Field label="Email" value={email} onChange={setEmail} type="email"/><Field label="State" value={state} onChange={setState} placeholder="e.g. Lagos"/><Field label="City / area" value={city} onChange={setCity}/><Field label="Landmark (optional)" value={landmark} onChange={setLandmark}/><div className="sm:col-span-2"><Field label="Street address" value={address} onChange={setAddress}/></div></div></div>
        {hasChinaImport && <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4"><div className="flex gap-3"><div className="rounded-xl bg-white p-2"><img src="/qafrica-bag-logo.svg" alt="" className="h-8 w-8"/></div><div><p className="text-sm font-bold text-gray-900">China Import items</p><p className="mt-1 text-xs leading-5 text-gray-600">The marketplace price already includes the item's air shipping allocation. No second consolidation bill is requested from you at checkout.</p></div></div></div>}
        <div className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center gap-2"><Truck className="h-5 w-5 text-orange-500"/><h2 className="font-bold text-gray-900">Order items</h2><span className="text-xs text-gray-400">{totalItems} item{totalItems === 1 ? '' : 's'}</span></div><div className="space-y-4">{items.map(item => <div key={item.id} className="flex gap-3"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover"/> : <Package className="m-auto h-full w-6 text-gray-300"/>}{item.sourceType === 'china_import' && <span className="absolute left-0 top-0 rounded-br-md bg-gray-900 px-1.5 py-0.5 text-[8px] font-bold text-white">China</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-500">Qty {item.quantity}</p></div><p className="text-sm font-bold text-gray-900">{naira(item.totalPrice)}</p></div>)}</div></div>
      </section>
      <aside className="lg:sticky lg:top-24 lg:self-start"><div className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold text-gray-900">Order summary</h2><div className="mt-4 space-y-3">{(quote?.stores ?? []).map(store => <div key={store.store_id} className="border-b pb-3 last:border-0"><div className="flex items-center justify-between text-sm"><span className="font-semibold text-gray-800">{store.store_name}</span><span>{naira(store.total)}</span></div>{store.shipping_included ? <p className="mt-1 text-xs text-green-600">Air shipping included</p> : <p className="mt-1 text-xs text-gray-500">Delivery {store.delivery_fee ? naira(store.delivery_fee) : '—'}</p>}</div>)}</div>{quoteError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600">{quoteError}</p>}<div className="mt-4 flex items-center justify-between border-t pt-4"><span className="font-semibold text-gray-700">Total</span><span className="text-xl font-black text-orange-600">{quote ? naira(quote.amount) : '—'}</span></div><button onClick={handleCheckout} disabled={processing || loadingQuote || !quote?.amount} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">{processing ? <><Loader2 className="h-4 w-4 animate-spin"/> Opening secure payment…</> : <>Continue to payment <ChevronRight className="h-4 w-4"/></>}</button><p className="mt-3 text-center text-[11px] leading-4 text-gray-400">You will complete the single payment on QAfrica's secure payment page.</p></div></aside>
    </main>
  </div>;
}

function Field({label,value,onChange,type='text',placeholder,inputMode}:{label:string;value:string;onChange:(value:string)=>void;type?:string;placeholder?:string;inputMode?:'tel'|'text'}){return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</span><input value={value} onChange={e=>onChange(e.target.value)} type={type} inputMode={inputMode} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"/></label>;}
