import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, Search, Package, CheckCircle, Truck, Clock, Eye, Lock 
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
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
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

  // FIX: Detect dropshipped orders using item.original_owner_id directly from
  // order_items DB columns — the old code relied on item.product?.original_owner_id
  // which is a nested join that isn't always loaded and caused silent false negatives.
  const getIsDropshipped = (order: Order) =>
    order.items?.some(
      (item: any) =>
        item.is_imported &&
        item.original_owner_id &&
        item.original_owner_id !== currentStore?.owner_id
    ) ?? false;

  // FIX: For dropshipped orders, calculate the dropshipper's net earnings
  // (their markup over the dropship_price, minus the 8% platform fee) so we
  // show a meaningful number in the Total column instead of the full order total.
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
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 mt-1">Manage and track your orders</p>
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
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
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
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
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
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-10 h-10 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-500">Orders will appear here when customers make purchases</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const StatusIcon = statusIcons[order.status as keyof typeof statusIcons] || Package;

                  // FIX: Use item.original_owner_id directly (DB column) instead of
                  // item.product?.original_owner_id (nested join not always present)
                  const isDropshipped = getIsDropshipped(order);
                  const dropshipperEarnings = getDropshipperEarnings(order);

                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{order.order_number}</p>
                        <p className="text-sm text-gray-500">{order.items?.length || 0} items</p>
                        {/* Badge so it's clear at a glance this order has dropshipped items */}
                        {isDropshipped && (
                          <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            Dropshipped
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                        <p className="text-sm text-gray-500">{order.customer_email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          statusColors[order.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
                        }`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>

                      {/* FIX: For dropshipped orders show the dropshipper's net earnings
                          (margin minus 8% platform fee) with a "Your Earnings" label
                          instead of the full customer-facing order total. */}
                      <td className="px-6 py-4 text-right">
                        {isDropshipped && dropshipperEarnings !== null ? (
                          <div>
                            <p className="font-medium text-gray-900">
                              ₦{dropshipperEarnings.toLocaleString()}
                            </p>
                            <p className="text-xs text-blue-500">Your Earnings</p>
                          </div>
                        ) : (
                          <p className="font-medium text-gray-900">
                            ₦{(order as any).total_amount?.toLocaleString() ?? order.total?.toLocaleString()}
                          </p>
                        )}
                      </td>

                      {/* FIX: Dropshipped orders now show a navigable "View Earnings" button
                          instead of the disabled "Supplier Fulfills" badge — dropshippers
                          can still view the order detail and see their earnings breakdown. */}
                      <td className="px-6 py-4 text-right">
                        {isDropshipped ? (
                          <button
                            onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Earnings
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 text-xs font-medium rounded-lg transition-colors"
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