import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Filter, ChevronDown, Eye, Truck, CheckCircle,
  Clock, XCircle, Printer, MapPin, Phone, Mail, Lock,
  ExternalLink, Download, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { orderService } from '@/services';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import type { Order } from '@/types';

const orderStatuses = [
  { value: 'all',                   label: 'All Orders',            color: 'bg-gray-500'   },
  { value: 'pending',               label: 'Pending',               color: 'bg-yellow-500' },
  { value: 'awaiting_confirmation', label: 'Awaiting Confirmation', color: 'bg-yellow-600' },
  { value: 'confirmed',             label: 'Confirmed',             color: 'bg-blue-500'   },
  { value: 'processing',            label: 'Processing',            color: 'bg-purple-500' },
  { value: 'shipped',               label: 'Shipped',               color: 'bg-indigo-500' },
  { value: 'out_for_delivery',      label: 'Out for Delivery',      color: 'bg-cyan-500'   },
  { value: 'delivered',             label: 'Delivered',             color: 'bg-green-500'  },
  { value: 'refunded',              label: 'Refunded',              color: 'bg-pink-500'   },
  { value: 'shipment_cancelled',    label: 'Shipment Cancelled',    color: 'bg-orange-500' },
  { value: 'cancelled',             label: 'Cancelled',             color: 'bg-red-500'    },
];

const terminalStatusLabel: Record<string, string> = {
  draft:              'Draft',
  confirmed:          'Confirmed',
  pending:            'Pending Pickup',
  'in-transit':       'In Transit',
  'out-for-delivery': 'Out for Delivery',
  delivered:          'Delivered',
  cancelled:          'Cancelled',
  exception:          'Exception',
};

