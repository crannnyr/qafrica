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
        <div className="grid xl:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-60 bg-white rounded-3xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-14 text-center">
          <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-200" />
          <h3 className="font-bold text-gray-800 mt-4">No expired orders waiting for recovery</h3>
          <p className="text-xs text-gray-400 mt-1">When an order times out, it will appear here for review.</p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-4">
          {orders.map(order => (
            <article key={order.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Clock3 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-black text-sm text-gray-900">{order.code}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <UserRound className="w-3 h-3 text-gray-300" />
                        <p className="text-xs font-semibold text-gray-700 truncate">{order.customer_name}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        {order.customer_email || 'No email'}{order.customer_phone ? ' · ' + order.customer_phone : ''}
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-black text-gray-900 flex-shrink-0">{money(order.total_ngn)}</p>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    {order.payment_method === 'manual' ? 'Manual transfer' : order.payment_method === 'paystack' ? 'Paystack' : 'Unknown payment'}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    {order.delivery_type === 'to_qafrica' ? 'To QAFRICA / Jumia' : 'To customer'}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                    Timed out {timeSince(order.failed_at)}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-400">
                  <span>Original order {new Date(order.order_created_at).toLocaleDateString()}</span>
                  <span>Expired {new Date(order.failed_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="px-5 py-4 bg-gray-50/70 border-t border-gray-100">
                {hasPermission('import.timed_out.manage') ? (
                  <button
                    onClick={() => void restore(order)}
                    disabled={restoringId === order.id}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white py-3 text-xs font-black disabled:opacity-40"
                  >
                    {restoringId === order.id ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Restore & mark paid
                  </button>
                ) : (
                  <p className="text-center text-[11px] font-semibold text-gray-400">View-only access · recovery permission required to restore</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
