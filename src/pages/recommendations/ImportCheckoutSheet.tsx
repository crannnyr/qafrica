// src/pages/recommendations/ImportCheckoutSheet.tsx
// Real checkout for the importation section: login-gated, Paystack or manual
// bank transfer. Replaces the old "generate code, send on WhatsApp" flow —
// the code is still generated server-side for continuity, it's just no
// longer the primary path.
import { useState, useEffect } from 'react';
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
// Orders over this amount can't go through Paystack — manual bank transfer
// only. Mirrors the same cap enforced server-side in checkout-init.
const PAYSTACK_MAX_NGN = 50_000;

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
  const [delivery, setDelivery] = useState<'to_qafrica' | 'to_me'>('to_me');
  const [showWhyQafrica, setShowWhyQafrica] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'flight' | 'sea_freight' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'manual'>('paystack');
  const [manualTransferEnabled, setManualTransferEnabled] = useState(true);
  const [whatsapp, setWhatsapp] = useState(customer.phone ?? '');
  const [isProcessing, setIsProcessing] = useState(false);
  // Separate from isProcessing: true only during the narrow window after
  // Paystack itself has already taken the customer's money and closed its
  // popup, but before our server has confirmed that back to us. This is the
  // window where closing the tab/app causes the "paid but stuck unconfirmed"
  // cases — so it gets its own full-screen blocking state and a
  // beforeunload warning, rather than just the normal button spinner.
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; bank?: any; order_id?: string } | null>(null);

  useEffect(() => {
    if (!isVerifying) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isVerifying]);

  useEffect(() => {
    fetch(`${EDGE_URL}?action=admin-settings`)
      .then(res => res.json())
      .then(data => {
        if (data.settings && typeof data.settings.manual_transfer_enabled === 'boolean') {
          setManualTransferEnabled(data.settings.manual_transfer_enabled);
          if (!data.settings.manual_transfer_enabled) setPaymentMethod('paystack');
        }
      })
      .catch(() => {});
  }, []);

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
    // Geolocation is blocked outright on non-HTTPS origins (except localhost)
    // — this is the single most common cause of "always fails".
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setLocationError('Location needs a secure (https) connection. You can still fill in the address manually.');
      return;
    }

    setIsLocating(true);
    setLocationError('');

    const onSuccess = (pos: GeolocationPosition) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setIsLocating(false);
    };

    const describeError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) return 'Location access was denied. Check your browser/site permissions, or fill in the address manually.';
      if (err.code === err.POSITION_UNAVAILABLE) return 'Your position couldn\'t be determined right now. You can still fill in the address manually.';
      if (err.code === err.TIMEOUT) return 'Location took too long to respond. You can still fill in the address manually.';
      return 'Couldn\'t access your location. You can still fill in the address manually.';
    };

    // High-accuracy GPS can time out indoors or on some devices. Retry once
    // with a coarser, longer-timeout request before giving up — this is what
    // was previously causing location sharing to fail almost every time.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError(describeError(err));
          setIsLocating(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err2) => { setLocationError(describeError(err2)); setIsLocating(false); },
          { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 }
    );
  };

  const subtotal = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);
  const jumiaFee = delivery === 'to_qafrica' ? cart.reduce((s, i) => s + 200 * i.quantity, 0) : 0;
  const total = subtotal + jumiaFee;
  const paystackAllowed = total <= PAYSTACK_MAX_NGN;

  // Orders over the Paystack cap must go manual — force the switch (and
  // back, if the cart shrinks below the cap again) rather than leaving the
  // customer stuck on a now-disabled option.
  useEffect(() => {
    if (!paystackAllowed && paymentMethod === 'paystack') setPaymentMethod('manual');
  }, [paystackAllowed, paymentMethod]);

  // "Deliver to QAFRICA" (Jumia consolidation) only makes sense in bulk — it's
  // gated behind a 20-unit cart minimum.
  const cartTotalQty = cart.reduce((s, i) => s + i.quantity, 0);
  const QAFRICA_MOQ = 20;
  const qafricaUnlocked = cartTotalQty >= QAFRICA_MOQ;

  // If the cart drops below that threshold after the option was already
  // selected (items removed), fall back to "to_me" automatically rather
  // than leaving an invalid state selected.
  useEffect(() => {
    if (delivery === 'to_qafrica' && !qafricaUnlocked) setDelivery('to_me');
  }, [delivery, qafricaUnlocked]);

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
      if (!res.ok) {
        if (data.error === 'duplicate_pending_order') {
          throw new Error(data.message ?? 'You already have a pending order for this — check your dashboard to complete payment.');
        }
        throw new Error(data.error ?? 'Checkout failed');
      }

      if (paymentMethod === 'manual') {
        setResult({ code: data.code, bank: data.bank, order_id: data.order_id });
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
          setIsVerifying(true);
          // Paystack has already charged the customer at this point — this
          // call is just us catching up. Retry a few times before giving up,
          // since a flaky connection right here is exactly what causes a
          // real payment to end up stuck unconfirmed.
          let verifyData: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const verifyRes = await fetch(`${EDGE_URL}?action=checkout-verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: data.order_id, reference }),
              });
              verifyData = await verifyRes.json();
              break;
            } catch {
              if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
            }
          }
          if (verifyData?.success) setResult({ code: data.code });
          else setError('Payment could not be verified. If you were charged, contact support with your order code: ' + data.code);
          setIsVerifying(false);
          setIsProcessing(false);
        },
        onCancel: () => setIsProcessing(false),
      });
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
      setIsProcessing(false);
    }
  };

  // ── Verifying screen ────────────────────────────────────────────────────
  // Shown only in the gap between Paystack confirming the charge and our
  // own server confirming it back to us. Deliberately blocks the whole
  // screen (no close button, no back gesture affordance) with an explicit
  // "don't close this" instruction, since closing here is exactly what
  // causes a real payment to end up stuck unconfirmed.
  if (isVerifying) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-8 text-center">
        <Loader className="w-10 h-10 text-orange-500 animate-spin mb-6" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Confirming your payment…</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Your payment already went through — we're just confirming it on our end. Please don't close this page or go back until this finishes, it only takes a few seconds.
        </p>
      </div>
    );
  }

  // ── Success screen ──────────────────────────────────────────────────────
  // Manual bank transfer goes through the shared warning -> details -> "I have
  // paid" -> community link flow. Paystack payments are already verified
  // server-side by the time we get here, so they get a simpler screen.
  if (result?.bank) {
    return (
      <ManualPaymentFlow
        amountLabel={fmt(total)}
        bank={result.bank}
        onConfirmPaid={async (sender) => {
          const res = await fetch(`${EDGE_URL}?action=checkout-mark-paid-claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_id: customer.id,
              order_id: result.order_id,
              sender_name: sender.senderName,
              sender_bank_name: sender.senderBankName,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Could not submit payment confirmation. Please try again.');
        }}
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
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Delivery preference</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => qafricaUnlocked && setDelivery('to_qafrica')}
              disabled={!qafricaUnlocked}
              className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                !qafricaUnlocked ? 'border-gray-100 opacity-50 cursor-not-allowed' :
                delivery === 'to_qafrica' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900 text-xs">Deliver to QAFRICA</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowWhyQafrica(true); }}
                  className="text-[10px] font-bold text-orange-500 flex-shrink-0"
                >
                  Why this?
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                We receive, inspect & list on Jumia for you. +₦200/item
              </p>
              {!qafricaUnlocked && (
                <p className="text-[11px] text-orange-500 mt-1 font-medium">
                  Needs {QAFRICA_MOQ}+ units in cart — you have {cartTotalQty}
                </p>
              )}
            </button>
            <button onClick={() => setDelivery('to_me')}
              className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${delivery === 'to_me' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
              <p className="font-semibold text-gray-900 text-xs">Deliver to my address</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">Shipped directly to you. Cost confirmed after.</p>
            </button>
          </div>
        </div>

        {showWhyQafrica && <WhyQafricaExplainer onClose={() => setShowWhyQafrica(false)} />}


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
            <button
              onClick={() => paystackAllowed && setPaymentMethod('paystack')}
              disabled={!paystackAllowed}
              className={`w-full flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-colors ${
                !paystackAllowed
                  ? 'border-gray-100 opacity-50 cursor-not-allowed'
                  : paymentMethod === 'paystack' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'
              }`}
            >
              <CreditCard className="w-4 h-4 text-gray-700 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 text-xs">Pay with card — fastest</p>
                <p className="text-[11px] text-gray-400">
                  {paystackAllowed ? 'Instant confirmation via Paystack' : `For orders under ${fmt(PAYSTACK_MAX_NGN)} only`}
                </p>
              </div>
            </button>
            <button
              onClick={() => manualTransferEnabled && setPaymentMethod('manual')}
              disabled={!manualTransferEnabled}
              className={`w-full flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-colors ${
                !manualTransferEnabled
                  ? 'border-gray-100 opacity-50 cursor-not-allowed'
                  : paymentMethod === 'manual' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'
              }`}
            >
              <Building2 className="w-4 h-4 text-gray-700 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-xs">Manual bank transfer</p>
                  {!manualTransferEnabled && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">
                      Currently inactive
                    </span>
                  )}
                  {!paystackAllowed && manualTransferEnabled && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                      Required for this amount
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  {manualTransferEnabled ? 'We confirm once received' : 'Please pay with card for now'}
                </p>
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

function WhyQafricaExplainer({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-lg">Why deliver to QAFRICA?</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
          <div>
            <p className="font-semibold text-gray-900 text-xs mb-1">The setup</p>
            <p>
              Instead of each unit shipping straight to you, we receive your whole order at our warehouse first, inspect it for quality, then list it for resale on Jumia. This only makes sense at bulk quantities — which is why it needs 20+ units in your cart — because consolidating a handful of items wouldn't cover its own handling cost.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-xs mb-1">When your order arrives</p>
            <p>
              We notify you the moment your shipment lands at the warehouse and clears inspection, so you always know where things stand — you're never left guessing whether it's arrived.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-xs mb-1">Want a sample first?</p>
            <p>
              If you'd rather test a product before committing to a bulk Jumia order, reach out and we'll walk you through ordering a sample to "Deliver to my address" instead — no pressure to go straight to the bulk route.
            </p>
          </div>
        </div>

        <button onClick={onClose}
          className="w-full mt-6 py-3 bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors">
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}

