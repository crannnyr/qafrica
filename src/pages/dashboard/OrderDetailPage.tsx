import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Package, Truck, CheckCircle, Clock, Check,
  MapPin, Phone, Mail, AlertTriangle, Loader2, Printer,
  ShieldCheck, Lock, ExternalLink  
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { supabase, orderService } from '@/services';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_options: any;
  is_imported: boolean;
  dropship_price: number;
  original_owner_id: string | null;
  original_store_id: string | null;
  product: {
    id: string;
    name: string;
    images: string[];
  } | null;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  store_id: string;
  // FIX: added dropshipper_store_id used for access control
  dropshipper_store_id?: string | null;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: {
    address: string;
    city: string;
    state: string;
    instructions?: string;
  };
  delivery_state: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  payment_reference: string;
  is_escrow_released: boolean;
  escrow_release_at: string | null;
  buyer_reported_issue: boolean;
  issue_description: string | null;
  issue_reported_at: string | null;
  // FIX: single declaration of tracking_number (was duplicated causing TS2300)
  tracking_number?: string | null;
  order_items: OrderItem[];
  store: {
    name: string;
    slug: string;
  } | null;
  shipbubble_order_id?: string | null;
  shipbubble_tracking_url?: string | null;
  shipbubble_courier_name?: string | null;
  shipbubble_courier_phone?: string | null;
  shipbubble_status?: string | null;
  is_cod_order?: boolean | null;
}

// ── Status flow ───────────────────────────────────────────────────────────────
const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed:  { label: 'Confirmed',  color: 'bg-blue-100 text-blue-800',    icon: Check },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-800', icon: Package },
  shipped:    { label: 'Shipped',    color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  delivered:  { label: 'Delivered',  color: 'bg-green-100 text-green-800',   icon: CheckCircle },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-800',       icon: AlertTriangle },
};

function getNextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current);
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { currentStore } = useStoreStore();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showTrackingInput, setShowTrackingInput] = useState(false);

  useEffect(() => {
    if (orderId && currentStore?.id) {
      fetchOrder();
    }
  }, [orderId, currentStore?.id]);

  const fetchOrder = async () => {
    if (!currentStore?.id || !orderId) return;
  
    setIsLoading(true);
  
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            product:products!order_items_product_id_fkey(
              id,
              name,
              images
            )
          ),
          store:stores!orders_store_id_fkey(
            name,
            slug
          )
        `)
        .eq('id', orderId)
        .maybeSingle();
  
      if (error || !data) {
        console.error('ORDER FETCH ERROR:', error);
        toast.error('Order not found');
        navigate('/dashboard/orders');
        return;
      }
  
      const isStoreOwner = data.store_id === currentStore.id;
      const isDropshipper = data.dropshipper_store_id === currentStore.id;
      const isOriginalSupplier = data.order_items?.some(
        (item: any) =>
          item.is_imported &&
          item.original_store_id === currentStore.id
      );
      
      const canAccess = isStoreOwner || isDropshipper || isOriginalSupplier;
      
      if (!canAccess) {
        console.log('ACCESS DENIED', {
          orderStore: data.store_id,
          dropshipperStore: data.dropshipper_store_id,
          currentStore: currentStore.id,
          items: data.order_items
        });
        toast.error('Order not found');
        navigate('/dashboard/orders');
        return;
      }
  
      setOrder(data as OrderDetail);
  
      if (data.tracking_number) {
        setTrackingNumber(data.tracking_number);
      }
  
    } catch (err) {
      console.error('Failed to fetch order:', err);
      toast.error('Failed to load order');
      navigate('/dashboard/orders');
    } finally {
      setIsLoading(false);
    }
  };

  const isDropshipperView =
    !!order && order.dropshipper_store_id === currentStore?.id;
  
  const isOriginalOwnerView =
    !!order &&
    !isDropshipperView &&
    order.store_id !== currentStore?.id &&
    order.order_items.some(
      item =>
        item.is_imported &&
        item.original_store_id === currentStore?.id
    );

  const myDropshippedItems = (order?.order_items || []).filter(
    (item) => item.is_imported && item.original_store_id === currentStore?.id
  );

  const hasDropshippedItems = (order?.order_items || []).some(
    (item) =>
      item.is_imported &&
      item.original_owner_id &&
      item.original_owner_id !== currentStore?.id
  );

  const isFullyDropshipped =
    (order?.order_items?.length ?? 0) > 0 &&
    order?.order_items.every((item) => item.is_imported);

  const dropshipEarnings = (() => {
    if (!order) return { margin: 0, platformFee: 0, net: 0 };
    const margin = (order.order_items || []).reduce((sum, item) => {
      if (item.is_imported && item.original_owner_id && item.original_owner_id !== currentStore?.id) {
        return sum + (item.unit_price - (item.dropship_price || 0)) * item.quantity;
      }
      return sum;
    }, 0);
    const platformFee = margin * 0.08;
    return { margin, platformFee, net: margin - platformFee };
  })();

  const originalOwnerTotal = myDropshippedItems.reduce(
    (sum, item) => sum + (item.dropship_price || 0) * item.quantity,
    0
  );

  const handleUpdateStatus = async (newStatus: string) => {
    if (!order) return;

    if (newStatus === 'shipped') {
      if (!trackingNumber.trim()) {
        setShowTrackingInput(true);
        toast.info('Please enter a tracking number before marking as shipped');
        return;
      }
    }

    setIsUpdating(true);
    try {
      if (isOriginalOwnerView && currentStore?.id) {
        const updates: any = { status: newStatus };
        if (newStatus === 'shipped' && trackingNumber.trim()) {
          updates.tracking_number = trackingNumber.trim();
        }
        const { error } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', order.id);

        if (error) throw error;
      } else {
        const updates: any = { status: newStatus };
        if (newStatus === 'shipped' && trackingNumber.trim()) {
          updates.tracking_number = trackingNumber.trim();
        }
        const { error } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', order.id)
          .eq('store_id', currentStore!.id);

        if (error) throw error;
      }

      toast.success(`Order marked as ${newStatus}`);
      setShowTrackingInput(false);
      await fetchOrder();
    } catch (err: any) {
      console.error('Status update failed:', err);
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  const printShippingLabel = () => {
    if (!order) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const address = order.delivery_address || {};
    printWindow.document.write(`
      <html>
        <head>
          <title>Shipping Label - ${order.order_number}</title>
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
              <p>Order ${order.order_number}</p>
            </div>
            <div class="section">
              <p class="label-title">Ship To:</p>
              <p class="label-value">${order.customer_name}</p>
              <p>${address.address || ''}</p>
              <p>${address.city || ''}, ${address.state || order.delivery_state || ''}</p>
            </div>
            <div class="section">
              <p class="label-title">Contact:</p>
              <p>${order.customer_phone}</p>
              <p>${order.customer_email}</p>
            </div>
            ${order.tracking_number ? `<div class="section"><p class="label-title">Tracking:</p><p class="label-value">${order.tracking_number}</p></div>` : ''}
            <div class="barcode">*${order.id.slice(0, 12)}*</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const deliveryAddress = order.delivery_address || {};
  const nextStatus = getNextStatus(order.status);
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // ── ORIGINAL OWNER VIEW ────────────────────────────────────────────────────
  if (isOriginalOwnerView) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard/orders')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Order {order.order_number}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Dropship Order — Fulfill Your Products
            </p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
          <Package className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-300">You Need to Ship These Items</p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              This order was placed through a dropshipper. Ship directly to the customer below.
              Your payment of ₦{originalOwnerTotal.toLocaleString()} is held in escrow.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.color}`}>
              <StatusIcon className="w-4 h-4" />
              {statusConfig.label}
            </span>
            {order.is_escrow_released && (
              <span className="text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                Escrow Released
              </span>
            )}
          </div>

          {nextStatus && !order.is_escrow_released && (
            <div className="space-y-3">
              {nextStatus === 'shipped' && (
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Tracking number (required)"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                />
              )}
              <Button
                onClick={() => handleUpdateStatus(nextStatus)}
                disabled={isUpdating || (nextStatus === 'shipped' && !trackingNumber.trim())}
                className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
              >
                {isUpdating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</>
                ) : (
                  <><Truck className="w-4 h-4 mr-2" />Mark as {STATUS_CONFIG[nextStatus]?.label || nextStatus}</>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
            Your Items to Ship ({myDropshippedItems.length})
          </h2>
          <div className="space-y-4">
            {myDropshippedItems.map((item, idx) => {
              const image = item.product?.images?.[0] ?? null;
              return (
                <div key={item.id ?? idx} className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                    {image ? (
                      <img src={image} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-medium">
                        {item.product_name?.charAt(0) ?? '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                    {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ₦{((item.dropship_price || 0) * item.quantity).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-400">
                      ₦{(item.dropship_price || 0).toLocaleString()} each
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Ship To</h2>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-base text-gray-900 dark:text-white">{order.customer_name}</p>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Phone className="w-4 h-4" /> {order.customer_phone}
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Mail className="w-4 h-4" /> {order.customer_email}
            </div>
            <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400 mt-2">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p>{deliveryAddress.address || 'Address not available'}</p>
                {deliveryAddress.city && (
                  <p>{deliveryAddress.city}, {deliveryAddress.state || order.delivery_state}</p>
                )}
                {deliveryAddress.instructions && (
                  <p className="text-xs text-gray-400 mt-1">Note: {deliveryAddress.instructions}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
          <h2 className="font-semibold text-green-900 dark:text-green-300 mb-2">Your Earnings</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-green-800 dark:text-green-400">
              <span>Product Value (dropship price × qty)</span>
              <span>₦{originalOwnerTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-green-800 dark:text-green-400 pt-1 border-t border-green-200 dark:border-green-700">
              <span className="font-medium">Total You'll Receive</span>
              <span className="font-bold">₦{originalOwnerTotal.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-green-600 dark:text-green-500 mt-2">
            Funds will be released to your wallet once delivery is confirmed.
          </p>
        </div>
      </div>
    );
  }

  // ── DROPSHIPPER / STORE OWNER VIEW ─────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard/orders')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Order {order.order_number}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Placed {new Date(order.created_at).toLocaleDateString('en-NG', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={printShippingLabel} className="hidden sm:flex">
          <Printer className="w-4 h-4 mr-2" />
          Print Label
        </Button>
      </div>

      {order.buyer_reported_issue && !order.is_escrow_released && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Customer Reported an Issue</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{order.issue_description}</p>
            <p className="text-xs text-red-500 mt-1">
              Reported {order.issue_reported_at
                ? new Date(order.issue_reported_at).toLocaleDateString()
                : ''}. Admin is reviewing. Payment is on hold until resolved.
            </p>
          </div>
        </motion.div>
      )}

      {order.is_escrow_released && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800 dark:text-green-300">Payment Released to Wallet</p>
            <p className="text-sm text-green-600 dark:text-green-400">
              Customer confirmed receipt on{' '}
              {order.escrow_release_at
                ? new Date(order.escrow_release_at).toLocaleDateString('en-NG', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })
                : ''}
            </p>
          </div>
        </div>
      )}

      {isFullyDropshipped && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-300">Fulfilled by Original Supplier</p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              All items in this order are dropshipped. The original seller handles shipping and status updates.
              Your profit will be credited when the customer confirms receipt.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.color}`}>
              <StatusIcon className="w-4 h-4" />
              {statusConfig.label}
            </span>
            {order.tracking_number && (
              <span className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg font-mono">
                {order.tracking_number}
              </span>
            )}
          </div>
        </div>

        {!isFullyDropshipped && !order.is_escrow_released && nextStatus && (
          <div className="space-y-3">
            {(nextStatus === 'shipped' || showTrackingInput) && !order.tracking_number && (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number (required for shipping)"
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            )}
            <div className="flex gap-3">
              <Button
                onClick={() => handleUpdateStatus(nextStatus)}
                disabled={
                  isUpdating ||
                  order.buyer_reported_issue ||
                  (nextStatus === 'shipped' && !trackingNumber.trim())
                }
                className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
              >
                {isUpdating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</>
                ) : (
                  <>
                    <Truck className="w-4 h-4 mr-2" />
                    Mark as {STATUS_CONFIG[nextStatus]?.label || nextStatus}
                  </>
                )}
              </Button>
              {order.buyer_reported_issue && (
                <p className="text-sm text-red-500 flex items-center gap-1 self-center">
                  <AlertTriangle className="w-4 h-4" />
                  Status locked — issue under review
                </p>
              )}
            </div>
          </div>
        )}

        {isFullyDropshipped && (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium">
            <Lock className="w-4 h-4" />
            Supplier Fulfils — No Action Needed
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
          Items ({(order.order_items || []).length})
        </h2>
        <div className="space-y-4">
          {(order.order_items || []).map((item) => {
            const image = item.product?.images?.[0] ?? null;
            const isFulfilledBySupplier =
              item.is_imported &&
              item.original_owner_id &&
              item.original_owner_id !== currentStore?.id;
            const isOwnProductDropshipped =
              item.is_imported &&
              item.original_owner_id === currentStore?.id;

            return (
              <div key={item.id} className="flex gap-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                  {image ? (
                    <img src={image} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-medium">
                      {item.product_name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                  {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">Qty: {item.quantity}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {isFulfilledBySupplier && (
                      <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        Fulfilled by Supplier
                      </span>
                    )}
                    {isOwnProductDropshipped && (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                        Your Product — You Fulfill
                      </span>
                    )}
                    {item.is_imported && !isFulfilledBySupplier && !isOwnProductDropshipped && (
                      <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        Dropshipped
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    ₦{(item.total_price || item.unit_price * item.quantity).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-400">
                    ₦{item.unit_price?.toLocaleString()} each
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasDropshippedItems && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
          <h2 className="font-semibold text-orange-900 dark:text-orange-300 mb-3">Your Dropship Earnings</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-orange-800 dark:text-orange-400">
              <span>Total Margin (selling price − dropship cost)</span>
              <span>₦{dropshipEarnings.margin.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-orange-800 dark:text-orange-400">
              <span>Platform Fee (8%)</span>
              <span>− ₦{dropshipEarnings.platformFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-orange-900 dark:text-orange-200 pt-2 border-t border-orange-200 dark:border-orange-700">
              <span>Your Net</span>
              <span>₦{dropshipEarnings.net.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-500 mt-2">
            Credited to your wallet after escrow is released.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Customer</h2>
        <div className="space-y-3 text-sm">
          <p className="font-medium text-gray-900 dark:text-white text-base">{order.customer_name}</p>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Mail className="w-4 h-4" />
            {order.customer_email}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Phone className="w-4 h-4" />
            {order.customer_phone}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Delivery Address</h2>
        <div className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
          <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p>{deliveryAddress.address || 'Address not available'}</p>
            {deliveryAddress.city && (
              <p>{deliveryAddress.city}, {deliveryAddress.state || order.delivery_state}</p>
            )}
            {deliveryAddress.instructions && (
              <p className="text-sm text-gray-400 mt-1">Note: {deliveryAddress.instructions}</p>
            )}
          </div>
        </div>
      </div>

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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Payment</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Subtotal</span>
            <span>₦{order.subtotal?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Delivery</span>
            <span>₦{order.delivery_fee?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-2 border-t dark:border-gray-700">
            <span>Total</span>
            <span>₦{order.total?.toLocaleString()}</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Method</span>
            <span className="capitalize text-gray-700 dark:text-gray-300">
              {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Card / Transfer'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className={`font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
              {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Reference</span>
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{order.payment_reference}</span>
          </div>
        </div>
      </div>
    </div>
  );
}