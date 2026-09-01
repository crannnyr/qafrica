// src/pages/import-admin/ClosedBatchDetail.tsx
// Full-screen sheet for one closed batch (spec Section 2). Two drill-down
// modes (grouped by product / chronological by customer), per-item
// consolidation + shipping billing that locks permanently once sent, an
// audit flag per item, and a flight-vs-ship KPI.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Loader, Users, Plane, Ship, ShieldCheck, Send, AlertTriangle, ChevronRight, Package } from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';
import { CustomerDetail } from './ImportAdminCustomers';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface OrderItem { id: string; name: string; image_url: string; quantity: number; variant_options?: Record<string, string>; }
interface OrderRow { id: string; code: string; user_id: string | null; customer_name: string; items: OrderItem[]; created_at: string; }
interface BreakdownRow {
  product_id: string; product_name: string; product_image: string | null;
  customer_id: string; customer_name: string; qty: number;
  order_id: string; order_code: string; order_created_at: string;
}
interface ItemBill { id: string; product_id: string; product_name: string; unit_amount_ngn: number; kind: 'consolidation' | 'shipping'; audit_status: boolean; }
interface BatchStatus { batch_key: string; kind: 'consolidation' | 'shipping'; status: 'draft' | 'sent'; shipping_method_final: string | null; recipients_count: number | null; }

function fmt(n: number) { return `₦${Math.round(n).toLocaleString()}`; }

