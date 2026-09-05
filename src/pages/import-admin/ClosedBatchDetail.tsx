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
  ChevronRight, Package, CheckCircle2, Truck, PackageCheck, ExternalLink, Layers,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';
import { CustomerDetail } from './ImportAdminCustomers';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
// Read-only batch data lives in its own small function so this screen does
// not force a redeploy of the whole order/payment surface.
const BATCH_VIEW_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-batch-view`;

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
  variant_options: Record<string, string> | null;
}
// One (customer, product) line from get_batch_customer_breakdown. Carries the
// price paid, the admin-only 1688 link, and both "others ordered this"
// counts, so the drill-down needs no further stitching.
interface CustomerLine {
  customer_id: string; customer_name: string;
  first_order_at: string; order_count: number;
  shipping_method: 'flight' | 'sea_freight' | null;
  order_id: string; order_code: string;
  product_id: string; product_name: string; product_image: string | null;
  source_url: string | null; ship_only: boolean;
  variant_options: Record<string, string> | null;
  qty: number; unit_price_ngn: number;
  others_in_batch: number; customers_in_open_batch: number;
}
interface ItemBill { id: string; product_id: string; product_name: string; unit_amount_ngn: number; kind: 'consolidation_shipping' | 'clearance'; audit_status: boolean; }
interface BatchStatus { batch_key: string; kind: 'consolidation_shipping' | 'clearance'; status: 'draft' | 'sent'; recipients_count: number | null; }
interface Bill { id: string; user_id: string; kind: string; status: string; amount_ngn: number; }

function fmt(n: number) { return `₦${Math.round(n).toLocaleString()}`; }

// e.g. {Color: "Pink", Size: "L"} -> "Pink, L". Empty/null means the item
// had no variant selection (single-variant or no-variant product).
function variantLabel(v: Record<string, string> | null | undefined): string {
  if (!v || Object.keys(v).length === 0) return '';
  return Object.values(v).join(', ');
}

async function call(action: string, body: Record<string, unknown>) {
  const res = await fetch(`${EDGE_URL}?action=${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
}

