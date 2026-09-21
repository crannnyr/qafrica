// src/pages/recommendations/ImportCheckoutSheet.tsx
// Real checkout for the importation section: login-gated, Paystack or manual
// bank transfer. Replaces the old "generate code, send on WhatsApp" flow —
// the code is still generated server-side for continuity, it's just no
// longer the primary path.
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  X, Loader, CreditCard, Building2, CheckCircle2,
  Plane, Ship, BookOpen, MapPin, Navigation, AlertCircle, Search,
  Tag, Home, Store, Zap, Pencil,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import type { CartItem } from './RecommendationsPage';
import { fmt } from './RecommendationsPage';
import ManualPaymentFlow, { COMMUNITY_LINK } from './ManualPaymentFlow';
import ImportQtyControl from '@/components/ImportQtyControl';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const STATIONS_REST_URL = `${CONFIG.SUPABASE_URL}/rest/v1/pickup_stations`;
const SHIPPING_BLOG_SLUG = 'why-shipping-costs-so-much-and-how-we-fix-it';
// Orders at or above the configured threshold must use manual bank transfer.
// The same rule is enforced server-side in checkout-init.

interface DeliveryAddress {
  name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  landmark: string;
}

interface SavedAddress {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  landmark: string | null;
  is_default: boolean;
  preferred_pickup_station_id: string | null;
}

interface PickupStation {
  id: string;
  name: string;
  state: string;
  address: string;
  landmark: string | null;
}

type DeliveryMode = 'home' | 'pickup_station';

interface Props {
  cart: CartItem[];
  customer: { id: string; email: string; full_name: string; phone?: string };
  onClose: () => void;
  onAdd: (cart_key: string) => void;
  onRemove: (cart_key: string) => void;
  onSetQuantity: (cart_key: string, quantity: number) => void;
}

