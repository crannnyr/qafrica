// src/pages/import-admin/ImportAdminAnalytics.tsx
// "At a glance" analytics for the import admin: revenue/profit KPIs, payment
// method split, delivery type split, order status breakdown, and a daily
// revenue trend. All data comes from china-import's admin-analytics action.
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, Package, Users, DollarSign, RefreshCw, Calendar, ShoppingCart, Clock3, Boxes, Truck, ReceiptText, RotateCcw, Layers3, MessageCircle, CheckCircle2,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface Analytics {
  orders_count: number;
  units_sold: number;
  revenue_ngn: number;
  cost_ngn: number;
  profit_ngn: number;
  margin_pct: number;
  new_customers_count: number;
  daily_trend: { date: string; orders: number; revenue_ngn: number }[];
  customer_daily_trend: { date: string; users: number }[];
  payment_method_breakdown: { method: string; orders: number; revenue_ngn: number }[];
  delivery_type_breakdown: { type: string; orders: number; revenue_ngn: number }[];
  status_breakdown: { status: string; count: number }[];
  live_operations?: {
    all_orders_count: number;
    unpaid_orders_count: number;
    unpaid_orders_value_ngn: number;
    units_awaiting_arrival: number;
    inventory_units: number;
    active_shipments_count: number;
    in_transit_shipments_count: number;
    pending_bills_count: number;
    pending_bills_value_ngn: number;
    pending_refunds_count: number;
    pending_refunds_value_ngn: number;
    active_batches_count: number;
    fulfillment_open_lines: number;
    fulfillment_hq_units: number;
    fulfillment_allocated_units: number;
    support_ai_count: number;
    support_waiting_count: number;
    support_human_active_count: number;
    support_resolved_count: number;
  };
}