export default function OrderManagementPage() {
  const { currentStore } = useStoreStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

  const isTerminalStore = currentStore?.delivery_mode === 'terminal';

  useEffect(() => {
    if (currentStore?.id) loadOrders();
  }, [currentStore]);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, statusFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await orderService.getStoreOrders(currentStore!.id);
      if (error) throw error;
      setOrders((data as Order[]) || []);
    } catch {
      toast.error('Failed to load orders');
    }
    setIsLoading(false);
  };

  const filterOrders = () => {
    let filtered = orders;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.order_number?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await orderService.updateOrderStatus(orderId, newStatus as Order['status']);
      if (error) throw error;
      setOrders(prev =>
        prev.map(o => o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o)
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as Order['status'] } : prev);
      }
      toast.success(`Order status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update order status');
    }
  };

  const handleShipOrder = async () => {
    if (!selectedOrder) return;
    try {
      const { error } = await orderService.updateOrderStatus(
        selectedOrder.id, 'shipped',
        { tracking_number: trackingNumber }
      );
      if (error) throw error;
      setOrders(prev =>
        prev.map(o => o.id === selectedOrder.id
          ? { ...o, status: 'shipped' as Order['status'], tracking_number: trackingNumber }
          : o)
      );
      setSelectedOrder(prev => prev
        ? { ...prev, status: 'shipped' as Order['status'], tracking_number: trackingNumber }
        : prev
      );
      toast.success('Order marked as shipped');
      setTrackingNumber('');
    } catch {
      toast.error('Failed to ship order');
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;
    setIsConfirmingPayment(true);
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Could not verify your user identity.');

      const { error } = await supabase.rpc('confirm_cod_payment', {
        p_order_id: selectedOrder.id,
        p_store_owner_id: user.id,
      });

      if (error) throw error;

      toast.success('Payment successfully confirmed!');
      loadOrders();
      setShowOrderModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm payment.');
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const printShippingLabel = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const addr = order.delivery_address as any;
    printWindow.document.write(`
      <html>
        <head>
          <title>Shipping Label - ${order.order_number || order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .label { border: 2px solid #000; padding: 20px; max-width: 400px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 15px; }
            .label-title { font-size: 12px; color: #666; text-transform: uppercase; }
            .label-value { font-size: 16px; font-weight: bold; }
            .barcode { text-align: center; margin: 20px 0; font-family: monospace; font-size: 24px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              <h2>QAFRICA SHIPPING</h2>
              <p>Order #${order.order_number || order.id.slice(0, 8)}</p>
            </div>
            <div class="section">
              <p class="label-title">Ship To:</p>
              <p class="label-value">${order.customer_name}</p>
              <p>${addr?.address || addr?.street || ''}</p>
              <p>${addr?.city || ''}, ${order.delivery_state || ''}</p>
            </div>
            <div class="section">
              <p class="label-title">Contact:</p>
              <p>${order.customer_phone}</p>
              <p>${order.customer_email}</p>
            </div>
            ${(order as any).terminal_tracking_number
              ? `<div class="section"><p class="label-title">Tracking:</p><p>${(order as any).terminal_tracking_number}</p></div>`
              : ''
            }
            <div class="barcode">*${order.order_number || order.id.slice(0, 12)}*</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusColor = (status: string) =>
    orderStatuses.find(s => s.value === status)?.color || 'bg-gray-500';

  const getNextStatus = (current: string) => {
    const flow = ['pending', 'awaiting_confirmation', 'confirmed', 'processing', 'shipped', 'delivered'];
    const idx = flow.indexOf(current);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  };

  const fmt = (amount: number) => `₦${amount?.toLocaleString() || 0}`;

  // FIX: use item.is_imported flag directly instead of item.product?.original_owner_id
  // to correctly detect dropshipped items in mixed carts
  const getDropshippedItems = (order: Order | null) => {
    if (!order) return [];
    return (order as any).items?.filter(
      (item: any) =>
        item.is_imported &&
        item.original_owner_id &&
        item.original_owner_id !== currentStore?.owner_id
    ) || [];
  };

  // FIX: check for own items separately so mixed carts are handled correctly
  const getOwnItems = (order: Order | null) => {
    if (!order) return [];
    return (order as any).items?.filter(
      (item: any) =>
        !item.is_imported || item.original_owner_id === currentStore?.owner_id
    ) || [];
  };

  const hasTerminalShipment = (order: Order | null) =>
    !!(order && (order as any).terminal_shipment_id);

  const terminalShipmentArranged = (order: Order | null) =>
    !!(order && (order as any).terminal_arranged_at);

  // FIX: pre-compute helpers for the selected order used in the modal
  const dropshippedItems = getDropshippedItems(selectedOrder);
  const ownItems = getOwnItems(selectedOrder);
  const hasDropshippedItems = dropshippedItems.length > 0;
  const hasOwnItems = ownItems.length > 0;
  const isFullyDropshipped = hasDropshippedItems && !hasOwnItems;

  // FIX: earnings breakdown for dropshipped items — margin minus 8% platform fee
  const dropshipEarnings = (() => {
    const margin = dropshippedItems.reduce((sum: number, item: any) => {
      return sum + ((item.unit_price - (item.dropship_price || 0)) * item.quantity);
    }, 0);
    const platformFee = margin * 0.08;
    return { margin, platformFee, net: margin - platformFee };
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and track all your orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadOrders}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders',  value: orders.length,                                                              icon: Package,     color: '' },
          { label: 'Pending',       value: orders.filter(o => o.status === 'pending').length,                          icon: Clock,       color: 'text-yellow-600' },
          { label: 'Processing',    value: orders.filter(o => ['confirmed','processing'].includes(o.status)).length,   icon: Package,     color: 'text-blue-600' },
          { label: 'Completed',     value: orders.filter(o => o.status === 'delivered').length,                        icon: CheckCircle, color: 'text-green-600' },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color || 'text-gray-900 dark:text-white'}`}>{stat.value}</p>
              </div>
              <stat.icon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by order number, customer name or email..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none appearance-none"
          >
            {orderStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No orders found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Orders will appear here when customers make purchases'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Order</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredOrders.map(order => {
                  // FIX: use helper functions for per-row dropship detection
                  const rowDropshippedItems = getDropshippedItems(order);
                  const rowOwnItems = getOwnItems(order);
                  const rowIsFullyDropshipped = rowDropshippedItems.length > 0 && rowOwnItems.length === 0;
                  const rowIsMixed = rowDropshippedItems.length > 0 && rowOwnItems.length > 0;
                  const hasTerminal = hasTerminalShipment(order);

                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-900 dark:text-white">
                          #{order.order_number || order.id.slice(0, 8).toUpperCase()}
                        </span>
                        {hasTerminal && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded font-medium">
                            <Truck className="w-3 h-3" />
                            T-Ship
                          </span>
                        )}
                        {/* FIX: badge for mixed cart orders */}
                        {rowIsMixed && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded font-medium">
                            Mixed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{order.customer_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{order.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {fmt((order as any).total_amount || order.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(order.status)}`}>
                          {order.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* FIX: fully dropshipped — Supplier Fulfills, no action */}
                          {rowIsFullyDropshipped ? (
                            <button
                              disabled
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium rounded-lg cursor-not-allowed"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Supplier Fulfills
                            </button>
                          ) : hasTerminal ? (
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                              Terminal Africa
                            </span>
                          ) : (
                            // FIX: mixed cart or own-only order — show status advance for own items
                            getNextStatus(order.status) && (
                              <button
                                onClick={() => {
                                  if (getNextStatus(order.status) === 'shipped') {
                                    setSelectedOrder(order);
                                    setShowOrderModal(true);
                                  } else {
                                    updateOrderStatus(order.id, getNextStatus(order.status)!);
                                  }
                                }}
                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
                              >
                                Mark {getNextStatus(order.status)?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </button>
                            )
                          )}

                          <button
                            onClick={() => printShippingLabel(order)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                            title="Print Label"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => { setSelectedOrder(order); setShowOrderModal(true); }}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Order Details Modal ── */}
      <AnimatePresence>
        {showOrderModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Order #{selectedOrder.order_number || selectedOrder.id.slice(0, 8).toUpperCase()}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Placed on {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => { setShowOrderModal(false); setTrackingNumber(''); }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">

                {/* Status row */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  {selectedOrder.tracking_number && !hasTerminalShipment(selectedOrder) && (
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg">
                      Tracking: {selectedOrder.tracking_number}
                    </span>
                  )}
                  {selectedOrder.is_escrow_released && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 px-2.5 py-1 rounded-full">
                      Escrow Released
                    </span>
                  )}
                  {/* FIX: mixed cart badge in modal header */}
                  {hasDropshippedItems && hasOwnItems && (
                    <span className="text-xs font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 px-2.5 py-1 rounded-full">
                      Mixed Cart
                    </span>
                  )}
                </div>

                {/* COD / Direct Transfer Confirmation Panel */}
                {['cod', 'direct_transfer'].includes((selectedOrder as any).payment_method) && (selectedOrder as any).payment_status === 'pending' && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Payment Verification Required
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {(selectedOrder as any).payment_method === 'cod'
                          ? 'This is a Cash on Delivery order. Confirm below only AFTER you have received the cash.'
                          : 'This is a Direct Transfer order. Confirm below only AFTER the funds reflect in your account.'}
                      </p>
                    </div>
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={isConfirmingPayment}
                      className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                    >
                      {isConfirmingPayment ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      {(selectedOrder as any).payment_method === 'cod' ? 'Confirm Cash Received' : 'Confirm Transfer Received'}
                    </Button>
                  </div>
                )}

                {/* FIX: show dropship notice only for fully dropshipped — mixed carts get the per-section breakdown below */}
                {isFullyDropshipped && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-300">Fulfillment Handled by Supplier</p>
                      <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        All items in this order are dropshipped. The original supplier handles shipping and status updates.
                      </p>
                    </div>
                  </div>
                )}

                {/* FIX: mixed cart notice */}
                {hasDropshippedItems && hasOwnItems && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex items-start gap-3">
                    <Package className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-purple-900 dark:text-purple-300">Mixed Cart Order</p>
                      <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                        This order has both your own items (you fulfill) and dropshipped items (supplier fulfills).
                        Manage your own items below; the supplier handles theirs independently.
                      </p>
                    </div>
                  </div>
                )}

                {/* Terminal Africa Shipment Panel */}
                {hasTerminalShipment(selectedOrder) ? (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                        <Truck className="w-5 h-5" />
                        Terminal Africa Shipment
                      </h3>
                      {(selectedOrder as any).terminal_shipment_status && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200">
                          {terminalStatusLabel[(selectedOrder as any).terminal_shipment_status] || (selectedOrder as any).terminal_shipment_status}
                        </span>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      {(selectedOrder as any).terminal_carrier_name && (
                        <div>
                          <p className="text-indigo-600 dark:text-indigo-400 text-xs font-medium uppercase mb-0.5">Carrier</p>
                          <p className="font-medium text-indigo-900 dark:text-indigo-100">{(selectedOrder as any).terminal_carrier_name}</p>
                        </div>
                      )}
                      {(selectedOrder as any).terminal_tracking_number && (
                        <div>
                          <p className="text-indigo-600 dark:text-indigo-400 text-xs font-medium uppercase mb-0.5">Tracking Number</p>
                          <p className="font-mono font-medium text-indigo-900 dark:text-indigo-100">{(selectedOrder as any).terminal_tracking_number}</p>
                        </div>
                      )}
                      {(selectedOrder as any).terminal_arranged_at && (
                        <div>
                          <p className="text-indigo-600 dark:text-indigo-400 text-xs font-medium uppercase mb-0.5">Arranged At</p>
                          <p className="text-indigo-900 dark:text-indigo-100">
                            {new Date((selectedOrder as any).terminal_arranged_at).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {(selectedOrder as any).terminal_delivery_cost && (
                        <div>
                          <p className="text-indigo-600 dark:text-indigo-400 text-xs font-medium uppercase mb-0.5">Delivery Cost</p>
                          <p className="text-indigo-900 dark:text-indigo-100">{fmt((selectedOrder as any).terminal_delivery_cost)}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 pt-1">
                      {(selectedOrder as any).terminal_tracking_url && (
                        <a
                          href={(selectedOrder as any).terminal_tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Track Shipment
                        </a>
                      )}
                      {(selectedOrder as any).terminal_waybill_url && (
                        <a
                          href={(selectedOrder as any).terminal_waybill_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm font-medium rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download Waybill
                        </a>
                      )}
                    </div>

                    {!terminalShipmentArranged(selectedOrder) && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          Shipment has not been arranged yet. This may have failed automatically.
                          Contact support with order number <strong>{selectedOrder.order_number}</strong> to arrange manually.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  selectedOrder.tracking_number && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tracking Number</p>
                      <p className="font-mono text-gray-900 dark:text-white">{selectedOrder.tracking_number}</p>
                    </div>
                  )
                )}

                {/* Customer Info */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Customer Information</h3>
                  <div className="space-y-2">
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{selectedOrder.customer_name}</p>
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4" /> {selectedOrder.customer_email}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4" /> {selectedOrder.customer_phone}
                    </p>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Shipping Address</h3>
                  {(() => {
                    const addr = selectedOrder.delivery_address as any;
                    const parts = [
                      addr?.address || addr?.street,
                      addr?.city,
                      selectedOrder.delivery_state,
                    ].filter(Boolean);
                    return (
                      <p className="text-gray-700 dark:text-gray-300 flex items-start gap-2 text-sm">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {parts.length ? parts.join(', ') : 'Address not available'}
                      </p>
                    );
                  })()}
                  {(() => {
                    const addr = selectedOrder.delivery_address as any;
                    return addr?.instructions ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-6">
                        <em>Note: {addr.instructions}</em>
                      </p>
                    ) : null;
                  })()}
                </div>

                {/* Order Items — with per-item ownership badges */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.items?.map((item: any, idx: number) => {
                      // FIX: per-item ownership detection for badges
                      const isFulfilledBySupplier =
                        item.is_imported &&
                        item.original_owner_id &&
                        item.original_owner_id !== currentStore?.owner_id;
                      const isYourProductDropshipped =
                        item.is_imported &&
                        item.original_owner_id === currentStore?.owner_id;

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                            )}
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name || item.product_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Qty: {item.quantity}</p>
                              {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                </p>
                              )}
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {/* FIX: "Fulfilled by Supplier" for externally dropshipped items */}
                                {isFulfilledBySupplier && (
                                  <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                    Fulfilled by Supplier
                                  </span>
                                )}
                                {/* FIX: "Your Product — You Fulfill" when this store is the original owner */}
                                {isYourProductDropshipped && (
                                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                                    Your Product — You Fulfill
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {fmt((item.price_at_time || item.unit_price) * item.quantity)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* FIX: Dropship Earnings card — shown whenever there are dropshipped items */}
                {hasDropshippedItems && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-5">
                    <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-3">
                      Your Dropship Earnings
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-orange-800 dark:text-orange-300">
                        <span>Total Margin (selling price − dropship cost)</span>
                        <span>{fmt(dropshipEarnings.margin)}</span>
                      </div>
                      <div className="flex justify-between text-orange-800 dark:text-orange-300">
                        <span>Platform Fee (8%)</span>
                        <span>− {fmt(dropshipEarnings.platformFee)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-orange-900 dark:text-orange-100 pt-2 border-t border-orange-200 dark:border-orange-700">
                        <span>Your Net</span>
                        <span>{fmt(dropshipEarnings.net)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                      Credited to your wallet after escrow is released.
                    </p>
                  </div>
                )}

                {/* Order Summary */}
                <div className="border-t dark:border-gray-700 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span><span>{fmt(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Delivery</span><span>{fmt(selectedOrder.delivery_fee)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-700">
                    <span>Total</span>
                    <span>{fmt((selectedOrder as any).total_amount || selectedOrder.total)}</span>
                  </div>
                </div>

                {/* FIX: Manual fulfillment actions — different sections for mixed cart vs own-only */}
                {!isFullyDropshipped && !hasTerminalShipment(selectedOrder) && (
                  <div className="space-y-4 pt-2">
                    {/* FIX: mixed cart — label section as "Manage Your Own Items" */}
                    {hasDropshippedItems && hasOwnItems && (
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Manage Your Own Items
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {selectedOrder.status === 'processing' && (
                        <>
                          <input
                            type="text"
                            value={trackingNumber}
                            onChange={e => setTrackingNumber(e.target.value)}
                            placeholder="Tracking number (optional)"
                            className="flex-1 min-w-0 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          <Button
                            onClick={handleShipOrder}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Mark Shipped
                          </Button>
                        </>
                      )}
                      {selectedOrder.status === 'shipped' && (
                        <Button
                          onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark Delivered
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => printShippingLabel(selectedOrder)}>
                        <Printer className="w-4 h-4 mr-2" />
                        Print Label
                      </Button>
                    </div>

                    {/* FIX: mixed cart — note about supplier handling their items */}
                    {hasDropshippedItems && hasOwnItems && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        The {dropshippedItems.length} dropshipped item(s) are fulfilled by the original supplier independently.
                      </p>
                    )}
                  </div>
                )}

                {/* Terminal: only print label available */}
                {!isFullyDropshipped && hasTerminalShipment(selectedOrder) && (
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => printShippingLabel(selectedOrder)}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print Label
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}