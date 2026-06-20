import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, ChevronRight, AlertCircle, Check,
  ShieldCheck, Star, Clock, Truck, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { useCustomerAuthStore } from '@/stores';
import { STATUS_STYLES, StatusIcon } from './helpers';
import { toast } from 'sonner';

export default function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);
  const [reportingOrderId, setReportingOrderId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const { customer } = useCustomerAuthStore();

  useEffect(() => { if (customer?.id) fetchOrders(); }, [customer?.id]);

  const fetchOrders = async () => {
    if (!customer) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, total, created_at,
          delivery_address, delivery_state, delivered_at, tracking_number,
          shipbubble_order_id, shipbubble_tracking_url, shipbubble_status,
          shipbubble_courier_name, is_cod_order, is_escrow_released,
          buyer_reported_issue, has_reviewed,
          store:stores!orders_store_id_fkey(name, slug),
          order_items(
            id, quantity, unit_price, total_price,
            product:products!order_items_product_id_fkey(id, name, images),
            original_product:products!order_items_original_product_id_fkey(id, name, images)
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) { console.error('Fetch orders error:', error); setOrders([]); }
      else setOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReleaseEscrow = async (orderId: string) => {
    if (!customer) return;
    setReleasingOrderId(orderId);
    try {
      const { error } = await supabase.rpc('release_escrow_funds', {
        p_order_id: orderId,
        p_customer_id: customer.id,
      });
      if (error) throw error;
      toast.success('Payment released to seller');
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm receipt');
    } finally {
      setReleasingOrderId(null);
    }
  };

  const handleSubmitReport = async (orderId: string) => {
    if (!reportText.trim()) { toast.error('Please describe the issue'); return; }
    setIsSubmittingReport(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          buyer_reported_issue: true,
          issue_description: reportText.trim(),
          issue_reported_at: new Date().toISOString(),
          dispute_status: 'open',
        })
        .eq('id', orderId)
        .eq('customer_id', customer!.id);
      if (error) throw error;
      toast.success('Report submitted. Our team will review within 24 hours.');
      setReportingOrderId(null);
      setReportText('');
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (orders.length === 0) return (
    <div className="text-center py-16">
      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Package className="w-7 h-7 text-gray-400" />
      </div>
      <p className="font-medium text-gray-900 mb-1">No orders yet</p>
      <p className="text-sm text-gray-500 mb-6">Your purchases will appear here</p>
      <Link to="/stores">
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">Browse Stores</Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map((order, index) => {
        const orderItems: any[] = order.order_items || [];
        const canRelease = order.status === 'shipped' && !order.is_escrow_released && !order.buyer_reported_issue;

        return (
          <motion.div key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">

            {/* Top row */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">#{order.order_number}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}>
                    <StatusIcon status={order.status} />
                    <span className="capitalize">{order.status}</span>
                  </span>
                  {order.buyer_reported_issue && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                      <AlertCircle className="w-3 h-3" />Issue reported
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}<span className="text-gray-500">{order.store?.name || 'Store'}</span>
                </p>
                {order.shipbubble_order_id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                      {order.shipbubble_status || 'Tracking'}
                    </span>
                    {order.shipbubble_tracking_url && (
                      <a href={order.shipbubble_tracking_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline font-semibold">Track</a>
                    )}
                  </div>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize mt-1 inline-block">
                    {order.status}
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-900 text-sm">₦{order.total?.toLocaleString()}</p>
            </div>

            {/* Thumbnails */}
            {orderItems.length > 0 && (
              <div className="flex gap-2 mb-3">
                {orderItems.slice(0, 4).map((item: any, idx: number) => {
                  const image = item.product?.images?.[0] ?? null;
                  return (
                    <div key={idx} className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100">
                      {image
                        ? <img src={image} alt={item.product?.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-medium">
                            {item.product?.name?.charAt(0) ?? '?'}
                          </div>
                      }
                    </div>
                  );
                })}
                {orderItems.length > 4 && (
                  <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium border border-gray-100">
                    +{orderItems.length - 4}
                  </div>
                )}
                <div className="flex-1" />
                {order.is_escrow_released && (
                  <div className="flex items-center gap-1 text-xs text-green-600 font-medium self-center">
                    <ShieldCheck className="w-3.5 h-3.5" />Paid
                  </div>
                )}
              </div>
            )}

            {canRelease && (
              <div className="mb-3 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Received your order? Confirm to release payment to the seller.
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 border-t border-gray-50 space-y-2">
              <div className="flex items-center justify-between">
                <Link to={`/customer/orders/${order.id}`}
                  className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1">
                  View details <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <div className="flex gap-2">
                  {canRelease && (
                    <Button size="sm" onClick={() => handleReleaseEscrow(order.id)}
                      disabled={releasingOrderId === order.id}
                      className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white px-3">
                      {releasingOrderId === order.id
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <><Check className="w-3 h-3 mr-1" />Received</>
                      }
                    </Button>
                  )}
                  {order.status === 'delivered' && !order.has_reviewed && (
                    <Link to={`/customer/orders/${order.id}/review`}>
                      <Button variant="outline" size="sm"
                        className="h-7 text-xs border-orange-200 text-orange-600 px-3">
                        <Star className="w-3 h-3 mr-1" />Review
                      </Button>
                    </Link>
                  )}
                  {!order.buyer_reported_issue &&
                    ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status) && (
                    <button
                      onClick={() => { setReportingOrderId(reportingOrderId === order.id ? null : order.id); setReportText(''); }}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />Report
                    </button>
                  )}
                </div>
              </div>

              {/* Inline report form */}
              {reportingOrderId === order.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-red-800 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Report Issue — Order #{order.order_number}
                  </p>
                  <textarea
                    value={reportText}
                    onChange={e => setReportText(e.target.value)}
                    placeholder="Describe the problem — wrong item, not delivered, damaged goods..."
                    rows={3}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSubmitReport(order.id)}
                      disabled={isSubmittingReport || !reportText.trim()}
                      className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white px-3 flex-1">
                      {isSubmittingReport
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : 'Submit Report'
                      }
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => { setReportingOrderId(null); setReportText(''); }}
                      className="h-7 text-xs px-3 border-red-200 text-red-600">
                      Cancel
                    </Button>
                  </div>
                  <p className="text-[10px] text-red-500">
                    Submitting a report will pause payment release until our team reviews the issue.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}