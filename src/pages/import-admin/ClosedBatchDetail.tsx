// src/pages/import-admin/ClosedBatchDetail.tsx
// Full-page view for one closed batch (not a modal — occupies the whole
// admin content area with its own back button). Covers the full lifecycle:
// ordered -> ordered_and_closed -> shipped_and_closed -> clearance_and_closed
// -> received (per order). An "at a glance" panel up top shows every product
// in the batch with its image and quantity, and lets admin price the current
// billing stage right there — no need to dig into a separate billing tab for
// the common case. Flight/Sea KPI cards are clickable filters that narrow
// both drill-down tabs to just that shipping method.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Loader, Users, Plane, Ship, ShieldCheck, Send, AlertTriangle,
  ChevronRight, ChevronDown, Package, CheckCircle2, Truck, PackageCheck,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';
import { CustomerDetail } from './ImportAdminCustomers';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface OrderItem { id: string; name: string; image_url: string; quantity: number; price_ngn?: number; variant_options?: Record<string, string>; }
interface OrderRow {
  id: string; code: string; user_id: string | null; customer_name: string;
  items: OrderItem[]; created_at: string;
  status?: string; shipped_at?: string | null; shipping_method?: 'flight' | 'sea_freight' | null;
}
interface BreakdownRow {
  product_id: string; product_name: string; product_image: string | null;
  customer_id: string; customer_name: string; qty: number;
  order_id: string; order_code: string; order_created_at: string;
}
interface ItemBill { id: string; product_id: string; product_name: string; unit_amount_ngn: number; kind: 'consolidation_shipping' | 'clearance'; audit_status: boolean; }
interface BatchStatus { batch_key: string; kind: 'consolidation_shipping' | 'clearance'; status: 'draft' | 'sent'; recipients_count: number | null; }
interface Bill { id: string; user_id: string; kind: string; status: string; amount_ngn: number; }

function fmt(n: number) { return `₦${Math.round(n).toLocaleString()}`; }

