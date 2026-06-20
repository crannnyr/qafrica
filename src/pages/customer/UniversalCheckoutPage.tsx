import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, MapPin, Store,
  CreditCard, Check, Truck, 
  ChevronRight, Loader2, MessageCircle, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deliveryZoneService, authService, supabase, messageService } from '@/services';
import { loadPaystackScript, initializePayment, generateReference } from '@/services/paystack';
import { toast } from 'sonner';
import { useCartStore } from '@/stores/cartStore';
import { useCustomerAuthStore } from '@/stores';
import type { DeliveryZone } from '@/types';
import { AlertCircle } from 'lucide-react'; 
import ShipBubbleRateSelector from '@/components/ShipBubbleRateSelector';

// Extended StoreCheckoutData interface
interface StoreCheckoutData {
  storeId: string;
  storeName: string;
  storeSlug: string;
  items: any[];
  subtotal: number;
  deliveryFee: number | null;
  canDeliver: boolean;
  zones: DeliveryZone[];
  paymentMethod: 'paystack' | 'direct_transfer';
  hasDropshippedItems: boolean;
  effectivePaymentMethod: 'paystack' | 'direct_transfer';
  storeInfo: any | null;
  deliveryMode?: string;
}

interface ShipbubbleSelection {
  request_token: string;
  courier_id: string | number;
  service_code: string;
  courier_name: string;
  receiver_address_code: number;
  courier: any;
}

