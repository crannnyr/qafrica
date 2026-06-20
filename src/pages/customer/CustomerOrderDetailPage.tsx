import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Package, Truck, CheckCircle, Clock, Store,
  MapPin, Phone, Mail, AlertCircle, ShieldCheck, Loader2,
  AlertTriangle, Check, ChevronRight, ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCustomerAuthStore } from '@/stores';
import { supabase } from '@/services';
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
  tracking_number: string | null;
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

// ── Status timeline config ────────────────────────────────────────────────────
const STATUS_STEPS = [
  { key: 'pending',    label: 'Order Placed',    icon: Clock },
  { key: 'confirmed',  label: 'Confirmed',        icon: Check },
  { key: 'processing', label: 'Processing',       icon: Package },
  { key: 'shipped',    label: 'Shipped',          icon: Truck },
  { key: 'delivered',  label: 'Delivered',        icon: CheckCircle },
];

function StatusTimeline({ status }: { status: string }) {
  const currentIndex = STATUS_STEPS.findIndex(s => s.key === status);
  const displayIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="flex items-center justify-between w-full">
      {STATUS_STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isCompleted = idx < displayIndex;
        const isCurrent = idx === displayIndex;
        const isPending = idx > displayIndex;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                isCompleted ? 'bg-green-500 border-green-500 text-white' :
                isCurrent   ? 'bg-orange-500 border-orange-500 text-white' :
                              'bg-white border-gray-200 text-gray-300'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className={`text-xs mt-2 text-center max-w-[60px] leading-tight ${
                isCompleted ? 'text-green-600 font-medium' :
                isCurrent   ? 'text-orange-600 font-medium' :
                              'text-gray-400'
              }`}>
                {step.label}
              </p>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 transition-colors ${
                idx < displayIndex ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CustomerOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { customer } = useCustomerAuthStore();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');

  useEffect(() => {
    if (orderId && customer) {
      fetchOrder();
    }
  }, [orderId, customer]);

  const fetchOrder = async () => {
    if (!customer || !orderId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            product:products!order_items_product_id_fkey(id, name, images),
            original_product:products!order_items_original_product_id_fkey(id, name, images)
          ),
          store:stores!orders_store_id_fkey(name, slug)
        `)
        .eq('id', orderId)
        .eq('customer_id', customer.id)
        .single();

      if (error || !data) {
        toast.error('Order not found');
        navigate('/customer/dashboard');
        return;
      }

      setOrder(data as OrderDetail);
    } catch (err) {
      console.error('Failed to fetch order:', err);
      toast.error('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsReceived = async () => {
    if (!order || !customer) return;

    // ── UI guard: block if issue is reported ─────────────────────────────────
    // NOTE: The release_escrow_funds RPC itself does NOT check buyer_reported_issue.
    // This UI block is the only protection. A proper fix requires adding a check
    // inside the RPC: AND buyer_reported_issue IS NOT TRUE
    if (order.buyer_reported_issue) {
      toast.error('Cannot confirm receipt while an issue is reported. Please wait for admin resolution.');
      return;
    }

    setIsReleasing(true);
    try {
      const { error } = await supabase.rpc('release_escrow_funds', {
        p_order_id: order.id,
        p_customer_id: customer.id,
      });

      if (error) throw error;

      toast.success('Payment released to seller. Thank you!');
      await fetchOrder();
    } catch (err: any) {
      console.error('Escrow release failed:', err);
      toast.error(err.message || 'Failed to confirm receipt');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleReportIssue = async () => {
    if (!order || !customer || !issueDescription.trim()) {
      toast.error('Please describe the issue');
      return;
    }

    setIsReporting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          buyer_reported_issue: true,
          issue_description: issueDescription.trim(),
          issue_reported_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('customer_id', customer.id);

      if (error) throw error;

      // Create a notification for the admin
      await supabase.from('notifications').insert({
        type: 'issue_reported',
        title: 'Customer Reported an Issue',
        message: `Order #${order.order_number}: ${issueDescription.trim()}`,
        data: { order_id: order.id, store_id: order.store?.slug },
      });

      toast.success('Issue reported. Our team will review it shortly.');
      setShowIssueForm(false);
      setIssueDescription('');
      await fetchOrder();
    } catch (err: any) {
      console.error('Issue report failed:', err);
      toast.error(err.message || 'Failed to report issue');
    } finally {
      setIsReporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const deliveryAddress = order.delivery_address || {};
  const canRelease = order.status === 'shipped' && !order.is_escrow_released && !order.buyer_reported_issue;
  const canReport = order.status === 'shipped' && !order.is_escrow_released && !order.buyer_reported_issue;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/customer/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900">Order #{order.order_number}</h1>
            <p className="text-sm text-gray-500">
              Placed {new Date(order.created_at).toLocaleDateString('en-NG', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Issue Reported Banner */}
        {order.buyer_reported_issue && !order.is_escrow_released && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Issue Reported</p>
              <p className="text-sm text-red-600 mt-1">{order.issue_description}</p>
              <p className="text-xs text-red-500 mt-1">
                Reported {order.issue_reported_at
                  ? new Date(order.issue_reported_at).toLocaleDateString()
                  : ''}. Our admin team is reviewing this.
              </p>
            </div>
          </motion.div>
        )}

        {/* Escrow Released Banner */}
        {order.is_escrow_released && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3"
          >
            <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Payment Released</p>
              <p className="text-sm text-green-600">
                You confirmed receipt on{' '}
                {order.escrow_release_at
                  ? new Date(order.escrow_release_at).toLocaleDateString('en-NG', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })
                  : ''}
              </p>
            </div>
          </motion.div>
        )}

        {/* Status Timeline */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-6">Order Status</h2>
          <StatusTimeline status={order.status} />

          {order.tracking_number && (
            <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Tracking:</span>
              <span className="font-medium text-gray-900">{order.tracking_number}</span>
            </div>
          )}
        </div>

        {/* SHIP BUBBLE TRACKING - CUSTOMER VIEW ✅ READY TO USE */}
        {order?.shipbubble_order_id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Package Tracking</h3>
              </div>
              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded capitalize">
                {order.shipbubble_status || 'In Transit'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Courier:</span>
                <span className="font-semibold">{order.shipbubble_courier_name || 'Processing'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tracking Number:</span>
                <span className="font-mono font-semibold">{order.tracking_number || order.shipbubble_order_id}</span>
              </div>
              {order.is_cod_order && (
                <div className="flex justify-between">
                  <span className="text-orange-600 font-medium">⚠️ Cash on Delivery</span>
                </div>
              )}
            </div>

            {order.shipbubble_tracking_url && (
              <button
                onClick={() => window.open(order.shipbubble_tracking_url ?? undefined, '_blank')}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                <ExternalLink className="w-4 h-4" />
                Track Your Package
              </button>
            )}
          </motion.div>
        )}

        {/* Confirm Receipt / Report Issue — only shown when shipped */}
        {order.status === 'shipped' && !order.is_escrow_released && (
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Have you received your order?</h2>

            {!order.buyer_reported_issue && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Only confirm receipt if your order has actually arrived. 
                  Confirming releases payment to the seller.
                </p>
              </div>
            )}

            {!order.buyer_reported_issue && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleMarkAsReceived}
                  disabled={isReleasing || !canRelease}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isReleasing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-2" />Mark as Received</>
                  )}
                </Button>

                {canReport && !showIssueForm && (
                  <Button
                    variant="outline"
                    onClick={() => setShowIssueForm(true)}
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Report an Issue
                  </Button>
                )}
              </div>
            )}

            {/* Issue form */}
            {showIssueForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 border-t pt-4"
              >
                <p className="font-medium text-gray-900">Describe the issue</p>
                <p className="text-sm text-gray-500">
                  Your report will be sent to our admin team who will review and contact both you and the seller.
                </p>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="e.g. Item arrived damaged, wrong item received, item not received..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                  rows={4}
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setShowIssueForm(false); setIssueDescription(''); }}
                    className="flex-1"
                    disabled={isReporting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReportIssue}
                    disabled={isReporting || !issueDescription.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isReporting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                    ) : (
                      'Submit Report'
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Items</h2>
            {order.store && (
              <Link
                to={`/${order.store.slug}`}
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
              >
                <Store className="w-4 h-4" />
                {order.store.name}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          <div className="space-y-4">
            {(order.order_items || []).map((item) => {
              const image = item.product?.images?.[0] ?? null;
              return (
                <div key={item.id} className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {image ? (
                      <img src={image} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-medium">
                        {item.product_name?.charAt(0) ?? '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                      <p className="text-sm text-gray-500">
                        {Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
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

        {/* Delivery Address */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Delivery Address</h2>
          <div className="flex items-start gap-3 text-gray-600">
            <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">{order.customer_name}</p>
              <p>{deliveryAddress.address}</p>
              <p>{deliveryAddress.city}, {deliveryAddress.state}</p>
              {deliveryAddress.instructions && (
                <p className="text-sm text-gray-500 mt-1">Note: {deliveryAddress.instructions}</p>
              )}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₦{order.subtotal?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery</span>
              <span>₦{order.delivery_fee?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-3 border-t">
              <span>Total</span>
              <span>₦{order.total?.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t space-y-2 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>Payment</span>
              <span className="capitalize font-medium text-gray-700">
                {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Card / Transfer'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Reference</span>
              <span className="font-mono text-xs text-gray-600">{order.payment_reference}</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}