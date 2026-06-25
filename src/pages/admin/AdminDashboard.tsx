import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Store, Package, ShoppingCart, DollarSign,
  CreditCard, AlertTriangle, TrendingUp, Zap,
  Clock, CheckCircle, RefreshCw, UserPlus, Crown
} from 'lucide-react';
import { supabase } from '@/services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AllTimeStats {
  total_users: number;
  total_stores: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  pending_withdrawals: number;
  pending_verifications: number;
  blocked_stores: number;
}

interface TodayStats {
  signups_today: number;
  stores_created_today: number;
  orders_today: number;
  revenue_today: number;
  paid_immediately: number;
  subscriptions_today: number;
  withdrawals_today: number;
}

interface RecentUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  store_name: string | null;
  store_created_at: string | null;
  has_paid: boolean;
  mins_to_subscribe: number | null;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  status: string;
  store_name: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(d: string) {
  return new Date(d).toLocaleString('en-NG', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeSince(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700',
  confirmed:  'bg-sky-100 text-sky-700',
  shipped:    'bg-blue-100 text-blue-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, bg, sub, link }: {
  label: string; value: string | number; icon: any;
  color: string; bg: string; sub?: string; link?: string;
}) {
  const inner = (
    <div className={`${bg} rounded-xl p-4 border border-white hover:shadow-sm transition-shadow`}>
      <div className="w-8 h-8 bg-white/70 rounded-lg flex items-center justify-center mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-black ${color} leading-none`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, to }: { title: string; sub?: string; to?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {to && <Link to={to} className="text-xs text-orange-500 hover:underline font-medium">View all</Link>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [allTime, setAllTime]           = useState<AllTimeStats | null>(null);
  const [today, setToday]               = useState<TodayStats | null>(null);
  const [recentUsers, setRecentUsers]   = useState<RecentUser[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [pendingWd, setPendingWd]       = useState<any[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [lastRefresh, setLastRefresh]   = useState(new Date());

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const load = useCallback(async () => {
    setIsLoading(true);

    // ── All-time stats via RPC ──────────────────────────────────────────────
    const { data: rpc } = await supabase.rpc('get_admin_dashboard_stats');
    if (rpc) setAllTime(typeof rpc === 'string' ? JSON.parse(rpc) : rpc);

    // ── Today's signups ─────────────────────────────────────────────────────
    const { count: signupsToday } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    // ── Today's stores created ──────────────────────────────────────────────
    const { count: storesToday } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    // ── Today's orders + revenue ────────────────────────────────────────────
    const { data: ordersToday } = await supabase
      .from('orders')
      .select('total, platform_fee')
      .gte('created_at', todayISO)
      .eq('payment_status', 'paid');

    const revenueToday = (ordersToday || []).reduce((s, o) => s + (o.platform_fee || 0), 0);

    // ── Today's subscriptions ───────────────────────────────────────────────
    const { count: subsToday } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('is_trial', false)
      .gte('created_at', todayISO);

    // ── Users who paid within 30 mins of signing up ─────────────────────────
    // FIX: Supabase RPC calls return a PostgrestFilterBuilder which does not
    // have a .catch() method. Use try/catch instead.
    let quickPayers: any[] | null = null;
    try {
      const { data } = await supabase.rpc('get_quick_payers_today');
      quickPayers = data;
    } catch {
      quickPayers = null;
    }
    const paidImmediately = quickPayers?.length ?? 0;

    // ── Today's withdrawals requested ───────────────────────────────────────
    const { count: wdToday } = await supabase
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    setToday({
      signups_today:        signupsToday ?? 0,
      stores_created_today: storesToday  ?? 0,
      orders_today:         ordersToday?.length ?? 0,
      revenue_today:        revenueToday,
      paid_immediately:     paidImmediately,
      subscriptions_today:  subsToday ?? 0,
      withdrawals_today:    wdToday   ?? 0,
    });

    // ── Recent users with store + subscription info ─────────────────────────
    const { data: users } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(8);

    if (users?.length) {
      const userIds = users.map(u => u.id);

      const { data: stores } = await supabase
        .from('stores')
        .select('owner_id, name, created_at')
        .in('owner_id', userIds);

      const { data: subs } = await supabase
        .from('subscriptions')
        .select('user_id, created_at, is_trial')
        .in('user_id', userIds)
        .eq('is_trial', false)
        .order('created_at', { ascending: true });

      const storeMap = Object.fromEntries((stores || []).map(s => [s.owner_id, s]));
      const subMap   = Object.fromEntries((subs   || []).map(s => [s.user_id,  s]));

      setRecentUsers(users.map(u => {
        const store = storeMap[u.id];
        const sub   = subMap[u.id];
        const minsToSub = sub
          ? Math.floor((new Date(sub.created_at).getTime() - new Date(u.created_at).getTime()) / 60_000)
          : null;
        return {
          ...u,
          store_name:        store?.name       ?? null,
          store_created_at:  store?.created_at ?? null,
          has_paid:          !!sub,
          mins_to_subscribe: minsToSub,
        };
      }));
    }

    // ── Recent orders ───────────────────────────────────────────────────────
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total, status, created_at, store:stores(name)')
      .order('created_at', { ascending: false })
      .limit(6);

    setRecentOrders((orders || []).map((o: any) => ({
      id:            o.id,
      order_number:  o.order_number,
      customer_name: o.customer_name,
      total:         o.total,
      status:        o.status,
      store_name:    o.store?.name ?? '—',
      created_at:    o.created_at,
    })));

    // ── Pending withdrawals ─────────────────────────────────────────────────
    const { data: wd } = await supabase
      .from('withdrawal_requests')
      .select('id, amount, account_name, bank_name, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);
    setPendingWd(wd || []);

    setIsLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { load(); }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Last updated {fmtTime(lastRefresh.toISOString())}
          </p>
        </div>
        <button onClick={load} disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── TODAY section ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <h2 className="text-sm font-bold text-gray-900">Today</h2>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
              ))
            : today && [
                { label: 'New Signups',      value: today.signups_today,        icon: UserPlus,    color: 'text-blue-600',    bg: 'bg-blue-50',    link: '/admin/users' },
                { label: 'Stores Created',   value: today.stores_created_today, icon: Store,       color: 'text-green-600',   bg: 'bg-green-50',   link: '/admin/stores' },
                { label: 'Orders',           value: today.orders_today,         icon: ShoppingCart,color: 'text-orange-600',  bg: 'bg-orange-50',  link: '/admin/orders' },
                { label: 'Revenue (fees)',   value: `₦${today.revenue_today.toLocaleString()}`, icon: DollarSign, color: 'text-pink-600', bg: 'bg-pink-50' },
                { label: 'New Paid Subs',    value: today.subscriptions_today,  icon: Crown,       color: 'text-purple-600',  bg: 'bg-purple-50',  link: '/admin/subscriptions' },
                { label: 'Paid in <30 mins', value: today.paid_immediately,     icon: Zap,         color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Signed up → paid fast' },
                { label: 'Withdrawals Req.', value: today.withdrawals_today,    icon: CreditCard,  color: 'text-red-600',     bg: 'bg-red-50',     link: '/admin/withdrawals' },
              ].map(k => <KpiCard key={k.label} {...k} />)
          }
        </div>
      </div>

      {/* ── ALL TIME section ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-gray-700 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-white" />
          </div>
          <h2 className="text-sm font-bold text-gray-900">All Time</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />
              ))
            : allTime && [
                { label: 'Total Users',         value: allTime.total_users,           icon: Users,         color: 'text-blue-600',   bg: 'bg-blue-50',   link: '/admin/users' },
                { label: 'Total Stores',        value: allTime.total_stores,          icon: Store,         color: 'text-green-600',  bg: 'bg-green-50',  link: '/admin/stores' },
                { label: 'Total Products',      value: allTime.total_products,        icon: Package,       color: 'text-purple-600', bg: 'bg-purple-50', link: '/admin/products' },
                { label: 'Total Orders',        value: allTime.total_orders,          icon: ShoppingCart,  color: 'text-orange-600', bg: 'bg-orange-50', link: '/admin/orders' },
                { label: 'Total Revenue',       value: `₦${(allTime.total_revenue / 1_000_000).toFixed(1)}M`, icon: DollarSign, color: 'text-pink-600', bg: 'bg-pink-50' },
                { label: 'Pending Withdrawals', value: allTime.pending_withdrawals,   icon: CreditCard,    color: 'text-red-600',    bg: 'bg-red-50',    link: '/admin/withdrawals' },
                { label: 'Unverified Stores',   value: allTime.pending_verifications, icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50',  link: '/admin/stores' },
                { label: 'Blocked Stores',      value: allTime.blocked_stores,        icon: AlertTriangle, color: 'text-gray-600',   bg: 'bg-gray-100',  link: '/admin/stores' },
              ].map(k => <KpiCard key={k.label} {...k} />)
          }
        </div>
      </div>

      {/* ── Bottom grid ────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Recent users */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <SectionHeader title="Recent Signups" sub="Exact join & store creation times" to="/admin/users" />
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 bg-gray-100 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-32 bg-gray-100 rounded" />
                      <div className="h-2 w-48 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))
              : recentUsers.length === 0
              ? <p className="px-5 py-8 text-sm text-gray-400 text-center">No users yet</p>
              : recentUsers.map(u => (
                  <div key={u.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-gray-500">
                        {u.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate">{u.full_name}</span>
                        <span className="text-[10px] capitalize bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {u.role}
                        </span>
                        {u.has_paid && (
                          <span className="text-[10px] bg-green-100 text-green-600 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> Paid
                          </span>
                        )}
                        {u.mins_to_subscribe !== null && u.mins_to_subscribe < 30 && (
                          <span className="text-[10px] bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" /> {u.mins_to_subscribe}m to pay
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{u.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          Joined {fmtTime(u.created_at)}
                        </span>
                        {u.store_name && (
                          <span className="flex items-center gap-0.5">
                            <Store className="w-2.5 h-2.5" />
                            {u.store_name} · {u.store_created_at ? timeSince(u.store_created_at) : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Right col: orders + withdrawals */}
        <div className="space-y-4">

          {/* Recent orders */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100">
              <SectionHeader title="Recent Orders" to="/admin/orders" />
            </div>
            <div className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-4 py-2.5 animate-pulse flex items-center gap-2">
                      <div className="flex-1 h-3 bg-gray-100 rounded" />
                      <div className="w-16 h-3 bg-gray-100 rounded" />
                    </div>
                  ))
                : recentOrders.length === 0
                ? <p className="px-4 py-6 text-xs text-gray-400 text-center">No orders yet</p>
                : recentOrders.map(o => (
                    <div key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-900">#{o.order_number}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[o.status] || 'bg-gray-100 text-gray-600'}`}>
                            {o.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">{o.customer_name} · {o.store_name}</p>
                        <p className="text-[10px] text-gray-300">{timeSince(o.created_at)}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-900 flex-shrink-0">
                        ₦{o.total.toLocaleString()}
                      </span>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* Pending withdrawals */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Pending Withdrawals</h2>
              <div className="flex items-center gap-2">
                {pendingWd.length > 0 && (
                  <span className="text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">
                    {pendingWd.length}
                  </span>
                )}
                <Link to="/admin/withdrawals" className="text-xs text-orange-500 hover:underline">View all</Link>
              </div>
            </div>
            {isLoading ? (
              <div className="px-4 py-3 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : pendingWd.length === 0 ? (
              <p className="px-4 py-6 text-xs text-gray-400 text-center">No pending withdrawals</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendingWd.map(w => {
                  const hrs = Math.floor((Date.now() - new Date(w.created_at).getTime()) / 3_600_000);
                  return (
                    <div key={w.id} className={`px-4 py-2.5 flex items-center justify-between ${hrs >= 24 ? 'bg-red-50/40' : ''}`}>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{w.account_name}</p>
                        <p className="text-[10px] text-gray-400">{w.bank_name} · {hrs}h ago</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-900">₦{w.amount.toLocaleString()}</p>
                        {hrs >= 24 && (
                          <span className="text-[9px] text-red-500 font-bold">Overdue</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
