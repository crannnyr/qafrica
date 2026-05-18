import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ShoppingCart, User, Phone, DollarSign,
  Loader2, Check, AlertCircle, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { useCustomerAuthStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

interface ManualSaleForm {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: 'cash' | 'transfer' | 'pos' | 'check';
  paymentStatus: 'pending' | 'received';
  notes: string;
}

export default function ManualSalesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { currentStore } = useStoreStore();
  const { customer } = useCustomerAuthStore();

  // Pre-fill from URL params
  const initialProductId = params.get('productId') || '';
  const initialProductName = params.get('productName') || '';
  const initialPrice = parseInt(params.get('price') || '0', 10);

  const [form, setForm] = useState<ManualSaleForm>({
    productId: initialProductId,
    productName: initialProductName,
    unitPrice: initialPrice,
    quantity: 1,
    totalPrice: initialPrice,
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    paymentMethod: 'cash',
    paymentStatus: 'received',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'form' | 'success'>('form');
  const [product, setProduct] = useState<any>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);

  // Load product details if productId provided
  useEffect(() => {
    if (form.productId) {
      loadProductDetails();
    }
  }, [form.productId]);

  // Update total price whenever quantity or unit price changes
  useEffect(() => {
    const total = form.quantity * form.unitPrice;
    setForm(prev => ({ ...prev, totalPrice: total }));
  }, [form.quantity, form.unitPrice]);

  const loadProductDetails = async () => {
    setIsLoadingProduct(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, selling_price, stock_quantity, is_out_of_stock, images')
        .eq('id', form.productId)
        .single();

      if (error) throw error;

      setProduct(data);

      // Update form with product details if they weren't pre-filled
      if (!form.productName && data.name) {
        setForm(prev => ({
          ...prev,
          productName: data.name,
          unitPrice: data.selling_price || prev.unitPrice,
        }));
      }
    } catch (err: any) {
      toast.error('Failed to load product details');
      console.error(err);
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = parseInt(e.target.value, 10) || 0;

    if (product && qty > product.stock_quantity) {
      toast.error(`Only ${product.stock_quantity} items in stock`);
      setForm(prev => ({ ...prev, quantity: product.stock_quantity }));
      return;
    }

    setForm(prev => ({ ...prev, quantity: Math.max(1, qty) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!form.productId) {
      toast.error('Product ID is required');
      return;
    }

    if (form.quantity <= 0) {
      toast.error('Quantity must be at least 1');
      return;
    }

    if (!form.customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    if (!currentStore?.id) {
      toast.error('Store not found');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Get current product stock
      const { data: currentProduct, error: fetchError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', form.productId)
        .single();

      if (fetchError || !currentProduct) {
        throw new Error('Product not found');
      }

      // 2. Check if enough stock available
      if (form.quantity > currentProduct.stock_quantity) {
        toast.error(`Only ${currentProduct.stock_quantity} items available`);
        setIsSubmitting(false);
        return;
      }

      // 3. Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          store_id: currentStore.id,
          customer_id: null,
          customer_name: form.customerName.trim(),
          customer_email: form.customerEmail.trim() || null,
          customer_phone: form.customerPhone.trim() || null,
          delivery_address: 'Manual Sale - In Store Pickup',
          delivery_city: 'Manual Sale',
          delivery_state: 'Manual Sale',
          status: 'delivered',
          payment_method: form.paymentMethod,
          payment_status: form.paymentStatus,
          subtotal: form.totalPrice,
          total: form.totalPrice,
          delivery_fee: 0,
          platform_fee: 0,
          items: [{
            product_id: form.productId,
            original_product_id: form.productId,
            name: form.productName,
            quantity: form.quantity,
            unit_price: form.unitPrice,
            total_price: form.totalPrice,
            is_imported: false,
            original_owner_id: null,
            original_store_id: null,
          }],
          notes: form.notes.trim() || null,
          is_manual_sale: true,
          delivered_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 4. Deduct stock from product
      const newStock = currentProduct.stock_quantity - form.quantity;

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: Math.max(0, newStock),
          is_out_of_stock: newStock <= 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', form.productId);

      if (updateError) throw updateError;

      toast.success(`Sale recorded successfully! Order #${order.order_number}`);
      setStatus('success');

      setTimeout(() => {
        navigate('/dashboard/orders');
      }, 2000);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to record sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900"
      >
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Sale Recorded!
          </h2>

          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Manual sale for <strong>{form.customerName}</strong> has been recorded successfully.
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {form.quantity} × {form.productName} = ₦{form.totalPrice.toLocaleString()}
          </p>

          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
            Redirecting to orders page...
          </p>

          <Button
            onClick={() => navigate('/dashboard/orders')}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            Go to Orders
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/dashboard/products')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Products
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8"
      >
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Record Manual Sale
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Enter sale details for in-store or direct transactions
            </p>
          </div>
        </div>

        {/* Stock Alert */}
        {product && product.is_out_of_stock && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />

            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Out of Stock:</strong> This product has no stock available.
              Recording this sale will keep the negative count.
            </p>
          </div>
        )}

        {product && !product.is_out_of_stock && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />

            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p>
                <strong>Available Stock:</strong> {product.stock_quantity} units
              </p>

              <p className="mt-1">
                Sale will deduct from available stock automatically.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Section */}
          <div className="border-b border-gray-100 dark:border-gray-700 pb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Product Details
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product ID
                </label>

                <input
                  type="text"
                  value={form.productId}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, productId: e.target.value }));
                    setProduct(null);
                  }}
                  readOnly
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Select or paste product ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Name
                </label>

                <input
                  type="text"
                  value={form.productName}
                  readOnly
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  placeholder="Auto-filled from product ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Unit Price (₦)
                </label>

                <input
                  type="number"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm(prev => ({
                      ...prev,
                      unitPrice: parseInt(e.target.value) || 0
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  step={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>

                <input
                  type="number"
                  value={form.quantity}
                  onChange={handleQuantityChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  min={1}
                  max={product?.stock_quantity || undefined}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Total (₦)
                </label>

                <div className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-2xl font-bold text-orange-600 dark:text-orange-400">
                  ₦{form.totalPrice.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Section */}
          <div className="border-b border-gray-100 dark:border-gray-700 pb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer Name *
                </label>

                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) =>
                    setForm(prev => ({
                      ...prev,
                      customerName: e.target.value
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone (Optional)
                </label>

                <input
                  type="tel"
                  value={form.customerPhone}
                  onChange={(e) =>
                    setForm(prev => ({
                      ...prev,
                      customerPhone: e.target.value
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="08012345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email (Optional)
                </label>

                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) =>
                    setForm(prev => ({
                      ...prev,
                      customerEmail: e.target.value
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="customer@email.com"
                />
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="border-b border-gray-100 dark:border-gray-700 pb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment Information
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>

                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm(prev => ({
                      ...prev,
                      paymentMethod: e.target.value as any
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="pos">POS/Card</option>
                  <option value="check">Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Status
                </label>

                <select
                  value={form.paymentStatus}
                  onChange={(e) =>
                    setForm(prev => ({
                      ...prev,
                      paymentStatus: e.target.value as any
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="received">Received</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>

            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm(prev => ({
                  ...prev,
                  notes: e.target.value
                }))
              }
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none"
              rows={3}
              placeholder="Any additional notes about this sale..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/products')}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              Cancel
            </button>

            <Button
              type="submit"
              disabled={isSubmitting || !form.customerName}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Record Sale
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}