function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}
function liveNumber(n: number | null | undefined) {
  return Math.round(Number(n ?? 0)).toLocaleString();
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${Math.round(n)}`;
}

const PIE_COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#10B981', '#F43F5E', '#EAB308'];

const PAYMENT_LABELS: Record<string, string> = {
  paystack: 'Paystack', manual: 'Bank transfer', unknown: 'Unspecified',
};
const DELIVERY_LABELS: Record<string, string> = {
  to_qafrica: 'To QAFRICA', to_me: 'Direct to customer', unknown: 'Unspecified',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', billed: 'Billed', to_review: 'To Review', unknown: 'Unknown',
};

function KpiCard({ icon: Icon, label, value, sub, iconBg = 'bg-gray-50', iconColor = 'text-gray-400' }: { icon: any; label: string; value: string; sub?: string; iconBg?: string; iconColor?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-black text-gray-900 text-xl leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="font-semibold text-gray-800 text-sm mb-3">{title}</p>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 shadow-xl">
      {label && <p className="text-xs text-gray-400 mb-1.5">{label}</p>}
      {payload.map((entry: any) => (
        <div key={entry.dataKey ?? entry.name} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill ?? entry.color }} />
          <span className="text-gray-300 capitalize">{entry.name}:</span>
          <span className="text-white font-semibold">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const RANGE_PRESETS = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
] as const;

export default function ImportAdminV2Analytics() {
  const token = getManagementToken() || '';
  const [range, setRange] = useState<typeof RANGE_PRESETS[number]['key']>('30d');
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const preset = RANGE_PRESETS.find(r => r.key === range)!;
      const body: any = { manager_token: token };
      if (preset.days) {
        body.date_from = new Date(Date.now() - preset.days * 86_400_000).toISOString();
      }
      const res = await fetch(`${EDGE_URL}?action=admin-analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setData(json.analytics ?? null);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, range]);

  useEffect(() => { load(); }, [load]);

  // Both charts consume the same response produced by the top range selector.
  // This keeps Revenue trend and New users trend on exactly the same date window.
  const trendFormatted = (data?.daily_trend ?? []).map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
  }));
  const usersTrendFormatted = (data?.customer_daily_trend ?? []).map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
  }));

  const paymentPieData = (data?.payment_method_breakdown ?? []).map(p => ({
    name: PAYMENT_LABELS[p.method] ?? p.method, value: p.orders,
  }));
  const deliveryPieData = (data?.delivery_type_breakdown ?? []).map(d => ({
    name: DELIVERY_LABELS[d.type] ?? d.type, value: d.orders,
  }));
  const statusBarData = (data?.status_breakdown ?? []).map(s => ({
    name: STATUS_LABELS[s.status] ?? s.status, count: s.count,
  }));

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-gray-300" />
        <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1 flex-1">
          {RANGE_PRESETS.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                range === r.key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={load} disabled={isLoading} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-300">Couldn't load analytics.</p>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={DollarSign} label="Revenue" value={fmtCompact(data.revenue_ngn)} sub={`${data.orders_count} paid orders`} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <KpiCard icon={TrendingUp} label="Profit" value={fmtCompact(data.profit_ngn)} sub={`${data.margin_pct}% margin`} iconBg="bg-violet-50" iconColor="text-violet-600" />
            <KpiCard icon={Package} label="Units sold" value={data.units_sold.toLocaleString()} sub={`Cost ${fmtCompact(data.cost_ngn)}`} iconBg="bg-blue-50" iconColor="text-blue-600" />
            <KpiCard icon={Users} label="New customers" value={data.new_customers_count.toLocaleString()} sub="in this range" iconBg="bg-cyan-50" iconColor="text-cyan-600" />
          </div>

          {/* Live operational snapshot */}
          <div>
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-black text-gray-900">Live operations</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Current operational workload, inventory and payment queues.</p>
              </div>
              <span className="text-[10px] font-semibold text-gray-400">Live snapshot</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={ShoppingCart} label="All orders" value={liveNumber(data.live_operations?.all_orders_count)} sub="all import orders" iconBg="bg-indigo-50" iconColor="text-indigo-600" />
              <KpiCard icon={Clock3} label="Unpaid orders" value={liveNumber(data.live_operations?.unpaid_orders_count)} sub={fmtCompact(data.live_operations?.unpaid_orders_value_ngn ?? 0) + ' outstanding'} iconBg="bg-amber-50" iconColor="text-amber-600" />
              <KpiCard icon={Package} label="Inventory on hand" value={liveNumber(data.live_operations?.inventory_units)} sub="units available" iconBg="bg-sky-50" iconColor="text-sky-600" />
              <KpiCard icon={Truck} label="Active shipments" value={liveNumber(data.live_operations?.active_shipments_count)} sub={liveNumber(data.live_operations?.in_transit_shipments_count) + ' in transit'} iconBg="bg-orange-50" iconColor="text-orange-600" />
              <KpiCard icon={ReceiptText} label="Pending bills" value={liveNumber(data.live_operations?.pending_bills_count)} sub={fmtCompact(data.live_operations?.pending_bills_value_ngn ?? 0) + ' awaiting'} iconBg="bg-rose-50" iconColor="text-rose-600" />
              <KpiCard icon={RotateCcw} label="Pending refunds" value={liveNumber(data.live_operations?.pending_refunds_count)} sub={fmtCompact(data.live_operations?.pending_refunds_value_ngn ?? 0) + ' to process'} iconBg="bg-teal-50" iconColor="text-teal-600" />
            </div>
          </div>

          {/* Fulfillment */}
          <div>
            <div className="mb-3">
              <p className="text-sm font-black text-gray-900">Fulfillment</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Live movement from China arrival through allocation at QAFRICA.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={Boxes} label="Awaiting arrival" value={liveNumber(data.live_operations?.units_awaiting_arrival)} sub={liveNumber(data.live_operations?.fulfillment_open_lines) + ' open lines'} iconBg="bg-fuchsia-50" iconColor="text-fuchsia-600" />
              <KpiCard icon={Package} label="At QAFRICA HQ" value={liveNumber(data.live_operations?.fulfillment_hq_units)} sub="units received" iconBg="bg-lime-50" iconColor="text-lime-600" />
              <KpiCard icon={Truck} label="Allocated" value={liveNumber(data.live_operations?.fulfillment_allocated_units)} sub="units fully allocated" iconBg="bg-purple-50" iconColor="text-purple-600" />
              <KpiCard icon={Layers3} label="Active batches" value={liveNumber(data.live_operations?.active_batches_count)} sub="batches in progress" iconBg="bg-red-50" iconColor="text-red-600" />
            </div>
          </div>

          {/* Support */}
          <div>
            <div className="mb-3">
              <p className="text-sm font-black text-gray-900">Customer support</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Live WhatsApp AI and human-support workload.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={MessageCircle} label="AI handling" value={liveNumber(data.live_operations?.support_ai_count)} sub="AI conversations" iconBg="bg-yellow-50" iconColor="text-yellow-600" />
              <KpiCard icon={MessageCircle} label="Waiting for human" value={liveNumber(data.live_operations?.support_waiting_count)} sub="customer requests" iconBg="bg-green-50" iconColor="text-green-600" />
              <KpiCard icon={Users} label="Human active" value={liveNumber(data.live_operations?.support_human_active_count)} sub="agent conversations" iconBg="bg-blue-50" iconColor="text-blue-600" />
              <KpiCard icon={CheckCircle2} label="Resolved" value={liveNumber(data.live_operations?.support_resolved_count)} sub="resolved conversations" iconBg="bg-slate-50" iconColor="text-slate-600" />
            </div>
          </div>

                    {/* Revenue trend */}
          <ChartCard title="Revenue trend">
            {trendFormatted.length === 0 ? (
              <p className="text-xs text-gray-300 py-8 text-center">No paid orders in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={trendFormatted} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={(v) => fmtCompact(v)} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }} />
                  <Bar dataKey="revenue_ngn" name="Revenue" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* New users trend */}
          <ChartCard title="New users trend">
            {usersTrendFormatted.length === 0 ? (
              <p className="text-xs text-gray-300 py-8 text-center">No new users in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={usersTrendFormatted} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }} />
                  <Bar dataKey="users" name="New users" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Payment method + delivery type side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChartCard title="Payment method">
              {paymentPieData.length === 0 ? (
                <p className="text-xs text-gray-300 py-8 text-center">No orders yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={paymentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} paddingAngle={2}>
                      {paymentPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Delivery preference">
              {deliveryPieData.length === 0 ? (
                <p className="text-xs text-gray-300 py-8 text-center">No orders yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={deliveryPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} paddingAngle={2}>
                      {deliveryPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Status breakdown */}
          <ChartCard title="Orders by status">
            {statusBarData.length === 0 ? (
              <p className="text-xs text-gray-300 py-8 text-center">No orders yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={statusBarData} layout="vertical" barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="count" name="Orders" fill="#0EA5E9" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <p className="text-[10px] text-gray-300 text-center leading-relaxed px-4">
            Revenue, profit, and units reflect paid orders only. Payment method, delivery preference, and status charts include all orders in range, so admins can see where things are stuck.
          </p>
        </>
      )}
    </div>
  );
}
