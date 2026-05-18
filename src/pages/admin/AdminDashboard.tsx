import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Store, Package, ShoppingCart, CreditCard, 
  TrendingUp, TrendingDown, DollarSign, Activity
} from 'lucide-react';
import { useAdminStore, useWalletStore } from '@/stores';

const stats = [
  { label: 'Total Users', value: '1,234', change: '+12%', icon: Users, color: 'bg-blue-500' },
  { label: 'Active Stores', value: '856', change: '+8%', icon: Store, color: 'bg-green-500' },
  { label: 'Total Products', value: '12,456', change: '+15%', icon: Package, color: 'bg-purple-500' },
  { label: 'Total Orders', value: '3,789', change: '+22%', icon: ShoppingCart, color: 'bg-orange-500' },
  { label: 'Revenue', value: '₦45.2M', change: '+18%', icon: DollarSign, color: 'bg-pink-500' },
  { label: 'Pending Withdrawals', value: '23', change: '-5%', icon: CreditCard, color: 'bg-red-500' },
];

const recentActivity = [
  { action: 'New store created', detail: 'Fashion Hub Nigeria', time: '2 mins ago' },
  { action: 'Order completed', detail: 'Order #12345 - ₦45,000', time: '5 mins ago' },
  { action: 'Withdrawal request', detail: '₦50,000 - Chioma Adeyemi', time: '15 mins ago' },
  { action: 'New user registered', detail: 'emmanuel@email.com', time: '1 hour ago' },
  { action: 'Store verified', detail: 'Electronics World', time: '2 hours ago' },
];

export default function AdminDashboard() {
  const { fetchDashboardStats } = useAdminStore();
  const { pendingWithdrawals, fetchPendingWithdrawals } = useWalletStore();

  useEffect(() => {
    fetchDashboardStats();
    fetchPendingWithdrawals();
  }, [fetchDashboardStats, fetchPendingWithdrawals]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of platform performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-xl p-6 border border-gray-100"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <div className={`flex items-center gap-1 mt-2 ${
                  stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change.startsWith('+') ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">{stat.change}</span>
                </div>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-gray-100 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Revenue Trend</h2>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">Revenue chart will appear here</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl border border-gray-100 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-6">User Growth</h2>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">User growth chart will appear here</p>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity & Pending Withdrawals */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl border border-gray-100 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-500">{activity.detail}</p>
                </div>
                <p className="text-sm text-gray-400">{activity.time}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pending Withdrawals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Pending Withdrawals</h2>
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              {pendingWithdrawals.length} pending
            </span>
          </div>
          {pendingWithdrawals.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No pending withdrawals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingWithdrawals.slice(0, 5).map((withdrawal) => (
                <div key={withdrawal.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">₦{withdrawal.amount.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{withdrawal.bank_name} - {withdrawal.account_number}</p>
                  </div>
                  <button className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
