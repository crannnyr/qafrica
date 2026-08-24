// src/pages/recommendations/RetryPaymentSheet.tsx
// Opened when a customer taps a "To Pay" order. Shows the exact items on
// that order (with a link back to each product), and retries payment using
// the order's ORIGINAL method — never creates a new order, always resumes
// this exact one.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Loader, ExternalLink } from 'lucide-react';
import CONFIG from '@/lib/config';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import ManualPaymentFlow from './ManualPaymentFlow';
import { fmt } from './RecommendationsPage';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface OrderItem {
  id: string;
  name: string;
  price_ngn: number;
  quantity: number;
  image_url: string;
  variant_options?: Record<string, string>;
}

interface ToPayOrder {
  id: string;
  code: string;
  total_ngn: number;
  payment_method: 'paystack' | 'manual' | null;
  items: OrderItem[];
}

export default function RetryPaymentSheet({ order, customer, onClose, onPaid }: {
  order: ToPayOrder;
  customer: { id: string; email: string; full_name?: string };
  onClose: () => void;
  onPaid: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [bank, setBank] = useState<any>(null);
  const [showManualFlow, setShowManualFlow] = useState(false);

  // Only fetch bank details if this order was a manual-transfer order.
  useEffect(() => {
    if (order.payment_method !== 'manual') return;
    fetch(`${EDGE_URL}?action=admin-settings`)
      .then(r => r.json())
      .then(d => setBank(d.settings))
      .catch(() => {});
  }, [order.payment_method]);

  const retryPaystack = async () => {
    setIsProcessing(true);
    setError('');
    try {
      await loadPaystackScript();
      const reference = generateReference('QAFIMP');
      initializePayment({
        email: customer.email,
        amount: toKobo(order.total_ngn),
        reference,
        metadata: { order_id: order.id, code: order.code },
        onSuccess: async () => {
          try {
            const res = await fetch(`${EDGE_URL}?action=checkout-verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: order.id, reference }),
            });
            const data = await res.json();
            if (data.success) { onPaid(); onClose(); }
            else setError('Payment could not be verified. If you were charged, contact support with your order code: ' + order.code);
          } catch {
            setError('Payment verification failed. Contact support with your order code: ' + order.code);
          } finally {
            setIsProcessing(false);
          }
        },
        onCancel: () => setIsProcessing(false),
      });
    } catch (e: any) {
      setError(e?.message ?? 'Could not start payment');
      setIsProcessing(false);
    }
  };

  const confirmManualPaid = async () => {
    const res = await fetch(`${EDGE_URL}?action=checkout-mark-paid-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, order_id: order.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Could not submit payment confirmation. Please try again.');
    onPaid();
  };

  if (showManualFlow && bank) {
    return (
      <ManualPaymentFlow
        amountLabel={fmt(order.total_ngn)}
        bank={bank}
        onConfirmPaid={confirmManualPaid}
        onClose={onClose}
        dashboardHref="/importations/dashboard"
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Complete payment</h2>
            <p className="text-[11px] text-gray-400 font-mono">{order.code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-2.5 mb-5">
          {order.items.map((item, i) => (
            <Link
              key={i}
              to={`/recommendations/${item.id}`}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 line-clamp-1">{item.name}</p>
                {item.variant_options && (
                  <p className="text-[10px] text-gray-400">
                    {Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
                <p className="text-[11px] text-gray-400">Qty {item.quantity} · {fmt(item.price_ngn)}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-between px-1 mb-5">
          <span className="text-xs text-gray-500">Total due</span>
          <span className="font-black text-orange-500 text-lg">{fmt(order.total_ngn)}</span>
        </div>

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        {order.payment_method === 'paystack' ? (
          <button
            onClick={retryPaystack}
            disabled={isProcessing}
            className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing && <Loader className="w-4 h-4 animate-spin" />}
            Retry payment with Paystack
          </button>
        ) : (
          <button
            onClick={() => setShowManualFlow(true)}
            disabled={!bank}
            className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {!bank && <Loader className="w-4 h-4 animate-spin" />}
            Pay by bank transfer
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
