// src/pages/import-admin/ClosedBatchDetail.tsx
// Full-page view for one closed batch (not a modal — occupies the whole
// admin content area with its own back button).
//
// Every stage of the pipeline (bill, ship, clearance-bill, receive) now
// tracks status PER CUSTOMER rather than per batch. Each stage has an
// individual action (act on one customer, from their drill-down) and a
// bulk action (act on every customer still eligible for that stage, from
// the panel at the top). Both call the exact same backend function; bulk
// just omits customer_id, so it naturally skips anyone already moved
// individually — nothing ever fires twice.
//
// Pricing is "batch default with per-customer override": set a price once
// for a product and it applies to everyone who bought it, unless you
// override it for one customer specifically, from inside their card.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Loader, Users, Plane, Ship, ShieldCheck, Send, AlertTriangle,
  ChevronRight, Package, CheckCircle2, Truck, PackageCheck, ExternalLink, Layers,
  StickyNote, RotateCcw, Boxes, Pencil,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';
import { CustomerDetail } from './ImportAdminCustomers';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
// Closed-batch admin data and billing/lifecycle actions live in their own
// small function so this screen does not force a redeploy of the whole
// order/payment surface.
const BATCH_VIEW_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-batch-view`;

interface OrderItem { id: string; name: string; image_url: string; quantity: number; price_ngn?: number; variant_options?: Record<string, string>; }
interface VariantGroup { id: string; name: string; options: string[]; price_deltas?: Record<string, number>; }
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
// price paid at checkout, the admin-only 1688 link, and both "others ordered
// this" counts, so the drill-down needs no further stitching.
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
type BillKind = 'consolidation_shipping' | 'clearance';
interface Adjustment { id: string; batch_key: string; customer_id: string; kind: BillKind; label: string; amount_ngn: number; }
interface LedgerRow { customer_id: string; bill_id: string; amount_ngn: number; status: string; reminder_count: number; customer_marked_paid_at: string | null; manual_sender_name: string | null; }
interface ItemBill { id: string; product_id: string; product_name: string; unit_amount_ngn: number; kind: BillKind; audit_status: boolean; }
// Per-customer override on top of the batch default price.
interface PriceOverride { id: string; batch_key: string; customer_id: string; product_id: string; kind: BillKind; unit_amount_ngn: number; }
// Per-customer bill lock state for one kind. status 'sent' = locked & billed.
interface CustomerStatusRow { customer_id: string; status: 'draft' | 'sent' | 'cancelled'; sent_at: string | null; admin_note: string | null; }
// One row per product, quantities summed across every customer — for
// placing the actual 1688 order. No prices, no customer names.
interface SourcingRow { product_id: string; product_name: string; product_image: string | null; source_url: string | null; total_qty: number; customers_count: number; }

function fmt(n: number) { return `₦${Math.round(n).toLocaleString()}`; }

// e.g. {Color: "Pink", Size: "L"} -> "Pink, L". Empty/null means the item
// had no variant selection (single-variant or no-variant product).
function variantLabel(v: Record<string, string> | null | undefined): string {
  if (!v || Object.keys(v).length === 0) return '';
  return Object.values(v).join(', ');
}

// Inline "change this customer's variant" affordance — collapsed to a small
// "Edit variant" link by default, expands into one <select> per variant
// group. Manages its own draft/open state since each line needs its own.
function VariantEditRow({ line, groups, onSave }: {
  line: CustomerLine;
  groups: VariantGroup[];
  onSave: (newOptions: Record<string, string>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(line.variant_options ?? {});
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(line.variant_options ?? {}); setEditing(true); }}
        className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-orange-500 mt-0.5"
      >
        <Pencil className="w-2.5 h-2.5" /> Edit variant
      </button>
    );
  }

  const canSave = groups.every(g => !!draft[g.name]);

  return (
    <div className="mt-1.5 space-y-1.5 bg-gray-50 rounded-xl p-2">
      {groups.map(g => (
        <div key={g.id} className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 w-14 flex-shrink-0 truncate">{g.name}</span>
          <select
            value={draft[g.name] ?? ''}
            onChange={e => setDraft(prev => ({ ...prev, [g.name]: e.target.value }))}
            className="text-[10px] border border-gray-200 rounded-lg px-1.5 py-1 flex-1 bg-white"
          >
            <option value="">Select…</option>
            {g.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ))}
      <div className="flex gap-1.5 pt-0.5">
        <button
          disabled={!canSave || saving}
          onClick={async () => { setSaving(true); await onSave(draft); setSaving(false); setEditing(false); }}
          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gray-900 text-white disabled:opacity-40 flex items-center gap-1"
        >
          {saving && <Loader className="w-2.5 h-2.5 animate-spin" />} Save
        </button>
        <button onClick={() => setEditing(false)} className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500">
          Cancel
        </button>
      </div>
    </div>
  );
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

const STAGE_ORDER = ['pending', 'confirmed', 'ordered', 'ordered_and_closed', 'shipped_and_closed', 'clearance_and_closed', 'received'] as const;
type OrderStage = typeof STAGE_ORDER[number];
function stageRank(status: string | undefined | null): number {
  const i = STAGE_ORDER.indexOf((status ?? 'ordered') as OrderStage);
  return i === -1 ? 0 : i;
}

type Tab = 'pricing' | 'sourcing' | 'customers';

const emptyByKind = <T,>(): Record<BillKind, T[]> => ({ consolidation_shipping: [], clearance: [] });

export default function ClosedBatchDetail({
  token, batchKey, orders, onClose, onOpenProduct, onReload,
}: {
  token: string; batchKey: string; orders: OrderRow[]; onClose: () => void;
  onOpenProduct?: (productId: string) => void; onReload?: () => void;
}) {
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [customerLines, setCustomerLines] = useState<CustomerLine[]>([]);
  const [adjustmentsByKind, setAdjustmentsByKind] = useState<Record<BillKind, Adjustment[]>>(emptyByKind());
  const [ledgerByKind, setLedgerByKind] = useState<Record<BillKind, LedgerRow[]>>(emptyByKind());
  const [statusByKind, setStatusByKind] = useState<Record<BillKind, CustomerStatusRow[]>>(emptyByKind());
  const [overridesByKind, setOverridesByKind] = useState<Record<BillKind, PriceOverride[]>>(emptyByKind());
  const [sourcingRows, setSourcingRows] = useState<SourcingRow[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid' | 'awaiting'>('all');
  const [adjLabel, setAdjLabel] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);
  const [kpi, setKpi] = useState({ flight: 0, sea_freight: 0 });
  const [itemBills, setItemBills] = useState<ItemBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [customerPriceDrafts, setCustomerPriceDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [shippingFilter, setShippingFilter] = useState<'flight' | 'sea_freight' | null>(null);
  const [shippingMethodFinal, setShippingMethodFinal] = useState<'flight' | 'sea_freight'>('flight');
  const [tab, setTab] = useState<Tab>('customers');
  const [billKind, setBillKind] = useState<BillKind>('consolidation_shipping');
  const [bulkConfirm, setBulkConfirm] = useState<null | 'bill' | 'ship' | 'clearance_bill' | 'receive'>(null);
  const [isActing, setIsActing] = useState(false);
  const [individualActing, setIndividualActing] = useState<string | null>(null);
  const [selectedCustomerForDrilldown, setSelectedCustomerForDrilldown] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [breakdownRes, itemBillsRes, consolRes, clearRes, sourcingRes] = await Promise.all([
        call('admin-batch-breakdown', { manager_token: token, batch_key: batchKey }),
        call('admin-batch-item-bills', { manager_token: token, batch_key: batchKey }),
        batchViewCall('customer-breakdown', { manager_token: token, batch_key: batchKey, kind: 'consolidation_shipping' }),
        batchViewCall('customer-breakdown', { manager_token: token, batch_key: batchKey, kind: 'clearance' }),
        batchViewCall('sourcing-totals', { manager_token: token, batch_key: batchKey }),
      ]);
      // `rows` (the line items) don't depend on kind — either response has them.
      setCustomerLines(consolRes.rows ?? []);
      setAdjustmentsByKind({ consolidation_shipping: consolRes.adjustments ?? [], clearance: clearRes.adjustments ?? [] });
      setLedgerByKind({ consolidation_shipping: consolRes.ledger ?? [], clearance: clearRes.ledger ?? [] });
      setStatusByKind({ consolidation_shipping: consolRes.customer_status ?? [], clearance: clearRes.customer_status ?? [] });
      setOverridesByKind({ consolidation_shipping: consolRes.price_overrides ?? [], clearance: clearRes.price_overrides ?? [] });
      setBreakdown(breakdownRes.rows ?? []);
      setKpi(breakdownRes.shipping_kpi ?? { flight: 0, sea_freight: 0 });
      setItemBills(itemBillsRes.items ?? []);
      setSourcingRows(sourcingRes.rows ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token, batchKey]);

  useEffect(() => { load(); }, [load]);

  // Variant group definitions per product, for the variant-edit UI below.
  // Fetched once (not per-batch) since it's the full catalog, not batch-scoped.
  const [productVariants, setProductVariants] = useState<Record<string, VariantGroup[]>>({});
  useEffect(() => {
    call('admin-products', { manager_token: token }).then(res => {
      const map: Record<string, VariantGroup[]> = {};
      for (const p of (res.products ?? [])) {
        if (p.has_variants && Array.isArray(p.variants) && p.variants.length > 0) map[p.id] = p.variants;
      }
      setProductVariants(map);
    }).catch(() => {});
  }, [token]);

  const orderShippingMethod = useMemo(() => {
    const map = new Map<string, 'flight' | 'sea_freight' | null>();
    for (const o of orders) map.set(o.id, o.shipping_method ?? null);
    return map;
  }, [orders]);

  const filteredBreakdown = useMemo(() => {
    if (!shippingFilter) return breakdown;
    return breakdown.filter(r => orderShippingMethod.get(r.order_id) === shippingFilter);
  }, [breakdown, shippingFilter, orderShippingMethod]);

  // Products for the Pricing tab, sorted oldest-order-first.
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

  // Actual sales revenue per product — what customers paid at checkout, not
  // the consolidation/clearance fee. Independent of billing stage.
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

  // ── Batch default price (per product, applies to everyone unless
  //    overridden for a specific customer). Deliberately never locked —
  //    a sent bill is already a frozen snapshot, so editing the default
  //    afterward only affects not-yet-billed customers going forward.
  const priceFor = (productId: string, kind: BillKind) => {
    const draft = priceDrafts[`${productId}:${kind}`];
    if (draft !== undefined) return draft;
    const saved = itemBills.find(b => b.product_id === productId && b.kind === kind);
    return saved ? String(saved.unit_amount_ngn) : '';
  };

  const savePrice = async (productId: string, productName: string, value: string, kind: BillKind) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    const result = await call('admin-batch-set-item-price', {
      manager_token: token, batch_key: batchKey, product_id: productId, product_name: productName,
      unit_amount_ngn: amount, kind,
    });
    if (result.error) { toast.error(result.error); return; }
    await load();
  };

  const expectedTotalNgn = useMemo(() => {
    const priceMap = new Map(itemBills.filter(b => b.kind === billKind).map(b => [b.product_id, b.unit_amount_ngn]));
    for (const [key, value] of Object.entries(priceDrafts)) {
      const [productId, kind] = key.split(':');
      if (kind === billKind && value !== '') priceMap.set(productId, Number(value));
    }
    let total = 0;
    for (const row of breakdown) {
      const price = priceMap.get(row.product_id);
      if (price != null) total += price * row.qty;
    }
    return total;
  }, [breakdown, itemBills, priceDrafts, billKind]);

  // ── Per-customer override on top of the batch default ───────────────────
  const overrideMapByKind = useMemo(() => {
    const out: Record<BillKind, Map<string, number>> = { consolidation_shipping: new Map(), clearance: new Map() };
    (['consolidation_shipping', 'clearance'] as BillKind[]).forEach(k => {
      for (const o of overridesByKind[k]) out[k].set(`${o.customer_id}:${o.product_id}`, o.unit_amount_ngn);
    });
    return out;
  }, [overridesByKind]);

  const defaultPriceMapByKind = useMemo(() => {
    const out: Record<BillKind, Map<string, number>> = { consolidation_shipping: new Map(), clearance: new Map() };
    for (const b of itemBills) out[b.kind]?.set(b.product_id, b.unit_amount_ngn);
    return out;
  }, [itemBills]);

  const customerPriceFor = (customerId: string, productId: string, kind: BillKind): string => {
    const draft = customerPriceDrafts[`${customerId}:${productId}:${kind}`];
    if (draft !== undefined) return draft;
    const override = overrideMapByKind[kind].get(`${customerId}:${productId}`);
    if (override != null) return String(override);
    const def = defaultPriceMapByKind[kind].get(productId);
    return def != null ? String(def) : '';
  };
  const isOverridden = (customerId: string, productId: string, kind: BillKind) =>
    overrideMapByKind[kind].has(`${customerId}:${productId}`);

  const saveCustomerPrice = async (customerId: string, productId: string, productName: string, value: string, kind: BillKind) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    const result = await batchViewCall('set-customer-price', {
      manager_token: token, batch_key: batchKey, kind,
      customer_id: customerId, product_id: productId, product_name: productName, unit_amount_ngn: amount,
    });
    if (result.error) { toast.error(result.error); return; }
    await load();
  };

  const revertCustomerPrice = async (customerId: string, productId: string, kind: BillKind) => {
    const result = await batchViewCall('delete-customer-price', {
      manager_token: token, batch_key: batchKey, kind, customer_id: customerId, product_id: productId,
    });
    if (result.error) { toast.error(result.error); return; }
    setCustomerPriceDrafts(prev => { const n = { ...prev }; delete n[`${customerId}:${productId}:${kind}`]; return n; });
    await load();
  };

  // Per-item variant override. Unlike shipping (patched locally), a variant
  // change can also change price_ngn/subtotal/total, so the simplest correct
  // thing is to just reload the batch data rather than try to reconcile
  // totals client-side.
  const setItemVariant = async (line: CustomerLine, newVariantOptions: Record<string, string>) => {
    const result = await call('admin-set-item-variant', {
      manager_token: token, order_id: line.order_id, product_id: line.product_id,
      old_variant_options: line.variant_options, new_variant_options: newVariantOptions,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success('Variant updated — customer notified');
    await load();
  };


  // bill is locked (enforced server-side too; the toggle is simply hidden
  // client-side once billed, see CustomerCard). Notifies the customer by email.
  const setItemShipping = async (line: CustomerLine, method: 'flight' | 'sea_freight') => {
    const result = await call('admin-set-item-shipping-method', {
      manager_token: token, order_id: line.order_id, product_id: line.product_id,
      variant_options: line.variant_options, new_method: method,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success(`Shipping updated to ${method === 'flight' ? 'air' : 'sea'} — customer notified`);
    setCustomerLines(prev => prev.map(l =>
      l.order_id === line.order_id && l.product_id === line.product_id && JSON.stringify(l.variant_options) === JSON.stringify(line.variant_options)
        ? { ...l, shipping_method: method } : l
    ));
  };

  // ── Per-customer stage, from the ground truth ────────────────────────────
  // Bill state comes from statusByKind, not order.status: cancelling a bill
  // resets the lock but doesn't roll order.status back, so order.status
  // alone can't be trusted for "is this customer billed".
  const customerOrders = useCallback((customerId: string) => orders.filter(o => o.user_id === customerId), [orders]);
  const allOrdersAtLeast = useCallback((customerId: string, target: OrderStage) => {
    const list = customerOrders(customerId);
    if (list.length === 0) return false;
    return list.every(o => stageRank(o.status) >= stageRank(target));
  }, [customerOrders]);

  const isBilled = (customerId: string, kind: BillKind) => statusByKind[kind].find(s => s.customer_id === customerId)?.status === 'sent';
  const statusRow = (customerId: string, kind: BillKind) => statusByKind[kind].find(s => s.customer_id === customerId);
  const ledgerRow = (customerId: string, kind: BillKind) => ledgerByKind[kind].find(l => l.customer_id === customerId);
  const isShippedC = (customerId: string) => allOrdersAtLeast(customerId, 'shipped_and_closed');
  const isReceivedC = (customerId: string) => allOrdersAtLeast(customerId, 'received');

  const adjustmentsByCustomer = useCallback((customerId: string, kind: BillKind) =>
    adjustmentsByKind[kind].filter(a => a.customer_id === customerId), [adjustmentsByKind]);

  const customerBillTotal = useCallback((customerId: string, lines: CustomerLine[], kind: BillKind) => {
    let total = 0;
    for (const line of lines) {
      const priceStr = customerPriceFor(customerId, line.product_id, kind);
      if (priceStr !== '') total += Number(priceStr) * line.qty;
    }
    for (const a of adjustmentsByCustomer(customerId, kind)) total += Number(a.amount_ngn);
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPriceDrafts, overrideMapByKind, defaultPriceMapByKind, adjustmentsByCustomer]);

  const addAdjustment = async (customerId: string) => {
    const amount = Number(adjAmount);
    if (!adjLabel.trim() || !Number.isFinite(amount) || amount === 0) {
      toast.error('Enter a label and a non-zero amount. Use a negative number for a discount.');
      return;
    }
    setSavingAdj(true);
    try {
      const result = await batchViewCall('add-adjustment', {
        manager_token: token, batch_key: batchKey, kind: billKind,
        customer_id: customerId, label: adjLabel.trim(), amount_ngn: amount,
      });
      if (result.error) { toast.error(result.error); return; }
      setAdjLabel(''); setAdjAmount('');
      await load();
    } finally {
      setSavingAdj(false);
    }
  };

  const removeAdjustment = async (id: string) => {
    const result = await batchViewCall('delete-adjustment', { manager_token: token, id });
    if (result.error) { toast.error(result.error); return; }
    await load();
  };

  const saveNote = async (customerId: string, kind: BillKind, note: string) => {
    const result = await batchViewCall('set-admin-note', {
      manager_token: token, batch_key: batchKey, kind, customer_id: customerId, admin_note: note,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success('Note saved.');
    await load();
  };

  // ── Bulk actions: every eligible customer at once ────────────────────────
  const runBulk = async (type: 'bill' | 'ship' | 'clearance_bill' | 'receive') => {
    setIsActing(true);
    try {
      if (type === 'bill' || type === 'clearance_bill') {
        const kind: BillKind = type === 'clearance_bill' ? 'clearance' : 'consolidation_shipping';
        const result = await batchViewCall('close-billing', { manager_token: token, batch_key: batchKey, kind });
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Billed ${result.customers_billed} customer${result.customers_billed !== 1 ? 's' : ''}${kind === 'clearance' ? ' for clearance' : ''}.`);
        if (result.skipped?.length) {
          toast.warning(`${result.skipped.length} skipped — adjustments cancelled out their total: ${result.skipped.map((x: { name: string }) => x.name).join(', ')}`);
        }
      } else if (type === 'ship') {
        const result = await batchViewCall('ship', { manager_token: token, batch_key: batchKey, shipping_method_final: shippingMethodFinal });
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Shipped ${result.shipped_count} customer${result.shipped_count !== 1 ? 's' : ''} — ${result.paid_notified} paid, ${result.held_unpaid_notified} held unpaid.`);
      } else if (type === 'receive') {
        const result = await batchViewCall('mark-received', { manager_token: token, batch_key: batchKey });
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Marked ${result.received_count} customer${result.received_count !== 1 ? 's' : ''} received.`);
      }
      setBulkConfirm(null);
      await load();
      onReload?.();
    } finally {
      setIsActing(false);
    }
  };

  // ── Individual actions: one customer, from their card ────────────────────
  const runIndividual = async (type: 'bill' | 'clearance_bill' | 'ship' | 'receive' | 'cancel', customerId: string, kind?: BillKind) => {
    const key = `${type}:${customerId}`;
    setIndividualActing(key);
    try {
      if (type === 'bill' || type === 'clearance_bill') {
        const billKindArg: BillKind = type === 'clearance_bill' ? 'clearance' : 'consolidation_shipping';
        const result = await batchViewCall('close-billing', { manager_token: token, batch_key: batchKey, kind: billKindArg, customer_id: customerId });
        if (result.error) { toast.error(result.error); return; }
        toast.success('Billed and notified.');
      } else if (type === 'ship') {
        const result = await batchViewCall('ship', { manager_token: token, batch_key: batchKey, customer_id: customerId, shipping_method_final: shippingMethodFinal });
        if (result.error) { toast.error(result.error); return; }
        toast.success('Marked shipped.');
      } else if (type === 'receive') {
        const result = await batchViewCall('mark-received', { manager_token: token, batch_key: batchKey, customer_id: customerId });
        if (result.error) { toast.error(result.error); return; }
        toast.success('Marked received.');
      } else if (type === 'cancel' && kind) {
        const result = await batchViewCall('cancel-bill', { manager_token: token, batch_key: batchKey, kind, customer_id: customerId });
        if (result.error) { toast.error(result.error); return; }
        toast.success('Bill cancelled — pricing unlocked again for this customer.');
      }
      await load();
      onReload?.();
    } finally {
      setIndividualActing(null);
    }
  };

  // By-customer list, built from the enriched line data. Sorted oldest
  // buyer first: whoever ordered earliest in this batch has been waiting
  // longest, so they head the list.
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

  const hasPricedLine = (customerId: string, kind: BillKind, lines: CustomerLine[]) =>
    lines.some(l => customerPriceFor(customerId, l.product_id, kind) !== '');

  // Live counts for the bulk-action panel. Best-effort on the client —
  // the server re-validates on the actual call either way.
  const counts = useMemo(() => {
    let billedC = 0, eligibleC = 0, shippedN = 0, eligibleShip = 0, billedClr = 0, eligibleClr = 0, receivedN = 0, eligibleRecv = 0;
    for (const c of customersForList) {
      const id = c.customerId;
      const consolBilled = isBilled(id, 'consolidation_shipping');
      if (consolBilled) billedC++; else if (hasPricedLine(id, 'consolidation_shipping', c.lines)) eligibleC++;

      const shipped = isShippedC(id);
      if (shipped) shippedN++; else if (consolBilled) eligibleShip++;

      const clrBilled = isBilled(id, 'clearance');
      if (clrBilled) billedClr++; else if (shipped && hasPricedLine(id, 'clearance', c.lines)) eligibleClr++;

      const received = isReceivedC(id);
      if (received) receivedN++; else if (clrBilled && ledgerRow(id, 'clearance')?.status === 'paid') eligibleRecv++;
    }
    return { total: customersForList.length, billedC, eligibleC, shippedN, eligibleShip, billedClr, eligibleClr, receivedN, eligibleRecv };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customersForList, statusByKind, ledgerByKind, customerPriceDrafts, overrideMapByKind, defaultPriceMapByKind]);

  // Who has paid and who has not, for the active kind's ledger.
  const ledgerByCustomerActive = useMemo(
    () => new Map(ledgerByKind[billKind].map(l => [l.customer_id, l])),
    [ledgerByKind, billKind]
  );

  const visibleCustomers = useMemo(() => {
    if (paymentFilter === 'all') return customersForList;
    return customersForList.filter(c => {
      const status = ledgerByCustomerActive.get(c.customerId)?.status;
      if (paymentFilter === 'paid') return status === 'paid';
      if (paymentFilter === 'awaiting') return status === 'awaiting_confirmation';
      return status !== 'paid' && status !== 'awaiting_confirmation';
    });
  }, [customersForList, paymentFilter, ledgerByCustomerActive]);

  const ledgerTotals = useMemo(() => {
    let paid = 0, awaiting = 0, unpaid = 0, outstanding = 0;
    for (const c of customersForList) {
      const row = ledgerByCustomerActive.get(c.customerId);
      if (row?.status === 'paid') paid++;
      else if (row?.status === 'awaiting_confirmation') { awaiting++; outstanding += Number(row.amount_ngn ?? 0); }
      else { unpaid++; outstanding += Number(row?.amount_ngn ?? 0); }
    }
    return { paid, awaiting, unpaid, outstanding };
  }, [customersForList, ledgerByCustomerActive]);

  const selectedCustomer = customersForList.find(c => c.customerId === selectedCustomerForDrilldown);

  const BULK_META: Record<'bill' | 'ship' | 'clearance_bill' | 'receive', { label: string; icon: typeof Send; done: number; eligible: number; body: string }> = {
    bill: { label: 'Bill (consolidation & shipping)', icon: Send, done: counts.billedC, eligible: counts.eligibleC, body: `${counts.eligibleC} priced customer${counts.eligibleC !== 1 ? 's' : ''} not yet billed will be billed and notified.` },
    ship: { label: 'Ship', icon: Truck, done: counts.shippedN, eligible: counts.eligibleShip, body: `${counts.eligibleShip} billed customer${counts.eligibleShip !== 1 ? 's' : ''} will move to shipped & closed. Paid customers are notified as shipped; unpaid customers get a held notice.` },
    clearance_bill: { label: 'Bill (clearance)', icon: Send, done: counts.billedClr, eligible: counts.eligibleClr, body: `${counts.eligibleClr} shipped, priced customer${counts.eligibleClr !== 1 ? 's' : ''} will be billed for clearance and notified.` },
    receive: { label: 'Mark received', icon: CheckCircle2, done: counts.receivedN, eligible: counts.eligibleRecv, body: `${counts.eligibleRecv} customer${counts.eligibleRecv !== 1 ? 's' : ''} with a paid clearance bill will be marked received.` },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-sm">Batch — {new Date(batchKey).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</h2>
          <p className="text-[11px] text-gray-400">
            {counts.total} customer{counts.total !== 1 ? 's' : ''} · {counts.billedC} billed · {counts.shippedN} shipped · {counts.billedClr} clearance billed · {counts.receivedN} received
          </p>
        </div>
      </div>

      <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 space-y-4 pb-24">
        {isLoading ? (
          <div className="py-16 text-center"><Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
        ) : (
          <>
            {/* ── All / Flight / Sea — clickable filters ────────────────── */}
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

            {/* ── Bulk actions: every stage, always visible ───────────────
                Bulk is the same underlying action as the individual one on a
                customer's card — it just applies to everyone still eligible,
                so it's always safe to run regardless of what's already been
                done individually. */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2.5">Batch actions</p>
              <div className="space-y-1.5">
                {(['bill', 'ship', 'clearance_bill', 'receive'] as const).map(type => {
                  const meta = BULK_META[type];
                  const Icon = meta.icon;
                  return (
                    <div key={type} className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{meta.label}</p>
                          <p className="text-[10px] text-gray-400">{meta.done}/{counts.total} done</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setBulkConfirm(type)}
                        disabled={meta.eligible === 0}
                        className="px-3 py-1.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded-lg flex-shrink-0"
                      >
                        {meta.eligible > 0 ? `Do all ${meta.eligible}` : 'None eligible'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShippingMethodFinal('flight')}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 ${shippingMethodFinal === 'flight' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  <Plane className="w-3 h-3" /> Ship by air
                </button>
                <button
                  onClick={() => setShippingMethodFinal('sea_freight')}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 ${shippingMethodFinal === 'sea_freight' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  <Ship className="w-3 h-3" /> Ship by sea
                </button>
              </div>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <div className="flex gap-1.5">
              {([
                ['customers', 'By customer'],
                ['pricing', 'Pricing'],
                ['sourcing', 'Sourcing'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${tab === value ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'pricing' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-800">Batch default pricing</p>
                  <div className="flex gap-1">
                    {(['consolidation_shipping', 'clearance'] as BillKind[]).map(k => (
                      <button
                        key={k}
                        onClick={() => setBillKind(k)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${billKind === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {k === 'clearance' ? 'Clearance' : 'Consolidation'}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mb-3">
                  Sets the price everyone pays for a product, unless overridden for one customer from their card. Always editable — a sent bill is already a locked snapshot, so this only affects who hasn't been billed yet.
                </p>

                {totalBatchRevenue > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-3 mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-emerald-600">Actually selling right now</p>
                    <p className="text-sm font-black text-emerald-700">{fmt(totalBatchRevenue)}</p>
                  </div>
                )}

                <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-2.5">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                        {p.image ? (
                          <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-gray-400">{p.totalQty} units</p>
                          {revenueByProduct.get(p.id) ? (
                            <p className="text-[10px] text-emerald-600 font-semibold">{fmt(revenueByProduct.get(p.id)!)} sold</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs text-gray-400">₦</span>
                        <input
                          type="number" inputMode="decimal"
                          value={priceFor(p.id, billKind)}
                          onChange={e => setPriceDrafts(prev => ({ ...prev, [`${p.id}:${billKind}`]: e.target.value }))}
                          onBlur={e => e.target.value && savePrice(p.id, p.name, e.target.value, billKind)}
                          placeholder="per unit"
                          className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {expectedTotalNgn > 0 && (
                  <div className="mt-3 bg-orange-50 rounded-xl p-3 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-orange-600">Expected total, if everyone pays the default</p>
                    <p className="text-sm font-black text-orange-700">{fmt(expectedTotalNgn)}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'sourcing' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-800">Sourcing</p>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">For placing the 1688 order</span>
                </div>
                <p className="text-[10px] text-gray-400 mb-3">
                  One row per product, quantities totalled across every customer — no prices, no names. The per-customer billing view repeats a product once per buyer; this doesn't.
                </p>
                {sourcingRows.length === 0 ? (
                  <div className="py-8 text-center">
                    <Boxes className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No items in this batch yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                    {sourcingRows.map(r => (
                      <div key={r.product_id} className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-2.5">
                        {r.product_image ? (
                          <img src={r.product_image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-800 truncate">{r.product_name}</p>
                          <p className="text-[10px] text-orange-500 font-bold">{r.total_qty} units · {r.customers_count} customer{r.customers_count !== 1 ? 's' : ''}</p>
                        </div>
                        {r.source_url ? (
                          <a
                            href={r.source_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg px-2 py-1.5 flex-shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" /> 1688
                          </a>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-gray-300 bg-gray-50 rounded-lg px-2 py-1.5 flex-shrink-0 cursor-not-allowed">
                            <ExternalLink className="w-3 h-3" /> 1688
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'customers' && (
              selectedCustomer ? (
                <CustomerCard
                  customer={selectedCustomer}
                  billKind={billKind}
                  setBillKind={setBillKind}
                  onBack={() => setSelectedCustomerForDrilldown(null)}
                  customerPriceFor={customerPriceFor}
                  isOverridden={isOverridden}
                  setCustomerPriceDrafts={setCustomerPriceDrafts}
                  saveCustomerPrice={saveCustomerPrice}
                  revertCustomerPrice={revertCustomerPrice}
                  customerBillTotal={customerBillTotal}
                  adjustments={adjustmentsByCustomer(selectedCustomer.customerId, billKind)}
                  adjLabel={adjLabel} setAdjLabel={setAdjLabel}
                  adjAmount={adjAmount} setAdjAmount={setAdjAmount}
                  savingAdj={savingAdj}
                  addAdjustment={addAdjustment}
                  removeAdjustment={removeAdjustment}
                  isBilled={isBilled}
                  statusRow={statusRow}
                  ledgerRow={ledgerRow}
                  isShippedC={isShippedC}
                  isReceivedC={isReceivedC}
                  noteDrafts={noteDrafts} setNoteDrafts={setNoteDrafts}
                  saveNote={saveNote}
                  runIndividual={runIndividual}
                  individualActing={individualActing}
                  onSetItemShipping={setItemShipping}
                  productVariants={productVariants}
                  onSetItemVariant={setItemVariant}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-gray-800">By customer</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Oldest buyer first</span>
                      <div className="flex gap-1">
                        {(['consolidation_shipping', 'clearance'] as BillKind[]).map(k => (
                          <button
                            key={k}
                            onClick={() => setBillKind(k)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${billKind === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                          >
                            {k === 'clearance' ? 'Clearance' : 'Consolidation'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {ledgerByKind[billKind].length > 0 && (
                    <div className="mb-2">
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {([
                          ['all', `All ${customersForList.length}`],
                          ['unpaid', `Unpaid ${ledgerTotals.unpaid}`],
                          ['awaiting', `Awaiting ${ledgerTotals.awaiting}`],
                          ['paid', `Paid ${ledgerTotals.paid}`],
                        ] as const).map(([value, label]) => (
                          <button
                            key={value}
                            onClick={() => setPaymentFilter(value)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${paymentFilter === value ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {ledgerTotals.outstanding > 0 && (
                        <p className="text-[11px] text-amber-600 font-semibold mt-1">
                          {fmt(ledgerTotals.outstanding)} still outstanding
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {visibleCustomers.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                        <Users className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">No customers match this filter.</p>
                      </div>
                    ) : visibleCustomers.map(c => {
                      const billed = isBilled(c.customerId, billKind);
                      const shipped = isShippedC(c.customerId);
                      const received = isReceivedC(c.customerId);
                      const ledger = ledgerRow(c.customerId, billKind);
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
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {received && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Received</span>}
                            {!received && shipped && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Shipped</span>}
                            {!shipped && billed && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">Billed</span>}
                            {ledger && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ledger.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {ledger.status}
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )
            )}
          </>
        )}
      </div>

      {bulkConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => !isActing && setBulkConfirm(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1.5">{BULK_META[bulkConfirm].label} — all eligible customers?</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{BULK_META[bulkConfirm].body}</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkConfirm(null)} disabled={isActing} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-600 border border-gray-200">
                Cancel
              </button>
              <button onClick={() => runBulk(bulkConfirm)} disabled={isActing} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gray-900 flex items-center justify-center gap-1.5">
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

// ── One customer's card: line items with editable per-customer pricing,
//    internal note, and this-customer-only actions for whichever stage
//    they're at. ──────────────────────────────────────────────────────────
function CustomerCard({
  customer, billKind, setBillKind, onBack,
  customerPriceFor, isOverridden, setCustomerPriceDrafts,
  saveCustomerPrice, revertCustomerPrice, customerBillTotal,
  adjustments, adjLabel, setAdjLabel, adjAmount, setAdjAmount, savingAdj, addAdjustment, removeAdjustment,
  isBilled, statusRow, ledgerRow, isShippedC, isReceivedC,
  noteDrafts, setNoteDrafts, saveNote, runIndividual, individualActing,
  onSetItemShipping, productVariants, onSetItemVariant,
}: {
  customer: { customerId: string; name: string; firstOrderAt: string; orderCount: number; lines: CustomerLine[] };
  billKind: BillKind; setBillKind: (k: BillKind) => void; onBack: () => void;
  customerPriceFor: (customerId: string, productId: string, kind: BillKind) => string;
  isOverridden: (customerId: string, productId: string, kind: BillKind) => boolean;
  setCustomerPriceDrafts: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  saveCustomerPrice: (customerId: string, productId: string, productName: string, value: string, kind: BillKind) => Promise<void>;
  revertCustomerPrice: (customerId: string, productId: string, kind: BillKind) => Promise<void>;
  customerBillTotal: (customerId: string, lines: CustomerLine[], kind: BillKind) => number;
  adjustments: Adjustment[];
  adjLabel: string; setAdjLabel: (v: string) => void;
  adjAmount: string; setAdjAmount: (v: string) => void;
  savingAdj: boolean; addAdjustment: (customerId: string) => Promise<void>; removeAdjustment: (id: string) => Promise<void>;
  isBilled: (customerId: string, kind: BillKind) => boolean;
  statusRow: (customerId: string, kind: BillKind) => CustomerStatusRow | undefined;
  ledgerRow: (customerId: string, kind: BillKind) => LedgerRow | undefined;
  isShippedC: (customerId: string) => boolean; isReceivedC: (customerId: string) => boolean;
  noteDrafts: Record<string, string>; setNoteDrafts: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  saveNote: (customerId: string, kind: BillKind, note: string) => Promise<void>;
  runIndividual: (type: 'bill' | 'clearance_bill' | 'ship' | 'receive' | 'cancel', customerId: string, kind?: BillKind) => Promise<void>;
  individualActing: string | null;
  onSetItemShipping: (line: CustomerLine, method: 'flight' | 'sea_freight') => Promise<void>;
  productVariants: Record<string, VariantGroup[]>;
  onSetItemVariant: (line: CustomerLine, newVariantOptions: Record<string, string>) => Promise<void>;
}) {
  const id = customer.customerId;
  const billed = isBilled(id, billKind);
  const shipped = isShippedC(id);
  const received = isReceivedC(id);
  const status = statusRow(id, billKind);
  const ledger = ledgerRow(id, billKind);
  const noteKey = `${id}:${billKind}`;
  const noteValue = noteDrafts[noteKey] !== undefined ? noteDrafts[noteKey] : (status?.admin_note ?? '');
  const total = customerBillTotal(id, customer.lines, billKind);
  const canBill = customer.lines.some(l => customerPriceFor(id, l.product_id, billKind) !== '');
  const acting = (type: string) => individualActing === `${type}:${id}`;

  return (
    <div>
      <button onClick={onBack} className="text-xs text-orange-500 font-bold mb-3">← Back to all customers</button>

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{customer.name}</p>
          <p className="text-[10px] text-gray-400">
            First ordered {new Date(customer.firstOrderAt).toLocaleDateString()} · {customer.orderCount} order{customer.orderCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-1">
          {(['consolidation_shipping', 'clearance'] as BillKind[]).map(k => (
            <button
              key={k}
              onClick={() => setBillKind(k)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 ${billKind === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {k === 'clearance' ? 'Clearance' : 'Consolidation'}
            </button>
          ))}
        </div>
      </div>

      {/* Overall pipeline position for this customer, independent of kind. */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {received ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Received</span>
        ) : shipped ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Shipped</span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not shipped yet</span>
        )}
        {billed && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {billKind === 'clearance' ? 'Clearance' : 'Consolidation'} billed
          </span>
        )}
        {ledger && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ledger.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            {ledger.status}
          </span>
        )}
      </div>

      {/* Line items — price editable per customer, defaults from the batch,
          overridable here. */}
      <div className="space-y-2">
        {customer.lines.map((line, i) => {
          const priceStr = customerPriceFor(id, line.product_id, billKind);
          const overridden = isOverridden(id, line.product_id, billKind);
          return (
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
                  {/* Variant change — only for products that have variants defined,
                      and only before the batch is billed (some customers ask for a
                      size/color swap after paying). */}
                  {productVariants[line.product_id] && !isBilled(id, 'consolidation_shipping') && (
                    <VariantEditRow
                      line={line}
                      groups={productVariants[line.product_id]}
                      onSave={(newOptions) => onSetItemVariant(line, newOptions)}
                    />
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-gray-400">{line.qty} × sold {fmt(line.unit_price_ngn)}</span>
                    <span className="text-[10px] font-mono text-gray-300">{line.order_code}</span>
                    {line.ship_only && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-50 rounded-full px-1.5 py-0.5">
                        <Ship className="w-2.5 h-2.5" /> Sea only
                      </span>
                    )}
                  </div>
                  {/* Shipping method for this item — visible always, editable only before
                      the consolidation_shipping bill is locked (isBilled checks that kind
                      specifically, independent of whichever bill tab is currently open). */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-gray-400">Shipping:</span>
                    {isBilled(id, 'consolidation_shipping') || line.ship_only ? (
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${line.shipping_method === 'flight' ? 'bg-sky-50 text-sky-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {line.shipping_method === 'flight' ? <Plane className="w-2.5 h-2.5" /> : <Ship className="w-2.5 h-2.5" />}
                        {line.shipping_method === 'flight' ? 'Air' : 'Sea'}
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => onSetItemShipping(line, 'flight')}
                          className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${line.shipping_method === 'flight' ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-white text-gray-400 border-gray-200'}`}
                        >
                          <Plane className="w-2.5 h-2.5" /> Air
                        </button>
                        <button
                          onClick={() => onSetItemShipping(line, 'sea_freight')}
                          className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${line.shipping_method === 'sea_freight' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-400 border-gray-200'}`}
                        >
                          <Ship className="w-2.5 h-2.5" /> Sea
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-400">Bill price ₦</span>
                    <input
                      type="number" inputMode="decimal"
                      value={priceStr}
                      disabled={billed}
                      onChange={e => setCustomerPriceDrafts(prev => ({ ...prev, [`${id}:${line.product_id}:${billKind}`]: e.target.value }))}
                      onBlur={e => e.target.value && saveCustomerPrice(id, line.product_id, line.product_name, e.target.value, billKind)}
                      placeholder="default"
                      className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-[11px] text-right disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    {overridden && !billed && (
                      <button onClick={() => revertCustomerPrice(id, line.product_id, billKind)} title="Revert to batch default" className="text-gray-300 hover:text-gray-500">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    {overridden && <span className="text-[9px] font-bold text-orange-500">override</span>}
                  </div>
                </div>
                {line.source_url ? (
                  <a href={line.source_url} target="_blank" rel="noopener noreferrer" title="Open this product on 1688"
                     className="self-start flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg px-2 py-1.5 flex-shrink-0">
                    <ExternalLink className="w-3 h-3" /> 1688
                  </a>
                ) : (
                  <span className="self-start flex items-center gap-1 text-[10px] font-bold text-gray-300 bg-gray-50 rounded-lg px-2 py-1.5 flex-shrink-0 cursor-not-allowed">
                    <ExternalLink className="w-3 h-3" /> 1688
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-50 flex-wrap">
                <Layers className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <span className="text-[10px] text-gray-500">
                  {line.others_in_batch > 0 ? `${line.others_in_batch} other${line.others_in_batch !== 1 ? 's' : ''} in this batch` : 'Only this customer in this batch'}
                </span>
                {line.customers_in_open_batch > 0 && (
                  <>
                    <span className="text-gray-200">·</span>
                    <span className="text-[10px] font-semibold text-orange-600">{line.customers_in_open_batch} in the open batch</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bill total + adjustments */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-800">{billKind === 'clearance' ? 'Clearance bill' : 'Consolidation & shipping bill'}</p>
          <p className="text-sm font-black text-gray-900">{fmt(total)}</p>
        </div>

        {adjustments.map(a => (
          <div key={a.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 mb-1.5">
            <span className="text-[11px] text-gray-600 truncate">{a.label}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[11px] font-bold ${Number(a.amount_ngn) < 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
                {Number(a.amount_ngn) < 0 ? '−' : '+'}{fmt(Math.abs(Number(a.amount_ngn)))}
              </span>
              {!billed && <button onClick={() => removeAdjustment(a.id)} className="text-[11px] text-gray-300 hover:text-red-500 font-bold">×</button>}
            </div>
          </div>
        ))}

        {billed ? (
          <p className="text-[11px] text-gray-400">This bill has been sent, so charges are locked.</p>
        ) : (
          <div className="flex gap-1.5 mt-2">
            <input value={adjLabel} onChange={e => setAdjLabel(e.target.value)} placeholder="Add a charge or discount"
                   className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
            <input type="number" inputMode="decimal" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="₦"
                   className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] text-right" />
            <button onClick={() => addAdjustment(id)} disabled={savingAdj}
                    className="px-2.5 py-1.5 bg-gray-900 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg flex-shrink-0">
              {savingAdj ? '…' : 'Add'}
            </button>
          </div>
        )}
      </div>

      {/* Internal note — admin-only, never sent to the customer. */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mt-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <StickyNote className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-bold text-gray-800">Internal note</p>
          <span className="text-[9px] text-gray-400">Never shown to the customer</span>
        </div>
        <textarea
          value={noteValue}
          onChange={e => setNoteDrafts(prev => ({ ...prev, [noteKey]: e.target.value }))}
          onBlur={e => saveNote(id, billKind, e.target.value)}
          placeholder="e.g. asked for repackaging, chasing on WhatsApp…"
          rows={2}
          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] resize-none"
        />
      </div>

      {/* This-customer-only actions for whichever stage they're at. */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mt-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">This customer</p>

        {billKind === 'consolidation_shipping' && !billed && (
          <button
            onClick={() => runIndividual('bill', id)}
            disabled={!canBill || acting('bill')}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
          >
            {acting('bill') ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Bill this customer
          </button>
        )}

        {billKind === 'consolidation_shipping' && billed && !shipped && (
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-700">Billed {status?.sent_at ? new Date(status.sent_at).toLocaleDateString() : ''} and locked.</p>
            </div>
            <button
              onClick={() => runIndividual('ship', id)}
              disabled={acting('ship')}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              {acting('ship') ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />} Ship this customer
            </button>
            {ledger?.status !== 'paid' && (
              <button
                onClick={() => runIndividual('cancel', id, 'consolidation_shipping')}
                disabled={acting('cancel')}
                className="w-full py-2 text-gray-400 hover:text-red-500 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5"
              >
                {acting('cancel') ? <Loader className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Cancel this bill
              </button>
            )}
          </div>
        )}

        {billKind === 'consolidation_shipping' && shipped && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-2.5">
            <Truck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">Shipped. Switch to the Clearance tab above to bill and receive.</p>
          </div>
        )}

        {billKind === 'clearance' && !shipped && (
          <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-2.5">
            <PackageCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-500">This customer needs to ship before clearance can be billed.</p>
          </div>
        )}

        {billKind === 'clearance' && shipped && !billed && (
          <button
            onClick={() => runIndividual('clearance_bill', id)}
            disabled={!canBill || acting('clearance_bill')}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
          >
            {acting('clearance_bill') ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Bill clearance for this customer
          </button>
        )}

        {billKind === 'clearance' && billed && !received && (
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-700">Clearance billed and locked.</p>
            </div>
            <button
              onClick={() => runIndividual('receive', id)}
              disabled={ledger?.status !== 'paid' || acting('receive')}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              {acting('receive') ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Mark received
            </button>
            {ledger?.status !== 'paid' && <p className="text-[10px] text-gray-400">Waiting on the clearance fee to be confirmed paid.</p>}
            {ledger?.status !== 'paid' && (
              <button
                onClick={() => runIndividual('cancel', id, 'clearance')}
                disabled={acting('cancel')}
                className="w-full py-2 text-gray-400 hover:text-red-500 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5"
              >
                {acting('cancel') ? <Loader className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Cancel this bill
              </button>
            )}
          </div>
        )}

        {billKind === 'clearance' && received && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-700">Received.</p>
          </div>
        )}
      </div>
    </div>
  );
}