async function call(action: string, body: Record<string, unknown>) {
  const res = await fetch(`${EDGE_URL}?action=${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
}

type Stage = 'ordered' | 'ordered_and_closed' | 'shipped_and_closed' | 'clearance_and_closed';

const STAGE_LABELS: Record<Stage, string> = {
  ordered: 'Sourcing — not yet billed',
  ordered_and_closed: 'Consolidation & shipping billed — awaiting shipment',
  shipped_and_closed: 'Shipped — clearance not yet billed',
  clearance_and_closed: 'Clearance billed',
};

export default function ClosedBatchDetail({
  token, batchKey, orders, onClose, onOpenProduct, onReload,
}: {
  token: string; batchKey: string; orders: OrderRow[]; onClose: () => void;
  onOpenProduct?: (productId: string) => void; onReload?: () => void;
}) {
  const [tab, setTab] = useState<'grouped' | 'chronological'>('grouped');
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [kpi, setKpi] = useState({ flight: 0, sea_freight: 0 });
  const [itemBills, setItemBills] = useState<ItemBill[]>([]);
  const [statuses, setStatuses] = useState<BatchStatus[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [shippingFilter, setShippingFilter] = useState<'flight' | 'sea_freight' | null>(null);
  const [shippingMethodFinal, setShippingMethodFinal] = useState<'flight' | 'sea_freight'>('flight');
  const [confirmAction, setConfirmAction] = useState<null | 'close_ordered' | 'mark_shipped' | 'close_clearance'>(null);
  const [isActing, setIsActing] = useState(false);
  const [markingReceived, setMarkingReceived] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [breakdownRes, itemBillsRes, billsRes] = await Promise.all([
        call('admin-batch-breakdown', { manager_token: token, batch_key: batchKey }),
        call('admin-batch-item-bills', { manager_token: token, batch_key: batchKey }),
        call('admin-all-bills', { manager_token: token }),
      ]);
      setBreakdown(breakdownRes.rows ?? []);
      setKpi(breakdownRes.shipping_kpi ?? { flight: 0, sea_freight: 0 });
      setItemBills(itemBillsRes.items ?? []);
      setStatuses(itemBillsRes.statuses ?? []);
      setBills(billsRes.bills ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token, batchKey]);

  useEffect(() => { load(); }, [load]);

  // ── Batch stage: derived from what's already loaded, no extra endpoint ──
  const consolidationSent = statuses.find(s => s.kind === 'consolidation_shipping')?.status === 'sent';
  const clearanceSent = statuses.find(s => s.kind === 'clearance')?.status === 'sent';
  const anyShipped = orders.some(o => !!o.shipped_at);
  const stage: Stage = !consolidationSent ? 'ordered'
    : !anyShipped ? 'ordered_and_closed'
    : !clearanceSent ? 'shipped_and_closed'
    : 'clearance_and_closed';

  // The bill "kind" admin should be pricing right now, based on stage.
  const activeKind: 'consolidation_shipping' | 'clearance' = stage === 'shipped_and_closed' || stage === 'clearance_and_closed'
    ? 'clearance' : 'consolidation_shipping';
  const activeStatus = statuses.find(s => s.kind === activeKind);
  const isLocked = activeStatus?.status === 'sent';

  const orderShippingMethod = useMemo(() => {
    const map = new Map<string, 'flight' | 'sea_freight' | null>();
    for (const o of orders) map.set(o.id, o.shipping_method ?? null);
    return map;
  }, [orders]);

  const filteredBreakdown = useMemo(() => {
    if (!shippingFilter) return breakdown;
    return breakdown.filter(r => orderShippingMethod.get(r.order_id) === shippingFilter);
  }, [breakdown, shippingFilter, orderShippingMethod]);

  // Products sorted oldest-order-first (the item with the oldest order
  // among its buyers comes first, and stacks up first) — matches what was
  // asked for instead of arbitrary order.
  const products = useMemo(() => {
    const map = new Map<string, { id: string; name: string; image: string | null; oldestAt: string; totalQty: number }>();
    for (const row of filteredBreakdown) {
      const existing = map.get(row.product_id);
      if (!existing) {
        map.set(row.product_id, { id: row.product_id, name: row.product_name, image: row.product_image, oldestAt: row.order_created_at, totalQty: row.qty });
      } else {
        existing.totalQty += row.qty;
        if (row.order_created_at < existing.oldestAt) existing.oldestAt = row.order_created_at;
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(a.oldestAt).getTime() - new Date(b.oldestAt).getTime());
  }, [filteredBreakdown]);

  // Actual sales revenue per product — what customers paid at checkout
  // (item.price_ngn × quantity), not the consolidation/clearance fee. This
  // is "how much am I actually selling", independent of billing stage.
  const revenueByProduct = useMemo(() => {
    const map = new Map<string, number>();
    let source = orders;
    if (shippingFilter) source = orders.filter(o => o.shipping_method === shippingFilter);
    for (const o of source) {
      for (const item of (o.items ?? [])) {
        const line = Number(item.price_ngn ?? 0) * Number(item.quantity ?? 0);
        map.set(item.id, (map.get(item.id) ?? 0) + line);
      }
    }
    return map;
  }, [orders, shippingFilter]);

  const totalBatchRevenue = useMemo(
    () => Array.from(revenueByProduct.values()).reduce((s, v) => s + v, 0),
    [revenueByProduct]
  );

  const priceFor = (productId: string) => {
    const draft = priceDrafts[`${productId}:${activeKind}`];
    if (draft !== undefined) return draft;
    const saved = itemBills.find(b => b.product_id === productId && b.kind === activeKind);
    return saved ? String(saved.unit_amount_ngn) : '';
  };

  const savePrice = async (productId: string, productName: string, value: string) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    const result = await call('admin-batch-set-item-price', {
      manager_token: token, batch_key: batchKey, product_id: productId, product_name: productName,
      unit_amount_ngn: amount, kind: activeKind,
    });
    if (result.error) { toast.error(result.error); return; }
    await load();
  };

  const toggleAudit = async (billId: string) => {
    const result = await call('admin-batch-toggle-audit', { manager_token: token, id: billId });
    if (result.error) { toast.error(result.error); return; }
    await load();
  };

  const toggleExpanded = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  // Expected total: sum of unit price × qty across everyone, for the
  // billing kind currently being priced — the "if 100% of people pay"
  // figure, shown live as admin enters prices.
  const expectedTotalNgn = useMemo(() => {
    const priceMap = new Map(itemBills.filter(b => b.kind === activeKind).map(b => [b.product_id, b.unit_amount_ngn]));
    for (const [key, value] of Object.entries(priceDrafts)) {
      const [productId, kind] = key.split(':');
      if (kind === activeKind && value !== '') priceMap.set(productId, Number(value));
    }
    let total = 0;
    for (const row of breakdown) {
      const price = priceMap.get(row.product_id);
      if (price != null) total += price * row.qty;
    }
    return total;
  }, [breakdown, itemBills, priceDrafts, activeKind]);

  const customerTotals = useMemo(() => {
    const priceMap = new Map(itemBills.filter(b => b.kind === activeKind).map(b => [b.product_id, b.unit_amount_ngn]));
    const totals = new Map<string, { name: string; total: number }>();
    for (const row of breakdown) {
      const price = priceMap.get(row.product_id);
      if (price == null) continue;
      const entry = totals.get(row.customer_id) ?? { name: row.customer_name, total: 0 };
      entry.total += price * row.qty;
      totals.set(row.customer_id, entry);
    }
    return totals;
  }, [breakdown, itemBills, activeKind]);

  const billStatusForCustomer = (customerId: string | null) => {
    if (!customerId) return null;
    const match = bills.filter(b => b.user_id === customerId && b.kind === activeKind);
    if (match.length === 0) return null;
    return match.some(b => b.status === 'paid') ? 'paid' : match[0].status;
  };

  const runAction = async () => {
    setIsActing(true);
    try {
      if (confirmAction === 'close_ordered') {
        const result = await call('admin-batch-close-ordered', { manager_token: token, batch_key: batchKey });
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Billed ${result.customers_billed} customer${result.customers_billed !== 1 ? 's' : ''} — consolidation & shipping locked.`);
      } else if (confirmAction === 'mark_shipped') {
        const result = await call('admin-batch-mark-shipped', { manager_token: token, batch_key: batchKey, shipping_method_final: shippingMethodFinal });
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Marked shipped — ${result.paid_notified} notified as shipped, ${result.held_unpaid_notified} notified their item is held until they pay.`);
      } else if (confirmAction === 'close_clearance') {
        const result = await call('admin-batch-close-clearance', { manager_token: token, batch_key: batchKey });
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Billed ${result.customers_billed} customer${result.customers_billed !== 1 ? 's' : ''} — clearance locked.`);
      }
      setConfirmAction(null);
      await load();
      onReload?.();
    } finally {
      setIsActing(false);
    }
  };

  const markReceived = async (orderId: string) => {
    setMarkingReceived(orderId);
    try {
      const result = await call('admin-mark-received', { manager_token: token, order_id: orderId });
      if (result.error) { toast.error(result.error); return; }
      toast.success('Order marked received.');
      onReload?.();
    } finally {
      setMarkingReceived(null);
    }
  };

  // By-customer view: sorted oldest-order-first.
  const chronologicalCustomers = useMemo(() => {
    const byCustomer = new Map<string, { userId: string | null; name: string; earliestAt: string; orders: OrderRow[] }>();
    let source = orders;
    if (shippingFilter) source = orders.filter(o => o.shipping_method === shippingFilter);
    for (const o of source) {
      const key = o.user_id ?? o.id;
      const entry = byCustomer.get(key) ?? { userId: o.user_id, name: o.customer_name, earliestAt: o.created_at, orders: [] };
      if (o.created_at < entry.earliestAt) entry.earliestAt = o.created_at;
      entry.orders.push(o);
      byCustomer.set(key, entry);
    }
    return Array.from(byCustomer.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => new Date(a.earliestAt).getTime() - new Date(b.earliestAt).getTime());
  }, [orders, shippingFilter]);

  const [selectedCustomerForDrilldown, setSelectedCustomerForDrilldown] = useState<string | null>(null);
  const selectedCustomer = chronologicalCustomers.find(c => c.key === selectedCustomerForDrilldown);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — real page chrome, no backdrop, no floating box */}
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-sm">Batch — {new Date(batchKey).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</h2>
          <p className="text-[11px] text-gray-400">{STAGE_LABELS[stage]}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
        {isLoading ? (
          <div className="py-16 text-center"><Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
        ) : (
          <>
            {/* ── At a glance: every product, image, qty, and quick pricing ── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-800">At a glance</p>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  Pricing: {activeKind === 'clearance' ? 'Clearance' : 'Consolidation & shipping'}
                </span>
              </div>

              {totalBatchRevenue > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-emerald-600">Actually selling right now</p>
                  <p className="text-sm font-black text-emerald-700">{fmt(totalBatchRevenue)}</p>
                </div>
              )}

              {isLocked && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700">
                    This bill was sent to {activeStatus?.recipients_count ?? 0} customer{activeStatus?.recipients_count !== 1 ? 's' : ''} and is locked.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-2.5">
                    <a
                      href={`/recommendations/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                      {p.image ? (
                        <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-orange-600 hover:underline truncate">{p.name}</p>
                        <p className="text-[10px] text-orange-500 font-bold">{p.totalQty} units</p>
                        {revenueByProduct.get(p.id) ? (
                          <p className="text-[10px] text-emerald-600 font-semibold">{fmt(revenueByProduct.get(p.id)!)} sold</p>
                        ) : null}
                      </div>
                    </a>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-gray-400">₦</span>
                      <input
                        type="number" inputMode="decimal"
                        value={priceFor(p.id)}
                        disabled={isLocked}
                        onChange={e => setPriceDrafts(prev => ({ ...prev, [`${p.id}:${activeKind}`]: e.target.value }))}
                        onBlur={e => e.target.value && savePrice(p.id, p.name, e.target.value)}
                        placeholder="per unit"
                        className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {expectedTotalNgn > 0 && (
                <div className="mt-3 bg-orange-50 rounded-xl p-3 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-orange-600">Expected total, if everyone pays</p>
                  <p className="text-sm font-black text-orange-700">{fmt(expectedTotalNgn)}</p>
                </div>
              )}
            </div>

            {/* ── Flight / Sea — clickable filters ── */}
            <div className="flex gap-2">
              <button
                onClick={() => setShippingFilter(f => f === 'flight' ? null : 'flight')}
                className={`flex-1 rounded-xl p-2.5 flex items-center gap-2 border-2 transition-colors ${shippingFilter === 'flight' ? 'border-sky-400 bg-sky-50' : 'border-transparent bg-sky-50/60'}`}
              >
                <Plane className="w-4 h-4 text-sky-500 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-black text-sky-700 leading-none">{kpi.flight}</p>
                  <p className="text-[10px] text-sky-500">Flight{shippingFilter === 'flight' ? ' · filtering' : ''}</p>
                </div>
              </button>
              <button
                onClick={() => setShippingFilter(f => f === 'sea_freight' ? null : 'sea_freight')}
                className={`flex-1 rounded-xl p-2.5 flex items-center gap-2 border-2 transition-colors ${shippingFilter === 'sea_freight' ? 'border-indigo-400 bg-indigo-50' : 'border-transparent bg-indigo-50/60'}`}
              >
                <Ship className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-black text-indigo-700 leading-none">{kpi.sea_freight}</p>
                  <p className="text-[10px] text-indigo-500">Sea{shippingFilter === 'sea_freight' ? ' · filtering' : ''}</p>
                </div>
              </button>
            </div>

            {/* ── Stage action bar ── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Next step</p>
              {stage === 'ordered' && (
                <button
                  onClick={() => setConfirmAction('close_ordered')}
                  disabled={customerTotals.size === 0}
                  className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Close & bill (consolidation & shipping)
                </button>
              )}
              {stage === 'ordered_and_closed' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShippingMethodFinal('flight')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${shippingMethodFinal === 'flight' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      <Plane className="w-3.5 h-3.5" /> Flight
                    </button>
                    <button
                      onClick={() => setShippingMethodFinal('sea_freight')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${shippingMethodFinal === 'sea_freight' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      <Ship className="w-3.5 h-3.5" /> Sea
                    </button>
                  </div>
                  <button
                    onClick={() => setConfirmAction('mark_shipped')}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
                  >
                    <Truck className="w-4 h-4" /> Mark shipped & closed
                  </button>
                  <p className="text-[10px] text-gray-400">
                    Not gated on payment — unpaid customers get a "held until cleared" notice instead and daily reminders.
                  </p>
                </div>
              )}
              {stage === 'shipped_and_closed' && (
                <button
                  onClick={() => setConfirmAction('close_clearance')}
                  disabled={customerTotals.size === 0}
                  className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Close & bill (clearance)
                </button>
              )}
              {stage === 'clearance_and_closed' && (
                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                  <PackageCheck className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500">
                    Clearance is billed. Mark individual orders received under "By customer" once each customer's clearance fee is paid.
                  </p>
                </div>
              )}
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1">
              {(['grouped', 'chronological'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSelectedCustomerForDrilldown(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${tab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
                >
                  {t === 'chronological' ? 'By customer' : 'Grouped'}
                </button>
              ))}
            </div>

            {tab === 'grouped' ? (
              <div className="space-y-2">
                {products.map(p => {
                  const buyersForProduct = filteredBreakdown.filter(r => r.product_id === p.id);
                  const isExpanded = expandedProducts.has(p.id);
                  return (
                    <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                      <div className="flex items-center gap-2.5">
                        <a
                          href={`/recommendations/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          {p.image ? (
                            <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5 text-gray-300" />
                            </div>
                          )}
                          <span className="text-sm font-semibold text-orange-600 hover:underline truncate">{p.name}</span>
                        </a>
                        <span className="text-xs font-bold text-orange-500 flex-shrink-0">{p.totalQty} units</span>
                        <button onClick={() => toggleExpanded(p.id)} className="p-1 flex-shrink-0">
                          <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="space-y-1 mt-2 pt-2 border-t border-gray-50">
                          {buyersForProduct.map((r, i) => (
                            <button
                              key={i}
                              onClick={() => r.customer_id && setProfileCustomerId(r.customer_id)}
                              className="w-full flex items-center justify-between text-xs text-left hover:underline"
                            >
                              <span className="text-gray-600">{r.customer_name} <span className="text-gray-300 font-mono">· {r.order_code}</span></span>
                              <span className="font-semibold text-gray-700">×{r.qty}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : selectedCustomer ? (
              <div>
                <button onClick={() => setSelectedCustomerForDrilldown(null)} className="text-xs text-orange-500 font-bold mb-3">← Back to all customers</button>
                <p className="text-sm font-bold text-gray-800 mb-1">{selectedCustomer.name}'s items</p>
                {(() => {
                  const billStatus = billStatusForCustomer(selectedCustomer.userId);
                  return billStatus && (
                    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full mb-3 ${billStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {activeKind === 'clearance' ? 'Clearance' : 'Consolidation & shipping'}: {billStatus}
                    </span>
                  );
                })()}
                <div className="space-y-3">
                  {selectedCustomer.orders.map(o => (
                    <div key={o.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-gray-400">{o.code}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{o.status}</span>
                      </div>
                      {(o.items ?? []).map(item => {
                        const others = breakdown.filter(r => r.product_id === item.id);
                        return (
                          <div key={item.id} className="bg-gray-50 rounded-xl p-2.5 mb-2 last:mb-0">
                            <p className="text-xs font-semibold text-gray-800 mb-1.5">{item.name} × {item.quantity}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                              <Users className="w-3 h-3" /> Everyone who ordered this
                            </p>
                            <div className="space-y-0.5">
                              {others.map((r, i) => (
                                <button
                                  key={i}
                                  onClick={() => r.customer_id && setProfileCustomerId(r.customer_id)}
                                  className="w-full flex items-center justify-between text-[11px] text-left hover:underline"
                                >
                                  <span className="text-gray-600">{r.customer_name}</span>
                                  <span className="font-semibold text-gray-700">×{r.qty}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {stage === 'clearance_and_closed' && o.status === 'clearance_and_closed' && (
                        <button
                          onClick={() => markReceived(o.id)}
                          disabled={markingReceived === o.id}
                          className="w-full mt-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
                        >
                          {markingReceived === o.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Mark received
                        </button>
                      )}
                      {o.status === 'received' && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Received
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {chronologicalCustomers.map(c => {
                  const billStatus = billStatusForCustomer(c.userId);
                  return (
                    <button
                      key={c.key}
                      onClick={() => setSelectedCustomerForDrilldown(c.key)}
                      className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 text-left hover:border-gray-200 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                        <p className="text-[10px] text-gray-400">{new Date(c.earliestAt).toLocaleDateString()} · {c.orders.length} order{c.orders.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {billStatus && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${billStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {billStatus}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => !isActing && setConfirmAction(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1.5">
              {confirmAction === 'mark_shipped' ? 'Mark this batch shipped?' : 'This locks pricing for this stage'}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              {confirmAction === 'mark_shipped'
                ? 'Every order in this batch moves to shipped & closed. Paid customers get a shipped notice; unpaid customers get a held notice with daily reminders.'
                : `Once sent, pricing can't be changed. ${customerTotals.size} customer${customerTotals.size !== 1 ? 's' : ''} will be billed by Paystack and notified. Continue?`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} disabled={isActing} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-600 border border-gray-200">
                Cancel
              </button>
              <button onClick={runAction} disabled={isActing} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gray-900 flex items-center justify-center gap-1.5">
                {isActing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileCustomerId && (
        <CustomerDetail token={token} customerId={profileCustomerId} onClose={() => setProfileCustomerId(null)} onFavoriteToggled={() => {}} />
      )}
    </div>
  );
}
