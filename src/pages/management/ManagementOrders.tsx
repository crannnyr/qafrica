import { useState, useEffect, useCallback } from 'react';
import { Loader, Package, Users, Archive, CheckCircle2, FileDown, Eye } from 'lucide-react';
import CONFIG from '@/lib/config';
import { CustomerDetail } from '@/pages/import-admin/ImportAdminCustomers';
import ClosedBatchDetail from '@/pages/import-admin/ClosedBatchDetail';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface OrderItem {
  id: string;
  name: string;
  image_url: string;
  quantity: number;
  variant_options?: Record<string, string>;
}
interface OrderRow {
  id: string;
  code: string;
  user_id: string | null;
  customer_name: string;
  customer_whatsapp: string;
  items: OrderItem[];
  payment_status: string;
  staged_at: string | null;
  created_at: string;
  status?: string;
  shipped_at?: string | null;
  shipping_method?: 'flight' | 'sea_freight' | null;
}
interface Group {
  key: string;
  productId: string;
  name: string;
  image_url: string;
  variantLabel: string;
  totalQty: number;
  buyers: Array<{ name: string; whatsapp: string; qty: number; orderCode: string; userId: string | null }>;
  orderIds: string[];
  stagedAt: string | null;
}
interface ClosedBatch {
  batchKey: string;
  stagedAt: string;
  orderCount: number;
  productCount: number;
  buyerCount: number;
  totalUnits: number;
}

function buildClosedBatches(orders: OrderRow[]): ClosedBatch[] {
  const map = new Map<string, { orders: Set<string>; products: Set<string>; buyers: Set<string>; units: number }>();
  for (const order of orders) {
    if (!order.staged_at) continue;
    const entry = map.get(order.staged_at) ?? { orders: new Set(), products: new Set(), buyers: new Set(), units: 0 };
    entry.orders.add(order.id);
    entry.buyers.add(order.user_id ?? order.code);
    for (const item of order.items ?? []) {
      entry.products.add(item.id);
      entry.units += item.quantity;
    }
    map.set(order.staged_at, entry);
  }
  return Array.from(map.entries())
    .map(([stagedAt, v]) => ({
      batchKey: stagedAt,
      stagedAt,
      orderCount: v.orders.size,
      productCount: v.products.size,
      buyerCount: v.buyers.size,
      totalUnits: v.units,
    }))
    .sort((a, b) => new Date(b.stagedAt).getTime() - new Date(a.stagedAt).getTime());
}

