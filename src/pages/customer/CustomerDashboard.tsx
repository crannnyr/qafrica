import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Heart, MapPin, User, LogOut,
  ChevronRight, Clock, CheckCircle, Truck, Camera,
  ShoppingCart, Store, Star, ShieldCheck, Upload,
  Check, AlertCircle, Wallet, Plus, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCustomerAuthStore, useCartStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import type { CustomerAddress } from '@/types';

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  delivered:  'bg-green-50 text-green-700 border-green-200',
  completed:  'bg-green-50 text-green-700 border-green-200',
  shipped:    'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-purple-50 text-purple-700 border-purple-200',
  confirmed:  'bg-sky-50 text-sky-700 border-sky-200',
  pending:    'bg-orange-50 text-orange-700 border-orange-200',
  cancelled:  'bg-red-50 text-red-700 border-red-200',
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'delivered' || status === 'completed') return <CheckCircle className="w-3.5 h-3.5" />;
  if (status === 'shipped') return <Truck className="w-3.5 h-3.5" />;
  if (status === 'pending') return <Clock className="w-3.5 h-3.5" />;
  return <Package className="w-3.5 h-3.5" />;
};

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);
  const [reportingOrderId, setReportingOrderId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const { customer } = useCustomerAuthStore();

useEffect(() => { fetchOrders(); }, [customer?.id]);

  const fetchOrders = async () => {
    if (!customer) return;
  
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
  
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          payment_status,
          total,
          created_at,
          delivery_address,
          delivery_state,
          delivered_at,
          tracking_number,

          shipbubble_order_id,
          shipbubble_tracking_url,
          shipbubble_status,
          shipbubble_courier_name,
          is_cod_order,

          store:stores!orders_store_id_fkey(name, slug),
          order_items(
            id,
            quantity,
            unit_price,
            total_price,
            product:products!order_items_product_id_fkey(id, name, images),
            original_product:products!order_items_original_product_id_fkey(id, name, images)
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
  
      if (error) { 
        console.error('Fetch orders error:', JSON.stringify(error)); 
        setOrders([]); 
      } else if (data) {
        setOrders(data);
      }
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
    if (!reportText.trim()) {
      toast.error('Please describe the issue');
      return;
    }
    setIsSubmittingReport(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          buyer_reported_issue: true,
          issue_description:    reportText.trim(),
          issue_reported_at:    new Date().toISOString(),
          dispute_status:       'open',
        })
        .eq('id', orderId)
        .eq('customer_id', customer!.id);

      if (error) throw error;

      toast.success('Report submitted. Our team will review it within 24 hours.');
      setReportingOrderId(null);
      setReportText('');
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
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
  }

  return (
    <div className="space-y-3">
      {orders.map((order, index) => {
        const orderItems: any[] = order.order_items || [];
        const storeName = order.store?.name || 'Store';
        const canRelease = order.status === 'shipped' && !order.is_escrow_released && !order.buyer_reported_issue;

        return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors"
          >
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
                  {' · '}<span className="text-gray-500">{storeName}</span>
                </p>

                {/* In your orders table/list render */}
                {order.shipbubble_order_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                      {order.shipbubble_status || 'Tracking'}
                    </span>
                    {order.shipbubble_tracking_url && (
                      <a
                        href={order.shipbubble_tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Track
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded capitalize">
                    {order.status}
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-900 text-sm">₦{order.total?.toLocaleString()}</p>
            </div>

            {/* Item thumbnails */}
            {orderItems.length > 0 && (
              <div className="flex gap-2 mb-3">
                {orderItems.slice(0, 4).map((item: any, idx: number) => {
                  const image = item.product?.images?.[0] ?? null;
                  return (
                    <div key={idx} className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100">
                      {image ? (
                        <img src={image} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-medium">
                          {item.product_name?.charAt(0) ?? '?'}
                        </div>
                      )}
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
                      <Button variant="outline" size="sm" className="h-7 text-xs border-orange-200 text-orange-600 px-3">
                        <Star className="w-3 h-3 mr-1" />Review
                      </Button>
                    </Link>
                  )}
                  {/* Report Issue button — show if order is active and not already reported */}
                  {!order.buyer_reported_issue &&
                    ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status) && (
                    <button
                      onClick={() => {
                        setReportingOrderId(reportingOrderId === order.id ? null : order.id);
                        setReportText('');
                      }}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      Report
                    </button>
                  )}
                </div>
              </div>

              {/* Inline report form */}
              {reportingOrderId === order.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2"
                >
                  <p className="text-xs font-semibold text-red-800 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Report an Issue with Order #{order.order_number}
                  </p>
                  <textarea
                    value={reportText}
                    onChange={e => setReportText(e.target.value)}
                    placeholder="Describe the problem — wrong item, not delivered, damaged goods, etc."
                    rows={3}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSubmitReport(order.id)}
                      disabled={isSubmittingReport || !reportText.trim()}
                      className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white px-3 flex-1"
                    >
                      {isSubmittingReport
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : 'Submit Report'
                      }
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setReportingOrderId(null); setReportText(''); }}
                      className="h-7 text-xs px-3 border-red-200 text-red-600"
                    >
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

// ── Add Address Form ──────────────────────────────────────────────────────────
function AddAddressForm({ onCancel, onSuccess, customerId }: {
  onCancel: () => void; onSuccess: () => void; customerId: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    country: 'Nigeria',
    postal_code: '',
    is_default: false,
  });

  const nigerianStates = [
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
    'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
    'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
  ];

  const validateAddressWithShipBubble = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
  
      const { data, error } = await supabase.functions.invoke(
        'shipbubble-validate-address',
        {
          body: {
            address: {
              full_name: formData.name,
              email: user?.email,
              phone: formData.phone,
              address: formData.address_line1,
              city: formData.city,
              state: formData.state,
              country: formData.country || 'Nigeria',
            },
          },
        }
      );
  
      console.log('Shipbubble response:', data);
  
      if (error) throw error;
  
      if (!data?.success || !data?.data?.address_code) {
        throw new Error(data?.error || 'Address validation failed');
      }
  
      return data.data.address_code;
    } catch (err: any) {
      console.error('Validation error:', err);
      throw new Error(err.message || 'Unable to validate address');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (
      !formData.name ||
      !formData.phone ||
      !formData.address_line1 ||
      !formData.city ||
      !formData.state
    ) {
      toast.error('Please fill in required fields');
      return;
    }
  
    setIsLoading(true);
  
    try {
      // Validate with ShipBubble first
      const addressCode = await validateAddressWithShipBubble();
  
      // Remove previous default if needed
      if (formData.is_default) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', customerId);
      }
  
      // Save validated address
      const { error } = await supabase
        .from('customer_addresses')
        .insert({
          customer_id: customerId,
  
          label: formData.label || 'Home',
  
          name: formData.name,
          phone: formData.phone,
  
          address_line1: formData.address_line1,
          address_line2: formData.address_line2 || null,
  
          city: formData.city,
          state: formData.state,
  
          country: formData.country,
  
          postal_code: formData.postal_code || null,
  
          is_default: formData.is_default,
  
          shipbubble_address_code: addressCode,
          shipbubble_validated_at: new Date().toISOString(),
        });
  
      if (error) throw error;
  
      toast.success('Address saved successfully');
  
      onSuccess();
    } catch (err: any) {
      console.error(err);
  
      toast.error(err.message || 'Failed to save address');
    } finally {
      setIsLoading(false);
    }
  };

  const ic = "w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm transition-colors";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="border border-gray-100 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-gray-900 text-sm">New Address</p>
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})}
          placeholder="Label (Home, Office...)" className={ic} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="Full name *"
            className={ic}
            required
          />
        
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="Phone number *"
            className={ic}
            required
          />
        </div>
        
        <input type="text" value={formData.address_line1} onChange={e => setFormData({...formData, address_line1: e.target.value})}
          placeholder="Street address *" className={ic} required />
        <div className="grid grid-cols-2 gap-3">
          <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}
            placeholder="City *" className={ic} required />
          <select value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})}
            className={ic} required>
            <option value="">State *</option>
            {nigerianStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={formData.is_default}
            onChange={e => setFormData({...formData, is_default: e.target.checked})}
            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
          Set as default
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-8 text-xs">Cancel</Button>
          <Button type="submit" disabled={isLoading} className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white">
            {isLoading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Address'}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

// ── Addresses Tab ─────────────────────────────────────────────────────────────
function AddressesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showAddForm = searchParams.get('add') === 'true';
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { customer } = useCustomerAuthStore();

  useEffect(() => { if (customer) fetchAddresses(); }, [customer]);

  const fetchAddresses = async () => {
    if (!customer) return;
    try {
      const { data, error } = await supabase.from('customer_addresses').select('*')
        .eq('customer_id', customer.id).order('is_default', { ascending: false });
      if (data && !error) setAddresses(data as CustomerAddress[]);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    await supabase.from('customer_addresses').delete().eq('id', id);
    fetchAddresses();
  };

  const setDefault = async (id: string) => {
    if (!customer) return;
    await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customer.id);
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id);
    fetchAddresses();
  };

  return (
    <div className="space-y-4">
      {!showAddForm && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{addresses.length} address{addresses.length !== 1 ? 'es' : ''}</p>
          <Button size="sm" onClick={() => { searchParams.set('add', 'true'); setSearchParams(searchParams); }}
            className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-3.5 h-3.5 mr-1" />Add
          </Button>
        </div>
      )}

      {showAddForm && customer && (
        <AddAddressForm
          onCancel={() => { searchParams.delete('add'); setSearchParams(searchParams); }}
          onSuccess={() => { searchParams.delete('add'); setSearchParams(searchParams); fetchAddresses(); }}
          customerId={customer.id}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !showAddForm && addresses.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No saved addresses</p>
        </div>
      ) : !showAddForm && (
        <div className="space-y-2">
          {addresses.map(address => (
            <div key={address.id}
              className={`border rounded-xl p-4 transition-colors ${address.is_default ? 'border-orange-300 bg-orange-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{address.label || 'Address'}</span>
                    {address.is_default && <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded font-medium">Default</span>}
                  </div>
                  <p className="text-gray-600">{address.address_line1}</p>
                  <p className="text-gray-400">{address.city}, {address.state}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!address.is_default && (
                    <button onClick={() => setDefault(address.id)}
                      className="text-xs text-orange-600 font-medium px-2 py-1 rounded hover:bg-orange-50 transition-colors">
                      Set default
                    </button>
                  )}
                  <button onClick={() => handleDelete(address.id)}
                    className="text-xs text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wishlist Tab ──────────────────────────────────────────────────────────────
function WishlistTab() {
  const { wishlist, removeFromWishlist } = useCartStore();
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchWishlistItems(); }, [wishlist]);

  const fetchWishlistItems = async () => {
    if (wishlist.length === 0) { setIsLoading(false); return; }
    try {
      const productIds = wishlist.map((w: any) => w.productId || w);
      const { data, error } = await supabase
        .from('products').select('*, store:stores(name, slug)').in('id', productIds);
      if (data && !error) setWishlistItems(data);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  if (isLoading) return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (wishlistItems.length === 0) return (
    <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
      <Heart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-500 mb-4">Your wishlist is empty</p>
      <Link to="/stores"><Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">Browse Stores</Button></Link>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {wishlistItems.map((item, index) => (
        <motion.div key={item.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.04 }}
          className="border border-gray-100 rounded-xl overflow-hidden group hover:border-gray-200 transition-colors">
          <div className="aspect-square bg-gray-50 relative overflow-hidden">
            {item.images?.[0] ? (
              <img src={item.images[0]} alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-200">{item.name?.charAt(0) ?? '?'}</span>
              </div>
            )}
            <button onClick={() => removeFromWishlist(item.id)}
              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity">
              <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
            </button>
          </div>
          <div className="p-3">
            <p className="font-medium text-gray-900 text-sm line-clamp-1 mb-0.5">{item.name}</p>
            <p className="text-orange-600 font-bold text-sm">₦{item.selling_price?.toLocaleString()}</p>
            <Link to={`/${item.store?.slug}/product/${item.id}`}
              className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-1 mt-1 transition-colors">
              <Store className="w-3 h-3" />{item.store?.name}
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const { customer, updateProfile, logout } = useCustomerAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(customer?.avatar_url || '');
  const [formData, setFormData] = useState({
    full_name: customer?.full_name || '',
    phone: customer?.phone || '',
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !customer) return;
    if (!file.type.startsWith('image/')) { toast.error('Images only'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    setUploadingAvatar(true);
    try {
      const filePath = `avatars/${customer.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('customers').update({ avatar_url: publicUrl }).eq('id', customer.id);
      setAvatarUrl(publicUrl);
      toast.success('Photo updated');
    } catch (err: any) { toast.error(err.message || 'Upload failed'); }
    finally { setUploadingAvatar(false); }
  };

  const handleSave = async () => {
    const result = await updateProfile(formData);
    if (result.success) { toast.success('Profile updated'); setIsEditing(false); }
    else toast.error(result.error || 'Update failed');
  };

  const ic = "w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm transition-colors";

  return (
    <div className="space-y-5 max-w-md">
      {/* Avatar row */}
      <div className="flex items-center gap-4">
        <div className="relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
          <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-orange-500">
                {customer?.full_name?.charAt(0) ?? '?'}
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingAvatar
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Camera className="w-4 h-4 text-white" />
            }
          </div>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{customer?.full_name}</p>
          <p className="text-sm text-gray-400">{customer?.email}</p>
          <button onClick={() => fileInputRef.current?.click()}
            className="text-xs text-orange-500 hover:text-orange-600 font-medium mt-0.5">
            Change photo
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      </div>

      {/* Info card */}
      <div className="border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900 text-sm">Personal Info</p>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)}
              className="text-xs text-orange-500 hover:text-orange-600 font-medium">Edit</button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <input type="text" value={formData.full_name}
              onChange={e => setFormData({...formData, full_name: e.target.value})}
              placeholder="Full name" className={ic} />
            <input type="tel" value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="Phone number" className={ic} />
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white">Save</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} className="h-8 text-xs px-4">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {[
              ['Name', customer?.full_name],
              ['Email', customer?.email],
              ['Phone', customer?.phone || 'Not set'],
              ['Member since', customer?.created_at ? new Date(customer.created_at).getFullYear().toString() : '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-900 font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={async () => { await logout(); toast.success('Signed out'); navigate('/'); }}
        className="flex items-center gap-2 text-sm text-red-600 font-medium px-4 py-2.5 border border-red-200 rounded-xl hover:bg-red-50 transition-colors w-full justify-center"
      >
        <LogOut className="w-4 h-4" />Sign Out
      </button>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'wishlist' | 'profile'>('orders');
  const { customer, isAuthenticated } = useCustomerAuthStore();
  const { getItemCount } = useCartStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate('/customer/login?return=/customer/dashboard');
  }, [isAuthenticated, navigate]);

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { key: 'orders',    label: 'Orders',    icon: Package },
    { key: 'addresses', label: 'Addresses', icon: MapPin   },
    { key: 'wishlist',  label: 'Wishlist',  icon: Heart    },
    { key: 'profile',   label: 'Profile',   icon: User     },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/stores" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">Q</span>
              </div>
              <span className="font-bold text-gray-900 tracking-tight">QAFRICA</span>
            </Link>
            <div className="flex items-center gap-1">
              <Link to="/stores" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Store className="w-4 h-4" />
              </Link>
              <Link to="/cart" className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <ShoppingCart className="w-4 h-4" />
                {getItemCount() > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {getItemCount()}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-4 gap-5">

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-20">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-50">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200 flex-shrink-0">
                  {customer.avatar_url ? (
                    <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-orange-600">
                      {customer.full_name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="font-semibold text-gray-900 text-sm truncate">{customer.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{customer.email}</p>
                </div>
              </div>

              <nav className="space-y-0.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-sm ${
                        isActive ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-4 pt-4 border-t border-gray-50">
                <button
                  onClick={() => { useCustomerAuthStore.getState().logout(); navigate('/'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="lg:col-span-3">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-xl border border-gray-100 p-5 lg:p-6"
            >
              <div className="mb-5">
                <h1 className="text-base font-bold text-gray-900">
                  {tabs.find(t => t.key === activeTab)?.label}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activeTab === 'orders'    && 'Track and manage your purchases'}
                  {activeTab === 'addresses' && 'Manage delivery locations'}
                  {activeTab === 'wishlist'  && "Items you've saved for later"}
                  {activeTab === 'profile'   && 'Update your personal information'}
                </p>
              </div>

              {activeTab === 'orders'    && <OrdersTab />}
              {activeTab === 'addresses' && <AddressesTab />}
              {activeTab === 'wishlist'  && <WishlistTab />}
              {activeTab === 'profile'   && <ProfileTab />}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  ); 
}