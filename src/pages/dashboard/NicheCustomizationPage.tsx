import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store, Check, X, AlertTriangle, Lock,
  TrendingUp, Package, Loader2, ArrowRight, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useStoreStore } from '@/stores';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { 
  NICHE_CATEGORIES, 
  getNicheDisplayList,
  SUBSCRIPTION_NICHE_LIMITS,
  normalizeTierId
} from '@/lib/nicheCategories';
import { PRICING_TIERS } from '@/lib/pricing';

interface NicheStatus {
  id: string;
  name: string;
  canRemove: boolean;
  reason: string;
  productCount: number;
  hasSales: boolean;
}

export default function NicheCustomizationPage() {
  const { user } = useAuthStore();
  const { currentStore, fetchStore } = useStoreStore();
  
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [nicheStatuses, setNicheStatuses] = useState<Record<string, NicheStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');

  const allNiches = getNicheDisplayList();
  const normalizedTier = normalizeTierId(subscriptionTier);
  const maxNiches = SUBSCRIPTION_NICHE_LIMITS[normalizedTier] || 1;
  const remainingSlots = maxNiches === Infinity ? 'Unlimited' : Math.max(0, maxNiches - selectedNiches.length);
  
  useEffect(() => {
    loadNicheData();
  }, [currentStore?.id]);

  const loadNicheData = async () => {
    if (!currentStore?.id) return;
    
    setIsLoading(true);
    try {
      // Get current niches
      const currentNiches = currentStore.niches || [];
      setSelectedNiches(currentNiches);

      // Get subscription tier - fallback to 'free' if no active subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Use normalized tier or default to 'free' (4-day trial)
      const rawTier = subData?.tier || 'free';
      setSubscriptionTier(rawTier);

      // Check each niche for products and sales
      const statuses: Record<string, NicheStatus> = {};
      
      for (const nicheId of currentNiches) {
        // Count products in this niche
        const { count: productCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', currentStore.id)
          .eq('niche', nicheId);

        // Check for sales (orders with products in this niche)
        const { data: salesData } = await supabase
          .from('orders')
          .select('id')
          .eq('store_id', currentStore.id)
          .limit(1);

        const hasSales = (salesData?.length || 0) > 0;
        
        // Determine if niche can be removed
        const canRemove = !hasSales && (productCount || 0) === 0;
        
        statuses[nicheId] = {
          id: nicheId,
          name: NICHE_CATEGORIES[nicheId]?.name || nicheId,
          canRemove,
          reason: hasSales 
            ? 'Cannot remove: You have sales in this niche'
            : (productCount || 0) > 0
            ? `Cannot remove: You have ${productCount} product(s) in this niche`
            : 'Can be removed',
          productCount: productCount || 0,
          hasSales
        };
      }

      setNicheStatuses(statuses);
    } catch (err) {
      console.error('Error loading niche data:', err);
    }
    setIsLoading(false);
  };

  const handleToggleNiche = (nicheId: string) => {
    if (selectedNiches.includes(nicheId)) {
      // Trying to remove
      const status = nicheStatuses[nicheId];
      if (status && !status.canRemove) {
        toast.error(status.reason);
        return;
      }
      setSelectedNiches(prev => prev.filter(id => id !== nicheId));
    } else {
      // Trying to add
      if (maxNiches !== Infinity && selectedNiches.length >= maxNiches) {
        toast.error(`You can only have ${maxNiches} niche(s) on your current plan`);
        setShowUpgradeModal(true);
        return;
      }
      setSelectedNiches(prev => [...prev, nicheId]);
    }
  };

  const handleSave = async () => {
    if (!currentStore?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ niches: selectedNiches })
        .eq('id', currentStore.id);

      if (error) throw error;

      // Refresh store data
      await fetchStore(currentStore.id);
      
      toast.success('Niches updated successfully');
      
      // Refresh status data
      loadNicheData();
    } catch (err) {
      console.error('Error saving niches:', err);
      toast.error('Failed to update niches');
    }
    setIsSaving(false);
  };

  const hasChanges = JSON.stringify(selectedNiches.sort()) !== 
    JSON.stringify((currentStore?.niches || []).sort());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Niche Customization</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Select the niches for your store based on your subscription plan
        </p>
      </div>

      {/* Current Plan Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl p-6 text-white"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-5 h-5" />
              <span className="font-medium">Current Plan</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {PRICING_TIERS.find(t => t.id === normalizedTier)?.name || 'Free Trial'}
            </h2>
            <p className="text-sky-100">
              {maxNiches === Infinity 
                ? 'Unlimited niches available'
                : `Up to ${maxNiches} niche${maxNiches > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{selectedNiches.length}</p>
            <p className="text-sky-100">niche(s) selected</p>
            {maxNiches !== Infinity && (
              <p className="text-sm mt-1 text-sky-100">
                {remainingSlots} slot(s) remaining
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Selected Niches */}
      {selectedNiches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Your Selected Niches
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedNiches.map((nicheId) => {
              const niche = NICHE_CATEGORIES[nicheId];
              const status = nicheStatuses[nicheId];
              
              return (
                <motion.div
                  key={nicheId}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4 relative"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {niche?.name || nicheId}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {niche?.description}
                      </p>
                      {status && (
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className={status.productCount > 0 ? 'text-orange-600' : 'text-gray-500'}>
                              {status.productCount} product{status.productCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {status.hasSales && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                              <TrendingUp className="w-4 h-4" />
                              <span>Has sales</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Remove button */}
                  <button
                    onClick={() => handleToggleNiche(nicheId)}
                    disabled={status && !status.canRemove}
                    className={`mt-4 w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      status && !status.canRemove
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                    title={status?.reason}
                  >
                    {status && !status.canRemove ? (
                      <span className="flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4" />
                        Locked
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <X className="w-4 h-4" />
                        Remove
                      </span>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Available Niches */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Niches
        </h2>
        
        {maxNiches !== Infinity && selectedNiches.length >= maxNiches && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300">
                Niche limit reached
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                You've selected the maximum number of niches for your plan. 
                Upgrade to add more niches.
              </p>
              <Button
                onClick={() => setShowUpgradeModal(true)}
                className="mt-3 bg-sky-500 hover:bg-sky-600 text-white"
                size="sm"
              >
                Upgrade Plan
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allNiches
            .filter(niche => !selectedNiches.includes(niche.id))
            .map((niche) => (
              <motion.div
                key={niche.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleToggleNiche(niche.id)}
                className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${
                  maxNiches !== Infinity && selectedNiches.length >= maxNiches
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {niche.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {niche.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {NICHE_CATEGORIES[niche.id]?.categories.length || 0} categories
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    maxNiches !== Infinity && selectedNiches.length >= maxNiches
                      ? 'border-gray-200'
                      : 'border-gray-300'
                  }`}>
                    {maxNiches !== Infinity && selectedNiches.length >= maxNiches ? (
                      <Lock className="w-4 h-4 text-gray-400" />
                    ) : (
                      <span className="text-gray-400">+</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
        </div>
      </motion.div>

      {/* Save Button */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You have unsaved changes
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedNiches(currentStore?.niches || [])}
              >
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-100 dark:border-sky-800 p-6"
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sky-900 dark:text-sky-300 mb-2">
              About Niche Management
            </h3>
            <ul className="space-y-2 text-sm text-sky-800 dark:text-sky-400">
              <li>• You can add niches up to your plan limit</li>
              <li>• Niches with products or sales cannot be removed</li>
              <li>• Each niche has specific categories for your products</li>
              <li>• Upgrade your plan to access more niches</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-sky-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Need More Niches?
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Upgrade your plan to add more niches to your store
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-4 border-2 border-sky-200 dark:border-sky-800 rounded-lg bg-sky-50 dark:bg-sky-900/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">Three Niches</span>
                    <span className="text-sky-600 font-bold">₦10,000/mo</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">3 niches + all features</p>
                </div>
                <div className="p-4 border-2 border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">Unlimited</span>
                    <span className="text-purple-600 font-bold">₦100,000/mo</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Unlimited niches + VIP support</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1"
                >
                  Maybe Later
                </Button>
                <Button
                  onClick={() => {
                    setShowUpgradeModal(false);
                    window.location.href = '/dashboard/subscription';
                  }}
                  className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
                >
                  View Plans
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}