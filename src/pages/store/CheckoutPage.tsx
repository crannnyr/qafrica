import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, User,
  CreditCard, Check, AlertCircle, Lock, Truck, Home,
  Building2, ChevronRight, Tag, Loader2, MessageCircle, Send, X,
  Package, RefreshCw, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storeService, deliveryZoneService, authService, supabase, messageService } from '@/services/supabase';
import { loadPaystackScript, initializePayment, generateReference } from '@/services/paystack';
import { toast } from 'sonner';
import { getThemeById } from '@/lib/themes';
import { useCartStore } from '@/stores/cartStore';
import { useCustomerAuthStore } from '@/stores';
import CONFIG from '@/lib/config';
import type { Store, DeliveryZone } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  storeId: string;
  storeName: string;
  variantOptions?: any;
}

interface ValidatedCartItem extends CartItem {
  dbPrice: number;
  dropshipPrice: number;
  originalOwnerId: string | null;
  originalStoreId: string | null;
  weight_kg: number | null;
  hs_code: string | null;
  product_type: 'parcel' | 'document';
}

interface ShipbubbleCourier {
  courier_id: string | number;
  courier_name: string;
  courier_image?: string;
  service_code: string;
  total: number;
  rate_card_amount: number;
  currency: string;
  delivery_eta: string;
  pickup_eta: string;
  is_cod_available: boolean;
  cod_fee?: number;
  service_type: 'pickup' | 'dropoff';
  tracking: { bars: number; label: string };
}

interface ShipbubbleSelection {
  request_token: string;
  receiver_address_code: number;
  courier_id: string | number;
  service_code: string;
  courier_name: string;
  courier: ShipbubbleCourier;
}

// ── DirectTransferFlow Component ──────────────────────────────────────────────

