// Universal Cart Page - Shows items from all stores with delivery validation
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, Trash2, Minus, Plus, Store, ArrowRight,
  MapPin, AlertCircle, Package, ChevronLeft, MessageCircle,
  Send, Loader2, X, Tag, CheckCircle, Ticket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore, useCustomerAuthStore } from '@/stores';
import { deliveryZoneService, messageService, supabase } from '@/services/supabase';
import { toast } from 'sonner';
import type { DeliveryZone } from '@/types';

interface StoreCouponState {
  code: string;
  discount: number;
  message?: string;
  isValid?: boolean;
}

export default function UniversalCartPage() {
  const navigate = useNavigate();
  const { 
    isAuthenticated, 
    addresses, 
    getDefaultAddress, 
    customer, 
    fetchAddresses 
  } = useCustomerAuthStore();
  
  const { 
    items, 
    getItemsByStore, 
    getStoreCount, 
    getTotalItems, 
    getSubtotal,
    getStoreSubtotal,
    updateQuantity, 
    removeItem,
    clearStoreCart,
    validateCoupon
  } = useCartStore();

  // State for delivery zones and messaging
  const [storeDeliveryZones, setStoreDeliveryZones] = useState<Record<string, DeliveryZone[]>>({});
  const [isLoadingZones, setIsLoadingZones] = useState(true);
  const [messageStoreId, setMessageStoreId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Coupon state per store
  const [storeCoupons, setStoreCoupons] = useState<Record<string, StoreCouponState>>({});
  const [productStocks, setProductStocks] = useState<Record<string, number>>({});
  const [applyingCoupon, setApplyingCoupon] = useState<string | null>(null);
  const [storeConfigs, setStoreConfigs] = useState<Record<string, any>>({});

  const itemsByStore = getItemsByStore();
  const storeCount = getStoreCount();
  const totalItems = getTotalItems();
  const subtotal = getSubtotal();
  const defaultAddress = getDefaultAddress();

  // FIX: Always fetch addresses on mount if authenticated to ensure we don't use stale cache
  useEffect(() => {
    if (isAuthenticated && customer) {
      fetchAddresses();
    }
  }, [isAuthenticated, customer, fetchAddresses]);

  // Fetch delivery zones for all stores in cart
  useEffect(() => {
    const loadDeliveryZones = async () => {
      const zones: Record<string, DeliveryZone[]> = {};
      const configs: Record<string, any> = {};
    
      if (Object.keys(itemsByStore).length === 0) {
        setIsLoadingZones(false);
        return;
      }
    
      for (const storeId of Object.keys(itemsByStore)) {
        try {
          const storeItems = itemsByStore[storeId];
          const productIds = storeItems.map(item => item.productId);
    
          const { data: importData } = await supabase
            .from('import_catalog')
            .select('original_store_id')
            .eq('importer_store_id', storeId)
            .in('original_product_id', productIds);
    
          let zoneStoreId = storeId;
    
          if (importData?.length) {
            const originalStoreIds = [
              ...new Set(
                importData
                  .map((i: any) => i.original_store_id as string)
                  .filter(Boolean)
              ),
            ] as string[];
    
            if (originalStoreIds.length === 1) {
              zoneStoreId = originalStoreIds[0];
            }
          }
    
          const { data: storeData } = await supabase
            .from('stores')
            .select('id, delivery_mode')
            .eq('id', zoneStoreId)
            .single();
    
          if (storeData) {
            configs[storeId] = storeData;
          }
    
          const { data } = await deliveryZoneService.getStoreZones(zoneStoreId);
    
          if (data) {
            zones[storeId] = data;
          }
        } catch (err) {
          console.error(err);
        }
      }
    
      setStoreConfigs(configs);
      setStoreDeliveryZones(zones);
      setIsLoadingZones(false);
    };

    loadDeliveryZones();
  }, [itemsByStore]);

  // Check product stock
  useEffect(() => {
    const loadProductStocks = async () => {
      if (items.length === 0) return;
  
      try {
        const productIds = items.map(item => item.productId);
  
        const { data, error } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .in('id', productIds);
  
        if (error) throw error;
  
        const stockMap: Record<string, number> = {};
  
        data?.forEach((product: any) => {
          stockMap[product.id] = product.stock_quantity || 0;
        });
  
        setProductStocks(stockMap);
      } catch (err) {
        console.error('Failed to load product stock:', err);
      }
    };
  
    loadProductStocks();
  }, [items]);

  // Get delivery fee for store to specific state
  const getDeliveryFeeForStore = (storeId: string, state: string): number | null => {
    const zones = storeDeliveryZones[storeId] || [];
    const zone = zones.find(z => 
      z.state.toLowerCase() === state.toLowerCase() && z.is_active
    );
    return zone ? zone.price : null;
  };

  const canStoreDeliverToState = (storeId: string, state: string): boolean => {
    const store = storeConfigs[storeId];
  
    // ShipBubble stores are assumed deliverable until checkout
    if (store?.delivery_mode === 'shipbubble') {
      return true;
    }
  
    const zones = storeDeliveryZones[storeId] || [];
  
    return zones.some(
      z =>
        z.state.toLowerCase() === state.toLowerCase() &&
        z.is_active
    );
  };

  // Calculate delivery fees based on default address
  const calculateStoreDeliveryFee = (storeId: string): number | null => {
    const store = storeConfigs[storeId];
  
    if (store?.delivery_mode === 'shipbubble') {
      return 0; // actual rate calculated at checkout
    }
  
    if (!defaultAddress?.state) return null;
  
    return getDeliveryFeeForStore(storeId, defaultAddress.state);
  };

  // Check delivery availability for all stores
  const getUnavailableStores = (): Array<{storeId: string, storeName: string}> => {
    if (!defaultAddress?.state) return [];
    
    return Object.entries(itemsByStore)
      .filter(([storeId]) => !canStoreDeliverToState(storeId, defaultAddress.state))
      .map(([storeId, storeItems]) => ({
        storeId,
        storeName: storeItems[0]?.storeName || 'Unknown Store'
      }));
  };

  const unavailableStores = getUnavailableStores();
  const hasUnavailableDelivery = unavailableStores.length > 0;

  const hasOutOfStockItems = items.some(item => {
    const stock = productStocks[item.productId] || 0;
    return stock <= 0 || item.quantity > stock;
  });

  // Handle coupon apply per store
  const handleApplyCoupon = async (storeId: string, code: string) => {
    if (!code.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    const storeSubtotal = getStoreSubtotal(storeId);
    setApplyingCoupon(storeId);

    try {
      const result = await validateCoupon(code, storeId, storeSubtotal);
      
      if (result.valid) {
        setStoreCoupons(prev => ({
          ...prev,
          [storeId]: { 
            code: code.toUpperCase(), 
            discount: result.discountAmount,
            isValid: true,
            message: result.message 
          }
        }));
        toast.success(`Coupon applied! Saved ₦${result.discountAmount.toLocaleString()}`);
      } else {
        setStoreCoupons(prev => ({
          ...prev,
          [storeId]: { 
            code: code.toUpperCase(), 
            discount: 0,
            isValid: false,
            message: result.message 
          }
        }));
        toast.error(result.message || 'Invalid coupon');
      }
    } catch (err) {
      toast.error('Failed to validate coupon');
    } finally {
      setApplyingCoupon(null);
    }
  };

  const handleRemoveCoupon = (storeId: string) => {
    setStoreCoupons(prev => {
      const updated = { ...prev };
      delete updated[storeId];
      return updated;
    });
    toast.info('Coupon removed');
  };

  // Calculate totals with discounts
  const deliveryFees = Object.keys(itemsByStore).reduce((acc, storeId) => {
    const fee = calculateStoreDeliveryFee(storeId);
    acc[storeId] = fee; // null if not deliverable
    return acc;
  }, {} as Record<string, number | null>);

  const totalDeliveryFee = Object.values(deliveryFees)
    .filter((fee): fee is number => fee !== null)
    .reduce((sum, fee) => sum + fee, 0);

  const totalDiscount = Object.values(storeCoupons)
    .reduce((sum, coupon) => sum + (coupon.discount || 0), 0);

  const platformFee = 500 * storeCount;
  
  const deliverableSubtotal = Object.entries(itemsByStore)
    .filter(([storeId]) => !hasUnavailableDelivery || canStoreDeliverToState(storeId, defaultAddress?.state || ''))
    .reduce((sum, [storeId]) => {
      const storeSubtotal = getStoreSubtotal(storeId);
      const discount = storeCoupons[storeId]?.discount || 0;
      return sum + Math.max(0, storeSubtotal - discount);
    }, 0);

  const hasShipbubbleStore = Object.values(storeConfigs).some(
      store => store?.delivery_mode === 'shipbubble'
  );
  
  const total = hasShipbubbleStore
    ? null
    : deliverableSubtotal + totalDeliveryFee + platformFee;

  // Handle sending message to seller
  const handleSendMessage = async (storeId: string, storeName: string) => {
    if (!messageText.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (!customer || !defaultAddress) {
      toast.error('You need to be logged in with an address to message the seller');
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
        context: `Delivery inquiry for ${defaultAddress.state}: ${messageText}`,
      });

      if (error) throw error;

      toast.success(`Message sent to ${storeName}!`);
      setMessageText('');
      setMessageStoreId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast.info('Please sign in to checkout');
      navigate(`/customer/login?return=/cart`);
      return;
    }

    if (!getDefaultAddress()) {
      toast.info('Please add a delivery address');
      navigate('/customer/dashboard?tab=addresses');
      return;
    }

    if (hasUnavailableDelivery) {
      toast.error('Some items cannot be delivered to your address. Please review or message sellers.');
      return;
    }

    // Pass coupon data to checkout if needed
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Link to="/" className="flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">Continue Shopping</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="w-12 h-12 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
            <p className="text-gray-500 mb-6">Looks like you haven't added anything yet</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/stores">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  Browse Stores
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline">
                  Go Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">QuickSell</span>
            </Link>

            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              <span className="font-medium">Cart ({totalItems})</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                Shopping Cart ({totalItems} items)
              </h1>
              {storeCount > 1 && (
                <span className="text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                  From {storeCount} stores
                </span>
              )}
            </div>

            {/* Delivery Unavailable Warning */}
            {hasUnavailableDelivery && defaultAddress && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-800">
                      Delivery Not Available to {defaultAddress.state}
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      {unavailableStores.map(s => s.storeName).join(', ')} 
                      {unavailableStores.length === 1 ? " doesn't" : " don't"} deliver to your location.
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      You can message the seller to inquire about delivery options, or select a different address.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Items Grouped by Store */}
            {Object.entries(itemsByStore).map(([storeId, storeItems]) => {
              const isDeliverable = defaultAddress?.state 
                ? canStoreDeliverToState(storeId, defaultAddress.state)
                : null;
              const deliveryFee = calculateStoreDeliveryFee(storeId);
              const isMessaging = messageStoreId === storeId;
              const storeSubtotal = getStoreSubtotal(storeId);
              const coupon = storeCoupons[storeId];

              return (
                <motion.div
                  key={storeId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl border overflow-hidden"
                >
                  {/* Store Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Store className="w-5 h-5 text-gray-400" />
                      <Link 
                        to={`/${storeItems[0]?.storeSlug || '#'}`}
                        className="font-medium hover:text-orange-600"
                      >
                        {storeItems[0]?.storeName || 'Store'}
                      </Link>
                      {isDeliverable === false && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          No delivery
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => clearStoreCart(storeId)}
                      className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove All
                    </button>
                  </div>

                  {/* Delivery Status Banner */}
                  {isDeliverable === false && defaultAddress && (
                    <div className="px-4 py-3 bg-red-50/50 border-b">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-red-700">
                            {storeItems[0]?.storeName} doesn't deliver to {defaultAddress.state} yet.
                          </p>
                          
                          {!isMessaging ? (
                            <button
                              onClick={() => setMessageStoreId(storeId)}
                              className="text-sm text-orange-600 hover:text-orange-700 font-medium mt-1 flex items-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              Ask the seller about delivery
                            </button>
                          ) : (
                            <AnimatePresence>
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700">Message {storeItems[0]?.storeName}</span>
                                  <button 
                                    onClick={() => setMessageStoreId(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <textarea
                                  value={messageText}
                                  onChange={(e) => setMessageText(e.target.value)}
                                  placeholder={`Hi, do you deliver to ${defaultAddress.state}? I'd like to order these items...`}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                                  rows={3}
                                />
                                <Button
                                  onClick={() => handleSendMessage(storeId, storeItems[0]?.storeName || 'Seller')}
                                  disabled={isSendingMessage || !messageText.trim()}
                                  className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-sm"
                                >
                                  {isSendingMessage ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Send className="w-3 h-3 mr-1" />
                                      Send Message
                                    </>
                                  )}
                                </Button>
                              </motion.div>
                            </AnimatePresence>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Store Items */}
                  <div className="divide-y">
                    {storeItems.map((item) => (
                      <div key={item.id} className="p-4 flex gap-4">
                        <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <Link 
                            to={`/${item.storeSlug || '#'}/product/${item.productId || ''}`}
                            className="font-medium text-gray-900 hover:text-orange-600 line-clamp-2"
                          >
                            {item.name || 'Product'}
                          </Link>
                          <p className="text-sm text-gray-500 mt-1">{item.storeName || ''}</p>
                          <p className="text-lg font-bold text-orange-600 mt-2">
                            ₦{(item.unitPrice || 0).toLocaleString()}
                          </p>

                          {(productStocks[item.productId] || 0) <= 0 ? (
                            <p className="text-sm text-red-500 mt-1 font-medium">
                              Out of Stock
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">
                              {productStocks[item.productId]} item(s) left
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-3">
                            <div
                              className={`flex items-center border overflow-hidden rounded-lg ${
                                (productStocks[item.productId] || 0) <= 0
                                  ? 'opacity-50 pointer-events-none'
                                  : ''
                              }`}
                            >
                              <button
                                onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                                className="p-2 bg-orange-500 hover:bg-orange-600 text-white"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-10 text-center font-medium">{item.quantity || 0}</span>
                              <button
                                onClick={() => {
                                  const stock = productStocks[item.productId] || 0;
                              
                                  if ((item.quantity || 0) >= stock) {
                                    toast.error(`Only ${stock} item(s) available`);
                                    return;
                                  }
                              
                                  updateQuantity(item.id, (item.quantity || 0) + 1);
                                }}
                                disabled={(item.quantity || 0) >= (productStocks[item.productId] || 0)}
                                className="p-2 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-lg">
                            ₦{(item.totalPrice || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Coupon Section for this Store */}
                  {isDeliverable !== false && (
                    <div className="px-4 py-3 bg-orange-50/50 border-t border-dashed">
                      {!coupon?.isValid ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={storeCoupons[storeId]?.code || ''}
                                onChange={(e) => setStoreCoupons(prev => ({
                                  ...prev,
                                  [storeId]: { 
                                    ...prev[storeId], 
                                    code: e.target.value.toUpperCase(),
                                    discount: 0,
                                    isValid: undefined,
                                    message: undefined
                                  }
                                }))}
                                placeholder="Enter coupon code"
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none uppercase"
                              />
                            </div>
                            <Button
                              onClick={() => handleApplyCoupon(storeId, storeCoupons[storeId]?.code || '')}
                              disabled={applyingCoupon === storeId || !storeCoupons[storeId]?.code?.trim()}
                              className="h-9 px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm"
                            >
                              {applyingCoupon === storeId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'Apply'
                              )}
                            </Button>
                          </div>
                          {coupon?.isValid === false && coupon.message && (
                            <p className="text-xs text-red-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {coupon.message}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <div>
                              <span className="text-sm font-medium text-green-800">{coupon.code}</span>
                              <p className="text-xs text-green-600">
                                -₦{coupon.discount.toLocaleString()} saved
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveCoupon(storeId)}
                            className="text-xs text-red-600 hover:text-red-700 underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Store Subtotal & Delivery */}
                  <div className="bg-gray-50 px-4 py-3 border-t">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        Subtotal: <span className="font-bold text-gray-900">₦{storeSubtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {coupon?.isValid && (
                          <div className="text-sm text-green-600">
                            Discount: -₦{coupon.discount.toLocaleString()}
                          </div>
                        )}
                        {isDeliverable && deliveryFee !== null && (
                          <div className="text-sm text-green-600">
                            {storeConfigs[storeId]?.delivery_mode === 'shipbubble'
                              ? 'Delivery: Calculated at checkout'
                              : `Delivery: ₦${deliveryFee.toLocaleString()}`
                            }
                          </div>
                        )}
                        {isDeliverable === false && (
                          <div className="text-sm text-red-500">
                            No delivery available
                          </div>
                        )}
                      </div>
                    </div>
                    {coupon?.isValid && (
                      <div className="text-right mt-1">
                        <span className="text-sm font-bold text-gray-900">
                          After Discount: ₦{Math.max(0, storeSubtotal - (coupon.discount || 0)).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Continue Shopping */}
            <Link 
              to="/stores"
              className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border sticky top-24">
              <div className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

                {/* Delivery Address */}
                {isAuthenticated && addresses.length > 0 ? (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-sm">Deliver to</span>
                    </div>
                    {defaultAddress ? (
                      <div>
                        <p className="font-medium">{defaultAddress.label || 'Address'}</p>
                        <p className="text-sm text-gray-500">{defaultAddress.address_line1}</p>
                        <p className="text-sm text-gray-500">
                          {defaultAddress.city}, {defaultAddress.state}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No default address set</p>
                    )}
                    <Link 
                      to="/customer/dashboard?tab=addresses"
                      className="text-sm text-orange-600 hover:text-orange-700 mt-2 inline-block"
                    >
                      Change Address
                    </Link>
                  </div>
                ) : isAuthenticated ? (
                  <div className="mb-6 p-4 bg-orange-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-orange-800">No delivery address</p>
                        <Link 
                          to="/customer/dashboard?tab=addresses"
                          className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                        >
                          Add Address →
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Price Breakdown */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal ({totalItems} items)</span>
                    <span>₦{(subtotal || 0).toLocaleString()}</span>
                  </div>
                  
                  {/* Discounts */}
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        <Ticket className="w-4 h-4" />
                        Discounts
                      </span>
                      <span>-₦{totalDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Delivery Fees by Store */}
                  <div className="space-y-1">
                    {Object.entries(itemsByStore).map(([storeId, storeItems]) => {
                      const fee = deliveryFees[storeId];
                      const isDeliverable = fee !== null;
                      
                      return (
                        <div key={storeId} className="flex justify-between text-xs">
                          <span className="text-gray-400">{storeItems[0]?.storeName}</span>
                          {storeConfigs[storeId]?.delivery_mode === 'shipbubble' ? (
                            <span className="text-blue-600 text-xs">
                              Calculated at checkout
                            </span>
                          ) : isDeliverable ? (
                            <span className="text-gray-600">
                              ₦{fee.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-red-400 text-xs">Not available</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Delivery</span>
                    <span className={hasUnavailableDelivery ? 'text-red-500' : ''}>
                    {Object.values(storeConfigs).some(
                        store => store?.delivery_mode === 'shipbubble'
                      )
                        ? 'Calculated at checkout'
                        : hasUnavailableDelivery
                        ? 'Partial / Unavailable'
                        : `₦${totalDeliveryFee.toLocaleString()}`
                      }
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Platform Fee</span>
                    <span>₦{(platformFee || 0).toLocaleString()}</span>
                  </div>

                  {hasUnavailableDelivery && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                      Cannot calculate total until delivery is available for all items
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-xl text-orange-600">
                      {hasUnavailableDelivery
                        ? '—'
                        : total === null
                          ? 'Calculated at checkout'
                          : `₦${total.toLocaleString()}`
                      }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Checkout Button */}
                <Button
                  onClick={handleCheckout}
                  disabled={hasUnavailableDelivery || isLoadingZones || hasOutOfStockItems}
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50"
                >
                  {isLoadingZones ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : hasOutOfStockItems ? (
                    'Some Items Out of Stock'
                  ) : hasUnavailableDelivery ? (
                    'Delivery Not Available'
                  ) : (
                    <>
                      Proceed to Checkout
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                {!isAuthenticated && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    You'll be asked to sign in during checkout
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}