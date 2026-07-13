import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, Search, Package, CheckCircle, Truck, Clock, Eye 
} from 'lucide-react';
import { useStoreStore, useOrderStore } from '@/stores';
import type { Order } from '@/types';

const statusFilters = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const statusIcons = {
  pending: Clock,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: Clock,
};

const statusColors = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  processing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  shipped: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  delivered: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { currentStore } = useStoreStore();
  const { orders, fetchStoreOrders } = useOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');

  useEffect(() => {
    if (currentStore?.id) {
      fetchStoreOrders(currentStore.id);
    }
  }, [currentStore, fetchStoreOrders]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || order.status === selectedStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const getIsDropshipped = (order: Order) =>
    order.items?.some(
      (item: any) =>
        item.is_imported &&
        item.original_owner_id &&
        item.original_owner_id !== currentStore?.owner_id
    ) ?? false;

  const getDropshipperEarnings = (order: Order): number | null => {
    if (!getIsDropshipped(order)) return null;
    const margin =
      order.items?.reduce((sum: number, item: any) => {
        if (
          item.is_imported &&
          item.original_owner_id &&
          item.original_owner_id !== currentStore?.owner_id
        ) {
          return sum + (((item.unit_price ?? 0) - (item.dropship_price ?? 0)) * item.quantity);
        }
        return sum;
      }, 0) ?? 0;
    const platformFee = margin * 0.08;
    return margin - platformFee;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and track your orders</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: orders.length, color: 'bg-blue-500' },
          { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: 'bg-yellow-500' },
          { label: 'Processing', value: orders.filter(o => o.status === 'processing').length, color: 'bg-orange-500' },
          { label: 'Delivered', value: orders.filter(o => o.status === 'delivered').length, color: 'bg-green-500' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
          >
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedStatus === status
                  ? 'bg-orange-500 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-10 h-10 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No orders yet</h3>
            <p className="text-gray-500 dark:text-gray-400">Orders will appear here when customers make purchases</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredOrders.map((order) => {
                  const StatusIcon = statusIcons[order.status as keyof typeof statusIcons] || Package;
                  const isDropshipped = getIsDropshipped(order);
                  const dropshipperEarnings = getDropshipperEarnings(order);

                  return (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{order.order_number}</p>
                        {/* BUG FIX: use order_items if items alias not present */}
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {(order.order_items ?? order.items)?.length || 0} items
                        </p>
                        {isDropshipped && (
                          <span className="inline-block mt-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            Dropshipped
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{order.customer_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{order.customer_email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          statusColors[order.status as keyof typeof statusColors] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isDropshipped && dropshipperEarnings !== null ? (
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              ₦{dropshipperEarnings.toLocaleString()}
                            </p>
                            <p className="text-xs text-blue-500 dark:text-blue-400">Your Earnings</p>
                          </div>
                        ) : (
                          <p className="font-medium text-gray-900 dark:text-white">
                            ₦{(order as any).total_amount?.toLocaleString() ?? order.total?.toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isDropshipped ? (
                          <button
                            onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-medium rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Earnings
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-xs font-medium rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Manage
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
