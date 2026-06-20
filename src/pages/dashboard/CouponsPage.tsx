import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Tag, Plus, Search, Copy, Edit2, Trash2, 
  Calendar, Percent, Hash, Check, X,
  Users, ShoppingBag, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { supabase } from '@/services';
import { toast } from 'sonner';
import type { Coupon } from '@/types';

// Coupon service with direct supabase import
const couponService = {
  async getStoreCoupons(storeId: string) {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createCoupon(couponData: Partial<Coupon>) {
    const { data, error } = await supabase
      .from('coupons')
      .insert(couponData)
      .select()
      .single();
    return { data, error };
  },

  async updateCoupon(couponId: string, updates: Partial<Coupon>) {
    const { data, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', couponId)
      .select()
      .single();
    return { data, error };
  },

  async deleteCoupon(couponId: string) {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', couponId);
    return { error };
  },
};

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage (%)', icon: Percent },
  { value: 'fixed', label: 'Fixed Amount (₦)', icon: Hash },
];

export default function CouponsPage() {
  const { currentStore } = useStoreStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    min_order_amount: 0,
    max_discount_amount: 0,
    usage_limit: 0,
    start_date: '',
    end_date: '',
    is_active: true,
    applies_to: 'all' as 'all' | 'products' | 'categories',
    product_ids: [] as string[],
    category_ids: [] as string[],
  });

  useEffect(() => {
    if (currentStore?.id) {
      loadCoupons();
    }
  }, [currentStore]);

  const loadCoupons = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await couponService.getStoreCoupons(currentStore!.id);
      if (error) throw error;
      setCoupons(data || []);
    } catch (err) {
      toast.error('Failed to load coupons');
    }
    setIsLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentStore?.id) return;

    // Validate
    if (!formData.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    if (formData.discount_value <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    try {
      const couponData = {
        ...formData,
        store_id: currentStore.id,
        code: formData.code.toUpperCase(),
        usage_count: 0,
      };

      if (editingCoupon) {
        const { error } = await couponService.updateCoupon(editingCoupon.id, couponData);
        if (error) throw error;
        toast.success('Coupon updated successfully');
      } else {
        const { error } = await couponService.createCoupon(couponData);
        if (error) throw error;
        toast.success('Coupon created successfully');
      }

      resetForm();
      setShowModal(false);
      loadCoupons();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save coupon');
    }
  };

  const handleDelete = async (couponId: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;

    try {
      const { error } = await couponService.deleteCoupon(couponId);
      if (error) throw error;
      toast.success('Coupon deleted');
      loadCoupons();
    } catch (err) {
      toast.error('Failed to delete coupon');
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount || 0,
      max_discount_amount: coupon.max_discount_amount || 0,
      usage_limit: coupon.usage_limit || 0,
      start_date: coupon.start_date ? coupon.start_date.split('T')[0] : '',
      end_date: coupon.end_date ? coupon.end_date.split('T')[0] : '',
      is_active: coupon.is_active,
      applies_to: coupon.applies_to || 'all',
      product_ids: coupon.product_ids || [],
      category_ids: coupon.category_ids || [],
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      min_order_amount: 0,
      max_discount_amount: 0,
      usage_limit: 0,
      start_date: '',
      end_date: '',
      is_active: true,
      applies_to: 'all',
      product_ids: [],
      category_ids: [],
    });
    setEditingCoupon(null);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Coupon code copied to clipboard');
  };

  const isCouponExpired = (coupon: Coupon) => {
    if (!coupon.end_date) return false;
    return new Date(coupon.end_date) < new Date();
  };

  const isCouponActive = (coupon: Coupon) => {
    return coupon.is_active && !isCouponExpired(coupon);
  };

  const filteredCoupons = coupons.filter(coupon =>
    coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: coupons.length,
    active: coupons.filter(c => isCouponActive(c)).length,
    expired: coupons.filter(c => isCouponExpired(c)).length,
    totalUsage: coupons.reduce((sum, c) => sum + (c.usage_count || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discount Coupons</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create and manage discount coupons for your store
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Coupons', value: stats.total, icon: Tag, color: 'bg-blue-500' },
          { label: 'Active', value: stats.active, icon: Check, color: 'bg-green-500' },
          { label: 'Expired', value: stats.expired, icon: Clock, color: 'bg-red-500' },
          { label: 'Total Usage', value: stats.totalUsage, icon: Users, color: 'bg-purple-500' },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search coupons by code or description..."
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
        />
      </div>

      {/* Coupons List */}
      <div className="space-y-4">
        {filteredCoupons.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700">
            <Tag className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No coupons yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first coupon to start offering discounts
            </p>
            <Button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Coupon
            </Button>
          </div>
        ) : (
          filteredCoupons.map((coupon, index) => (
            <motion.div
              key={coupon.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white dark:bg-gray-800 rounded-xl p-6 border ${
                isCouponActive(coupon)
                  ? 'border-gray-100 dark:border-gray-700'
                  : 'border-gray-200 dark:border-gray-600 opacity-75'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Left: Coupon Info */}
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isCouponActive(coupon) ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Tag className={`w-6 h-6 ${
                      isCouponActive(coupon) ? 'text-orange-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {coupon.code}
                      </h3>
                      <button
                        onClick={() => copyCode(coupon.code)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Copy code"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                      {isCouponActive(coupon) ? (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                          Active
                        </span>
                      ) : isCouponExpired(coupon) ? (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-full">
                          Expired
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    {coupon.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                        {coupon.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        {coupon.discount_type === 'percentage' ? (
                          <Percent className="w-4 h-4" />
                        ) : (
                          <Hash className="w-4 h-4" />
                        )}
                        {coupon.discount_type === 'percentage'
                          ? `${coupon.discount_value}% off`
                          : `₦${coupon.discount_value.toLocaleString()} off`}
                      </span>
                      {coupon.min_order_amount && coupon.min_order_amount > 0 && (
                        <span>Min order: ₦{coupon.min_order_amount.toLocaleString()}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="w-4 h-4" />
                        Used {coupon.usage_count || 0}
                        {coupon.usage_limit && coupon.usage_limit > 0 && ` / ${coupon.usage_limit}`} times
                      </span>
                      {coupon.end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Expires {new Date(coupon.end_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(coupon)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(coupon.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreate} className="p-6 space-y-6">
                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., SUMMER2024"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Summer sale discount"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                {/* Discount Type & Value */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Discount Type
                    </label>
                    <select
                      value={formData.discount_type}
                      onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                    >
                      {DISCOUNT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Discount Value *
                    </label>
                    <input
                      type="number"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                      placeholder={formData.discount_type === 'percentage' ? 'e.g., 20' : 'e.g., 5000'}
                      min="0"
                      max={formData.discount_type === 'percentage' ? 100 : undefined}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Minimum Order Amount (₦)
                    </label>
                    <input
                      type="number"
                      value={formData.min_order_amount}
                      onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      min="0"
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Usage Limit (0 = unlimited)
                    </label>
                    <input
                      type="number"
                      value={formData.usage_limit}
                      onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      min="0"
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Coupon is active
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}