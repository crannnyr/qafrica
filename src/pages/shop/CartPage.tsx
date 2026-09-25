// /cart: one cart across all stores, grouped by store (SHEIN-style).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShieldCheck, ChevronRight, ShoppingBag, AlertCircle } from 'lucide-react';
import { useCartStore } from '@/stores';
import type { CartItem } from '@/stores/cartStore';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { EscrowExplainer, InfoButton, PageHeader, QtyStepper, RoundCheck } from './ui';
import { naira } from './format';
import { fetchQuote, type Quote } from './checkoutApi';

export const CHECKOUT_SELECTION_KEY = 'qafrica_checkout_selection';

export default function CartPage() {
  useForceLightMode();
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [quote, setQuote] = useState<Quote | null>(null);

  // Live prices + availability from the server (no state yet, so no delivery fees)
  const itemsKey = items.map((i) => `${i.id}:${i.quantity}`).join('|');
  useEffect(() => {
    if (!items.length) return;
    let alive = true;
    fetchQuote(items, null).then((q) => alive && setQuote(q)).catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const livePrice = (i: CartItem) =>
    quote?.stores.find((s) => s.store_id === i.storeId)?.items.find((l) => l.product_id === i.productId)?.unit_price ?? i.unitPrice;
  const problemFor = (i: CartItem) => quote?.errors.find((e) => e.product_id === i.productId && (!e.store_id || e.store_id === i.storeId));

  const groups = useMemo(() => {
    const m = new Map<string, { storeId: string; storeName: string; storeSlug: string; items: CartItem[] }>();
    for (const i of items) {
      if (!m.has(i.storeId)) m.set(i.storeId, { storeId: i.storeId, storeName: i.storeName, storeSlug: i.storeSlug, items: [] });
      m.get(i.storeId)!.items.push(i);
    }
    return [...m.values()];
  }, [items]);

  const isSelected = (i: CartItem) => !deselected.has(i.id) && !problemFor(i);
  const selected = items.filter(isSelected);
  const total = selected.reduce((sum, i) => sum + livePrice(i) * i.quantity, 0);
  const allSelected = items.length > 0 && items.every((i) => !deselected.has(i.id));

  const toggle = (ids: string[], on: boolean) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.delete(id) : next.add(id)));
      return next;
    });

  const checkout = () => {
    try {
      sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(selected.map((i) => i.id)));
    } catch { /* ignore */ }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader title="Cart" />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto text-gray-300" aria-hidden />
          <p className="mt-4 text-[15px] font-semibold">Your cart is empty</p>
          <p className="mt-1 text-[13px] text-gray-500">Items you add from any store show up here.</p>
          <Link to="/stores" className="mt-6 inline-flex h-10 px-6 items-center rounded-lg bg-gray-900 text-white text-[13px] font-semibold">
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-28">
      <PageHeader title={<>Cart <span className="text-gray-400 font-normal">({items.reduce((n, i) => n + i.quantity, 0)})</span></>} />

      <div className="max-w-2xl mx-auto">
        <div className="bg-white px-4 py-2.5 flex items-center gap-2 text-[12px] text-gray-600 border-b border-gray-100">
          <ShieldCheck className="w-4 h-4 text-[#1A7F37] shrink-0" aria-hidden />
          <span className="flex-1">Buyer protection: paid to the seller only after delivery</span>
          <InfoButton title="Buyer protection">
            <EscrowExplainer />
          </InfoButton>
        </div>

        {groups.map((g) => {
          const groupSelectable = g.items.filter((i) => !problemFor(i));
          const groupAll = groupSelectable.length > 0 && groupSelectable.every((i) => !deselected.has(i.id));
          return (
            <section key={g.storeId} className="mt-2 bg-white" aria-label={g.storeName}>
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <RoundCheck checked={groupAll} onChange={(v) => toggle(g.items.map((i) => i.id), v)} label={`Select all from ${g.storeName}`} />
                <Link to={`/${g.storeSlug}`} className="flex items-center gap-0.5 text-[14px] font-semibold min-w-0">
                  <span className="truncate">{g.storeName}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                </Link>
              </div>
              <ul>
                {g.items.map((i) => {
                  const problem = problemFor(i);
                  const price = livePrice(i);
                  const changed = quote && Math.round(price) !== Math.round(i.unitPrice);
                  const opts = i.variantOptions ? Object.values(i.variantOptions).filter(Boolean).join(' / ') : '';
                  return (
                    <li key={i.id} className="flex gap-3 px-4 py-3">
                      <div className="pt-8">
                        <RoundCheck checked={isSelected(i)} onChange={(v) => toggle([i.id], v)} label={`Select ${i.name}`} />
                      </div>
                      <Link to={`/${i.storeSlug}/product/${i.productId}`} className="shrink-0 w-[84px] h-[84px] rounded-md overflow-hidden bg-gray-100">
                        {i.image && <img src={i.image} alt="" className={`w-full h-full object-cover ${problem ? 'opacity-40' : ''}`} />}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="flex-1 text-[13px] leading-snug line-clamp-2">{i.name}</p>
                          <button type="button" onClick={() => removeItem(i.id)} aria-label={`Remove ${i.name}`} className="p-1 -m-1 text-gray-400 hover:text-gray-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {opts && <p className="mt-0.5 text-[12px] text-gray-500 truncate">{opts}</p>}
                        {problem ? (
                          <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[#C4320A]">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                            {problem.message}
                          </p>
                        ) : (
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[15px] font-bold text-[#FA6338]">{naira(price)}</span>
                              {changed && <span className="ml-1.5 text-[11px] text-gray-500">price updated</span>}
                            </div>
                            <QtyStepper value={i.quantity} onChange={(n) => updateQuantity(i.id, n)} label={i.name} />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <p className="px-4 py-4 text-[11px] text-gray-500">Delivery fees are added at checkout once you choose your state.</p>
      </div>

      {/* Sticky total bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-2xl mx-auto h-16 px-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px]">
            <RoundCheck checked={allSelected} onChange={(v) => toggle(items.map((i) => i.id), v)} label="Select all items" />
            All
          </label>
          <div className="flex-1 text-right">
            <p className="text-[16px] font-bold leading-tight">{naira(total)}</p>
            <p className="text-[11px] text-gray-500">+ delivery</p>
          </div>
          <button
            type="button"
            onClick={checkout}
            disabled={selected.length === 0}
            className="h-11 px-5 rounded-lg bg-gray-900 text-white text-[14px] font-semibold disabled:opacity-40"
          >
            Checkout ({selected.reduce((n, i) => n + i.quantity, 0)})
          </button>
        </div>
      </div>
    </div>
  );
}
