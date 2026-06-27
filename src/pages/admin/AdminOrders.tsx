import { useState, useEffect } from 'react';
import { ShoppingCart, Search } from 'lucide-react';
import { orderService } from '@/services';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      // Calls edge function with mode: 'admin' — requires admin role in profiles
      const { data, error } = await orderService.getAllOrders();
      if (error) {
        console.error('Failed to load orders:', error);
      } else {
        setOrders(data || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) =>
    o.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 mt-1">Manage all platform orders</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by order number, customer name or email..."
          className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{order.order_number}</p>
                          <p className="text-xs text-gray-400">{order.order_items?.length || 0} items</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{order.customer_name}</p>
                      <p className="text-sm text-gray-500">{order.customer_email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.store?.name || order.store_id?.slice(0, 8) + '...'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[order.status] || 'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      ₦{order.total?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