export default function UniversalCheckoutPage() {
  const navigate = useNavigate();
  const {
    customer,
    addresses,
    isAuthenticated,
    getDefaultAddress,
    fetchAddresses
  } = useCustomerAuthStore();
  const { 
    getItemsByStore, 
    clearStoreCart,
    validateCoupon 
  } = useCartStore();

  const [shipBubbleData, setShipBubbleData] = useState<Record<string, {
    couriers: any[];
    selection: ShipbubbleSelection | null;
    loading: boolean;
    error: string | null;
  }>>({});

  const [storesData, setStoresData] = useState<Record<string, StoreCheckoutData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'shipping' | 'payment' | 'confirm'>('shipping');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'cod'>('paystack');

  // Coupon state per store
  const [storeCoupons, setStoreCoupons] = useState<Record<string, { code: string; discount: number }>>({});
  const [storeCouponInputs, setStoreCouponInputs] = useState<Record<string, string>>({});
  const [applyingCouponFor, setApplyingCouponFor] = useState<string | null>(null);

  // Messaging
  const [messageStoreId, setMessageStoreId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [deliveryInstructions, setDeliveryInstructions] = useState('');

  const defaultAddress = getDefaultAddress();
  const itemsByStore = getItemsByStore();

  const PLATFORM_DELIVERY_MARKUP = 500;

  const selectedAddress = defaultAddress;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (addresses.length > 0) {
      loadData();
    }
  }, [addresses.length]);

  const checkAuth = async () => {
    if (!isAuthenticated) {
      const { session } = await authService.getSession();
      if (!session?.user) {
        navigate(`/customer/login?return=/checkout`);
        return;
      }
    }
    if (customer) {
      await fetchAddresses();
    }
  };

  const loadData = async () => {
    if (Object.keys(itemsByStore).length === 0) {
      toast.error('Your cart is empty');
      navigate('/cart');
      return;
    }

    const storesMap: Record<string, StoreCheckoutData> = {};

    for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
      const storeName = storeItems[0]?.storeName || 'Unknown Store';
      const storeSlug = storeItems[0]?.storeSlug || '';
      const subtotal  = storeItems.reduce(
        (sum: number, item: any) => sum + item.unitPrice * item.quantity, 0
      );

      // Fetch store payment + domain settings
      const { data: storeInfo } = await supabase
        .from('stores')
        .select('payment_method, direct_bank_name, direct_account_number, direct_account_name, cod_enabled, delivery_mode')
        .eq('id', storeId)
        .single();

      // Fetch import catalog for ALL items in this store's cart
      const productIds = storeItems.map((i: any) => i.productId);
      const { data: importData } = await supabase
        .from('import_catalog')
        .select('original_product_id, original_store_id, original_owner_id, dropship_price, selling_price, custom_selling_price')
        .eq('importer_store_id', storeId)
        .in('original_product_id', productIds);

      const hasImportedItems = importData && importData.length > 0;

      // Enrich items with import metadata
      const enrichedItems = storeItems.map((item: any) => {
        const importRecord = importData?.find(
          (imp: any) => imp.original_product_id === item.productId
        );
        return {
          ...item,
          is_imported:       !!importRecord,
          original_owner_id: importRecord?.original_owner_id ?? null,
          original_store_id: importRecord?.original_store_id ?? null,
          dropship_price:    importRecord?.dropship_price ?? 0,
          unitPrice: importRecord?.custom_selling_price
            ?? importRecord?.selling_price
            ?? item.unitPrice,
        };
      });

      // Recalculate subtotal with corrected prices
      const correctedSubtotal = enrichedItems.reduce(
        (sum: number, item: any) => sum + item.unitPrice * item.quantity, 0
      );

      // ── Delivery zone resolution ─────────────────────────────────────────────
      let zones: DeliveryZone[] = [];

      if (hasImportedItems) {
        const originalStoreIds = [
          ...new Set(
            (importData ?? [])
              .map((i: any) => i.original_store_id)
              .filter(Boolean)
          ),
        ] as string[];

        if (originalStoreIds.length === 1) {
          const { data: origZones } = await deliveryZoneService.getStoreZones(originalStoreIds[0]);
          if (origZones && origZones.length > 0) {
            zones = origZones as DeliveryZone[];
          } else {
            const { data: fallbackZones } = await deliveryZoneService.getStoreZones(storeId);
            zones = (fallbackZones as DeliveryZone[]) || [];
          }
        } else {
          const { data: importerZones } = await deliveryZoneService.getStoreZones(storeId);
          zones = (importerZones as DeliveryZone[]) || [];
        }
      } else {
        const { data: ownZones } = await deliveryZoneService.getStoreZones(storeId);
        zones = (ownZones as DeliveryZone[]) || [];
      }

      const hasDropshipped      = enrichedItems.some((item: any) => item.is_imported);
      const rawPaymentMethod    = storeInfo?.payment_method || 'paystack';
      const effectivePaymentMethod = hasDropshipped ? 'paystack' : rawPaymentMethod;

      let canDeliver = false;
      let deliveryFee: number | null = null;

      if (storeInfo?.delivery_mode === 'shipbubble') {
        canDeliver = true;
        deliveryFee = 0;
      } else if (defaultAddress?.state) {
        const zone = zones.find(
          z =>
            z.state.toLowerCase() === defaultAddress.state.toLowerCase() &&
            z.is_active
        );

        canDeliver = !!zone;
        deliveryFee = zone
          ? zone.price + PLATFORM_DELIVERY_MARKUP
          : null;
      }

      storesMap[storeId] = {
        storeId,
        storeName,
        storeSlug,
        items:                enrichedItems,
        subtotal:             correctedSubtotal,
        deliveryFee,
        canDeliver,
        zones,
        paymentMethod:        rawPaymentMethod,
        hasDropshippedItems:  hasDropshipped,
        effectivePaymentMethod,
        storeInfo:            storeInfo || null,
        deliveryMode:         storeInfo?.delivery_mode || 'manual',
      };
    }

    setStoresData(storesMap);
    setIsLoading(false);
  };

  // Recompute delivery availability whenever the selected state changes
  useEffect(() => {
    if (!selectedAddress?.state) return;

    setStoresData(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(storeId => {
        const store = updated[storeId];
        const zone = store.zones.find(
          z => z.state.toLowerCase() === selectedAddress?.state.toLowerCase() && z.is_active
        );
        updated[storeId] = {
          ...store,
          canDeliver: !!zone,
          deliveryFee: zone ? zone.price + PLATFORM_DELIVERY_MARKUP : null,
        };
      });
      return updated;
    });
  }, [selectedAddress?.state]);

  const canProceedToPayment = () =>
    Object.values(storesData).every(store => {
      if (store.deliveryMode === 'shipbubble') {
        return !!shipBubbleData[store.storeId]?.selection?.courier;
      }

    return store.canDeliver;
  });

  const calculateStoreTotal = (storeId: string) => {
    const store = storesData[storeId];
    if (!store) return 0;
  
    const discount = storeCoupons[storeId]?.discount || 0;
    const courier = shipBubbleData[storeId]?.selection?.courier;
  
    const deliveryFee =
      store.deliveryMode === 'shipbubble'
        ? (courier?.rate_card_amount || 0)
        : (store.deliveryFee || 0);
  
    const codFee =
      paymentMethod === 'cod'
        ? (courier?.cod_fee || 0)
        : 0;
  
    return Math.max(
      0,
      store.subtotal +
      deliveryFee +
      PLATFORM_DELIVERY_MARKUP +
      codFee -
      discount
    );
  };

  const grandTotal = Object.keys(storesData).reduce(
    (sum, storeId) => sum + calculateStoreTotal(storeId), 0
  );

  // Split totals by payment method
  const paystackTotal = Object.keys(storesData)
    .filter(id => storesData[id].effectivePaymentMethod === 'paystack')
    .reduce((sum, id) => sum + calculateStoreTotal(id), 0);

  const directTransferTotal = Object.keys(storesData)
    .filter(id => storesData[id].effectivePaymentMethod === 'direct_transfer')
    .reduce((sum, id) => sum + calculateStoreTotal(id), 0);

  const codAllowed = Object.values(storesData).every(store => {
    if (store.deliveryMode === 'shipbubble') {
      return shipBubbleData[store.storeId]?.selection?.courier?.is_cod_available === true;
    }
  
    return store.storeInfo?.cod_enabled === true;
  });

  const handleSendMessage = async (storeId: string, storeName: string) => {
    if (!messageText.trim() || !customer) {
      toast.error('Please enter a message and ensure you are logged in');
      return;
    }
    setIsSendingMessage(true);
    try {
      const { error } = await messageService.sendMessage({
        store_id: storeId,
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_email: customer.email,
        message: messageText.trim(),
        context: `Checkout delivery inquiry for ${selectedAddress?.state}: ${messageText}`,
      });
      if (error) throw error;
      toast.success(`Message sent to ${storeName}`);
      setMessageText('');
      setMessageStoreId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleApplyCoupon = async (storeId: string) => {
    const code = storeCouponInputs[storeId]?.trim();
    const store = storesData[storeId];
    if (!store || !code) return;

    setApplyingCouponFor(storeId);
    try {
      const { valid, discountAmount, message } = await validateCoupon(code, storeId, store.subtotal);
      if (valid) {
        setStoreCoupons(prev => ({ ...prev, [storeId]: { code: code.toUpperCase(), discount: discountAmount } }));
        toast.success(`Coupon applied! Saved ₦${discountAmount.toLocaleString()}`);
      } else {
        toast.error(message || 'Invalid coupon');
      }
    } catch {
      toast.error('Failed to apply coupon');
    } finally {
      setApplyingCouponFor(null);
    }
  };

  const validateStockBeforeCheckout = async () => {
    try {
      const allItems = Object.values(storesData).flatMap(store => store.items);
  
      const productIds = allItems.map((item: any) => item.productId);
  
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity')
        .in('id', productIds);
  
      if (error) {
        throw error;
      }
  
      for (const item of allItems) {
        const product = products?.find((p: any) => p.id === item.productId);
  
        if (!product) {
          toast.error(`Product not found`);
          return false;
        }
  
        if (product.stock_quantity <= 0) {
          toast.error(`${product.name} is out of stock`);
          return false;
        }
  
        if (item.quantity > product.stock_quantity) {
          toast.error(
            `${product.name} has only ${product.stock_quantity} item(s) available`
          );
          return false;
        }
      }
  
      return true;
    } catch (err) {
      console.error('Stock validation error:', err);
      toast.error('Failed to validate product stock');
      return false;
    }
  };

  // Validate Address
  const validateAndSaveAddress = async (): Promise<number | null> => {
    if (!selectedAddress) return null;
   
    // If already validated, return the code
    if (selectedAddress.shipbubble_address_code) {
      return Number(selectedAddress.shipbubble_address_code);
    }
   
    try {
      // Get name from address or customer
      const fullName = selectedAddress.name || customer?.full_name || 'Customer';
      
      // Parse into first and last name
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || 'Customer';
      const lastName = nameParts.slice(1).join(' ') || '';
   
      const { data, error } = await supabase.functions.invoke(
        'shipbubble-validate-address',
        {
          body: {
            address: {
              first_name: firstName,
              last_name: lastName,
              phone: selectedAddress.phone || customer?.phone,
              email: customer?.email,
              line1: selectedAddress.address_line1,
              city: selectedAddress.city,
              state: selectedAddress.state,
              country: 'Nigeria',
            },
          },
        }
      );
   
      if (error) throw error;
   
      const addressCode = Number(data?.data?.address_code);
   
      if (!addressCode) {
        throw new Error('No address code returned');
      }
   
      // Save to database
      await supabase
        .from('customer_addresses')
        .update({
          shipbubble_address_code: addressCode,
          shipbubble_validated_at: new Date().toISOString(),
        })
        .eq('id', selectedAddress.id);

        await fetchAddresses();
   
      return addressCode;
    } catch (err: any) {
      console.error('Address validation failed:', err);
      toast.error(err.message || 'Address validation failed');
      return null;
    }
  };
  
  // ORDER CREATION via edge function
  const createAllOrdersViaEdgeFunction = async (
    paymentReference: string,
    addressCode: number
  ) => {
    const storeOrders = Object.values(storesData).map(store => ({
      store_id: store.storeId,
      subtotal: store.subtotal,
      delivery_fee: store.deliveryFee || 0,
      coupon_discount: storeCoupons[store.storeId]?.discount || 0,
      items: store.items.map((item: any) => ({
        productId: item.productId,
        name: item.name || item.product_name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        variantOptions: item.variantOptions || null,
        is_imported: item.is_imported || false,
        original_owner_id: item.original_owner_id || null,
        original_store_id: item.original_store_id || null,
        dropship_price: item.dropship_price || 0,
      })),
      shipbubble_selection: shipBubbleData[store.storeId]?.selection,
    }));
   
    const fullName = selectedAddress?.name || customer?.full_name || 'Customer';
   
    const { data, error } = await supabase.functions.invoke('create-order', {
      body: {
        payment_reference: paymentReference,
        payment_method: paymentMethod,
        amount_paid: grandTotal,
   
        customer_id: customer?.id || null,
        customer_name: fullName,
        customer_email: customer?.email,
        customer_phone: selectedAddress?.phone || customer?.phone,
   
        delivery_address: selectedAddress?.address_line1,
        delivery_city: selectedAddress?.city,
        delivery_state: selectedAddress?.state,
   
        shipbubble_address_code: addressCode,
   
        delivery_instructions: deliveryInstructions,
   
        store_orders: storeOrders,
      },
    });
   
    if (error) {
      console.error('create-order edge function error:', error);
      throw new Error(error.message || 'Order creation failed');
    }
   
    if (data?.error) {
      throw new Error(data.error);
    }
   
    // Clear carts for all stores that had orders created
    Object.keys(storesData).forEach(storeId => clearStoreCart(storeId));
   
    return data;
  };

  const handlePayment = async () => {
    if (!customer?.email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsProcessing(true);

    const addressCode = await validateAndSaveAddress();
  
    if (!addressCode) {
      setIsProcessing(false);
      return;
    }
  
    const stockValid = await validateStockBeforeCheckout();
    if (!stockValid) {
      setIsProcessing(false);
      return;
    }

    if (paymentMethod === 'cod') {
      setIsProcessing(true);
      try {
        const ref = generateReference('COD');
        await createAllOrdersViaEdgeFunction(ref, addressCode);
        toast.success('Orders placed! Pay on delivery.');
        setCurrentStep('confirm');
      } catch (err: any) {
        toast.error(err.message || 'Some orders failed to create. Please contact support.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (paystackTotal === 0) {
      setIsProcessing(true);
      try {
        const ref = generateReference('DT');
        await createAllOrdersViaEdgeFunction(ref, addressCode);
        toast.success('Orders confirmed! Please complete your direct bank transfers.');
        setCurrentStep('confirm');
      } catch (err: any) {
        toast.error(err.message || 'Some orders failed to create. Please contact support.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    try {
      setIsProcessing(true);
      await loadPaystackScript();

      const reference = generateReference('ORD');
      const amountInKobo = paystackTotal * 100;

      initializePayment({
        email: customer?.email,
        amount: amountInKobo,
        reference,
        metadata: {
          customer_name: selectedAddress?.name,
          customer_phone: selectedAddress?.phone,
          stores: Object.values(storesData).map(s => ({
            store_id: s.storeId,
            store_name: s.storeName,
            items: s.items.map((i: any) => ({ name: i.name, quantity: i.quantity })),
          })),
        },
        onSuccess: async (response) => {
          toast.success('Payment successful! Confirming your orders...');
          try {
            await createAllOrdersViaEdgeFunction(response.reference, addressCode);
            setCurrentStep('confirm');
          } catch (err: any) {
            toast.error(
              'Payment received but order confirmation failed. Contact support with reference: ' +
              response.reference
            );
          } finally {
            setIsProcessing(false);
          }
        },
        onCancel: () => {
          setIsProcessing(false);
          toast.info(
            'Payment window closed. If you completed payment, your orders will confirm shortly — please refresh.',
            { duration: 6000 }
          );
        },
      });
    } catch (err) {
      console.error('Paystack init error:', err);
      setIsProcessing(false);
      toast.error('Payment initialization failed');
    }
  };

  // Fetch Ship Bubble rates
  const fetchShipbubbleRatesForStore = async (
    storeId: string,
    addressCode: number
  ) => {
    if (!selectedAddress?.city || !selectedAddress?.state) return;
    if (!selectedAddress?.name || !selectedAddress?.phone) return;
   
    setShipBubbleData(prev => ({
      ...prev,
      [storeId]: { 
        ...(prev[storeId] || {}), loading: true, error: null }
    }));
   
    try {
      const store = storesData[storeId];
      if (!store) {
        throw new Error('Store not found');
      }
   
      // Format request correctly for ShipBubble API
      const requestBody = {
        store_id: storeId,
      
        delivery_address: {
          address: selectedAddress?.address_line1,
          city: selectedAddress?.city,
          state: selectedAddress?.state,
          phone: selectedAddress?.phone || customer?.phone,
        },
      
        cart_items: store.items.map((item: any) => ({
          name: item.name || item.product_name,
          product_name: item.name || item.product_name,
          weight_kg: Number(item.weight_kg || 0.5),
          quantity: Number(item.quantity || 1),
          price: Number(item.unitPrice || 0),
        })),
      
        pickup_address_code: undefined,
      
        receiver_address_code: Number(
          selectedAddress?.shipbubble_address_code
        ),
      
        pickup_date: new Date().toISOString().split('T')[0],
      };
   
      console.log(`[${store.storeName}] ShipBubble Rate Request:`, requestBody);
   
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('shipbubble-get-rates', {
        body: requestBody,
      });
   
      if (error || data?.error) {
        const errorMsg = data?.error ?? error?.message ?? 'Failed to fetch delivery rates';
        setShipBubbleData(prev => ({
          ...prev,
          [storeId]: { ...(prev[storeId] || {}), loading: false, error: errorMsg }
        }));
        console.error(`[${store.storeName}] ShipBubble Error:`, errorMsg);
        return;
      }
   
      const couriers = data.couriers ?? [];
      if (couriers.length === 0) {
        setShipBubbleData(prev => ({
          ...prev,
          [storeId]: { 
            ...(prev[storeId] || {}), 
            loading: false, 
            error: 'No carriers available for this location'
          }
        }));
        return;
      }
   
      console.log(`[${store.storeName}] Available Couriers:`, couriers);
   
      // Pre-select cheapest courier
      const cheapest = couriers.reduce((a: any, b: any) =>
        a.rate_card_amount < b.rate_card_amount ? a : b
      );
   
      setShipBubbleData(prev => ({
        ...prev,
        [storeId]: {
          couriers,
          selection: {
            request_token: data.request_token,
            receiver_address_code: addressCode,
            courier_id: cheapest.courier_id,
            service_code: cheapest.service_code,
            courier_name: cheapest.courier_name,
            courier: cheapest,
          },
          loading: false,
          error: null,
        }
      }));
   
      toast.success(`Delivery rates loaded for ${store.storeName}`);
    } catch (error: any) {
      console.error(`ShipBubble Exception for ${storeId}:`, error);
      setShipBubbleData(prev => ({
        ...prev,
        [storeId]: { 
          ...(prev[storeId] || {}), 
          loading: false, 
          error: error.message ?? 'Failed to fetch delivery rates'
        }
      }));
    }
  };

  useEffect(() => {
    if (!selectedAddress?.city || !selectedAddress?.state) return;
   
    // Find which stores use ShipBubble
    const shipbubbleStores = Object.entries(storesData)
      .filter(([_, store]) => store.deliveryMode === 'shipbubble')
      .map(([storeId, _]) => storeId);
   
    if (shipbubbleStores.length === 0) return; // No ShipBubble stores
   
    const timer = setTimeout(async () => {
      // Validate all required fields
      if (
        !selectedAddress?.name ||
        !selectedAddress?.phone ||
        !selectedAddress?.address_line1 ||
        !selectedAddress?.city ||
        !selectedAddress?.state
      ) {
        return;
      }
   
      // Validate and save address to get addressCode
      const addressCode = await validateAndSaveAddress();
   
      if (!addressCode) {
        console.error('Failed to get address code');
        return;
      }
   
      // Fetch rates for each ShipBubble store
      for (const storeId of shipbubbleStores) {
        await fetchShipbubbleRatesForStore(storeId, addressCode);
      }
    }, 700);
   
    return () => clearTimeout(timer);
  }, [
    selectedAddress?.city,
    selectedAddress?.state,
    selectedAddress?.name,
    selectedAddress?.phone,
    Object.keys(storesData).length
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/cart" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Cart</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'shipping' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
              }`}>
                {currentStep === 'shipping' ? '1' : <Check className="w-4 h-4" />}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'payment' ? 'bg-orange-500 text-white' :
                currentStep === 'confirm' ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {currentStep === 'confirm' ? <Check className="w-4 h-4" /> : '2'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Shipping Step */}
        {currentStep === 'shipping' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-bold mb-6">
              Checkout ({Object.keys(storesData).length} store{Object.keys(storesData).length > 1 ? 's' : ''})
            </h2>

            {/* Shipping Form */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Delivery Address
                </h3>

                {selectedAddress && (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/customer/dashboard')}
                  >
                    Change
                  </Button>
                )}
              </div>

              {!selectedAddress ? (
                <div className="border border-dashed rounded-xl p-6 text-center">
                  <p className="text-gray-500 mb-4">
                    You don't have a delivery address yet
                  </p>

                  <Button
                    onClick={() => navigate('/customer/addresses')}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    Add Address
                  </Button>
                </div>
              ) : (
                <div className="border rounded-xl p-4 bg-gray-50">
                  <p className="font-semibold">
                    {selectedAddress.name || customer?.full_name}
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    {selectedAddress.address_line1}
                  </p>

                  <p className="text-sm text-gray-600">
                    {selectedAddress.city}, {selectedAddress.state}
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    {selectedAddress.phone || customer?.phone}
                  </p>
                </div>
              )}
            </div>

            {/* Per-store delivery status */}
            {selectedAddress?.state && (
              <div className="space-y-4 mb-6">
                {Object.values(storesData).map((store) => (
                  <div
                    key={store.storeId}
                    className={`bg-white rounded-xl border p-4 ${
                      store.canDeliver ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-gray-400" />
                        <span className="font-medium">{store.storeName}</span>
                      </div>
                      {store.canDeliver ? (
                        <span className="text-sm text-green-600 font-medium">
                          Delivery: ₦{store.deliveryFee?.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-red-600 font-medium">No delivery</span>
                      )}
                    </div>

                    {/* Items */}
                    <div className="space-y-2 mb-3">
                      {store.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.name} x{item.quantity}</span>
                          <span>₦{(item.unitPrice * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between font-medium text-sm">
                        <span>Subtotal</span>
                        <span>₦{store.subtotal.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Ship Bubble Rates Selector */}
                    {store.deliveryMode === 'shipbubble' ? (
                      <div className="border-t pt-3">
                        <ShipBubbleRateSelector
                          couriers={shipBubbleData[store.storeId]?.couriers || []}
                          loading={shipBubbleData[store.storeId]?.loading || false}
                          error={shipBubbleData[store.storeId]?.error}
                          onSelect={(courier) => {
                            setShipBubbleData(prev => ({
                              ...prev,
                              [store.storeId]: {
                                ...prev[store.storeId],
                                selection: {
                                  request_token: prev[store.storeId]?.selection?.request_token || '',
                                  receiver_address_code:
                                    prev[store.storeId]?.selection?.receiver_address_code || 0,
                                  courier_id: courier.courier_id,
                                  service_code: courier.service_code,
                                  courier_name: courier.courier_name,
                                  courier,
                                },
                              },
                            }));
                          }}
                          selectedCourier={shipBubbleData[store.storeId]?.selection?.courier}
                          paymentMethod={paymentMethod}
                          onPaymentMethodChange={setPaymentMethod}
                          allowCod={codAllowed}
                          subtotal={store.subtotal}
                          platformFee={PLATFORM_DELIVERY_MARKUP}
                        />
                      </div>
                    ) : (
                      /* Manual zone selection */
                      <div className="border-t pt-3">
                        {store.canDeliver && (
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            <span>Delivery to {selectedAddress?.state}: ₦{store.deliveryFee?.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Coupon input per store */}
                    {store.canDeliver && (
                      <div className="border-t pt-3 mt-3">
                        {storeCoupons[store.storeId] ? (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-green-600 font-medium">
                              {storeCoupons[store.storeId].code} — saved ₦{storeCoupons[store.storeId].discount.toLocaleString()}
                            </span>
                            <button
                              onClick={() => setStoreCoupons(prev => {
                                const next = { ...prev };
                                delete next[store.storeId];
                                return next;
                              })}
                              className="text-xs text-red-500 underline"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={storeCouponInputs[store.storeId] || ''}
                              onChange={(e) => setStoreCouponInputs(prev => ({
                                ...prev,
                                [store.storeId]: e.target.value.toUpperCase()
                              }))}
                              placeholder="Coupon code"
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                            />
                            <Button
                              onClick={() => handleApplyCoupon(store.storeId)}
                              disabled={applyingCouponFor === store.storeId || !storeCouponInputs[store.storeId]?.trim()}
                              variant="outline"
                              className="px-4 text-sm"
                            >
                              {applyingCouponFor === store.storeId
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : 'Apply'
                              }
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* No delivery block with message seller */}
                    {!store.canDeliver && (
                      <div className="mt-3 p-3 bg-red-100 rounded-lg">
                        <p className="text-sm text-red-700 mb-2">
                          {store.storeName} doesn't deliver to {selectedAddress?.state}
                        </p>
                        {messageStoreId === store.storeId ? (
                          <div className="space-y-2">
                            <textarea
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              placeholder={`Ask about delivery to ${selectedAddress?.state}...`}
                              className="w-full px-3 py-2 text-sm rounded border border-gray-200 focus:border-orange-500 outline-none resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSendMessage(store.storeId, store.storeName)}
                                disabled={isSendingMessage || !customer || !messageText.trim()}
                                className="flex-1 h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs"
                              >
                                {isSendingMessage ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Send'}
                              </Button>
                              <Button
                                onClick={() => setMessageStoreId(null)}
                                variant="outline"
                                className="h-8 text-xs"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setMessageStoreId(store.storeId)}
                            className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Ask seller about delivery
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Direct transfer info banner */}
            {Object.values(storesData).some(s => s.effectivePaymentMethod === 'direct_transfer') && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">One or more stores require direct bank transfer</p>
                  <p>These stores don't use card payment. After checkout, you'll be shown each store's account details to pay separately. Complete your card payments first, then handle direct transfers.</p>
                </div>
              </div>
            )}

            {/* Unavailable stores warning */}
            {selectedAddress?.state && !canProceedToPayment() && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Some stores don't deliver to <strong>{selectedAddress?.state}</strong>. 
                  All stores must be able to deliver before you can proceed.
                </p>
              </div>
            )}

            <Button
              onClick={() => setCurrentStep('payment')}
              disabled={
                !canProceedToPayment() ||
                !selectedAddress?.name ||
                !customer?.email ||
                !selectedAddress?.phone ||
                !selectedAddress?.address_line1 ||
                !selectedAddress?.state
              }
              className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white font-medium"
            >
              Continue to Payment
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Payment Step */}
        {currentStep === 'payment' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-2xl font-bold mb-6">Payment</h2>

            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Method
              </h3>

              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('paystack')}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-colors ${
                    paymentMethod === 'paystack' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">Pay with Card</p>
                    <p className="text-sm text-gray-500">Secure payment via Paystack</p>
                  </div>
                  {paymentMethod === 'paystack' && <Check className="w-6 h-6 text-orange-500" />}
                </button>

                {codAllowed && (
                  <button
                    onClick={() => setPaymentMethod('cod')}
                    className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-colors ${
                      paymentMethod === 'cod' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">Cash on Delivery</p>
                      <p className="text-sm text-gray-500">Pay when you receive</p>
                    </div>
                    {paymentMethod === 'cod' && <Check className="w-6 h-6 text-orange-500" />}
                  </button>
                )}
              </div>
            </div>

            {/* Order Summary — Paystack stores only */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-bold mb-4">Order Summary</h3>

              {Object.values(storesData)
                .filter(store => store.effectivePaymentMethod === 'paystack')
                .map(store => (
                  <div key={store.storeId} className="mb-4 pb-4 border-b last:border-0">
                    <p className="font-medium text-gray-900 mb-2">{store.storeName}</p>
                    <div className="space-y-1 text-sm">
                      {store.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-gray-600">
                          <span>{item.name} x{item.quantity}</span>
                          <span>₦{(item.unitPrice * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-gray-600 pt-1">
                        <span>Delivery</span>
                        <span>
                          ₦{
                            (
                              store.deliveryMode === 'shipbubble'
                                ? shipBubbleData[store.storeId]?.selection?.courier?.rate_card_amount || 0
                                : store.deliveryFee || 0
                            ).toLocaleString()
                          }
                        </span>
                      </div>
                      {storeCoupons[store.storeId] && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount ({storeCoupons[store.storeId].code})</span>
                          <span>-₦{storeCoupons[store.storeId].discount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium pt-1 border-t">
                        <span>Store total</span>
                        <span>₦{calculateStoreTotal(store.storeId).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              }

              {/* Paystack grand total */}
              {paystackTotal > 0 && (
                <div className="border-t pt-4">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Card Payment Total</span>
                    <span className="text-orange-600">₦{paystackTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Direct transfer stores section */}
              {directTransferTotal > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                  <p className="font-semibold text-amber-900 text-sm mb-1">Direct Transfer — Handle Separately</p>
                  {Object.values(storesData)
                    .filter(s => s.effectivePaymentMethod === 'direct_transfer')
                    .map(s => (
                      <div key={s.storeId} className="flex justify-between text-sm text-amber-800 py-1">
                        <span>{s.storeName}</span>
                        <span>₦{calculateStoreTotal(s.storeId).toLocaleString()}</span>
                      </div>
                    ))
                  }
                  <p className="text-xs text-amber-700 mt-2">You'll complete these payments after checkout.</p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep('shipping')}
                className="px-6 py-3 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>

              <Button
                onClick={handlePayment}
                disabled={isProcessing}
                className="flex-1 h-14 bg-orange-500 hover:bg-orange-600 text-white font-medium"
              >
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : paystackTotal === 0 ? (
                  <>Confirm Orders <ArrowRight className="w-5 h-5 ml-2" /></>
                ) : (
                  <>Pay ₦{paystackTotal.toLocaleString()} <ArrowRight className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Confirm Step */}
        {currentStep === 'confirm' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Orders Confirmed!</h2>
              <p className="text-gray-500 mb-2">Thank you for your purchase.</p>
              <p className="text-gray-500 mb-6 text-sm">
                A confirmation has been sent to <strong>{customer?.email}</strong>
              </p>

              {/* Show direct transfer reminder on confirm screen if applicable */}
              {directTransferTotal > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
                  <p className="font-semibold text-amber-900 text-sm mb-2">Complete Your Direct Transfers</p>
                  {Object.values(storesData)
                    .filter(s => s.effectivePaymentMethod === 'direct_transfer')
                    .map(s => (
                      <div key={s.storeId} className="mb-3">
                        <p className="text-sm font-medium text-amber-800">{s.storeName}</p>
                        {s.storeInfo?.direct_bank_name && (
                          <p className="text-xs text-amber-700">Bank: {s.storeInfo.direct_bank_name}</p>
                        )}
                        {s.storeInfo?.direct_account_number && (
                          <p className="text-xs text-amber-700">Account: {s.storeInfo.direct_account_number}</p>
                        )}
                        {s.storeInfo?.direct_account_name && (
                          <p className="text-xs text-amber-700">Name: {s.storeInfo.direct_account_name}</p>
                        )}
                        <p className="text-xs font-semibold text-amber-800 mt-1">
                          Amount: ₦{calculateStoreTotal(s.storeId).toLocaleString()}
                        </p>
                      </div>
                    ))
                  }
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Total Paid</span>
                  <span>₦{grandTotal.toLocaleString()}</span>
                </div>
              </div>
              <Button
                onClick={() => navigate('/customer/dashboard')}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                View My Orders
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}