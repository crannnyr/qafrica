// src/pages/developer/dashboard/DeveloperOrderDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Package, MapPin, CreditCard, Truck,
  User, Loader2, AlertTriangle, XCircle, ExternalLink,
  ClipboardList,
} from 'lucide-react';
import { useDeveloperOrderStore } from '@/stores/developerOrderStore';
import { OrderStatusBadge }       from '@/components/developer/OrderStatusBadge';
import { CopyButton }             from '@/components/developer/CopyButton';
import { toast } from 'sonner';

// ── Info card wrapper ─────────────────────────────────────────
function Card({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <Icon className="w-4 h-4 text-gray-400" />
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Label/Value row ───────────────────────────────────────────
function Row({ label, value, mono = false }: {
  label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-xs font-medium text-gray-900 text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ── Cancel confirmation ───────────────────────────────────────
function CancelModal({
  orderNumber,
  onConfirm,
  onCancel,
  isLoading,
}: {
  orderNumber: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
      >
        <div className="p-6">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="font-bold text-gray-900 text-center mb-1">Cancel order?</h2>
          <p className="text-sm text-gray-500 text-center mb-4">
            <span className="font-mono font-semibold text-gray-700">{orderNumber}</span>
          </p>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer requested cancellation"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                text-gray-900 placeholder-gray-400 focus:outline-none
                focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 h-11 border border-gray-200 text-gray-600 font-medium
                rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              Keep order
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={isLoading}
              className="flex-1 h-11 bg-red-500 hover:bg-red-600 disabled:opacity-50
                text-white font-semibold rounded-xl transition-colors text-sm
                flex items-center justify-center gap-2"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling...</>
                : 'Cancel order'
              }
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate    = useNavigate();

  const {
    currentOrder, currentOrderLoading, currentOrderError,
    cancellingId,
    fetchOrder, cancelOrder, clearCurrentOrder,
  } = useDeveloperOrderStore();

  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (orderId) fetchOrder(orderId);
    return () => clearCurrentOrder();
  }, [orderId]);

  const isCancelling = cancellingId === orderId;
  const canCancel    = currentOrder
    ? ['pending', 'confirmed'].includes(currentOrder.status)
    : false;

  async function handleCancel(reason: string) {
    if (!orderId) return;
    const result = await cancelOrder(orderId, reason || undefined);
    if (result.success) {
      toast.success('Order cancelled.');
      setShowCancel(false);
    } else {
      toast.error(result.error ?? 'Failed to cancel order.');
    }
  }

  // ── Loading ────────────────────────────────────────────────
  if (currentOrderLoading && !currentOrder) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (currentOrderError && !currentOrder) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-start gap-3 p-5 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Order not found</p>
            <p className="text-sm text-red-600 mt-0.5">{currentOrderError}</p>
            <button
              onClick={() => navigate('/developer/dashboard/orders')}
              className="text-sm font-semibold text-red-700 underline mt-2"
            >
              Back to orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrder) return null;

  const order = currentOrder;

  const createdAt = new Date(order.created_at).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const deliveryAddress = order.delivery_address
    ? `${order.delivery_address.street}, ${order.delivery_address.city}, ${order.delivery_address.state}`
    : order.delivery_state ?? '—';

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/developer/dashboard/orders')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800
            transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900 font-mono">
                {order.order_number}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-sm text-gray-500">{createdAt}</p>
          </div>
          {canCancel && (
            <button
              onClick={() => setShowCancel(true)}
              disabled={isCancelling}
              className="h-9 px-4 border border-red-200 text-red-600 font-medium
                rounded-xl hover:bg-red-50 transition-colors text-sm flex items-center gap-2
                disabled:opacity-50"
            >
              {isCancelling
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <XCircle className="w-3.5 h-3.5" />
              }
              Cancel order
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Customer info */}
          <Card title="Customer" icon={User}>
            <div className="space-y-0.5">
              <Row label="Name"  value={order.customer_name} />
              <Row label="Email" value={order.customer_email} />
            </div>
          </Card>

          {/* Payment */}
          <Card title="Payment" icon={CreditCard}>
            <div className="space-y-0.5">
              <Row label="Status"   value={order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)} />
              <Row label="Method"   value={order.payment_method?.replace('_', ' ') ?? '—'} />
              <Row label="Total"    value={`₦${order.total.toLocaleString()}`} />
              <Row label="Subtotal" value={`₦${order.subtotal.toLocaleString()}`} />
              <Row label="Delivery" value={`₦${order.delivery_fee.toLocaleString()}`} />
              <Row label="Platform fee" value={`₦${order.platform_fee.toLocaleString()}`} />
            </div>
          </Card>

          {/* Delivery */}
          <Card title="Delivery" icon={MapPin}>
            <div className="space-y-0.5">
              <Row label="Address" value={deliveryAddress} />
              <Row label="State"   value={order.delivery_state} />
              {order.tracking_number && (
                <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">Tracking #</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-medium text-gray-900">
                      {order.tracking_number}
                    </span>
                    <CopyButton text={order.tracking_number} size="sm" />
                    {order.terminal_tracking_url && (
                      <a
                        href={order.terminal_tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 hover:text-orange-700 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Shipping */}
          <Card title="Shipping" icon={Truck}>
            {order.tracking_number ? (
              <div className="space-y-0.5">
                <Row label="Tracking #" value={order.tracking_number} mono />
                {order.terminal_tracking_url && (
                  <div className="pt-2">
                    <a
                      href={order.terminal_tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold
                        text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      Track shipment <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                {['pending', 'confirmed', 'processing'].includes(order.status)
                  ? 'Awaiting shipment.'
                  : 'No tracking information available.'
                }
              </p>
            )}
          </Card>
        </div>

        {/* Order items */}
        {order.items && order.items.length > 0 && (
          <div className="mt-4">
            <Card title="Items" icon={Package}>
              <div className="space-y-3">
                {order.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0"
                  >
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {item.product_name}
                      </p>
                      {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {Object.entries(item.variant_options)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')
                          }
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        ₦{item.total_price.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.quantity} × ₦{item.unit_price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order total footer */}
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>₦{order.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Delivery</span>
                  <span>₦{order.delivery_fee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Platform fee</span>
                  <span>₦{order.platform_fee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
                  <span>Total</span>
                  <span>₦{order.total.toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Cancel modal */}
      <AnimatePresence>
        {showCancel && (
          <CancelModal
            orderNumber={order.order_number}
            onConfirm={handleCancel}
            onCancel={() => setShowCancel(false)}
            isLoading={isCancelling}
          />
        )}
      </AnimatePresence>
    </>
  );
}