async function call(action: string, body: Record<string, unknown>) {
  const res = await fetch(`${EDGE_URL}?action=${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
}

export default function ClosedBatchDetail({
  token, batchKey, orders, onClose, onOpenProduct,
}: {
  token: string; batchKey: string; orders: OrderRow[]; onClose: () => void; onOpenProduct?: (productId: string) => void;
}) {
  const [tab, setTab] = useState<'grouped' | 'chronological' | 'billing'>('grouped');
  const [billingKind, setBillingKind] = useState<'consolidation' | 'shipping'>('consolidation');
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [kpi, setKpi] = useState({ flight: 0, sea_freight: 0 });
  const [itemBills, setItemBills] = useState<ItemBill[]>([]);
  const [statuses, setStatuses] = useState<BatchStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomerForDrilldown, setSelectedCustomerForDrilldown] = useState<string | null>(null);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [shippingMethodFinal, setShippingMethodFinal] = useState<'flight' | 'sea_freight'>('flight');
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [breakdownRes, itemBillsRes] = await Promise.all([
        call('admin-batch-breakdown', { manager_token: token, batch_key: batchKey }),
        call('admin-batch-item-bills', { manager_token: token, batch_key: batchKey }),
      ]);
      setBreakdown(breakdownRes.rows ?? []);
      setKpi(breakdownRes.shipping_kpi ?? { flight: 0, sea_freight: 0 });
      setItemBills(itemBillsRes.items ?? []);
      setStatuses(itemBillsRes.statuses ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token, batchKey]);

  useEffect(() => { load(); }, [load]);

  const currentStatus = statuses.find(s => s.kind === billingKind);
  const isLocked = currentStatus?.status === 'sent';

  // Unique products in this batch, derived from the breakdown rows.
  const products = useMemo(() => {
    const map = new Map<string, { id: string; name: string; image: string | null }>();
    for (const row of breakdown) {
      if (!map.has(row.product_id)) map.set(row.product_id, { id: row.product_id, name: row.product_name, image: row.product_image });
    }
    return Array.from(map.values());
  }, [breakdown]);

  const priceFor = (productId: string) => {
    const draft = priceDrafts[`${productId}:${billingKind}`];
    if (draft !== undefined) return draft;
    const saved = itemBills.find(b => b.product_id === productId && b.kind === billingKind);
    return saved ? String(saved.unit_amount_ngn) : '';
  };

  const savePrice = async (productId: string, productName: string, value: string) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    const result = await call('admin-batch-set-item-price', {
      manager_token: token, batch_key: batchKey, product_id: productId, product_name: productName,
      unit_amount_ngn: amount, kind: billingKind,
    });
    if (result.error) { toast.error(result.error); return; }
    await load();
  };

  const toggleAudit = async (billId: string) => {
    const result = await call('admin-batch-toggle-audit', { manager_token: token, id: billId });
    if (result.error) { toast.error(result.error); return; }
    await load();
  };

  // Per-customer running total for the currently selected billing kind,
  // computed client-side from entered (not-yet-sent) prices — matches
  // exactly what the server will compute when Send Bill is clicked.
  const customerTotals = useMemo(() => {
    const priceMap = new Map(itemBills.filter(b => b.kind === billingKind).map(b => [b.product_id, b.unit_amount_ngn]));
    const totals = new Map<string, { name: string; total: number }>();
    for (const row of breakdown) {
      const price = priceMap.get(row.product_id);
      if (price == null) continue;
      const entry = totals.get(row.customer_id) ?? { name: row.customer_name, total: 0 };
      entry.total += price * row.qty;
      totals.set(row.customer_id, entry);
    }
    return totals;
  }, [breakdown, itemBills, billingKind]);

  const handleSendBill = async () => {
    setIsSending(true);
    try {
      const result = await call('admin-batch-send-bill', {
        manager_token: token, batch_key: batchKey, kind: billingKind,
        ...(billingKind === 'shipping' ? { shipping_method_final: shippingMethodFinal } : {}),
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Billed ${result.customers_billed} customer${result.customers_billed !== 1 ? 's' : ''} — this batch is now locked.`);
      setShowSendConfirm(false);
      await load();
    } finally {
      setIsSending(false);
    }
  };

  // Chronological view: customers sorted by their earliest order in the batch.
  const chronologicalCustomers = useMemo(() => {
    const byCustomer = new Map<string, { userId: string | null; name: string; earliestAt: string; items: OrderItem[] }>();
    for (const o of orders) {
      const key = o.user_id ?? o.id;
      const entry = byCustomer.get(key) ?? { userId: o.user_id, name: o.customer_name, earliestAt: o.created_at, items: [] };
      if (o.created_at < entry.earliestAt) entry.earliestAt = o.created_at;
      entry.items.push(...(o.items ?? []));
      byCustomer.set(key, entry);
    }
    return Array.from(byCustomer.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => new Date(a.earliestAt).getTime() - new Date(b.earliestAt).getTime());
  }, [orders]);

  const selectedCustomer = chronologicalCustomers.find(c => c.key === selectedCustomerForDrilldown);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Closed batch</h2>
            <p className="text-[11px] text-gray-400">{new Date(batchKey).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* Flight vs Ship KPI */}
        <div className="flex gap-2 px-4 pt-3 flex-shrink-0">
          <div className="flex-1 bg-sky-50 rounded-xl p-2.5 flex items-center gap-2">
            <Plane className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-sky-700 leading-none">{kpi.flight}</p>
              <p className="text-[10px] text-sky-500">Flight</p>
            </div>
          </div>
          <div className="flex-1 bg-indigo-50 rounded-xl p-2.5 flex items-center gap-2">
            <Ship className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-indigo-700 leading-none">{kpi.sea_freight}</p>
              <p className="text-[10px] text-indigo-500">Sea</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 flex-shrink-0">
          {(['grouped', 'chronological', 'billing'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedCustomerForDrilldown(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${tab === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {t === 'chronological' ? 'By customer' : t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-12 text-center"><Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
          ) : tab === 'grouped' ? (
            <div className="space-y-2">
              {products.map(p => {
                const buyersForProduct = breakdown.filter(r => r.product_id === p.id);
                const totalQty = buyersForProduct.reduce((s, r) => s + r.qty, 0);
                return (
                  <div key={p.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => onOpenProduct?.(p.id)}
                        className={`text-sm font-semibold ${onOpenProduct ? 'text-orange-600 hover:underline' : 'text-gray-800'}`}
                      >
                        {p.name}
                      </button>
                      <span className="text-xs font-bold text-orange-500">{totalQty} units</span>
                    </div>
                    <div className="space-y-1">
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
                  </div>
                );
              })}
            </div>
          ) : tab === 'chronological' ? (
            selectedCustomer ? (
              <div>
                <button onClick={() => setSelectedCustomerForDrilldown(null)} className="text-xs text-orange-500 font-bold mb-3">← Back to all customers</button>
                <p className="text-sm font-bold text-gray-800 mb-3">{selectedCustomer.name}'s items</p>
                <div className="space-y-3">
                  {Array.from(new Map(selectedCustomer.items.map(i => [i.id, i])).values()).map(item => {
                    const others = breakdown.filter(r => r.product_id === item.id);
                    return (
                      <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-sm font-semibold text-gray-800 mb-1.5">{item.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Everyone who ordered this
                        </p>
                        <div className="space-y-1">
                          {others.map((r, i) => (
                            <button
                              key={i}
                              onClick={() => r.customer_id && setProfileCustomerId(r.customer_id)}
                              className="w-full flex items-center justify-between text-xs text-left hover:underline"
                            >
                              <span className="text-gray-600">{r.customer_name}</span>
                              <span className="font-semibold text-gray-700">×{r.qty}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {chronologicalCustomers.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCustomerForDrilldown(c.key)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl text-left hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{new Date(c.earliestAt).toLocaleDateString()} · {c.items.length} item{c.items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
            )
          ) : (
            // Billing tab
            <div className="space-y-4">
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setBillingKind('consolidation')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${billingKind === 'consolidation' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                >
                  Consolidation bill
                </button>
                <button
                  onClick={() => setBillingKind('shipping')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${billingKind === 'shipping' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                >
                  Shipping bill
                </button>
              </div>

              {isLocked && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700">
                    This {billingKind} bill was sent to {currentStatus?.recipients_count ?? 0} customer{currentStatus?.recipients_count !== 1 ? 's' : ''} and is locked.
                    Pricing can't be changed — handle anything missed directly with the customer.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {products.map(p => {
                  const bill = itemBills.find(b => b.product_id === p.id && b.kind === billingKind);
                  return (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                      <Package className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <span className="flex-1 text-xs font-semibold text-gray-700 truncate">{p.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">₦</span>
                        <input
                          type="number" inputMode="decimal"
                          value={priceFor(p.id)}
                          disabled={isLocked}
                          onChange={e => setPriceDrafts(prev => ({ ...prev, [`${p.id}:${billingKind}`]: e.target.value }))}
                          onBlur={e => e.target.value && savePrice(p.id, p.name, e.target.value)}
                          placeholder="0"
                          className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-right disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </div>
                      {bill && (
                        <button
                          onClick={() => toggleAudit(bill.id)}
                          disabled={isLocked}
                          title="Mark reviewed"
                          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${bill.audit_status ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-300'}`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {customerTotals.size > 0 && (
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1.5">Running totals (not yet sent)</p>
                  <div className="space-y-1">
                    {Array.from(customerTotals.entries()).map(([id, v]) => (
                      <div key={id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{v.name}</span>
                        <span className="font-bold text-gray-900">{fmt(v.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {billingKind === 'shipping' && !isLocked && (
                <div>
                  <p className="text-xs font-bold text-gray-600 mb-1.5">Actual shipping method for this batch</p>
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
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Customers who picked something different will be notified their shipping method changed.
                  </p>
                </div>
              )}

              {!isLocked && (
                <button
                  onClick={() => setShowSendConfirm(true)}
                  disabled={customerTotals.size === 0}
                  className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send {billingKind} bill
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showSendConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => !isSending && setShowSendConfirm(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1.5">This locks pricing for this batch</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Once sent, you won't be able to add or change pricing for this {billingKind} bill. {customerTotals.size} customer{customerTotals.size !== 1 ? 's' : ''} will be billed and notified. Continue?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowSendConfirm(false)} disabled={isSending} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-600 border border-gray-200">
                Cancel
              </button>
              <button onClick={handleSendBill} disabled={isSending} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gray-900 flex items-center justify-center gap-1.5">
                {isSending ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Send & lock'}
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
