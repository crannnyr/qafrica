import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader, RefreshCw, Search, ShieldCheck, UserRound, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

const EDGE = CONFIG.SUPABASE_URL + '/functions/v1/china-import';

interface FailedOrder {
  id: string;
  code: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  total_ngn: number;
  delivery_type: 'to_qafrica' | 'to_me';
  payment_method: 'paystack' | 'manual' | null;
  failed_at: string;
  order_created_at: string;
}

const money = (n: number) => '₦' + Math.round(Number(n || 0)).toLocaleString();
const timeSince = (value: string) => {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000));
  return hours < 1 ? 'just now' : hours < 24 ? hours + 'h ago' : Math.floor(hours / 24) + 'd ago';
};

export default function ImportAdminV2PaymentRecovery() {
  const token = getManagementToken();
  const { hasPermission, loading: permissionsLoading } = useImportAdminPermissions(token);
  const [orders, setOrders] = useState<FailedOrder[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !hasPermission('import.timed_out.view')) return;
    setLoading(true);
    try {
      const res = await fetch(EDGE + '?action=admin-failed-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, search: search.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load timed-out orders');
      setOrders(data.failed_orders ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load timed-out orders');
    } finally {
      setLoading(false);
    }
  }, [token, search, hasPermission]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const restore = async (order: FailedOrder) => {
    if (!hasPermission('import.timed_out.manage')) {
      toast.error('You do not have permission to restore timed-out orders.');
      return;
    }
    setRestoringId(order.id);
    try {
      const res = await fetch(EDGE + '?action=admin-restore-failed-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, failed_order_id: order.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not restore this order');
      toast.success('Order ' + order.code + ' restored and marked paid — apology email sent');
      setOrders(prev => prev.filter(item => item.id !== order.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore this order');
    } finally {
      setRestoringId(null);
    }
  };

  if (!token || permissionsLoading) {
    return <div className="flex justify-center py-16"><Loader className="w-5 h-5 animate-spin text-orange-500" /></div>;
  }

  if (!hasPermission('import.timed_out.view')) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center">
        <ShieldCheck className="w-9 h-9 mx-auto text-gray-200" />
        <h2 className="font-black text-gray-900 mt-4">Payment Recovery</h2>
        <p className="text-sm text-gray-400 mt-1">You do not have permission to view expired orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gray-950 text-white p-6 md:p-7">
        <div className="absolute -right-12 -top-16 w-52 h-52 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-amber-300 text-[11px] font-bold uppercase tracking-[0.16em]">
              <WalletCards className="w-4 h-4" /> Payment recovery
            </div>
            <h1 className="text-2xl md:text-3xl font-black mt-2">Recover expired orders.</h1>
            <p className="text-sm text-gray-400 mt-1 max-w-xl">
              Review orders that timed out before payment was confirmed and restore genuine payments safely.
            </p>
          </div>
          <button onClick={() => void load()} className="self-start inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-bold">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </section>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          Orders appear here after the 24-hour expiry sweep when payment was not confirmed in time.
          Restoring marks the order as paid, sends the customer an apology email, and asks them to provide shipping details again.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order code or customer name…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 text-xs outline-none focus:ring-2 focus:ring-gray-100"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 animate-pulse bg-gray-50/70" />)}
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-14 text-center">
          <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-200" />
          <h3 className="font-bold text-gray-800 mt-4">No expired orders waiting for recovery</h3>
          <p className="text-xs text-gray-400 mt-1">When an order times out, it will appear here for review.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">Order</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">Customer</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">Amount</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">Payment</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">Delivery</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">Expired</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <Clock3 className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-mono font-bold text-xs text-gray-900">{order.code}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Created {new Date(order.order_created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-gray-800">{order.customer_name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 max-w-[190px] truncate">{order.customer_email || order.customer_phone || 'No contact details'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-black text-gray-900">{money(order.total_ngn)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex px-2.5 py-1 rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                        {order.payment_method === 'manual' ? 'Manual transfer' : order.payment_method === 'paystack' ? 'Paystack' : 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[10px] font-semibold text-gray-500">
                        {order.delivery_type === 'to_qafrica' ? 'QAFRICA / Jumia' : 'Customer'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-amber-700">{timeSince(order.failed_at)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(order.failed_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {hasPermission('import.timed_out.manage') ? (
                        <button
                          onClick={() => void restore(order)}
                          disabled={restoringId === order.id}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white px-3 py-2 text-[10px] font-black disabled:opacity-40 whitespace-nowrap"
                        >
                          {restoringId === order.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          Restore & pay
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
