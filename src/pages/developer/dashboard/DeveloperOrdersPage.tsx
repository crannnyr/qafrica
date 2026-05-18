// src/pages/developer/dashboard/DeveloperOrdersPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Search, X, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle, RefreshCw, Calendar,
  TrendingUp, Package, CheckCircle, XCircle,
  ChevronRight as Arrow,
} from 'lucide-react';
import { useDeveloperOrderStore } from '@/stores/developerOrderStore';
import { OrderStatusBadge }       from '@/components/developer/OrderStatusBadge';
import type { DeveloperOrderStatus } from '@/types/developer';

// ── Status filter tabs ────────────────────────────────────────
const STATUS_TABS: { label: string; value: DeveloperOrderStatus | '' }[] = [
  { label: 'All',             value: '' },
  { label: 'Pending',         value: 'pending' },
  { label: 'Confirmed',       value: 'confirmed' },
  { label: 'Shipped',         value: 'shipped' },
  { label: 'Delivered',       value: 'delivered' },
  { label: 'Cancelled',       value: 'cancelled' },
];

// ── Stat card ─────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-tight">
          {typeof value === 'number' && label.toLowerCase().includes('revenue')
            ? `₦${value.toLocaleString()}`
            : value
          }
        </p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────
function OrderRow({ order, onClick }: { order: any; onClick: () => void }) {
  const date = new Date(order.created_at).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full bg-white border border-gray-100 rounded-xl p-4 flex items-center
        gap-4 shadow-sm hover:shadow-md hover:border-orange-200 transition-all duration-200 text-left"
    >
      {/* Order number + customer */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <span className="font-bold text-gray-900 text-sm font-mono">
            {order.order_number}
          </span>
          <OrderStatusBadge status={order.status} size="sm" />
          {order.payment_status === 'paid' && (
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Paid
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {order.customer_name} · {order.customer_email}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{date} · {order.delivery_state}</p>
      </div>

      {/* Total */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-gray-900">
          ₦{order.total.toLocaleString()}
        </p>
        {order.tracking_number && (
          <p className="text-xs text-gray-400 mt-0.5 font-mono">
            {order.tracking_number}
          </p>
        )}
      </div>

      <Arrow className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </motion.button>
  );
}

// ── Date range picker ─────────────────────────────────────────
function DateRange({
  from, to,
  onFromChange, onToChange,
}: {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-700
          focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
          bg-white transition-colors"
      />
      <span className="text-xs text-gray-400">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-700
          focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
          bg-white transition-colors"
      />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperOrdersPage() {
  const navigate = useNavigate();
  const {
    orders, ordersPage, ordersTotal, ordersPages,
    ordersLoading, ordersError, filters, stats,
    fetchOrders, setFilters, resetFilters,
  } = useDeveloperOrderStore();

  const [search,   setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  // Initial load
  useEffect(() => {
    fetchOrders({ page: 1 });
  }, []);

  // Apply date range filter
  useEffect(() => {
    if (dateFrom || dateTo) {
      fetchOrders({
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        page: 1,
      });
    }
  }, [dateFrom, dateTo]);

  // Local search filter
  const filtered = search
    ? orders.filter((o) =>
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_email.toLowerCase().includes(search.toLowerCase()) ||
        (o.tracking_number ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : orders;

  function handleStatusTab(status: DeveloperOrderStatus | '') {
    setSearch('');
    fetchOrders({ status: status || undefined, page: 1 });
  }

  function handleClearFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    resetFilters();
    fetchOrders({ page: 1 });
  }

  const hasActiveFilters = !!(filters.status || filters.date_from || filters.date_to);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            All orders placed through your API integration.
          </p>
        </div>
        <button
          onClick={() => fetchOrders({ page: ordersPage })}
          disabled={ordersLoading}
          className="h-9 px-4 border border-gray-200 text-gray-600 font-medium
            rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={ClipboardList}
          color="bg-yellow-50 text-yellow-500"
        />
        <StatCard
          label="In Transit"
          value={stats.shipped}
          icon={Package}
          color="bg-purple-50 text-purple-500"
        />
        <StatCard
          label="Delivered"
          value={stats.delivered}
          icon={CheckCircle}
          color="bg-green-50 text-green-500"
        />
        <StatCard
          label="Total Value"
          value={stats.totalValue}
          icon={TrendingUp}
          color="bg-orange-50 text-orange-500"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusTab(tab.value)}
            className={`h-8 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
              (filters.status ?? '') === tab.value
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + date range */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, name, email, tracking..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-sm
              text-gray-900 placeholder-gray-400 bg-white focus:outline-none
              focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <DateRange
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />

        {(hasActiveFilters || search) && (
          <button
            onClick={handleClearFilters}
            className="h-10 px-4 border border-orange-200 text-orange-600 text-sm
              font-medium rounded-xl hover:bg-orange-50 transition-colors flex items-center gap-2"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Error */}
      {ordersError && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{ordersError}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {ordersLoading && orders.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 animate-pulse h-20">
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-1/4" />
              </div>
              <div className="w-20 space-y-2">
                <div className="h-4 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!ordersLoading && orders.length === 0 && !ordersError && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">No orders yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Orders placed through your API will appear here.
          </p>
          <a
            href="/developer/dashboard/docs"
            className="text-sm font-semibold text-orange-600 hover:underline"
          >
            View API docs →
          </a>
        </div>
      )}

      {/* No search results */}
      {!ordersLoading && orders.length > 0 && filtered.length === 0 && search && (
        <div className="text-center py-10">
          <p className="text-sm text-gray-500">No orders match "{search}".</p>
          <button onClick={() => setSearch('')} className="text-sm text-orange-600 font-medium mt-1 hover:underline">
            Clear search
          </button>
        </div>
      )}

      {/* Orders list */}
      {filtered.length > 0 && (
        <>
          <div className="space-y-2.5">
            <AnimatePresence>
              {filtered.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onClick={() => navigate(`/developer/dashboard/orders/${order.id}`)}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {ordersPages > 1 && !search && (
            <div className="flex items-center justify-between mt-8">
              <p className="text-sm text-gray-500">{ordersTotal.toLocaleString()} orders</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchOrders({ page: ordersPage - 1 })}
                  disabled={ordersPage <= 1 || ordersLoading}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-gray-700 px-3">
                  {ordersPage} / {ordersPages}
                </span>
                <button
                  onClick={() => fetchOrders({ page: ordersPage + 1 })}
                  disabled={ordersPage >= ordersPages || ordersLoading}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}