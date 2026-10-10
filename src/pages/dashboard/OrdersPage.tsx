import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, Search, Package, CheckCircle, Truck, Clock, Eye 
} from 'lucide-react';
import { useStoreStore, useOrderStore } from '@/stores';
import { supabase } from '@/services';
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

const paymentStatusColors: Record<string, string> = {
  paid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  refunded: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
};

function formatStatus(status?: string | null) {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { currentStore } = useStoreStore();
  const { orders, fetchStoreOrders } = useOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [chinaDropshipProfitByOrder, setChinaDropshipProfitByOrder] = useState<Record<string, number>>({});
  const [orderProductImages, setOrderProductImages] = useState<Record<string, { image: string | null; name?: string }>>({});

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

  useEffect(() => {
    const items = orders.flatMap(order => getOrderItems(order).map((item: any) => ({ orderId: order.id, item })));
    const ids = [...new Set(items.flatMap(({ item }) =>
      [item?.source_id, item?.original_product_id, item?.product_id, item?.product?.id, item?.original_product?.id]
        .filter((id: unknown) => typeof id === 'string' && id.length > 0)
    ))];
    if (!ids.length) {
      setOrderProductImages({});
      return;
    }

    let cancelled = false;
    const loadImages = async () => {
      const [chinaResult, productsResult] = await Promise.all([
        supabase.from('china_import_products').select('id,name,image_url,image_urls').in('id', ids),
        supabase.from('products').select('id,name,images,image_url').in('id', ids),
      ]);
      if (cancelled) return;
      const byId = new Map<string, { image: string | null; name?: string }>();
      for (const product of chinaResult.data ?? []) {
        byId.set(product.id, {
          name: product.name,
          image: Array.isArray(product.image_urls) && product.image_urls.length
            ? product.image_urls[0]
            : product.image_url ?? null,
        });
      }
      for (const product of productsResult.data ?? []) {
        const previous = byId.get(product.id);
        const images = Array.isArray(product.images) ? product.images : [];
        byId.set(product.id, {
          name: previous?.name || product.name,
          image: previous?.image || images[0] || product.image_url || null,
        });
      }
      const next: Record<string, { image: string | null; name?: string }> = {};
      for (const { orderId, item } of items) {
        const candidates = [item?.source_id, item?.original_product_id, item?.product_id, item?.product?.id, item?.original_product?.id]
          .filter((id: unknown) => typeof id === 'string' && id.length > 0);
        const resolved = candidates.map((id: string) => byId.get(id)).find(Boolean);
        next[orderId] = {
          image: item?.product?.images?.[0] || item?.original_product?.images?.[0] || item?.image_url || item?.image || item?.product_image_url || resolved?.image || next[orderId]?.image || null,
          name: item?.product?.name || item?.original_product?.name || item?.product_name || item?.name || resolved?.name,
        };
      }
      setOrderProductImages(next);
    };
    void loadImages();
    return () => { cancelled = true; };
  }, [orders]);

  useEffect(() => {
    const orderIds = orders.map(order => order.id).filter(Boolean);
    if (!currentStore?.id || orderIds.length === 0) {
      setChinaDropshipProfitByOrder({});
      return;
    }

    let cancelled = false;
    const loadChinaDropshipEarnings = async () => {
      const { data, error } = await supabase
        .from('china_import_dropship_earnings')
        .select('seller_order_id, net_profit_ngn')
        .eq('seller_store_id', currentStore.id)
        .in('seller_order_id', orderIds);

      if (cancelled) return;
      if (error) {
        console.warn('Could not load China Import dropship earnings:', error.message);
        return;
      }
      const profits: Record<string, number> = {};
      for (const row of data ?? []) {
        profits[row.seller_order_id] = (profits[row.seller_order_id] ?? 0) + Number(row.net_profit_ngn ?? 0);
      }
      setChinaDropshipProfitByOrder(profits);
    };
    void loadChinaDropshipEarnings();
    return () => { cancelled = true; };
  }, [orders, currentStore?.id]);

  const getOrderItems = (order: Order): any[] =>
    ((order as any).order_items ?? (order as any).items ?? []) as any[];

  // China Import catalog items are identified by their explicit source marker.
  // Do not infer China Import from generic marketplace attribution; that can
  // mislabel ordinary marketplace products as dropshipped.
  const isChinaImportDropship = (item: any) =>
    item?.source_type === 'china_import' &&
    (item?.attribution_source === 'marketplace' || item?.is_imported === true || !!item?.source_id);

  const getIsDropshipped = (order: Order) =>
    !!((order as any).dropshipper_store_id || (order as any).is_dropshipped) ||
    getOrderItems(order).some((item: any) =>
      (item?.is_imported && item?.original_owner_id && item.original_owner_id !== currentStore?.owner_id) ||
      isChinaImportDropship(item)
    );

  const getDropshipperEarnings = (order: Order): number | null => {
    if (!getIsDropshipped(order)) return null;
    const persistedChinaProfit = chinaDropshipProfitByOrder[order.id];
    if (persistedChinaProfit !== undefined) return persistedChinaProfit;

    const storedProfit = Number((order as any).dropshipper_profit);
    if (Number.isFinite(storedProfit) && storedProfit > 0) return storedProfit;

    // Legacy marketplace products do not have a dedicated earnings-ledger row.
    const margin = getOrderItems(order).reduce((sum: number, item: any) => {
      const isLegacyDropship =
        item.is_imported &&
        item.original_owner_id &&
        item.original_owner_id !== currentStore?.owner_id;
      if (isLegacyDropship) {
        return sum + (((item.unit_price ?? item.price_at_time ?? 0) - (item.dropship_price ?? 0)) * item.quantity);
      }
      return sum;
    }, 0) ?? 0;
    return margin > 0 ? margin * (1 - Number((order as any).dropship_commission_rate ?? 8) / 100) : 0;
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Order Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Payment Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredOrders.map((order) => {
                  const StatusIcon = statusIcons[order.status as keyof typeof statusIcons] || Package;
                  const isDropshipped = getIsDropshipped(order);
                  const dropshipperEarnings = getDropshipperEarnings(order);
                  const paymentStatus = (order as any).payment_status as string | undefined;
                  const paymentColor = paymentStatusColors[paymentStatus ?? ''] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';

                  return (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          {(() => {
                            const firstItem = getOrderItems(order)[0];
                            const image = firstItem?.product?.images?.[0]
                              ?? firstItem?.original_product?.images?.[0]
                              ?? firstItem?.image_url
                              ?? firstItem?.image
                              ?? firstItem?.product_image_url
                              ?? orderProductImages[order.id]?.image
                              ?? null;
                            return image ? (
                              <img
                                src={image}
                                alt={firstItem?.product?.name ?? firstItem?.product_name ?? firstItem?.name ?? 'Order product'}
                                className="h-11 w-11 rounded-lg object-cover border border-gray-100 dark:border-gray-700 shrink-0"
                                onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
                              />
                            ) : (
                              <div className="h-11 w-11 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                <Package className="h-5 w-5 text-gray-400" />
                              </div>
                            );
                          })()}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{order.order_number}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {getOrderItems(order).length || 0} items
                            </p>
                          {isDropshipped && (
                            <span className="inline-block mt-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">
                              Dropshipped
                            </span>
                          )}
                          </div>
                        </div>
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
                          {formatStatus(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paymentColor}`}>
                          {formatStatus(paymentStatus)}
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
