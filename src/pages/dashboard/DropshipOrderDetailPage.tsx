import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Package, Truck, CheckCircle, Clock,
  MapPin, Phone, Mail, AlertTriangle, Loader2, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore, useOrderStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import type { DropshipOrderView, OrderItem } from '@/types';

export default function DropshipOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { currentStore } = useStoreStore();
  const { dropshipOrders, updateDropshipOrderStatus, isLoading } = useOrderStore();

  const [order, setOrder] = useState<DropshipOrderView | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (orderId && dropshipOrders.length > 0) {
      const found = dropshipOrders.find((o) => o.order_id === orderId);
      if (found) setOrder(found);
    }
  }, [orderId, dropshipOrders]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!order || !currentStore?.id) return;
    
    if (newStatus === 'shipped' && !trackingNumber.trim()) {
      toast.info('Please enter a tracking number');
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateDropshipOrderStatus(order.order_id, currentStore.id, newStatus as any);
      if (result.success) {
        toast.success(`Order marked as ${newStatus}`);
        setOrder((prev) => prev ? { ...prev, status: newStatus as any } : prev);
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Order not found</p>
        <Button onClick={() => navigate('/dashboard/dropship-orders')} className="mt-4">
          Back to Dropship Orders
        </Button>
      </div>
    );
  }

  const myItems = order.items?.filter(
    (item: OrderItem) => item.is_imported && item.original_store_id === currentStore?.id
  ) || [];

  const nextStatus = (() => {
    const flow = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const idx = flow.indexOf(order.status);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  })();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/dropship-orders')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order #{order.order_number}</h1>
          <p className="text-gray-500 text-sm">Dropship Order — Fulfill Your Products</p>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Package className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900">You Need to Ship These Items</p>
          <p className="text-sm text-blue-700 mt-1">
            This order was placed through a dropshipper. Ship directly to the customer below.
            Your payment of ₦{order.total_dropship_price.toLocaleString()} is held in escrow.
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
            order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          {order.is_escrow_released && (
            <span className="text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              Escrow Released
            </span>
          )}
        </div>

        {/* Status Actions */}
        {nextStatus && !order.is_escrow_released && (
          <div className="space-y-3">
            {nextStatus === 'shipped' && !order.shipbubble_order_id && (
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Tracking number (required)"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            )}
            <Button
              onClick={() => handleUpdateStatus(nextStatus)}
              disabled={isUpdating || (nextStatus === 'shipped' && !trackingNumber.trim())}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Truck className="w-4 h-4 mr-2" />
              )}
              Mark as {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
            </Button>
          </div>
        )}
      </div>

      

      {/* Items to Ship */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Items to Ship ({myItems.length})</h2>
        <div className="space-y-4">
          {myItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{item.product_name}</p>
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                  <p className="text-xs text-gray-400">
                    {Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  ₦{((item.dropship_price || 0) * item.quantity).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  ₦{(item.dropship_price || 0).toLocaleString()} each
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SHIP BUBBLE TRACKING SECTION */}
      {order?.shipbubble_order_id && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-5 space-y-4 mt-6"
        >
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-full p-2">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Ship Bubble Shipment</h3>
              <p className="text-xs text-blue-700">Real-time tracking via Ship Bubble</p>
            </div>
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full capitalize">
              {order.shipbubble_status || 'Processing'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Courier</p>
              <p className="font-semibold text-gray-900 mt-1">{order.shipbubble_courier_name || 'TBD'}</p>
              {order.shipbubble_courier_phone && (
                <p className="text-xs text-gray-600 mt-1">📞 {order.shipbubble_courier_phone}</p>
              )}
            </div>

            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Tracking Number</p>
              <p className="font-mono font-semibold text-gray-900 mt-1">{order.tracking_number || order.shipbubble_order_id || 'N/A'}</p>
            </div>

            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Shipment ID</p>
              <p className="font-mono text-xs text-gray-700 mt-1 break-all">{order.shipbubble_order_id}</p>
            </div>

            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Status</p>
              <p className="font-semibold text-gray-900 mt-1 capitalize">{order.shipbubble_status || 'Pending'}</p>
            </div>
          </div>

          {order.is_cod_order && (
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Cash on Delivery</p>
                <p className="text-xs text-amber-800">Customer will pay on delivery</p>
              </div>
            </div>
          )}

          {order.shipbubble_tracking_url && (
            <a
              href={order.shipbubble_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              <ExternalLink className="w-4 h-4" />
              View Full Tracking on Ship Bubble
            </a>
          )}
        </motion.div>
      )}

      {/* Customer Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Ship To</h2>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-base">{order.customer_name}</p>
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="w-4 h-4" /> {order.customer_phone}
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Mail className="w-4 h-4" /> {order.customer_email}
          </div>
          <div className="flex items-start gap-2 text-gray-600 mt-2">
            <MapPin className="w-4 h-4 mt-0.5" />
            <div>
              <p>{order.delivery_address?.street || order.delivery_address?.address}</p>
              <p>{order.delivery_address?.city}, {order.delivery_state}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <h2 className="font-semibold text-green-900 mb-2">Your Earnings</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-green-800">
            <span>Product Value</span>
            <span>₦{order.total_dropship_price.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-green-800 pt-1 border-t border-green-200">
            <span className="font-medium">Total You'll Receive</span>
            <span className="font-bold">₦{order.total_dropship_price.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-xs text-green-600 mt-2">
          Funds will be released to your wallet once delivery is confirmed.
        </p>
      </div>
    </div>
  );
}