async function batchViewCall(action: string, body: Record<string, unknown>) {
  const res = await fetch(`${BATCH_VIEW_URL}?action=${action}`, {
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
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [customerLines, setCustomerLines] = useState<CustomerLine[]>([]);
  const [kpi, setKpi] = useState({ flight: 0, sea_freight: 0 });
  const [itemBills, setItemBills] = useState<ItemBill[]>([]);
  const [statuses, setStatuses] = useState<BatchStatus[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      const [breakdownRes, itemBillsRes, billsRes, linesRes] = await Promise.all([
        call('admin-batch-breakdown', { manager_token: token, batch_key: batchKey }),
        call('admin-batch-item-bills', { manager_token: token, batch_key: batchKey }),
        call('admin-all-bills', { manager_token: token }),
        batchViewCall('customer-breakdown', { manager_token: token, batch_key: batchKey }),
      ]);
      setCustomerLines(linesRes.rows ?? []);
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

  // Per-product variant breakdown for sourcing -- e.g. "Pink: 3, Black: 1"
  // instead of one merged "4 units" line that hides which variant is which.
  const variantsByProduct = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const row of filteredBreakdown) {
      const label = variantLabel(row.variant_options) || 'No variant selected';
      const inner = map.get(row.product_id) ?? new Map<string, number>();
      inner.set(label, (inner.get(label) ?? 0) + row.qty);
      map.set(row.product_id, inner);
    }
    const out = new Map<string, { label: string; qty: number }[]>();
    for (const [productId, inner] of map.entries()) {
      out.set(productId, Array.from(inner.entries()).map(([label, qty]) => ({ label, qty })).sort((a, b) => b.qty - a.qty));
    }
    return out;
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

  // The sourcing list needs each product's 1688 link too. It only arrives on
  // the enriched line data, so index it once here.
  const productMeta = useMemo(() => {
    const map = new Map<string, { sourceUrl: string | null; shipOnly: boolean }>();
    for (const line of customerLines) {
      if (!map.has(line.product_id)) {
        map.set(line.product_id, { sourceUrl: line.source_url, shipOnly: line.ship_only });
      }
    }
    return map;
  }, [customerLines]);

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

  // By-customer view, built from the enriched line data rather than the raw
  // orders array, so each line already carries its photo, price paid, 1688
  // link and both "others ordered this" counts.
  //
  // Sorted oldest buyer first: whoever ordered earliest in this batch has
  // been waiting longest, so they head the list.
  const customersForList = useMemo(() => {
    const filtered = shippingFilter
      ? customerLines.filter(l => l.shipping_method === shippingFilter)
      : customerLines;

    const byCustomer = new Map<string, {
      customerId: string; name: string; firstOrderAt: string;
      orderCount: number; lines: CustomerLine[];
    }>();

    for (const line of filtered) {
      if (!line.customer_id) continue;
      const entry = byCustomer.get(line.customer_id) ?? {
        customerId: line.customer_id,
        name: line.customer_name,
        firstOrderAt: line.first_order_at,
        orderCount: line.order_count,
        lines: [],
      };
      entry.lines.push(line);
      byCustomer.set(line.customer_id, entry);
    }

    return Array.from(byCustomer.values())
      .sort((a, b) => new Date(a.firstOrderAt).getTime() - new Date(b.firstOrderAt).getTime());
  }, [customerLines, shippingFilter]);

  const [selectedCustomerForDrilldown, setSelectedCustomerForDrilldown] = useState<string | null>(null);
  const selectedCustomer = customersForList.find(c => c.customerId === selectedCustomerForDrilldown);

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

      <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 space-y-4 pb-24">
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

              <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
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
                        {(() => {
                          const variants = variantsByProduct.get(p.id) ?? [];
                          const showVariants = variants.length > 1 || (variants.length === 1 && variants[0].label !== 'No variant selected');
                          return showVariants ? (
                            <p className="text-[9px] text-gray-500 truncate">
                              {variants.map(v => `${v.label}: ${v.qty}`).join(' · ')}
                            </p>
                          ) : null;
                        })()}
                        {revenueByProduct.get(p.id) ? (
                          <p className="text-[10px] text-emerald-600 font-semibold">{fmt(revenueByProduct.get(p.id)!)} sold</p>
                        ) : null}
                      </div>
                    </a>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Straight to the supplier page for this product.
                          Disabled rather than hidden when no link is saved,
                          so gaps in the backfill are visible while sourcing. */}
                      {productMeta.get(p.id)?.sourceUrl ? (
                        <a
                          href={productMeta.get(p.id)!.sourceUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open this product on 1688"
                          className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg px-2 py-1.5"
                        >
                          <ExternalLink className="w-3 h-3" /> 1688
                        </a>
                      ) : (
                        <span
                          title="No 1688 link saved for this product yet"
                          className="flex items-center gap-1 text-[10px] font-bold text-gray-300 bg-gray-50 rounded-lg px-2 py-1.5 cursor-not-allowed"
                        >
                          <ExternalLink className="w-3 h-3" /> 1688
                        </span>
                      )}
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

            {/* ── All / Flight / Sea — clickable filters ──────────────────
                "All" is an explicit button rather than "nothing selected", so
                the current state is always visible on screen. */}
            <div className="flex gap-2">
              <button
                onClick={() => setShippingFilter(null)}
                className={`flex-1 rounded-xl p-2.5 flex items-center gap-2 border-2 transition-colors ${shippingFilter === null ? 'border-gray-900 bg-gray-100' : 'border-transparent bg-gray-50'}`}
              >
                <Layers className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-black text-gray-800 leading-none">{kpi.flight + kpi.sea_freight}</p>
                  <p className="text-[10px] text-gray-500">All</p>
                </div>
              </button>
              <button
                onClick={() => setShippingFilter('flight')}
                className={`flex-1 rounded-xl p-2.5 flex items-center gap-2 border-2 transition-colors ${shippingFilter === 'flight' ? 'border-sky-400 bg-sky-50' : 'border-transparent bg-sky-50/60'}`}
              >
                <Plane className="w-4 h-4 text-sky-500 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-black text-sky-700 leading-none">{kpi.flight}</p>
                  <p className="text-[10px] text-sky-500">Flight</p>
                </div>
              </button>
              <button
                onClick={() => setShippingFilter('sea_freight')}
                className={`flex-1 rounded-xl p-2.5 flex items-center gap-2 border-2 transition-colors ${shippingFilter === 'sea_freight' ? 'border-indigo-400 bg-indigo-50' : 'border-transparent bg-indigo-50/60'}`}
              >
                <Ship className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-black text-indigo-700 leading-none">{kpi.sea_freight}</p>
                  <p className="text-[10px] text-indigo-500">Sea</p>
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

            {selectedCustomer ? (
              <div>
                <button
                  onClick={() => setSelectedCustomerForDrilldown(null)}
                  className="text-xs text-orange-500 font-bold mb-3"
                >
                  ← Back to all customers
                </button>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{selectedCustomer.name}</p>
                    <p className="text-[10px] text-gray-400">
                      First ordered {new Date(selectedCustomer.firstOrderAt).toLocaleDateString()} · {selectedCustomer.orderCount} order{selectedCustomer.orderCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {(() => {
                    const billStatus = billStatusForCustomer(selectedCustomer.customerId);
                    return billStatus ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${billStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {activeKind === 'clearance' ? 'Clearance' : 'Consolidation'}: {billStatus}
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* Every item this customer bought. Photo, name, what they
                    paid, the 1688 link, and how much other demand exists for
                    the same product — in this batch and in the open one. */}
                <div className="space-y-2">
                  {selectedCustomer.lines.map((line, i) => (
                    <div key={`${line.order_id}-${line.product_id}-${i}`} className="bg-white rounded-2xl border border-gray-100 p-3">
                      <div className="flex gap-3">
                        {line.product_image ? (
                          <img src={line.product_image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-gray-50" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-gray-300" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-900 leading-snug">{line.product_name}</p>
                          {variantLabel(line.variant_options) && (
                            <p className="text-[10px] text-gray-500 mt-0.5">{variantLabel(line.variant_options)}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px] font-bold text-gray-900">
                              {fmt(line.unit_price_ngn * line.qty)}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {line.qty} × {fmt(line.unit_price_ngn)}
                            </span>
                            <span className="text-[10px] font-mono text-gray-300">{line.order_code}</span>
                            {line.ship_only && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-50 rounded-full px-1.5 py-0.5">
                                <Ship className="w-2.5 h-2.5" /> Sea only
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Disabled until the product has a link saved, rather
                            than hidden, so it is obvious which products still
                            need backfilling. */}
                        {line.source_url ? (
                          <a
                            href={line.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open this product on 1688"
                            className="self-start flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg px-2 py-1.5 flex-shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" /> 1688
                          </a>
                        ) : (
                          <span
                            title="No 1688 link saved for this product yet"
                            className="self-start flex items-center gap-1 text-[10px] font-bold text-gray-300 bg-gray-50 rounded-lg px-2 py-1.5 flex-shrink-0 cursor-not-allowed"
                          >
                            <ExternalLink className="w-3 h-3" /> 1688
                          </span>
                        )}
                      </div>

                      {/* Demand signal: how many others want the same thing. */}
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50 flex-wrap">
                        <Layers className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        <span className="text-[10px] text-gray-500">
                          {line.others_in_batch > 0
                            ? `${line.others_in_batch} other${line.others_in_batch !== 1 ? 's' : ''} in this batch`
                            : 'Only this customer in this batch'}
                        </span>
                        {line.customers_in_open_batch > 0 && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-[10px] font-semibold text-orange-600">
                              {line.customers_in_open_batch} in the open batch
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Per-order actions still belong to the order, not the line. */}
                {stage === 'clearance_and_closed' && (
                  <div className="mt-3 space-y-2">
                    {orders
                      .filter(o => o.user_id === selectedCustomer.customerId)
                      .map(o => (
                        <div key={o.id} className="bg-white rounded-xl border border-gray-100 p-2.5 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono text-gray-400">{o.code}</span>
                          {o.status === 'received' ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Received
                            </span>
                          ) : o.status === 'clearance_and_closed' ? (
                            <button
                              onClick={() => markReceived(o.id)}
                              disabled={markingReceived === o.id}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5"
                            >
                              {markingReceived === o.id ? <Loader className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Mark received
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 uppercase font-bold">{o.status}</span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ── By customer — the only drill-down ────────────────────
                    The old "Grouped" tab duplicated the product list already
                    shown in "At a glance" above, just with an expander. It
                    has been removed: the flat list is the sourcing view, and
                    this is the billing view. */}
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-bold text-gray-800">By customer</p>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Oldest buyer first</span>
                </div>

                <div className="space-y-1.5">
                  {customersForList.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                      <Users className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No customers match this filter.</p>
                    </div>
                  ) : customersForList.map(c => {
                    const billStatus = billStatusForCustomer(c.customerId);
                    return (
                      <button
                        key={c.customerId}
                        onClick={() => setSelectedCustomerForDrilldown(c.customerId)}
                        className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 text-left hover:border-gray-200 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(c.firstOrderAt).toLocaleDateString()} · {c.orderCount} order{c.orderCount !== 1 ? 's' : ''} · {c.lines.length} item{c.lines.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
              </>
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
