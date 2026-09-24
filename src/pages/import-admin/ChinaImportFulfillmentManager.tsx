import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, PackageCheck, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';

type FulfillmentItem = {
  id: string;
  order_id: string;
  order_item_index: number;
  product_id: string | null;
  product_name: string;
  image_url: string | null;
  variant_options: Record<string, unknown> | null;
  ordered_quantity: number;
  received_quantity: number;
  allocated_quantity: number;
  shipped_quantity: number;
  delivered_quantity: number;
  status: string;
  received_at: string | null;
  order_code: string;
  customer_name: string;
  customer_whatsapp: string | null;
  batch_id: string | null;
  batch_opened_at: string | null;
  order_status: string;
  shipping_method: string | null;
};

type BatchGroup = {
  id: string;
  openedAt: string | null;
  items: FulfillmentItem[];
};

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-management`;

function variantLabel(options: Record<string, unknown> | null) {
  if (!options || typeof options !== 'object') return '';
  return Object.entries(options)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

function batchLabel(batch: BatchGroup) {
  if (!batch.openedAt) return 'Batch';
  const date = new Date(batch.openedAt);
  return `Batch opened ${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ChinaImportFulfillmentManager({ token, canReceive }: { token: string; canReceive: boolean }) {
  const [items, setItems] = useState<FulfillmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'awaiting_arrival' | 'at_qafrica_hq'>('all');
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-fulfillment-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load fulfillment items');
      const next = Array.isArray(data.items) ? data.items as FulfillmentItem[] : [];
      setItems(next);
      setOpenBatches(current => {
        if (current.size > 0) return current;
        return new Set(next.slice(0, 1).map(item => item.batch_id ?? 'unbatched'));
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load fulfillment items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!needle) return true;
      return [item.order_code, item.customer_name, item.product_name, variantLabel(item.variant_options)]
        .join(' ').toLowerCase().includes(needle);
    });
  }, [items, query, statusFilter]);

  const batches = useMemo<BatchGroup[]>(() => {
    const map = new Map<string, BatchGroup>();
    for (const item of filtered) {
      const id = item.batch_id ?? 'unbatched';
      const existing = map.get(id);
      if (existing) existing.items.push(item);
      else map.set(id, { id, openedAt: item.batch_opened_at, items: [item] });
    }
    return Array.from(map.values()).sort((a, b) => {
      const ad = a.openedAt ? new Date(a.openedAt).getTime() : 0;
      const bd = b.openedAt ? new Date(b.openedAt).getTime() : 0;
      return bd - ad;
    });
  }, [filtered]);

  const receive = async (item: FulfillmentItem) => {
    const raw = receivedDrafts[item.id] ?? String(item.received_quantity);
    const quantity = Number(raw);
    if (!Number.isInteger(quantity) || quantity < item.received_quantity || quantity > item.ordered_quantity) {
      toast.error(`Received quantity must be between ${item.received_quantity} and ${item.ordered_quantity}`);
      return;
    }
    setActing(item.id);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-fulfillment-receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          fulfillment_item_id: item.id,
          received_quantity: quantity,
          note: notes[item.id]?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not record receipt');
      const updated = data.fulfillment_item as FulfillmentItem;
      setItems(current => current.map(row => row.id === item.id ? { ...row, ...updated } : row));
      setReceivedDrafts(current => ({ ...current, [item.id]: String(updated.received_quantity) }));
      toast.success(updated.received_quantity === updated.ordered_quantity ? 'Item fully received at QAfrica HQ' : 'Received quantity updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record receipt');
    } finally {
      setActing(null);
    }
  };

  const awaitingCount = items.filter(item => item.status === 'awaiting_arrival').length;
  const hqCount = items.filter(item => item.status === 'at_qafrica_hq' || item.status === 'partially_allocated' || item.status === 'fully_allocated').length;
  const orderedUnits = items.reduce((sum, item) => sum + item.ordered_quantity, 0);
  const receivedUnits = items.reduce((sum, item) => sum + item.received_quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-black text-gray-900">China Import Fulfillment</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">Receive paid shipping order items at QAfrica HQ individually. Receiving an item does not change the main order status.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] text-gray-400 uppercase font-bold">Awaiting</p>
            <p className="text-xl font-black text-gray-900">{awaitingCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] text-gray-400 uppercase font-bold">At HQ</p>
            <p className="text-xl font-black text-emerald-600">{hqCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] text-gray-400 uppercase font-bold">Units received</p>
            <p className="text-xl font-black text-gray-900">{receivedUnits.toLocaleString()}<span className="text-xs text-gray-400">/{orderedUnits.toLocaleString()}</span></p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search order, customer or item…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-orange-300" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs bg-white">
            <option value="all">All fulfillment</option>
            <option value="awaiting_arrival">Awaiting arrival</option>
            <option value="at_qafrica_hq">At QAfrica HQ</option>
          </select>
          <button onClick={() => void load(true)} disabled={refreshing} className="px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-xs">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <PackageCheck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-700">No fulfillment items found</p>
          <p className="text-xs text-gray-400 mt-1">Only paid consolidation-shipping orders are included.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => {
            const batchKey = batch.id;
            const isOpen = openBatches.has(batchKey);
            const batchOrdered = batch.items.reduce((sum, item) => sum + item.ordered_quantity, 0);
            const batchReceived = batch.items.reduce((sum, item) => sum + item.received_quantity, 0);
            return (
              <div key={batchKey} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button onClick={() => setOpenBatches(current => {
                  const next = new Set(current);
                  if (next.has(batchKey)) next.delete(batchKey); else next.add(batchKey);
                  return next;
                })} className="w-full p-4 flex items-center justify-between gap-3 text-left">
                  <div>
                    <p className="text-xs font-black text-gray-900">{batch.id === 'unbatched' ? 'Unbatched' : batchLabel(batch)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{batch.items.length} item line{batch.items.length === 1 ? '' : 's'} · {batchReceived}/{batchOrdered} units received</p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {batch.items.map(item => {
                      const currentReceived = item.received_quantity;
                      const draft = receivedDrafts[item.id] ?? String(currentReceived);
                      const complete = currentReceived >= item.ordered_quantity;
                      return (
                        <div key={item.id} className="p-4">
                          <div className="flex gap-3">
                            {item.image_url ? <img src={item.image_url} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-50 flex-shrink-0" /> : <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold text-orange-600">{item.order_code}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${complete ? 'bg-emerald-50 text-emerald-600' : currentReceived > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {complete ? 'At HQ' : currentReceived > 0 ? 'Partially received' : 'Awaiting arrival'}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-gray-900 mt-1 leading-snug">{item.product_name}</p>
                              {variantLabel(item.variant_options) && <p className="text-[10px] text-gray-500 mt-0.5">{variantLabel(item.variant_options)}</p>}
                              <p className="text-[10px] text-gray-400 mt-1">{item.customer_name}{item.customer_whatsapp ? ` · ${item.customer_whatsapp}` : ''} · Ordered {item.ordered_quantity}</p>
                            </div>
                          </div>

                          <div className="mt-3 bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Received at HQ</p>
                                <p className="text-xs text-gray-700 mt-0.5">{currentReceived} of {item.ordered_quantity} unit{item.ordered_quantity !== 1 ? 's' : ''}</p>
                              </div>
                              {complete && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                            </div>
                            {canReceive && !complete && (
                              <>
                                <div className="flex gap-2 mt-2">
                                  <input type="number" min={currentReceived} max={item.ordered_quantity} step={1} value={draft} onChange={e => setReceivedDrafts(current => ({ ...current, [item.id]: e.target.value }))} className="w-24 px-2.5 py-2 rounded-lg border border-gray-200 text-xs" />
                                  <button onClick={() => void receive(item)} disabled={acting === item.id} className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                                    {acting === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Record received
                                  </button>
                                </div>
                                <textarea value={notes[item.id] ?? ''} onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))} rows={2} placeholder="Optional internal note…" className="w-full mt-2 px-2.5 py-2 rounded-lg border border-gray-200 text-xs resize-none" />
                              </>
                            )}
                            {!canReceive && !complete && <p className="text-[10px] text-gray-400 mt-2">You can view fulfillment, but your account cannot record receiving.</p>}
                            {item.received_at && <p className="text-[10px] text-gray-400 mt-2">Last received: {new Date(item.received_at).toLocaleString()}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