function DirectTransferFlow({
  store,
  total,
  cartItems,
  deliveryFee,
  discountAmount,
  isProcessing,
  onOrderCreated,
  createOrderViaEdgeFunction,
  clearCart
}: {
  store: Store | null;
  total: number;
  cartItems: any[];
  deliveryFee: number;
  discountAmount: number;
  isProcessing: boolean;
  onOrderCreated: () => void;
  createOrderViaEdgeFunction: (ref: string, isCod?: boolean) => Promise<any>;
  clearCart: () => void;
}) {
  const [step, setStep] = useState<'fetching' | 'account' | 'awaiting'>('fetching');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStep('account'), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handlePaid = async () => {
    setProcessing(true);
    try {
      const ref = `DT_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await createOrderViaEdgeFunction(ref);
      clearCart();
      setStep('awaiting');
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setProcessing(false);
    }
  };

  const whatsappMsg = encodeURIComponent(
    `Hi, I just placed an order of ₦${total.toLocaleString()} at ${store?.name}. Please find my payment receipt attached.`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`;

  if (step === 'fetching') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-gray-600 text-sm">Fetching account details…</p>
      </div>
    );
  }

  if (step === 'awaiting') {
    return (
      <div className="text-center space-y-5 py-6">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">Awaiting Confirmation</p>
          <p className="text-sm text-gray-500 mt-1">The seller will confirm your payment and process your order.</p>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium text-sm"
        >
          <MessageCircle className="w-4 h-4" />
          Share Receipt for Faster Confirmation
        </a>
        <button onClick={onOrderCreated} className="block w-full py-3 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Transfer ₦{total.toLocaleString()} to:</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Bank</span>
            <span className="font-medium text-gray-900">{(store as any)?.direct_bank_name}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-gray-500">Account Number</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-gray-900 text-base tracking-wider">
                {(store as any)?.direct_account_number}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText((store as any)?.direct_account_number || '');
                  toast.success('Copied!');
                }}
                className="text-xs text-orange-500 underline"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Account Name</span>
            <span className="font-medium text-gray-900">{(store as any)?.direct_account_name}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-gray-500">Amount</span>
            <span className="font-bold text-orange-600 text-base">₦{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 text-center">After transferring, click the button below to notify the seller.</p>
      <Button
        onClick={handlePaid}
        disabled={processing}
        className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-medium"
      >
        {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "I've Paid — Notify Seller"}
      </Button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [cartItems, setCartItems] = useState<ValidatedCartItem[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Delivery mode — read from store once loaded
  const [deliveryMode, setDeliveryMode] = useState<'manual' | 'shipbubble'>('manual');

  // Shipbubble rate state
  const [shipbubbleCouriers, setShipbubbleCouriers] = useState<ShipbubbleCourier[]>([]);
  const [shipbubbleSelection, setShipbubbleSelection] = useState<ShipbubbleSelection | null>(null);
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<'paystack' | 'cod'>('paystack');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);

  // Checkout steps
  const [currentStep, setCurrentStep] = useState<'shipping' | 'payment' | 'confirm'>('shipping');

  // Message seller
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Shipping
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'paystack'>('paystack');
  const [storePaymentMethod, setStorePaymentMethod] = useState<'paystack' | 'direct_transfer'>('paystack');
  const [showDirectWarning, setShowDirectWarning] = useState(false);

  // Address code state
  const [shipbubbleAddressCode, setShipbubbleAddressCode] = useState<number | null>(null);

  const { getStoreCart, clearStoreCart, validateCoupon } = useCartStore();
  const { customer, getDefaultAddress, fetchAddresses } = useCustomerAuthStore();
  const theme = store?.theme ? getThemeById(store.theme) : getThemeById('modern');
  const PLATFORM_DELIVERY_MARKUP = 500;

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadData();
    };
  
    init();
  }, [slug]);

  const defaultAddress = getDefaultAddress();

  useEffect(() => {
    if (defaultAddress) {
      setSelectedAddress(defaultAddress);
    }
  }, [defaultAddress]);

  useEffect(() => {
    if (
      deliveryMode === 'shipbubble' &&
      selectedAddress
    ) {
      fetchShipbubbleRates();
    }
  }, [selectedAddress, cartItems]);

  const checkAuth = async () => {
    const { session } = await authService.getSession();
  
    if (!session?.user) {
      toast.error('Please login to continue checkout');
  
      navigate(`/customer/login?return=/${slug}/checkout`);
      return;
    }
  
    await fetchAddresses();
  
    setCurrentStep('shipping');
  };

  const loadData = async () => {
    if (!slug) return;

    const storeCart = getStoreCart(slug);
    const rawCart: CartItem[] = storeCart?.items || [];

    if (rawCart.length === 0) {
      toast.error('Your cart is empty');
      navigate(`/${slug}`);
      return;
    }

    const productIds = rawCart.map(item => item.productId);

    const { data: storeData } = await storeService.getStoreBySlug(slug);
    let importedProducts: any[] = [];

    if (storeData) {
      setStore(storeData as Store);
      const mode = ((storeData as any).delivery_mode ?? 'manual') as 'manual' | 'shipbubble';
      setDeliveryMode(mode);

      if (mode === 'manual') {
        const { data: zonesData } = await deliveryZoneService.getStoreZones(storeData.id);
        if (zonesData) setDeliveryZones(zonesData as DeliveryZone[]);
      }
      // Shipbubble mode: no zones needed — rates fetched live

      // Fetch import catalog — include selling_price and custom_selling_price
      const { data: imports } = await supabase
        .from('import_catalog')
        .select('original_product_id, original_owner_id, original_store_id, dropship_price, selling_price, custom_selling_price')
        .eq('importer_store_id', storeData.id)
        .in('original_product_id', productIds);

      if (imports && imports.length > 0) {
        importedProducts = imports;

        // For manual mode: use original seller's delivery zones if single-origin cart
        if (mode === 'manual') {
          const originalStoreIds = [
            ...new Set(imports.map((i: any) => i.original_store_id).filter(Boolean))
          ];
          if (originalStoreIds.length === 1) {
            const { data: originalZones } = await deliveryZoneService.getStoreZones(originalStoreIds[0] as string);
            if (originalZones && originalZones.length > 0) {
              setDeliveryZones(originalZones as DeliveryZone[]);
            }
          }
        }
      }

      // Resolve effective payment method — bypass direct transfer if cart has dropshipped items
      const hasDropshipped = rawCart.some(item =>
        importedProducts.find((ip: any) => ip.original_product_id === item.productId)
      );
      const pm = (storeData as any).payment_method || 'paystack';
      setStorePaymentMethod(hasDropshipped ? 'paystack' : pm);
      if (hasDropshipped && pm === 'direct_transfer') {
        toast.info('Some items in your cart are from partner sellers — card payment is required.', { duration: 5000 });
      }
    }

    // Fetch DB prices + shipping fields per product
    const { data: dbProducts } = await supabase
      .from('products')
      .select('id, selling_price, weight_kg, hs_code, product_type')
      .in('id', productIds);

    if (dbProducts) {
      const validatedItems: ValidatedCartItem[] = rawCart.map(cartItem => {
        const dbProduct = dbProducts.find(p => p.id === cartItem.productId);
        const importRecord = importedProducts.find(
          (ip: any) => ip.original_product_id === cartItem.productId
        );

        const resolvedPrice = importRecord?.custom_selling_price
          ?? importRecord?.selling_price
          ?? cartItem.price
          ?? dbProduct?.selling_price
          ?? 0;

        return {
          ...cartItem,
          dbPrice:         resolvedPrice,
          dropshipPrice:   importRecord?.dropship_price   || 0,
          originalOwnerId: importRecord?.original_owner_id || null,
          originalStoreId: importRecord?.original_store_id || null,
          weight_kg:       dbProduct?.weight_kg           ?? null,
          hs_code:         dbProduct?.hs_code             ?? null,
          product_type:    dbProduct?.product_type        ?? 'parcel',
        };
      });
      setCartItems(validatedItems);
    } else {
      setCartItems(rawCart.map(item => ({
        ...item,
        dbPrice: item.price,
        dropshipPrice: 0,
        originalOwnerId: null,
        originalStoreId: null,
        weight_kg: null,
        hs_code: null,
        product_type: 'parcel' as const,
      })));
    }

    setIsLoading(false);
  };

  // ── Validate and save address to Ship Bubble ────────────────────────────────
  const getReceiverAddressCode = (): number | null => {
    if (!selectedAddress?.shipbubble_address_code) {
      toast.error('Selected address is not validated');
      return null;
    }
  
    return Number(selectedAddress.shipbubble_address_code);
  };

  const groupedByStore = cartItems.reduce((acc: any, item) => {
    const ownerStoreId =
      item.originalStoreId ||
      item.storeId;
  
    if (!acc[ownerStoreId]) {
      acc[ownerStoreId] = [];
    }
  
    acc[ownerStoreId].push(item);
  
    return acc;
  }, {});

  // ── Shipbubble: fetch live carrier rates ─────────────────────────────────
  const fetchShipbubbleRates = async () => {
    if (!selectedAddress) return;
  
    const receiverAddressCode = getReceiverAddressCode();
  
    if (!receiverAddressCode) return;
  
    setIsFetchingRates(true);
    setRatesError(null);
  
    try {
      const groupedByStore = cartItems.reduce((acc: any, item) => {
        const ownerStoreId = item.originalStoreId || item.storeId;
  
        if (!acc[ownerStoreId]) {
          acc[ownerStoreId] = [];
        }
  
        acc[ownerStoreId].push(item);
  
        return acc;
      }, {});
  
      const allCouriers: ShipbubbleCourier[] = [];
  
      for (const storeId of Object.keys(groupedByStore)) {
        const items = groupedByStore[storeId];
  
        const body = {
          store_id: storeId,
        
          delivery_address: {
            address: selectedAddress.address_line1,
            city: selectedAddress.city,
            state: selectedAddress?.state,
            phone:
              selectedAddress.phone ||
              customer?.phone ||
              '',
          },
        
          cart_items: items.map((item: any) => ({
            name: item.name,
            product_name: item.name,
            weight_kg: Number(item.weight_kg || 0.5),
            quantity: Number(item.quantity || 1),
            price: Number(item.dbPrice || 0),
          })),
        
          receiver_address_code: receiverAddressCode,
        
          pickup_date: new Date()
            .toISOString()
            .split('T')[0],
        };
  
        console.log('ShipBubble Request:', body);
  
        const { data, error } = await supabase.functions.invoke(
          'shipbubble-get-rates',
          { body }
        );
  
        if (error || data?.error) {
          console.error(error || data?.error);
          continue;
        }
  
        if (data?.couriers?.length) {
          const mapped = data.couriers.map((c: any) => ({
            ...c,
            request_token: data.request_token,
          }));
        
          allCouriers.push(...mapped);
        }
      }
  
      if (!allCouriers.length) {
        setRatesError('No delivery options available');
        return;
      }
  
      setShipbubbleCouriers(allCouriers);
  
      const cheapest = allCouriers.reduce((a, b) =>
        a.rate_card_amount < b.rate_card_amount ? a : b
      );
  
      setShipbubbleSelection({
        request_token: cheapest.request_token,
        receiver_address_code: receiverAddressCode,
        courier_id: cheapest.courier_id,
        service_code: cheapest.service_code,
        courier_name: cheapest.courier_name,
        courier: cheapest,
      });
  
    } catch (err: any) {
      console.error(err);
      setRatesError(err.message);
    } finally {
      setIsFetchingRates(false);
    }
  };

  // ── Delivery fee resolution ───────────────────────────────────────────────
  const getDeliveryFee = (): number | null => {
    if (deliveryMode === 'shipbubble') {
      return shipbubbleSelection?.courier.rate_card_amount ?? null;
    }
    if (!selectedAddress?.state) return null;
    const zone = deliveryZones.find(
      z => z.state.toLowerCase() === selectedAddress?.state.toLowerCase() && z.is_active
    );
    return zone ? zone.price + PLATFORM_DELIVERY_MARKUP : null;
  };

  const canDeliverToState = (): boolean => {
    if (deliveryMode === 'shipbubble') return true;
    if (!selectedAddress?.state) return true;
    return !!deliveryZones.find(
      z => z.state.toLowerCase() === selectedAddress?.state.toLowerCase() && z.is_active
    );
  };

  const canProceedToPayment = (): boolean => {
    if (deliveryMode === 'shipbubble') {
      return !!shipbubbleSelection;
    }
    return canDeliverToState();
  };

  const codAvailable = deliveryMode === 'shipbubble' && (shipbubbleSelection?.courier.is_cod_available === true);

  const activeDeliveryStates = deliveryZones.filter(z => z.is_active).map(z => z.state).sort();

  const deliveryFee   = getDeliveryFee() ?? 0;
  const subtotal      = cartItems.reduce((sum, item) => sum + item.dbPrice * item.quantity, 0);
  const discountAmount = appliedCoupon?.discount ?? 0;

  const codFee = paymentChoice === 'cod' && shipbubbleSelection?.courier.cod_fee 
  ? shipbubbleSelection.courier.cod_fee 
  : 0;
  
  const total = Math.max(   0,   subtotal +   deliveryFee +   PLATFORM_DELIVERY_MARKUP +   codFee -   discountAmount );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!messageText.trim()) { toast.error('Please enter a message'); return; }
    if (!store || !customer) { toast.error('You need to be logged in to message the seller'); return; }
    setIsSendingMessage(true);
    try {
      const { error } = await messageService.sendMessage({
        store_id:       store.id,
        customer_id:    customer.id,
        customer_name:  customer.full_name,
        customer_email: customer.email,
        message:        messageText.trim(),
        context:        `Delivery inquiry: ${selectedAddress?.state || 'unspecified state'}`,
      });
      if (error) throw error;
      toast.success('Message sent! The seller will get back to you.');
      setMessageText('');
      setShowMessageForm(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) { toast.error('Please enter a coupon code'); return; }
    if (!store?.id) { toast.error('Store information not loaded'); return; }
    setIsApplyingCoupon(true);
    try {
      const result = await validateCoupon(couponCode.trim().toUpperCase(), store.id, subtotal);
      if (result.valid) {
        setCouponDiscount(result.discountAmount);
        setAppliedCoupon({ code: couponCode.trim().toUpperCase(), discount: result.discountAmount });
        toast.success(`Coupon applied! You saved ₦${result.discountAmount.toLocaleString()}`);
      } else {
        toast.error(result.message || 'Invalid coupon code');
        setCouponDiscount(0);
        setAppliedCoupon(null);
      }
    } catch { toast.error('Failed to apply coupon'); }
    finally { setIsApplyingCoupon(false); }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponDiscount(0);
    setAppliedCoupon(null);
    toast.info('Coupon removed');
  };

  // const handleBuyerSignup = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setIsLoggedIn(true);
  //   setCurrentStep('shipping');
  //   toast.success('Welcome! Please enter your shipping details.');
  // };

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!selectedAddress) {
      toast.error('Please add a delivery address');
      return;
    }
  
    if (deliveryMode === 'shipbubble' && !shipbubbleSelection) {
      toast.error('Please select a delivery option');
      return;
    }
  
    setCurrentStep('payment');
  };

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Order creation ────────────────────────────────────────────────────────
  const createOrderViaEdgeFunction = async (paymentReference: string, isCod = false) => {
    if (!store) return;

    const { data, error } = await supabase.functions.invoke('create-order', {
      body: {
        payment_reference:    paymentReference,
        payment_method:       storePaymentMethod === 'direct_transfer' ? 'direct_transfer' : isCod ? 'cod' : 'paystack',
        amount_paid:          total,
    
        customer_id:          customer?.id || null,
        customer_name: selectedAddress?.name || customer?.full_name || 'Customer',
        customer_email: customer?.email || '',
        customer_phone: selectedAddress?.phone || customer?.phone || '',
    
        delivery_address: selectedAddress?.address_line1,
        delivery_city: selectedAddress?.city,
        delivery_state: selectedAddress?.state,
        delivery_instructions: deliveryInstructions,
        shipbubble_address_code: deliveryMode === 'shipbubble' ? getReceiverAddressCode() : null,
    
        store_orders: [
          {
            store_id:        store.id,
            subtotal,
            delivery_fee:    deliveryFee,
            coupon_discount: discountAmount,
            items: cartItems.map(item => ({
              productId:          item.productId,
              name:               item.name,
              quantity:           item.quantity,
              unitPrice:          item.dbPrice,
              variantOptions:     item.variantOptions   || null,
              is_imported:        !!item.originalOwnerId,
              original_owner_id:  item.originalOwnerId  || null,
              original_store_id:  item.originalStoreId  || null,
              dropship_price:     item.dropshipPrice     || 0,
            })),
            shipbubble_selection: deliveryMode === 'shipbubble' ? {
              request_token: shipbubbleSelection?.request_token,
              receiver_address_code: getReceiverAddressCode() || 0,
              courier_id: shipbubbleSelection?.courier_id,
              service_code: shipbubbleSelection?.service_code,
              courier_name: shipbubbleSelection?.courier_name,
              courier: shipbubbleSelection?.courier,
            } : undefined,
        
          },
        ],
      },
    });

    if (error) {
      console.error('create-order edge function error:', error);
      throw new Error(error.message || 'Order creation failed');
    }
    if (data?.error) throw new Error(data.error);

    return data;
  };

  const handleCodOrder = async () => {
    setIsProcessing(true);
    try {
      const ref = generateReference('COD');
      await createOrderViaEdgeFunction(ref, true);
      if (slug) clearStoreCart(slug);
      setCurrentStep('confirm');
      toast.success('Order placed! Pay the courier on delivery.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    try {
      setIsProcessing(true);
      await loadPaystackScript();

      const reference     = generateReference('ORD');
      const amountInKobo  = total * 100;

      initializePayment({
        email:     customer?.email,
        amount:    amountInKobo,
        reference,
        metadata: {
          store_id:        store?.id,
          store_name:      store?.name,
          customer_name:   customer?.full_name,
          customer_phone:  customer?.phone,
          coupon_code:     appliedCoupon?.code,
          discount_amount: discountAmount,
          items: cartItems.map(item => ({
            product_id: item.productId,
            name:       item.name,
            quantity:   item.quantity,
            price:      item.dbPrice,
          })),
        },
        onSuccess: async (response) => {
          toast.success('Payment successful! Confirming your order...');
          try {
            await createOrderViaEdgeFunction(response.reference);
            if (slug) clearStoreCart(slug);
            setCurrentStep('confirm');
          } catch (err: any) {
            toast.error(
              'Payment received but order confirmation failed. Please contact support with reference: ' +
              response.reference
            );
          } finally {
            setIsProcessing(false);
          }
        },
        onCancel: () => {
          setIsProcessing(false);
          toast.info(
            'Payment window closed. If you completed payment, your order will confirm shortly — please refresh.',
            { duration: 6000 }
          );
        },
      });
    } catch {
      setIsProcessing(false);
      toast.error('Payment initialization failed. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Delivery summary text for sidebar ─────────────────────────────────────
  const deliveryDisplay = () => {
    if (deliveryMode === 'shipbubble') {
      if (!selectedAddress?.state) return <span className="text-gray-400 text-sm italic">Enter city &amp; state</span>;
      if (isFetchingRates)     return <span className="text-gray-400 text-sm italic">Fetching rates…</span>;
      if (!shipbubbleSelection) return <span className="text-gray-400 text-sm italic">Select a carrier</span>;
      return `₦${shipbubbleSelection.courier.rate_card_amount.toLocaleString()}`;
    }
    if (!selectedAddress?.state) return <span className="text-gray-400 text-sm italic">Select state</span>;
    if (!canDeliverToState()) return <span className="text-red-500 text-sm">Not available</span>;
    return `₦${(getDeliveryFee() ?? 0).toLocaleString()}`;
  };

  const totalDisplay = () => {
    if (deliveryMode === 'shipbubble' && !shipbubbleSelection) return `₦${subtotal.toLocaleString()}`;
    if (deliveryMode === 'manual' && (!selectedAddress?.state || !canDeliverToState())) return `₦${subtotal.toLocaleString()}`;
    return `₦${total.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to={`/${slug}`}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Continue Shopping</span>
            </Link>

            <div className="flex items-center gap-2">
              {(['shipping', 'payment'] as const).map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step ? 'bg-orange-500 text-white' :
                    (
                      (step === 'shipping' && ['payment', 'confirm'].includes(currentStep)) ||
                      (step === 'payment' && currentStep === 'confirm')
                    ) ? 'bg-green-500 text-white' :
                    'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}>
                    {(
                      (step === 'auth'     && ['shipping','payment','confirm'].includes(currentStep)) ||
                      (step === 'shipping' && ['payment','confirm'].includes(currentStep)) ||
                      (step === 'payment'  && currentStep === 'confirm')
                    ) ? <Check className="w-4 h-4" /> : step === 'shipping' ? 1 : 2}
                  </div>
                </div>
              ))}
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'confirm' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}>
                {currentStep === 'confirm' ? <Check className="w-4 h-4" /> : '3'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Shipping Step ── */}
        {currentStep === 'shipping' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Shipping Address
                </h2>

                <div className="space-y-4">
  {selectedAddress ? (
    <>
      {/* SHIPPING ADDRESS CARD */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="font-semibold text-gray-900 dark:text-white">
              {selectedAddress.name || customer?.full_name}
            </p>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedAddress.address_line1}
            </p>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedAddress.city}, {selectedAddress?.state}
            </p>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedAddress.phone || customer?.phone}
            </p>
          </div>

          <Link
            to="/customer/dashboard/"
            className="text-sm text-orange-500 hover:underline"
          >
            Change
          </Link>
        </div>
      </div>

      {/* SHIPBUBBLE COURIERS */}
      {deliveryMode === 'shipbubble' && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-5 bg-white dark:bg-gray-800">
          
          {/* LABEL */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Select Courier
            </h3>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Choose your preferred delivery option
            </p>
          </div>

          {isFetchingRates ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching delivery rates...
            </div>
          ) : ratesError ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <p className="text-sm text-red-500">
                {ratesError}
              </p>
            </div>
          ) : shipbubbleCouriers.length > 0 ? (
            <div className="space-y-3">
              {shipbubbleCouriers.map((courier, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    setShipbubbleSelection({
                      request_token: shipbubbleSelection?.request_token || (courier as any).request_token,
                      receiver_address_code: getReceiverAddressCode()!,
                      courier_id: courier.courier_id,
                      service_code: courier.service_code,
                      courier_name: courier.courier_name,
                      courier,
                    })
                  }
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    shipbubbleSelection?.courier?.service_code === courier.service_code
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      
                      {/* Optional courier logo */}
                      {courier.courier_image ? (
                        <img
                          src={courier.courier_image}
                          alt={courier.courier_name}
                          className="w-10 h-10 rounded-lg object-cover border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <Truck className="w-5 h-5 text-gray-500" />
                        </div>
                      )}

                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {courier.courier_name}
                        </p>

                        <p className="text-xs text-gray-500">
                          {courier.delivery_eta}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">
                        ₦{Number(courier.rate_card_amount).toLocaleString()}
                      </p>

                      {shipbubbleSelection?.courier?.service_code === courier.service_code && (
                        <p className="text-xs text-orange-500 mt-1">
                          Selected
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No courier options available
            </div>
          )}
        </div>
      )}

      {/* CONTINUE BUTTON */}
      <Button
        onClick={() => setCurrentStep('payment')}
        disabled={
          !selectedAddress ||
          (deliveryMode === 'shipbubble' && !shipbubbleSelection)
        }
        className="w-full mt-2"
      >
        Continue to Payment
      </Button>
    </>
  ) : (
    <div className="border border-dashed rounded-2xl p-8 text-center">
      <MapPin className="w-10 h-10 mx-auto text-gray-400 mb-3" />

      <p className="font-medium text-gray-900 dark:text-white">
        No delivery address found
      </p>

      <p className="text-sm text-gray-500 mt-1">
        Add your address to continue checkout
      </p>

      <Link to="/customer/dashboard/">
        <Button className="mt-4">
          Add Address
        </Button>
      </Link>
    </div>
  )}
</div>
              </div>
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 sticky top-24">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Order Summary</h3>

                <div className="space-y-4 mb-6">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <span className="text-xl text-gray-400">{item.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{item.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Qty: {item.quantity}</p>
                        <p className="text-sm font-medium">₦{(item.dbPrice * item.quantity).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                <div className="border-t dark:border-gray-700 pt-4 mb-4">
                  {!appliedCoupon ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Tag className="w-4 h-4" />Coupon Code
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={e => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Enter code"
                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                        />
                        <Button onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode.trim()} variant="outline" className="px-4">
                          {isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-300">{appliedCoupon.code}</span>
                        </div>
                        <button onClick={handleRemoveCoupon} className="text-xs text-red-600 hover:text-red-700 underline">Remove</button>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">-₦{appliedCoupon.discount.toLocaleString()} saved</p>
                    </div>
                  )}
                </div>

                <div className="border-t dark:border-gray-700 pt-4 space-y-2">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Delivery</span>
                    <span>{deliveryDisplay()}</span>
                  </div>
                  {/* COD FEE DISPLAY */}
                  {codFee > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>COD Fee</span>
                      <span>₦{codFee.toLocaleString()}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Discount</span><span>-₦{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-700">
                    <span>Total</span>
                    <span>{totalDisplay()}</span>
                  </div>
                  {deliveryMode === 'shipbubble' && shipbubbleSelection && (
                    <p className="text-xs text-gray-400 text-right">
                      via {shipbubbleSelection.courier.courier_name} · {shipbubbleSelection.courier.delivery_eta}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Payment Step ── */}
        {currentStep === 'payment' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />Payment Method
              </h2>

              {/* Payment options — branches by store payment method */}
              <div className="space-y-4 mb-8">
                {storePaymentMethod === 'direct_transfer' && !showDirectWarning ? (
                  // Direct transfer warning gate
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900 mb-1">This seller accepts bank transfer only</p>
                        <p className="text-sm text-amber-700">
                          You will be shown the seller's bank account details and asked to transfer the amount manually.
                          Please note: initiating a false transfer claim can result in a permanent account ban.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 font-medium text-center">Do you want to proceed with bank transfer?</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCurrentStep('shipping')}
                        className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
                      >
                        Go Back
                      </button>
                      <Button
                        onClick={() => setShowDirectWarning(true)}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        Yes, Proceed
                      </Button>
                    </div>
                  </div>
                ) : storePaymentMethod === 'direct_transfer' && showDirectWarning ? (
                  // Direct transfer account display flow
                  <DirectTransferFlow
                    store={store}
                    total={total}
                    cartItems={cartItems}
                    deliveryFee={deliveryFee}
                    discountAmount={discountAmount}
                    isProcessing={isProcessing}
                    onOrderCreated={() => setCurrentStep('confirm')}
                    createOrderViaEdgeFunction={createOrderViaEdgeFunction}
                    clearCart={() => { if (slug) clearStoreCart(slug); }}
                  />
                ) : (
                  // Paystack + optional COD
                  <div className="space-y-4">
                    <button onClick={() => setPaymentChoice('paystack')}
                      className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-colors ${
                        paymentChoice === 'paystack' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}>
                      <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900 dark:text-white">Pay with Card</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Secure payment via Paystack</p>
                      </div>
                      {paymentChoice === 'paystack' && <Check className="w-6 h-6 text-orange-500" />}
                    </button>

                    {codAvailable && (
                      <button onClick={() => setPaymentChoice('cod')}
                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-colors ${
                          paymentChoice === 'cod' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}>
                        <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                          <Truck className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900 dark:text-white">Cash on Delivery</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Pay when your package arrives
                            {shipbubbleSelection?.courier.cod_fee ? ` (+₦${shipbubbleSelection.courier.cod_fee.toLocaleString()} COD fee)` : ''}
                          </p>
                        </div>
                        {paymentChoice === 'cod' && <Check className="w-6 h-6 text-orange-500" />}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Selected carrier info (Shipbubble mode) */}
              {deliveryMode === 'shipbubble' && shipbubbleSelection && storePaymentMethod !== 'direct_transfer' && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
                  <Truck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {shipbubbleSelection.courier.courier_name} · {shipbubbleSelection.courier.delivery_eta}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Delivery: ₦{shipbubbleSelection.courier.rate_card_amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Order Total</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal ({cartItems.reduce((a, b) => a + b.quantity, 0)} items)</span>
                    <span>₦{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Delivery</span>
                    <span>{deliveryFee > 0 ? `₦${deliveryFee.toLocaleString()}` : 'Free'}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Platform Fee</span>
                    <span>₦{PLATFORM_DELIVERY_MARKUP.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span>-₦{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-600">
                    <span>Total</span><span>₦{total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Security note + Pay button — only for Paystack */}
              {storePaymentMethod === 'paystack' && (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
                    <Lock className="w-4 h-4" />
                    <span>Your payment information is secure and encrypted</span>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setCurrentStep('shipping')}
                      className="px-6 py-3 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Back
                    </button>
                    <Button
                      onClick={paymentChoice === 'cod' ? handleCodOrder : handlePayment}
                      disabled={isProcessing}
                      className="flex-1 h-14 text-lg font-medium"
                      style={{ backgroundColor: store?.primary_color || theme?.colors.primary }}
                    >
                      {isProcessing
                        ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : paymentChoice === 'cod'
                          ? <>Place COD Order<ArrowLeft className="w-5 h-5 ml-2 rotate-180" /></>
                          : <>Pay ₦{total.toLocaleString()}<ArrowLeft className="w-5 h-5 ml-2 rotate-180" /></>
                      }
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Confirmation Step ── */}
        {currentStep === 'confirm' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Order Confirmed!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Thank you for your order. A confirmation has been sent to {customer?.email}
              </p>

              {deliveryMode === 'shipbubble' && shipbubbleSelection && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">{shipbubbleSelection.courier.courier_name}</p>
                  <p className="text-xs mt-0.5 text-blue-600 dark:text-blue-400">
                    {shipbubbleSelection.courier.delivery_eta}
                  </p>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6 text-left space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Delivery</span><span>₦{deliveryFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Platform Fee</span>
                  <span>₦{PLATFORM_DELIVERY_MARKUP.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Discount</span><span>-₦{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-600">
                  <span>Total Paid</span><span>₦{total.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Link to={`/${slug}`}>
                  <Button className="w-full h-12" style={{ backgroundColor: store?.primary_color || theme?.colors.primary }}>
                    Continue Shopping
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="outline" className="w-full h-12">Back to QAFRICA</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}