function buildGroups(orders: OrderRow[], showClosed: boolean): Group[] {
  const map = new Map<string, Group>();
  for (const order of orders) {
    const isStaged = !!order.staged_at;
    if (isStaged !== showClosed) continue;
    for (const item of order.items ?? []) {
      const variantLabel = item.variant_options
        ? Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')
        : '';
      const key = `${item.id}::${variantLabel}::${isStaged ? order.staged_at : ''}`;
      const existing = map.get(key) ?? {
        key,
        productId: item.id,
        name: item.name,
        image_url: item.image_url,
        variantLabel,
        totalQty: 0,
        buyers: [],
        orderIds: [],
        stagedAt: isStaged ? order.staged_at : null,
      };
      existing.totalQty += item.quantity;
      existing.buyers.push({
        name: order.customer_name,
        whatsapp: order.customer_whatsapp,
        qty: item.quantity,
        orderCode: order.code,
        userId: order.user_id ?? null,
      });
      existing.orderIds.push(order.id);
      map.set(key, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ManagementOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [closingKey, setClosingKey] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [selectedBatchKey, setSelectedBatchKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const token = sessionStorage.getItem('import_manager_token') || '';

  const load = useCallback(async () => {
    if (!token) {
      setOrders([]);
      setIsLoading(false);
      toast.error('Management session expired');
      return;
    }
    setIsLoading(true);
    try {
      const staged = showClosed ? 'closed' : 'active';
      const res = await fetch(`${EDGE_URL}?action=all-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, payment_status: 'paid', staged }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? `Could not load ${staged} orders`);
      setOrders(data.orders ?? []);
    } catch (error) {
      setOrders([]);
      toast.error(error instanceof Error ? error.message : 'Could not load orders');
    } finally {
      setIsLoading(false);
    }
  }, [showClosed, token]);

  useEffect(() => { void load(); }, [load]);

  const groups = buildGroups(orders, showClosed);
  const closedBatches = buildClosedBatches(orders);

  const downloadCsv = (rows: Group[]) => {
    const header = ['Customer Name', 'WhatsApp', 'Order Code', 'Product', 'Variant', 'Quantity'];
    const lines = [header.join(',')];
    for (const g of rows) {
      for (const b of g.buyers) {
        const cells = [b.name, b.whatsapp, b.orderCode, g.name, g.variantLabel || '—', String(b.qty)]
          .map(v => `"${String(v).replace(/"/g, '""')}"`);
        lines.push(cells.join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qafrica-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const closeGroup = async (group: Group) => {
    setClosingKey(group.key);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-close-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_ids: group.orderIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) throw new Error(data.error ?? 'Could not close this batch');
      await load();
      toast.success('Batch closed successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not close this batch');
    } finally {
      setClosingKey(null);
    }
  };

  const closeAll = async () => {
    if (!groups.length) return;
    setClosingAll(true);
    try {
      downloadCsv(groups);
      const orderIds = Array.from(new Set(groups.flatMap(g => g.orderIds).filter(Boolean)));
      const res = await fetch(`${EDGE_URL}?action=admin-close-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_ids: orderIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) throw new Error(data.error ?? 'Could not close the active orders');
      await load();
      toast.success(`Closed ${data.count ?? data.closed_count ?? orderIds.length} active orders`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not close the active orders');
    } finally {
      setClosingAll(false);
    }
  };

  if (selectedBatchKey) {
    return (
      <ClosedBatchDetail
        token={token}
        batchKey={selectedBatchKey}
        orders={orders.filter(o => o.staged_at === selectedBatchKey)}
        onClose={() => setSelectedBatchKey(null)}
        onReload={load}
      />
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Orders</h2>
          <p className="text-xs text-gray-400">Paid import orders grouped for sourcing and batch processing.</p>
        </div>
        <div className="flex items-center gap-2">
          {!showClosed && groups.length > 0 && (
            <>
              <button onClick={() => downloadCsv(groups)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50">
                <FileDown className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => void closeAll()} disabled={closingAll || closingKey !== null} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40">
                {closingAll ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                Close All
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1">
        <button onClick={() => setShowClosed(false)} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${!showClosed ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}>
          Active
        </button>
        <button onClick={() => setShowClosed(true)} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${showClosed ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}>
          Closed
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center"><Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
        ) : showClosed ? (
          closedBatches.length === 0 ? (
            <div className="p-12 text-center"><Package className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">No closed batches yet.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Batch</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orders</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Products</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buyers</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Units</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {closedBatches.map(b => (
                    <tr key={b.batchKey} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{formatDate(b.stagedAt)}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.orderCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.productCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.buyerCount}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-800">{b.totalUnits}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => setSelectedBatchKey(b.batchKey)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100"><Eye className="w-3.5 h-3.5" /> View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : groups.length === 0 ? (
          <div className="p-12 text-center"><Package className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">No paid active orders right now.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Variant</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Qty</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buyers</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orders</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groups.map(g => (
                  <>
                    <tr key={g.key} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-[230px]">
                          {g.image_url ? <img src={g.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Package className="w-4 h-4 text-gray-300" /></div>}
                          <div className="min-w-0"><p className="text-sm font-semibold text-gray-800 truncate max-w-[250px]">{g.name}</p><p className="text-[10px] text-gray-400">{g.buyers.length} buyer{g.buyers.length !== 1 ? 's' : ''}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px]">{g.variantLabel || '—'}</td>
                      <td className="px-4 py-3"><span className="text-lg font-black text-orange-500">{g.totalQty}</span><span className="text-[10px] text-gray-400 ml-1">units</span></td>
                      <td className="px-4 py-3"><button onClick={() => setExpandedKey(expandedKey === g.key ? null : g.key)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:underline"><Users className="w-3.5 h-3.5" /> {g.buyers.length} View</button></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{new Set(g.orderIds).size}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => void closeGroup(g)} disabled={closingKey === g.key || closingAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 disabled:opacity-40"><Archive className="w-3.5 h-3.5" /> {closingKey === g.key ? 'Closing…' : 'Close batch'}</button></td>
                    </tr>
                    {expandedKey === g.key && (
                      <tr key={g.key + ':buyers'} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buyers</div>
                            <table className="w-full text-left">
                              <tbody className="divide-y divide-gray-100">
                                {g.buyers.map((b, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-2 text-xs">{b.userId ? <button onClick={() => setProfileCustomerId(b.userId)} className="text-orange-600 hover:underline font-semibold">{b.name}</button> : <span className="text-gray-600">{b.name}</span>}</td>
                                    <td className="px-3 py-2 text-[11px] text-gray-400">{b.orderCode}</td>
                                    <td className="px-3 py-2 text-xs text-gray-600">{b.whatsapp || '—'}</td>
                                    <td className="px-3 py-2 text-xs font-semibold text-right">×{b.qty}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {profileCustomerId && <CustomerDetail token={token} customerId={profileCustomerId} onClose={() => setProfileCustomerId(null)} onFavoriteToggled={() => {}} />}
    </div>
  );
}