export default function ImportCheckoutSheet({ cart, customer, onClose, onAdd, onRemove, onSetQuantity }: Props) {
  // Flight is the default shipping choice — customer can switch to sea freight.
  const [shippingMethod, setShippingMethod] = useState<'flight' | 'sea_freight' | null>('flight');
  // const [shippingMethod, setShippingMethod] = useState<'flight' | 'sea_freight' | null>(null);

  // Some products cannot travel by air. With a single item in the cart this
  // still forces the whole (single) shipping choice to sea, same as before.
  // With multiple items it only locks that one item — the rest of the cart
  // can still choose freely (see the per-item shipping section below).
  const seaOnlyItems = cart.filter(i => i.ship_only);
  const forcedSeaFreight = cart.length === 1 && seaOnlyItems.length > 0;
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

  // useEffect(() => {
  //   fetch(`${EDGE_URL}?action=admin-settings`)
  //     .then(res => res.json())
  //     .then(data => {
  //       if (data.settings && typeof data.settings.manual_transfer_enabled === 'boolean') {
  //         setManualTransferEnabled(data.settings.manual_transfer_enabled);
  //         if (!data.settings.manual_transfer_enabled) setPaymentMethod('paystack');
  //       }
  //     })
  //     .catch(() => {});
  // }, []);

  const [shippingSettings, setShippingSettings] = useState({
    chargeShippingAtCheckout: false,
    shippingDiscountPercent: 0,
    shippingDiscountMinNgn: 1600,
    bulkDiscountTier1Qty: 10,
    bulkDiscountTier1Percent: 5,
    bulkDiscountTier2Qty: 20,
    bulkDiscountTier2Percent: 5,
    paystackManualThresholdNgn: 100_000,
  });
  
  useEffect(() => {
    fetch(`${EDGE_URL}?action=admin-settings`)
      .then(res => res.json())
      .then(data => {
        if (!data.settings) return;
        if (typeof data.settings.manual_transfer_enabled === 'boolean') {
          setManualTransferEnabled(data.settings.manual_transfer_enabled);
          if (!data.settings.manual_transfer_enabled) setPaymentMethod('paystack');
        }
        setShippingSettings({
          chargeShippingAtCheckout: data.settings.charge_shipping_at_checkout === true,
          shippingDiscountPercent: Number(data.settings.shipping_discount_percent ?? 0),
          shippingDiscountMinNgn: Number(data.settings.shipping_discount_min_ngn ?? 1600),
          bulkDiscountTier1Qty: Number(data.settings.bulk_discount_tier1_qty ?? 10),
          bulkDiscountTier1Percent: Number(data.settings.bulk_discount_tier1_percent ?? 5),
          bulkDiscountTier2Qty: Number(data.settings.bulk_discount_tier2_qty ?? 20),
          bulkDiscountTier2Percent: Number(data.settings.bulk_discount_tier2_percent ?? 5),
          paystackManualThresholdNgn: Number(data.settings.paystack_manual_threshold_ngn ?? 100_000),
        });
      })
      .catch(() => {});
  }, []);

  
  // ── Per-item shipping method ─────────────────────────────────────────
  // Each distinct cart item gets its own shipping method. Quantity does not
  // create another shipping selection: Bag x3 is one cart item, while
  // Bag x1 + Clothes x1 are two separate items and each gets its own default.
  //
  // Normal items default to Air. Sea-only items default to Sea and cannot
  // switch to Air. State only stores explicit customer choices; the render
  // fallback below guarantees a default even when a new item is added after
  // this checkout sheet has already mounted.
  const [itemShipping, setItemShipping] = useState<Record<string, 'flight' | 'sea_freight'>>(() =>
    Object.fromEntries(
      cart.map(item => [item.cart_key, item.ship_only ? 'sea_freight' : 'flight'])
    ) as Record<string, 'flight' | 'sea_freight'>
  );

  const setItemShippingMethod = (cartKey: string, method: 'flight' | 'sea_freight') => {
    setItemShipping(prev => ({ ...prev, [cartKey]: method }));
  };

  // Compute shipping per item and total
  // The default is derived directly from the cart, not only from React state.
  // This guarantees Air is selected even when a second item is added after
  // this checkout sheet has already mounted.
  const shippingMethodFor = (item: CartItem): 'flight' | 'sea_freight' | null => {
    if (cart.length <= 1) return shippingMethod;
    // For multiple distinct products, every normal item is Air by default.
    // Only an explicit customer choice changes it; sea-only items remain Sea.
    return itemShipping[item.cart_key] ?? (item.ship_only ? 'sea_freight' : 'flight');
  };

  const getDeliveryEstimate = (method: 'flight' | 'sea_freight') => {
    const start = new Date();
    const minDate = new Date(start);
    const maxDate = new Date(start);
    const minDays = method === 'sea_freight' ? 63 : 23;
    const maxDays = method === 'sea_freight' ? 93 : 33;
    minDate.setDate(minDate.getDate() + minDays);
    maxDate.setDate(maxDate.getDate() + maxDays);

    const fmtDate = (date: Date) => date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Lagos',
    });

    return `${fmtDate(minDate)} – ${fmtDate(maxDate)}`;
  };

  const selectedDeliveryMethods = Array.from(
    new Set(cart.map(item => shippingMethodFor(item)).filter(Boolean))
  ) as Array<'flight' | 'sea_freight'>;

  const deliveryEstimateText = selectedDeliveryMethods.map(method => ({
    method,
    window: getDeliveryEstimate(method),
  }));

  const shippingCostFor = (item: CartItem) => {
    const method = shippingMethodFor(item);
    if (!method) return 0;
    const rate = method === 'flight' ? item.flight_shipping_cost_ngn : item.sea_shipping_cost_ngn;
    return (rate ?? 0) * item.quantity;
  };
  
  const cartQty = cart.reduce((s, i) => s + i.quantity, 0);
  const rawShippingTotal = cart.reduce((s, item) => s + shippingCostFor(item), 0);
  
  // Discount only kicks in once raw shipping is at/above the floor — below
  // that, no discount at all, matching the same rule enforced server-side.
  const discountActive = rawShippingTotal >= shippingSettings.shippingDiscountMinNgn;
  const effectiveDiscountPercent = discountActive
    ? Math.min(
        shippingSettings.shippingDiscountPercent
          + (cartQty >= shippingSettings.bulkDiscountTier1Qty ? shippingSettings.bulkDiscountTier1Percent : 0)
          + (cartQty >= shippingSettings.bulkDiscountTier2Qty ? shippingSettings.bulkDiscountTier2Percent : 0),
        100
      )
    : 0;
  const shippingTotal = discountActive
    ? Math.round(rawShippingTotal * (1 - effectiveDiscountPercent / 100))
    : rawShippingTotal;
  
  const subtotal = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);
  const total = subtotal + (shippingSettings.chargeShippingAtCheckout ? shippingTotal : 0);

  // Paystack / manual selection
  // Paystack remains available only below the configured threshold.
  // At or above the threshold, manual bank transfer is required.
  const paystackAllowed = manualTransferEnabled && total < shippingSettings.paystackManualThresholdNgn;
  const manualAllowed = manualTransferEnabled && total >= shippingSettings.paystackManualThresholdNgn;

  useEffect(() => {
    if (!paystackAllowed && manualAllowed && paymentMethod === 'paystack') {
      setPaymentMethod('manual');
    } else if (!manualAllowed && paystackAllowed && paymentMethod === 'manual') {
      setPaymentMethod('paystack');
    }
  }, [paystackAllowed, manualAllowed, paymentMethod]);

  // Delivery address — only required when delivery === 'to_me'
  const [address, setAddress] = useState<DeliveryAddress>({
    name: customer.full_name ?? '', phone: customer.phone ?? '',
    address_line1: '', address_line2: '', city: '', state: '', landmark: '',
  });
  const setAddressField = (field: keyof DeliveryAddress, value: string) =>
    setAddress(prev => ({ ...prev, [field]: value }));

  // ── Address book ──────────────────────────────────────────────────────
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  // null = still deciding; a saved address id = using that one; 'new' = the
  // manual form below is in use (either no saved addresses yet, or the
  // customer chose to add another).
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new' | null>(null);
  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');

  useEffect(() => {
    fetch(`${EDGE_URL}?action=my-addresses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id }),
    })
      .then(res => res.json())
      .then(data => {
        const list: SavedAddress[] = data.addresses ?? [];
        setSavedAddresses(list);
        const def = list.find(a => a.is_default) ?? list[0];
        setSelectedAddressId(def ? def.id : 'new');
      })
      .catch(() => setSelectedAddressId('new'))
      .finally(() => setAddressesLoaded(true));
  }, [customer.id]);

  // Populate the manual form fields whenever a saved address is chosen, so
  // handleCheckout (and the pickup-station name/phone reuse) always has
  // something to read from without needing two separate code paths.
  useEffect(() => {
    if (!selectedAddressId || selectedAddressId === 'new') return;
    const saved = savedAddresses.find(a => a.id === selectedAddressId);
    if (!saved) return;
    setAddress({
      name: saved.name, phone: saved.phone, address_line1: saved.address_line1,
      address_line2: saved.address_line2 ?? '', city: saved.city, state: saved.state,
      landmark: saved.landmark ?? '',
    });
  }, [selectedAddressId, savedAddresses]);

  // ── Delivery mode: home address vs Jumia pickup station ─────────────────
  // Defaults to Jumia pickup — fastest/cheapest — unless the customer has
  // saved a different preference in Settings, which always wins once loaded.
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('pickup_station');
  const [stations, setStations] = useState<PickupStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationSearch, setStationSearch] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [showStationPicker, setShowStationPicker] = useState(false);

  useEffect(() => {
    fetch(`${EDGE_URL}?action=my-delivery-prefs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.default_delivery_mode) setDeliveryMode(data.default_delivery_mode);
        if (data.default_pickup_station) {
          setSelectedStationId(data.default_pickup_station.id);
          setStations(prev => prev.some(s => s.id === data.default_pickup_station.id) ? prev : [...prev, data.default_pickup_station]);
        }
      })
      .catch(() => {});
  }, [customer.id]);

  useEffect(() => {
    if (deliveryMode !== 'pickup_station' || stations.length > 0 || stationsLoading) return;
    setStationsLoading(true);
    fetch(`${STATIONS_REST_URL}?select=id,name,state,address,landmark&is_active=eq.true&order=state.asc`, {
      headers: { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}` },
    })
      .then(res => res.json())
      .then((data: PickupStation[]) => setStations(Array.isArray(data) ? data : []))
      .catch(() => setStations([]))
      .finally(() => setStationsLoading(false));
  }, [deliveryMode, stations.length, stationsLoading]);

  // Pre-fill state from the address form, then suggest stations matching
  // the typed city first, falling back to the whole state. Nothing shows
  // until the customer has typed at least a city or a search term — a
  // full 451-station list up front is the "list everything" pattern this
  // was specifically meant to avoid.
  const matchingStations = (() => {
    const q = stationSearch.trim().toLowerCase();
    const city = address.city.trim().toLowerCase();
    const state = address.state.trim().toLowerCase();
    if (!q && !city && !state) return [];
    return stations.filter(s => {
      const haystack = `${s.name} ${s.address} ${s.landmark ?? ''} ${s.state}`.toLowerCase();
      if (q) return haystack.includes(q);
      if (city) return haystack.includes(city) || s.state.toLowerCase() === state;
      return s.state.toLowerCase() === state;
    }).slice(0, 25);
  })();
  const selectedStation = stations.find(s => s.id === selectedStationId) ?? null;

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

  const addressComplete = deliveryMode === 'pickup_station'
  ? !!(address.name.trim() && address.phone.trim() && selectedStationId)
  : (address.name.trim() && address.phone.trim() && address.address_line1.trim() &&
     address.city.trim() && address.state.trim());
  
  useEffect(() => {
    if (forcedSeaFreight && shippingMethod !== 'sea_freight') setShippingMethod('sea_freight');
  }, [forcedSeaFreight, shippingMethod]);

  // Multi-item carts default every normal item to Air. Sea-only items are locked to Sea.
  // Existing customer choices are preserved when the cart changes.
  useEffect(() => {
    if (cart.length <= 1) return;
    setItemShipping(prev => {
      const next = { ...prev };
      let changed = false;
      for (const item of cart) {
        const requiredMethod = item.ship_only ? 'sea_freight' : 'flight';
        if (item.ship_only) {
          if (next[item.cart_key] !== requiredMethod) {
            next[item.cart_key] = requiredMethod;
            changed = true;
          }
        } else if (!next[item.cart_key]) {
          next[item.cart_key] = requiredMethod;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cart]);

  const perItemShippingComplete = cart.length <= 1 || cart.every(i => !!shippingMethodFor(i));
  const missingShippingItems = cart.length > 1 ? cart.filter(i => !shippingMethodFor(i)) : [];
  const canSubmit = whatsapp.trim() && cart.length > 0 && addressComplete && perItemShippingComplete &&
    (cart.length > 1 ? true : !!shippingMethod);

  const handleCheckout = async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    setError('');
    try {
      // Persist a new address before checkout if the customer asked to
      // save it — a failure here shouldn't block the order, so it's best
      // effort and swallowed rather than surfaced as a checkout error.
      if (deliveryMode === 'home' && selectedAddressId === 'new' && saveThisAddress) {
        fetch(`${EDGE_URL}?action=save-address`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customer.id, label: newAddressLabel.trim() || null,
            ...address, is_default: savedAddresses.length === 0,
          }),
        }).catch(() => {});
      }

      const res = await fetch(`${EDGE_URL}?action=checkout-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          customer_name: customer.full_name,
          customer_whatsapp: whatsapp.trim(),
          delivery_type: 'to_me',
          delivery_mode: deliveryMode,
          pickup_station_id: deliveryMode === 'pickup_station' ? selectedStationId : undefined,
          address_id: deliveryMode === 'home' && selectedAddressId !== 'new' ? selectedAddressId : undefined,
          shipping_method: cart.length === 1 ? shippingMethod : undefined,
          delivery_address: address,
          delivery_latitude: coords?.lat, delivery_longitude: coords?.lng,
          location_shared: !!coords,
          payment_method: paymentMethod,
          items: cart.map(i => ({
            id: i.id, name: i.name, price_ngn: i.price_ngn, price_cny: i.price_cny,
            quantity: i.quantity, image_url: i.image_url,
            variant_options: i.variant_selection ?? undefined,
            shipping_method: shippingMethodFor(i),
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
        metadata: { type: 'china_import_order', order_id: data.order_id, code: data.code },
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
                <ImportQtyControl
                  size="sm"
                  quantity={item.quantity}
                  onDecrement={() => onRemove(item.cart_key)}
                  onIncrement={() => onAdd(item.cart_key)}
                  onSetQuantity={n => onSetQuantity(item.cart_key, n)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Shipping method — flight vs sea freight, with a link explaining why consolidation keeps rates low.
            Single-item carts keep the original one-off toggle; carts with 2+ items get a per-item toggle instead,
            since different products in the same order can now travel by different methods. */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {cart.length > 1 ? 'Shipping method per item' : 'Shipping method'}
            </p>
            <Link
              to={`/blog/${SHIPPING_BLOG_SLUG}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold text-orange-500 hover:text-orange-600"
            >
              <BookOpen className="w-3 h-3" /> Why is shipping priced this way?
            </Link>
          </div>

          {cart.length <= 1 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShippingMethod('flight')}
                  disabled={forcedSeaFreight}
                  title={forcedSeaFreight ? 'Not available for sea-freight-only items in your cart' : undefined}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${forcedSeaFreight ? 'border-gray-100 opacity-40 cursor-not-allowed' : shippingMethod === 'flight' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                  <Plane className="w-4 h-4 text-gray-700 mb-1.5" />
                  <p className="font-semibold text-gray-900 text-xs">Flight</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Flight 20–30 days</p>
                  {cart[0]?.weight_grams != null && (
                    <p className="text-[9px] text-gray-400 mt-0.5">{cart[0].weight_grams}g</p>
                  )}
                  {cart[0]?.flight_shipping_cost_ngn != null && shippingSettings.chargeShippingAtCheckout && (
                    <div className="mt-1">
                      {discountActive && effectiveDiscountPercent > 0 ? (
                        <>
                          <p className="text-[9px] text-gray-300 line-through">{fmt(cart[0].flight_shipping_cost_ngn * cart[0].quantity)}</p>
                          <p className="text-[10px] font-bold text-emerald-600">
                            {fmt(Math.round(cart[0].flight_shipping_cost_ngn * cart[0].quantity * (1 - effectiveDiscountPercent / 100)))}
                            <span className="ml-1 text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded">-{effectiveDiscountPercent}%</span>
                          </p>
                        </>
                      ) : (
                        <p className="text-[10px] font-bold text-gray-600">{fmt(cart[0].flight_shipping_cost_ngn * cart[0].quantity)}</p>
                      )}
                    </div>
                  )}
                </button>
                <button onClick={() => setShippingMethod('sea_freight')}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${shippingMethod === 'sea_freight' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                  <Ship className="w-4 h-4 text-gray-700 mb-1.5" />
                  <p className="font-semibold text-gray-900 text-xs">Sea freight</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Sea 60–90 days</p>
                  {cart[0]?.volume_cbm != null && (
                    <p className="text-[9px] text-gray-400 mt-0.5">{cart[0].volume_cbm} cbm</p>
                  )}
                  {cart[0]?.sea_shipping_cost_ngn != null && shippingSettings.chargeShippingAtCheckout && (
                    <div className="mt-1">
                      {discountActive && effectiveDiscountPercent > 0 ? (
                        <>
                          <p className="text-[9px] text-gray-300 line-through">{fmt(cart[0].sea_shipping_cost_ngn * cart[0].quantity)}</p>
                          <p className="text-[10px] font-bold text-emerald-600">
                            {fmt(Math.round(cart[0].sea_shipping_cost_ngn * cart[0].quantity * (1 - effectiveDiscountPercent / 100)))}
                            <span className="ml-1 text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded">-{effectiveDiscountPercent}%</span>
                          </p>
                        </>
                      ) : (
                        <p className="text-[10px] font-bold text-gray-600">{fmt(cart[0].sea_shipping_cost_ngn * cart[0].quantity)}</p>
                      )}
                    </div>
                  )}
                </button>
              </div>
              {forcedSeaFreight && (
                <p className="text-[11px] text-gray-500 mt-2 flex items-start gap-1.5">
                  <Ship className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-px" />
                  <span>
                    {seaOnlyItems.map(i => i.name).join(', ')} {seaOnlyItems.length > 1 ? 'ship' : 'ships'} by sea only,
                    so this order goes by sea freight.
                  </span>
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {missingShippingItems.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-amber-800">Select shipping method</p>
                    <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                      Please choose Air or Sea for {missingShippingItems.length === 1 ? 'the item above' : 'each item above'} before continuing.
                    </p>
                  </div>
                </div>
              )}
              {cart.map(item => {
                const locked = item.ship_only;
                const chosen = shippingMethodFor(item);
                return (
                  <div key={item.cart_key} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-100">
                    <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                      {(item.weight_grams != null || item.volume_cbm != null) && (
                        <p className="text-[9px] text-gray-400">
                          {item.weight_grams != null && `${item.weight_grams}g`}
                          {item.weight_grams != null && item.volume_cbm != null && ' · '}
                          {item.volume_cbm != null && `${item.volume_cbm} cbm`}
                        </p>
                      )}
                      {chosen && shippingSettings.chargeShippingAtCheckout && (
                        <p className="text-[10px] text-gray-400">+{fmt(shippingCostFor(item))} shipping</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => !locked && setItemShippingMethod(item.cart_key, 'flight')}
                        disabled={locked}
                        title={locked ? 'Ships by sea only' : undefined}
                        aria-pressed={chosen === 'flight'}
                        className={`flex flex-col items-center justify-center gap-0.5 w-10 h-10 rounded-lg border-2 transition-colors ${locked ? 'border-gray-100 opacity-30 cursor-not-allowed' : chosen === 'flight' ? 'border-gray-900 bg-gray-100 ring-1 ring-gray-900' : 'border-gray-100 bg-white'}`}
                      >
                        <Plane className="w-3 h-3 text-gray-700" />
                        <span className={`text-[8px] font-bold leading-none ${chosen === 'flight' ? 'text-gray-900' : 'text-gray-500'}`}>Air{chosen === 'flight' ? ' ✓' : ''}</span>
                      </button>
                      <button
                        onClick={() => setItemShippingMethod(item.cart_key, 'sea_freight')}
                        aria-pressed={chosen === 'sea_freight'}
                        className={`flex flex-col items-center justify-center gap-0.5 w-10 h-10 rounded-lg border-2 transition-colors ${chosen === 'sea_freight' ? 'border-gray-900 bg-gray-100 ring-1 ring-gray-900' : 'border-gray-100 bg-white'}`}
                      >
                        <Ship className="w-3 h-3 text-gray-700" />
                        <span className={`text-[8px] font-bold leading-none ${chosen === 'sea_freight' ? 'text-gray-900' : 'text-gray-500'}`}>Sea{chosen === 'sea_freight' ? ' ✓' : ''}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {seaOnlyItems.length > 0 && (
                <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
                  <Ship className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-px" />
                  <span>{seaOnlyItems.map(i => i.name).join(', ')} {seaOnlyItems.length > 1 ? 'ship' : 'ships'} by sea only.</span>
                </p>
              )}
            </div>
          )}
        </div>

        {deliveryEstimateText.length > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-3.5 py-3 mb-4">
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1.5">
              Expected delivery
            </p>
            <p className="text-[11px] text-orange-800 leading-relaxed mb-2">
              Estimated from the date your payment is confirmed. Includes the 3-day processing period.
            </p>
            <div className="space-y-1">
              {deliveryEstimateText.map(({ method, window }) => (
                <div key={method} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-gray-700">
                    {method === 'sea_freight' ? 'Sea freight' : 'Flight'}
                  </span>
                  <span className="font-bold text-gray-900 text-right">{window}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delivery address / pickup station — only required when shipping directly to the customer */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Delivery</p>

            {/* Home address vs Jumia pickup station */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setDeliveryMode('home')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${deliveryMode === 'home' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                <Home className="w-4 h-4 text-gray-700 flex-shrink-0" />
                <p className="font-semibold text-gray-900 text-xs">Home address</p>
              </button>
              <button onClick={() => setDeliveryMode('pickup_station')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${deliveryMode === 'pickup_station' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                <Store className="w-4 h-4 text-gray-700 flex-shrink-0" />
                <p className="font-semibold text-gray-900 text-xs">Jumia pickup station</p>
              </button>
            </div>

            {deliveryMode === 'pickup_station' && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 mb-3">
                <Zap className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-orange-700 leading-relaxed">
                  Jumia pickup stations keep costs down and get your order to a collection point near you faster than a door delivery.
                </p>
              </div>
            )}

            {deliveryMode === 'home' ? (
              <div className="space-y-2">
                {/* Address book */}
                {addressesLoaded && savedAddresses.length > 0 && (
                  <div className="space-y-1.5 mb-1">
                    {savedAddresses.map(a => (
                      <button key={a.id} onClick={() => setSelectedAddressId(a.id)}
                        className={`w-full text-left p-2.5 rounded-xl border-2 transition-colors ${selectedAddressId === a.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <p className="text-xs font-bold text-gray-900">{a.label || 'Address'}</p>
                          {a.is_default && <span className="text-[9px] font-bold uppercase text-orange-500">Default</span>}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{a.address_line1}, {a.city}, {a.state}</p>
                      </button>
                    ))}
                    <button onClick={() => setSelectedAddressId('new')}
                      className={`w-full text-left p-2.5 rounded-xl border-2 border-dashed transition-colors ${selectedAddressId === 'new' ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                      <p className="text-xs font-bold text-gray-600">+ Add a new address</p>
                    </button>
                  </div>
                )}

                {(selectedAddressId === 'new' || savedAddresses.length === 0) && (
                  <>
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

                    <label className="flex items-center gap-2 px-1 py-1">
                      <input type="checkbox" checked={saveThisAddress} onChange={e => setSaveThisAddress(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300" />
                      <span className="text-[11px] text-gray-500">Save this address for next time</span>
                    </label>
                    {saveThisAddress && (
                      <input type="text" placeholder='Label (e.g. "House", "Workplace")' value={newAddressLabel}
                        onChange={e => setNewAddressLabel(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
                    )}

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
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Full name" value={address.name}
                    onChange={e => setAddressField('name', e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
                  <input type="tel" placeholder="Phone number" value={address.phone}
                    onChange={e => setAddressField('phone', e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
                </div>
                <input type="text" placeholder="Your city (helps us find nearby stations)" value={address.city}
                  onChange={e => setAddressField('city', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />

                {selectedStation && !showStationPicker ? (
                  <button onClick={() => setShowStationPicker(true)}
                    className="w-full text-left p-3 rounded-xl border-2 border-gray-900 bg-gray-50 flex items-center gap-2.5">
                    <Store className="w-4 h-4 text-gray-700 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{selectedStation.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{selectedStation.address}</p>
                    </div>
                    <Pencil className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  </button>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                      <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <input type="text" placeholder="Search stations by name or area…" value={stationSearch}
                        onChange={e => setStationSearch(e.target.value)}
                        className="flex-1 min-w-0 text-sm outline-none" />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {stationsLoading ? (
                        <div className="flex items-center justify-center py-6"><Loader className="w-4 h-4 animate-spin text-gray-400" /></div>
                      ) : matchingStations.length === 0 ? (
                        <p className="text-[11px] text-gray-400 text-center py-6 px-4">
                          {address.city.trim() || stationSearch.trim() ? 'No stations match yet — try a different city or search term.' : 'Type your city above, or search here, to see nearby stations.'}
                        </p>
                      ) : (
                        matchingStations.map(s => (
                          <button key={s.id}
                            onClick={() => { setSelectedStationId(s.id); setShowStationPicker(false); }}
                            className="w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{s.address} · {s.state}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
                  {paystackAllowed ? 'Instant confirmation via Paystack' : `For orders under ${fmt(shippingSettings.paystackManualThresholdNgn)} only`}
                </p>
              </div>
            </button>
            <button
              onClick={() => {
                if (!manualTransferEnabled) return;
                if (!manualAllowed) {
                  setError(`Manual bank transfer isn't available for orders under ${fmt(shippingSettings.paystackManualThresholdNgn)}. Please pay with card instead.`);
                  return;
                }
                setPaymentMethod('manual');
              }}
              className={`w-full flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-colors ${
                !manualTransferEnabled || !manualAllowed
                  ? 'border-gray-100 opacity-50'
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
          {shippingSettings.chargeShippingAtCheckout && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Shipping{discountActive && effectiveDiscountPercent > 0 ? ` (${effectiveDiscountPercent}% off)` : ''}</span>              
              <span className="font-medium">{fmt(shippingTotal)}</span>
            </div>
          )}
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
