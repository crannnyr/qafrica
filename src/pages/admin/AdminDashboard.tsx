import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Store, Package, ShoppingCart,
  DollarSign, CreditCard, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useWalletStore } from '@/stores';

interface DashboardStats {
  total_users: number;
  total_stores: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  pending_withdrawals: number;
  pending_verifications: number;
  blocked_stores: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { pendingWithdrawals, fetchPendingWithdrawals } = useWalletStore();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
        if (error) throw error;
        // RPC returns JSON directly
        setStats(typeof data === 'string' ? JSON.parse(data) : data);
      } catch (err) {
        console.error('[AdminDashboard] Stats error:', err);
      }
      setIsLoading(false);
    };
    fetchStats();
    fetchPendingWithdrawals();
  }, [fetchPendingWithdrawals]);

  const cards = stats ? [
    { label: 'Total Users',          value: stats.total_users,                                          icon: Users,         color: 'text-blue-600',   bg: 'bg-blue-50',   link: '/admin/users'      },
    { label: 'Total Stores',         value: stats.total_stores,                                         icon: Store,         color: 'text-green-600',  bg: 'bg-green-50',  link: '/admin/stores'     },
    { label: 'Total Products',       value: stats.total_products,                                       icon: Package,       color: 'text-purple-600', bg: 'bg-purple-50', link: '/admin/products'   },
    { label: 'Total Orders',         value: stats.total_orders,                                         icon: ShoppingCart,  color: 'text-orange-600', bg: 'bg-orange-50', link: '/admin/orders'     },
    { label: 'Total Revenue',        value: `₦${(stats.total_revenue / 1_000_000).toFixed(1)}M`,       icon: DollarSign,    color: 'text-pink-600',   bg: 'bg-pink-50',   link: '/admin/orders'     },
    { label: 'Pending Withdrawals',  value: stats.pending_withdrawals,                                  icon: CreditCard,    color: 'text-red-600',    bg: 'bg-red-50',    link: '/admin/withdrawals'},
    { label: 'Unverified Stores',    value: stats.pending_verifications,                                icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50',  link: '/admin/stores'     },
    { label: 'Blocked Stores',       value: stats.blocked_stores,                                       icon: CheckCircle,   color: 'text-gray-600',   bg: 'bg-gray-100',  link: '/admin/stores'     },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-xs text-gray-400 mt-0.5">Live platform overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                <div className="w-8 h-8 bg-gray-100 rounded-lg mb-3" />
                <div className="h-6 w-16 bg-gray-100 rounded mb-1" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            ))
          : cards.map(({ label, value, icon: Icon, color, bg, link }) => (
              <Link key={label} to={link}
                className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </Link>
            ))
        }
      </div>

      {/* Pending Withdrawals */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Pending Withdrawals</h2>
          <div className="flex items-center gap-2">
            {pendingWithdrawals.length > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                {pendingWithdrawals.length}
              </span>
            )}
            <Link to="/admin/withdrawals" className="text-xs text-orange-500 hover:underline">
              View all
            </Link>
          </div>
        </div>

        {pendingWithdrawals.length === 0 ? (
          <div className="py-10 text-center">
            <CreditCard className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No pending withdrawals</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pendingWithdrawals.slice(0, 5).map(w => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">₦{w.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{w.bank_name} · {w.account_number}</p>
                </div>
                <Link to="/admin/withdrawals"
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors">
                  Review
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}