import { useCallback, useEffect, useState } from 'react';
import { Loader, Send } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';

const CUSTOM_ORDERS_EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/custom-orders`;

interface CustomOrderItemRow {
  id: string;
  image_url: string;
  description: string;
  quantity: number;
  estimated_budget_ngn: number | null;
  product_url: string | null;
  product_name: string | null;
}

interface CustomOrderRequestRow {
  id: string;
  status: 'pending' | 'in_progress' | 'ready';
  created_at: string;
  ready_at: string | null;
  custom_order_items: CustomOrderItemRow[];
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
}

export default function ImportAdminV2CustomOrders() {
  const token = getManagementToken();
  const [requests, setRequests] = useState<CustomOrderRequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'ready'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [markingReadyId, setMarkingReadyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${CUSTOM_ORDERS_EDGE_URL}?action=admin-list-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, status: statusFilter === 'all' ? undefined : statusFilter }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not load custom orders');
        return;
      }
      setRequests(data.requests ?? []);
    } catch {
      toast.error('Could not load custom orders');
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const saveLink = async (item: CustomOrderItemRow) => {
    const url = (linkDrafts[item.id] ?? item.product_url ?? '').trim();
    if (!url) { toast.error('Paste a product link first'); return; }

    setSavingItemId(item.id);
    try {
      const res = await fetch(`${CUSTOM_ORDERS_EDGE_URL}?action=admin-set-item-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, item_id: item.id, product_url: url }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Could not save link'); return; }
      toast.success('Link saved');
      await load();
    } catch {
      toast.error('Could not save link');
    } finally {
      setSavingItemId(null);
    }
  };

  const markReady = async (request: CustomOrderRequestRow) => {
    setMarkingReadyId(request.id);
    try {
      const res = await fetch(`${CUSTOM_ORDERS_EDGE_URL}?action=admin-mark-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, request_id: request.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Could not mark ready'); return; }
      toast.success('Marked ready — customer notified');
      await load();
    } catch {
      toast.error('Could not mark ready');
    } finally {
      setMarkingReadyId(null);
    }
  };

  if (!token) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['all', 'pending', 'in_progress', 'ready'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors capitalize ${statusFilter === status ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-gray-400">No custom order requests here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => {
            const unlinkedCount = request.custom_order_items.filter(item => !item.product_url).length;
            return (
              <div key={request.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{request.customer_name ?? 'Unknown customer'}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {request.customer_email ?? 'no email'}{request.customer_phone ? ` · ${request.customer_phone}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{new Date(request.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    request.status === 'ready' ? 'bg-emerald-50 text-emerald-700' :
                    request.status === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {request.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {request.custom_order_items.map(item => (
                    <div key={item.id} className="flex gap-2.5 bg-gray-50 rounded-xl p-2.5">
                      <img src={item.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700">{item.description}</p>
                        <p className="text-[10px] text-gray-400 mb-1.5">
                          Qty {item.quantity}{item.estimated_budget_ngn ? ` · up to ₦${Number(item.estimated_budget_ngn).toLocaleString()} each` : ''}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={linkDrafts[item.id] ?? item.product_url ?? ''}
                            onChange={e => setLinkDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Paste QAFRICA product link…"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]"
                          />
                          <button
                            onClick={() => void saveLink(item)}
                            disabled={savingItemId === item.id}
                            className="flex-shrink-0 px-2.5 py-1.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg"
                          >
                            {savingItemId === item.id ? '…' : item.product_url ? 'Update' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {request.status !== 'ready' && (
                  <button
                    onClick={() => void markReady(request)}
                    disabled={unlinkedCount > 0 || markingReadyId === request.id}
                    className="w-full mt-3 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    {markingReadyId === request.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {unlinkedCount > 0 ? `${unlinkedCount} item${unlinkedCount > 1 ? 's' : ''} still need a link` : 'Mark ready & notify customer'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
