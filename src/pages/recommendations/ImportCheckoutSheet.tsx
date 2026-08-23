// src/pages/recommendations/ImportCheckoutSheet.tsx
// Real checkout for the importation section: login-gated, Paystack or manual
// bank transfer. Replaces the old "generate code, send on WhatsApp" flow —
// the code is still generated server-side for continuity, it's just no
// longer the primary path.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  X, Minus, Plus, Loader, CreditCard, Building2, CheckCircle2,
  Plane, Ship, BookOpen, MapPin, Navigation, AlertCircle,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import type { CartItem } from './RecommendationsPage';
import { fmt } from './RecommendationsPage';
import ManualPaymentFlow, { COMMUNITY_LINK } from './ManualPaymentFlow';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const SHIPPING_BLOG_SLUG = 'why-shipping-costs-so-much-and-how-we-fix-it';

interface DeliveryAddress {
  name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  landmark: string;
}

interface Props {
  cart: CartItem[];
  customer: { id: string; email: string; full_name: string; phone?: string };
  onClose: () => void;
  onAdd: (cart_key: string) => void;
  onRemove: (cart_key: string) => void;
}

export default function ImportCheckoutSheet({ cart, customer, onClose, onAdd, onRemove }: Props) {
  const [delivery, setDelivery] = useState<'to_qafrica' | 'to_me'>('to_qafrica');
  const [shippingMethod, setShippingMethod] = useState<'flight' | 'sea_freight' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'manual'>('paystack');
  const [whatsapp, setWhatsapp] = useState(customer.phone ?? '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; bank?: any } | null>(null);

  // Delivery address — only required when delivery === 'to_me'
  const [address, setAddress] = useState<DeliveryAddress>({
    name: customer.full_name ?? '', phone: customer.phone ?? '',
    address_line1: '', address_line2: '', city: '', state: '', landmark: '',
  });
  const setAddressField = (field: keyof DeliveryAddress, value: string) =>
    setAddress(prev => ({ ...prev, [field]: value }));

  // Optional GPS — supplements the manual address, never replaces it
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location isn\'t supported on this device/browser.');
      return;
    }
    setIsLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      () => {
        setLocationError('Couldn\'t access your location. You can still fill in the address manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  const subtotal = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);
  const jumiaFee = delivery === 'to_qafrica' ? cart.reduce((s, i) => s + 200 * i.quantity, 0) : 0;
  const total = subtotal + jumiaFee;

  const addressComplete = delivery === 'to_qafrica' || (
    address.name.trim() && address.phone.trim() && address.address_line1.trim() &&
    address.city.trim() && address.state.trim()
  );
  const canSubmit = whatsapp.trim() && cart.length > 0 && !!shippingMethod && addressComplete;

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
          shipping_method: shippingMethod,
          delivery_address: delivery === 'to_me' ? address : undefined,
          delivery_latitude: coords?.lat, delivery_longitude: coords?.lng,
          location_shared: !!coords,
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

        {/* Shipping method — flight vs sea freight, with a link explaining why consolidation keeps rates low */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shipping method</p>
            <Link
              to={`/blog/${SHIPPING_BLOG_SLUG}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold text-orange-500 hover:text-orange-600"
            >
              <BookOpen className="w-3 h-3" /> Why is shipping priced this way?
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShippingMethod('flight')}
              className={`text-left p-3 rounded-xl border-2 transition-colors ${shippingMethod === 'flight' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
              <Plane className="w-4 h-4 text-gray-700 mb-1.5" />
              <p className="font-semibold text-gray-900 text-xs">Flight</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Faster, consolidated air freight</p>
            </button>
            <button onClick={() => setShippingMethod('sea_freight')}
              className={`text-left p-3 rounded-xl border-2 transition-colors ${shippingMethod === 'sea_freight' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
              <Ship className="w-4 h-4 text-gray-700 mb-1.5" />
              <p className="font-semibold text-gray-900 text-xs">Sea freight</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Slower, lowest cost per kg</p>
            </button>
          </div>
        </div>

        {/* Delivery address — only required when shipping directly to the customer */}
        {delivery === 'to_me' && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Delivery address</p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Full name" value={address.name}
                  onChange={e => setAddressField('name', e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
                <input type="tel" placeholder="Phone number" value={address.phone}
                  onChange={e => setAddressField('phone', e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
              </div>
              <input type="text" placeholder="Address line 1 (street, house number)" value={address.address_line1}
                onChange={e => setAddressField('address_line1', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
              <input type="text" placeholder="Address line 2 (optional)" value={address.address_line2}
                onChange={e => setAddressField('address_line2', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="City" value={address.city}
                  onChange={e => setAddressField('city', e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
                <input type="text" placeholder="State" value={address.state}
                  onChange={e => setAddressField('state', e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
              </div>
              <input type="text" placeholder="Nearby landmark (optional)" value={address.landmark}
                onChange={e => setAddressField('landmark', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />

              {/* Optional GPS — supplements, doesn't replace, the address above */}
              {coords ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                  <Navigation className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <p className="text-[11px] text-emerald-700 flex-1">Location shared — this'll help us find you more precisely.</p>
                  <button onClick={() => setCoords(null)} className="text-emerald-400 hover:text-emerald-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={shareLocation} disabled={isLocating}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs font-semibold hover:border-gray-400 hover:text-gray-700 transition-colors">
                  {isLocating ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  {isLocating ? 'Getting your location…' : 'Share my current location (optional)'}
                </button>
              )}
              {locationError && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-600">
                  <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {locationError}
                </p>
              )}
            </div>
          </div>
        )}

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
