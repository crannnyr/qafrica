// src/pages/recommendations/ImportCheckoutSheet.tsx
// Real checkout for the importation section: login-gated, Paystack or manual
// bank transfer. Replaces the old "generate code, send on WhatsApp" flow —
// the code is still generated server-side for continuity, it's just no
// longer the primary path.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Minus, Plus, Loader, CreditCard, Building2, CheckCircle2 } from 'lucide-react';
import CONFIG from '@/lib/config';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import type { CartItem } from './RecommendationsPage';
import { fmt } from './RecommendationsPage';
import ManualPaymentFlow, { COMMUNITY_LINK } from './ManualPaymentFlow';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface Props {
  cart: CartItem[];
  customer: { id: string; email: string; full_name: string; phone?: string };
  onClose: () => void;
  onAdd: (cart_key: string) => void;
  onRemove: (cart_key: string) => void;
}

export default function ImportCheckoutSheet({ cart, customer, onClose, onAdd, onRemove }: Props) {
  const [delivery, setDelivery] = useState<'to_qafrica' | 'to_me'>('to_qafrica');
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'manual'>('paystack');
  const [whatsapp, setWhatsapp] = useState(customer.phone ?? '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; bank?: any } | null>(null);

  const subtotal = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);
  const jumiaFee = delivery === 'to_qafrica' ? cart.reduce((s, i) => s + 200 * i.quantity, 0) : 0;
  const total = subtotal + jumiaFee;
  const canSubmit = whatsapp.trim() && cart.length > 0;

  const handleCheckout = async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=checkout-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          customer_name: customer.full_name,
          customer_whatsapp: whatsapp.trim(),
          delivery_type: delivery,
          payment_method: paymentMethod,
          items: cart.map(i => ({
            id: i.id, name: i.name, price_ngn: i.price_ngn, price_cny: i.price_cny,
            quantity: i.quantity, image_url: i.image_url,
            variant_options: i.variant_selection ?? undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');

      if (paymentMethod === 'manual') {
        setResult({ code: data.code, bank: data.bank });
        setIsProcessing(false);
        return;
      }

      // Paystack
      await loadPaystackScript();
      const reference = generateReference('QAFIMP');
      initializePayment({
        email: customer.email,
        amount: toKobo(data.total_ngn),
        reference,
        metadata: { order_id: data.order_id, code: data.code },
        onSuccess: async () => {
          try {
            const verifyRes = await fetch(`${EDGE_URL}?action=checkout-verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: data.order_id, reference }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) setResult({ code: data.code });
            else setError('Payment could not be verified. If you were charged, contact support with your order code: ' + data.code);
          } catch {
            setError('Payment verification failed. Contact support with your order code: ' + data.code);
          } finally {
            setIsProcessing(false);
          }
        },
        onCancel: () => setIsProcessing(false),
      });
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
      setIsProcessing(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────
  // Manual bank transfer goes through the shared warning -> details -> "I have
  // paid" -> community link flow. Paystack payments are already verified
  // server-side by the time we get here, so they get a simpler screen.
  if (result?.bank) {
    return (
      <ManualPaymentFlow
        amountLabel={fmt(total)}
        bank={result.bank}
        onConfirmPaid={() => {}}
        onClose={onClose}
        dashboardHref="/importations/dashboard"
      />
    );
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 26 }}
          className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6"
        >
          <div className="text-center mb-5">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Payment received!</h3>
            <p className="text-gray-400 text-xs">Order code: <span className="font-bold text-gray-700">{result.code}</span></p>
          </div>

          <a
            href={COMMUNITY_LINK} target="_blank" rel="noopener noreferrer"
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors mb-2"
          >
            Join the QAFRICA community
          </a>
          <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 font-medium">Close</button>
        </motion.div>
      </motion.div>
    );
  }

  // ── Cart / checkout form ────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-white flex flex-col sm:left-auto sm:w-[420px] sm:shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 text-sm">Checkout</h2>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div className="space-y-3">
          {cart.map(item => (
            <div key={item.cart_key} className="flex items-center gap-3">
              <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-xs leading-snug truncate">{item.name}</p>
                {item.variant_selection && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {Object.entries(item.variant_selection).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">{fmt(item.price_ngn)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => onRemove(item.cart_key)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></button>
                <span className="font-bold text-sm w-7 text-center">{item.quantity}</span>
                <button onClick={() => onAdd(item.cart_key)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"><Plus className="w-2.5 h-2.5" /></button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Delivery preference</p>
          <div className="space-y-2">
            {[
              { key: 'to_qafrica' as const, label: 'Deliver to QAFRICA', sub: 'We receive, inspect & list on Jumia for you. +₦200/item' },
              { key: 'to_me' as const, label: 'Deliver to my address', sub: 'Shipped directly to you. Cost confirmed after.' },
            ].map(opt => (
              <button key={opt.key} onClick={() => setDelivery(opt.key)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${delivery === opt.key ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                <p className="font-semibold text-gray-900 text-xs">{opt.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment method</p>
          <div className="space-y-2">
            <button onClick={() => setPaymentMethod('paystack')}
              className={`w-full flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-colors ${paymentMethod === 'paystack' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
              <CreditCard className="w-4 h-4 text-gray-700 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 text-xs">Pay with card — fastest</p>
                <p className="text-[11px] text-gray-400">Instant confirmation via Paystack</p>
              </div>
            </button>
            <button onClick={() => setPaymentMethod('manual')}
              className={`w-full flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-colors ${paymentMethod === 'manual' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
              <Building2 className="w-4 h-4 text-gray-700 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 text-xs">Manual bank transfer</p>
                <p className="text-[11px] text-gray-400">We confirm once received</p>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3.5 space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span className="font-medium">{fmt(subtotal)}</span></div>
          {delivery === 'to_qafrica' && <div className="flex justify-between text-xs text-gray-500"><span>Jumia listing fee</span><span className="font-medium">{fmt(jumiaFee)}</span></div>}
          <div className="flex justify-between text-xs font-bold text-gray-900 pt-1.5 border-t border-gray-200"><span>Total</span><span className="text-orange-500">{fmt(total)}</span></div>
        </div>

        <input
          type="tel" placeholder="WhatsApp number (e.g. 08012345678)" value={whatsapp}
          onChange={e => setWhatsapp(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
        />

        {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      </div>

      <div className="px-4 py-4 border-t border-gray-100">
        <button
          disabled={!canSubmit || isProcessing} onClick={handleCheckout}
          className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : null}
          {isProcessing ? 'Processing…' : `Pay ${fmt(total)}`}
        </button>
      </div>
    </motion.div>
  );
}
