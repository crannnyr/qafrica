// src/pages/import-admin/TotalOrdersView.tsx
// Groups identical product+spec combinations across all paid, not-yet-staged
// orders — streamlines bulk purchasing by showing total quantity needed and
// the full list of buyers for that exact combo. Admin can "Close" a group
// once it's been sourced, which stamps every order in it with a shared
// staged_at timestamp and moves it into the Closed view for reference.
import { useState, useEffect, useCallback } from 'react';
import { Loader, Package, Users, Archive, CheckCircle2, FileDown } from 'lucide-react';
import CONFIG from '@/lib/config';
import { CustomerDetail } from './ImportAdminCustomers';
import ClosedBatchDetail from './ClosedBatchDetail';

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

// A "batch" is every order sharing one staged_at timestamp (i.e. everything
// closed together in one action) — the unit the new billing/drill-down
// workflow (spec Section 2) actually operates on, as opposed to the
// per-product Group above which only covers Active-tab grouping.
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
      batchKey: stagedAt, stagedAt,
      orderCount: v.orders.size, productCount: v.products.size, buyerCount: v.buyers.size, totalUnits: v.units,
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
        key, productId: item.id, name: item.name, image_url: item.image_url,
        variantLabel, totalQty: 0, buyers: [], orderIds: [], stagedAt: isStaged ? order.staged_at : null,
      };
      existing.totalQty += item.quantity;
      existing.buyers.push({ name: order.customer_name, whatsapp: order.customer_whatsapp, qty: item.quantity, orderCode: order.code, userId: order.user_id ?? null });
      existing.orderIds.push(order.id);
      map.set(key, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
}

export default function TotalOrdersView({ token, onOpenProduct }: { token: string; onOpenProduct?: (productId: string) => void }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [closingKey, setClosingKey] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [selectedBatchKey, setSelectedBatchKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=all-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, payment_status: 'paid' }),
      });
      const data = await res.json();
      setOrders(data.orders ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const groups = buildGroups(orders, showClosed);
  const closedBatches = buildClosedBatches(orders);

  const closeGroup = async (group: Group) => {
    setClosingKey(group.key);
    try {
      await fetch(`${EDGE_URL}?action=admin-close-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_ids: group.orderIds }),
      });
      await load();
    } finally {
      setClosingKey(null);
    }
  };

  // Builds a CSV of every buyer line across the currently active (open)
  // batches, listed by customer name, and triggers a browser download.
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
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qafrica-batches-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Closes every currently active batch in one go — collects every order id
  // across all groups (deduped, since one order can span multiple groups if
  // it has multiple different line items), downloads a CSV record of what's
  // being closed, then stamps them all closed in a single request.
  const closeAll = async () => {
    if (groups.length === 0) return;
    setClosingAll(true);
    try {
      downloadCsv(groups);
      const allOrderIds = Array.from(new Set(groups.flatMap(g => g.orderIds)));
      await fetch(`${EDGE_URL}?action=admin-close-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_ids: allOrderIds }),
      });
      await load();
    } finally {
      setClosingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1">
        <button
          onClick={() => setShowClosed(false)}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${!showClosed ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}
        >
          Active
        </button>
        <button
          onClick={() => setShowClosed(true)}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${showClosed ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}
        >
          Closed
        </button>
      </div>

      {!showClosed && !isLoading && groups.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {groups.length} batch{groups.length !== 1 ? 'es' : ''} open
            </p>
            <p className="text-[11px] text-gray-400">
              {groups.reduce((s, g) => s + g.totalQty, 0)} units total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadCsv(groups)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              Download CSV
            </button>
            <button
              onClick={closeAll}
              disabled={closingAll || closingKey !== null}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {closingAll ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              Close All
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
        </div>
      ) : showClosed ? (
        closedBatches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-300">No closed batches yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closedBatches.map(b => (
              <button
                key={b.batchKey}
                onClick={() => setSelectedBatchKey(b.batchKey)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left hover:border-gray-200 transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Closed {new Date(b.stagedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {b.orderCount} orders · {b.productCount} products · {b.buyerCount} buyers · {b.totalUnits} units
                  </p>
                </div>
                <span className="text-[11px] font-bold text-orange-500 flex-shrink-0">View →</span>
              </button>
            ))}
          </div>
        )
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-300">
            Nothing to group right now — paid orders will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.key} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start gap-3 mb-3">
                <button
                  onClick={() => onOpenProduct?.(g.productId)}
                  disabled={!onOpenProduct}
                  className="flex items-start gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                >
                  {g.image_url && <img src={g.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold line-clamp-1 ${onOpenProduct ? 'text-orange-600 hover:underline' : 'text-gray-800'}`}>{g.name}</p>
                    {g.variantLabel && <p className="text-[11px] text-gray-400">{g.variantLabel}</p>}
                  </div>
                </button>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-orange-500 text-lg leading-none">{g.totalQty}</p>
                  <p className="text-[10px] text-gray-400">units</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {g.buyers.length} buyer{g.buyers.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1">
                  {g.buyers.map((b, i) => (
                    <button
                      key={i}
                      onClick={() => b.userId && setProfileCustomerId(b.userId)}
                      disabled={!b.userId}
                      className={`w-full flex items-center justify-between text-xs text-left ${b.userId ? 'hover:underline' : 'cursor-default'}`}
                    >
                      <span className={b.userId ? 'text-orange-600' : 'text-gray-600'}>{b.name} <span className="text-gray-300 font-mono">· {b.orderCode}</span></span>
                      <span className="font-semibold text-gray-700">×{b.qty}</span>
                    </button>
                  ))}
                </div>
              </div>

              {showClosed ? (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Closed {g.stagedAt ? new Date(g.stagedAt).toLocaleDateString() : ''}
                </div>
              ) : (
                <button
                  onClick={() => closeGroup(g)}
                  disabled={closingKey === g.key}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {closingKey === g.key ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                  Close batch
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {profileCustomerId && (
        <CustomerDetail
          token={token}
          customerId={profileCustomerId}
          onClose={() => setProfileCustomerId(null)}
          onFavoriteToggled={() => {}}
        />
      )}

      {selectedBatchKey && (
        <ClosedBatchDetail
          token={token}
          batchKey={selectedBatchKey}
          orders={orders.filter(o => o.staged_at === selectedBatchKey)}
          onClose={() => setSelectedBatchKey(null)}
          onOpenProduct={onOpenProduct}
        />
      )}
    </div>
  );
}
