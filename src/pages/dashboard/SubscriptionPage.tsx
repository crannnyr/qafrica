import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, Check, ArrowRight, Calendar, CreditCard, 
  RefreshCw, AlertTriangle, ToggleLeft, ToggleRight,
  Loader2, Zap, Sparkles, Wallet, Plus,
  TrendingUp, Clock, Trash2, Infinity as InfinityIcon,
  AlertCircle, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useWalletStore } from '@/stores';
import { toast } from 'sonner';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import { supabase } from '@/services';
import type { Subscription, SavedCard } from '@/types';

// Pricing configuration
const TIER_CONFIG = {
  one_niche: { name: 'Starter', niches: 1, monthlyPrice: 5000, color: 'orange' },
  three_niches: { name: 'Growth', niches: 3, monthlyPrice: 10000, color: 'blue' },
  unlimited: { name: 'Enterprise', niches: Infinity, monthlyPrice: 100000, color: 'purple' },
  free: { name: 'Free Trial', niches: 1, monthlyPrice: 0, color: 'green' },
};

const LIFETIME_PRICES = {
  one_niche: 2000000,
  three_niches: 3800000,
  unlimited: 10000000,
};

const DURATION_DISCOUNTS = [
  { months: 1, label: '1 Month', multiplier: 1, discount: 0 },
  { months: 3, label: '3 Months', multiplier: 2.7, discount: 10 },
  { months: 6, label: '6 Months', multiplier: 5, discount: 17 },
  { months: 12, label: '1 Year', multiplier: 9, discount: 25 },
];

interface SubscriptionData extends Subscription {
  cancel_at_period_end?: boolean;
}

// Progress Bar Component
function SubscriptionProgressBar({ startDate, endDate }: { startDate: string; endDate: string }) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const total = end - start;
  const elapsed = now - start;
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  
  const getProgressColor = () => {
    if (progress > 90) return 'bg-red-500';
    if (progress > 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-orange-100">{formatDate(startDate)}</span>
        <span className="text-orange-100">{formatDate(endDate)}</span>
      </div>
      <div className="w-full bg-white/20 rounded-full h-2 mb-2">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${getProgressColor()} transition-all duration-500`}
        />
      </div>
      <p className={`text-sm ${daysRemaining <= 3 ? 'text-red-200 font-medium' : 'text-orange-100'}`}>
        {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expired today'}
      </p>
    </div>
  );
}

function formatDate(dateString: string) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-NG', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const { availableBalance: walletBalance } = useWalletStore();
  
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modals
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<keyof typeof TIER_CONFIG>('one_niche');
  const [selectedDuration, setSelectedDuration] = useState(3);
  const [isLifetime, setIsLifetime] = useState(false);
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(false);
  const [autoRenewMethod, setAutoRenewMethod] = useState<'wallet' | 'card'>('wallet');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  
  // Confirmation modals
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteCardConfirm, setShowDeleteCardConfirm] = useState<string | null>(null);

  // Expiration check
  const isExpired = subscription ? new Date() > new Date(subscription.expires_at) : false;
  const daysUntilExpiry = subscription 
    ? Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    // ── GUARD: never attempt a query without a user id ───────────────────────
    // Previously, returning early here without calling setIsLoading(false)
    // left the spinner running forever. Now we always exit the loading state.
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // Load subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error loading subscription:', subError);
      }

      if (subData) {
        setSubscription(subData);
        setAutoRenewEnabled(subData.auto_renew || false);
        if (subData.auto_renew_method) {
          setAutoRenewMethod(subData.auto_renew_method);
        }
      }

      // Load saved cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('saved_cards')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (cardsError) {
        console.error('Error loading cards:', cardsError);
      } else if (cardsData) {
        setSavedCards(cardsData.map((c: any) => ({
          id: c.id,
          user_id: c.user_id,
          paystack_authorization_code: c.paystack_authorization_code,
          last4: c.last4,
          brand: c.brand,
          exp_month: c.exp_month,
          exp_year: c.exp_year,
          is_default: c.is_default,
          is_active: c.is_active,
          created_at: c.created_at,
          updated_at: c.updated_at,
        })));
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Failed to load subscription data');
    }
    setIsLoading(false);
  };

  const calculatePrice = () => {
    const basePrice = TIER_CONFIG[selectedTier].monthlyPrice;
    
    if (isLifetime) {
      return { 
        total: LIFETIME_PRICES[selectedTier as keyof typeof LIFETIME_PRICES] || 0, 
        original: LIFETIME_PRICES[selectedTier as keyof typeof LIFETIME_PRICES] || 0,
        savings: 0,
        isLifetime: true 
      };
    }

    const plan = DURATION_DISCOUNTS.find(d => d.months === selectedDuration);
    const multiplier = plan?.multiplier || 1;
    const originalPrice = basePrice * selectedDuration;
    const discountedPrice = Math.round(basePrice * multiplier);

    return {
      total: discountedPrice,
      original: originalPrice,
      savings: originalPrice - discountedPrice,
      isLifetime: false,
    };
  };

  const handleSubscribe = async () => {
    if (!user?.email) {
      toast.error('User email not found');
      return;
    }

    const pricing = calculatePrice();

    if (autoRenewEnabled && autoRenewMethod === 'card' && !pricing.isLifetime) {
      if (savedCards.length === 0) {
        toast.error('Please add a card first for auto-renewal');
        setShowAddCardModal(true);
        return;
      }
      if (!selectedCardId) {
        toast.error('Please select a saved card for auto-renewal');
        return;
      }
    }

    setIsProcessing(true);

    try {
      await loadPaystackScript();
      
      const reference = generateReference(pricing.isLifetime ? 'LIFE' : 'SUB');
      
      let authorizationCode = null;
      if (autoRenewEnabled && autoRenewMethod === 'card' && selectedCardId) {
        const selectedCard = savedCards.find(c => c.id === selectedCardId);
        authorizationCode = selectedCard?.paystack_authorization_code;
      }
      
      sessionStorage.setItem('payment_intent', JSON.stringify({
        type: 'subscription',
        tier: selectedTier,
        duration_months: pricing.isLifetime ? 9999 : selectedDuration,
        is_lifetime: pricing.isLifetime,
        auto_renew: autoRenewEnabled && !pricing.isLifetime,
        auto_renew_method: autoRenewMethod,
        authorization_code: authorizationCode,
        reference,
      }));

      const paymentChannels = (autoRenewEnabled && !pricing.isLifetime) ? ['card'] : undefined;

      initializePayment({
        email: user.email,
        amount: toKobo(pricing.total),
        reference,
        channels: paymentChannels,
        metadata: {
          user_id: user.id,
          tier: selectedTier,
          duration_months: pricing.isLifetime ? 9999 : selectedDuration,
          is_lifetime: pricing.isLifetime,
          auto_renew: autoRenewEnabled && !pricing.isLifetime,
          auto_renew_method: autoRenewMethod,
          authorization_code: authorizationCode,
          requires_authorization: autoRenewEnabled && !pricing.isLifetime,
        },
        onSuccess: (response) => {
          toast.success('Payment successful! Processing...');
          processSuccessfulPayment(response.reference, pricing);
        },
        // ── SAFE CANCEL HANDLER ──────────────────────────────────────────────
        // We do NOT assume the payment failed when the popup closes.
        // For large amounts in test mode, Paystack can show an "insufficient
        // funds" error, close the popup (firing onClose/onCancel), yet still
        // process the charge internally. The webhook is the safety net for
        // this case. We tell the user to wait and refresh rather than leaving
        // them confused if their subscription activates a moment later.
        onCancel: () => {
          setIsProcessing(false);
          toast.info(
            'Payment window closed. If you completed payment, your subscription will activate shortly — please refresh in a moment.',
            { duration: 6000 }
          );
        },
      });
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Failed to initialize payment');
      setIsProcessing(false);
    }
  };

  const processSuccessfulPayment = async (reference: string, pricing: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-subscription-payment', {
        body: {
          reference,
          user_id: user?.id,
          tier: selectedTier,
          duration_months: pricing.isLifetime ? 9999 : selectedDuration,
          is_lifetime: pricing.isLifetime,
          auto_renew: autoRenewEnabled && !pricing.isLifetime,
          auto_renew_method: autoRenewMethod,
          amount: pricing.total,
          requires_authorization: autoRenewEnabled && !pricing.isLifetime,
        },
      });

      if (error) throw error;

      toast.success(pricing.isLifetime ? 'Lifetime access activated!' : 'Subscription renewed!');
      setShowUpgradeModal(false);
      loadData();
    } catch (err) {
      console.error('Verification error:', err);
      toast.error('Payment verified but failed to activate. Contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!subscription) return;
    
    setIsProcessing(true);
    try {
      const newValue = !autoRenewEnabled;
      
      const updates: any = { 
        auto_renew: newValue,
      };
      
      if (newValue) {
        updates.auto_renew_method = autoRenewMethod;
      } else {
        updates.auto_renew_method = null;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', subscription.id);

      if (error) throw error;

      setAutoRenewEnabled(newValue);
      toast.success(newValue ? 'Auto-renewal enabled' : 'Auto-renewal disabled');
    } catch (err: any) {
      console.error('Auto-renew toggle error:', err);
      toast.error(err.message || 'Failed to update auto-renewal');
    }
    setIsProcessing(false);
  };

  const handleAutoRenewMethodChange = async (method: 'wallet' | 'card') => {
    setAutoRenewMethod(method);
    
    if (subscription && autoRenewEnabled) {
      try {
        await supabase
          .from('subscriptions')
          .update({ auto_renew_method: method })
          .eq('id', subscription.id);
        toast.success(`Auto-renewal set to use ${method === 'wallet' ? 'wallet balance' : 'saved card'}`);
      } catch (err: any) {
        toast.error('Failed to update payment method');
      }
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          cancel_at_period_end: true,
          auto_renew: false,
        })
        .eq('id', subscription.id);

      if (error) throw error;

      setSubscription(prev => prev ? { ...prev, cancel_at_period_end: true } : null);
      toast.success('Subscription will be cancelled at the end of the billing period');
      setShowCancelConfirm(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel subscription');
    }
    setIsProcessing(false);
  };

  const handleAddCard = async () => {
    if (!user?.email) {
      toast.error('Email not found');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      await loadPaystackScript();
      const reference = generateReference('CARD');
      
      const handlePaymentSuccess = async (response: any) => {
        try {
          console.log('Paystack success response:', response);
          
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-and-save-card', {
            body: { 
              reference: response.reference, 
              user_id: user.id 
            },
          });
          
          if (verifyError) throw verifyError;
          
          toast.success('Card saved successfully');
          setShowAddCardModal(false);
          await loadData();
        } catch (err: any) {
          console.error('Save card error:', err);
          toast.error(err.message || 'Failed to save card');
        } finally {
          setIsProcessing(false);
        }
      };
      
      const handlePaymentCancel = () => {
        toast.info('Card addition cancelled');
        setIsProcessing(false);
      };

      initializePayment({
        email: user.email,
        amount: 5000, // ₦50 in kobo
        reference,
        metadata: {
          user_id: user.id,
          type: 'card_tokenization',
        },
        channels: ['card'],
        onSuccess: handlePaymentSuccess,
        onCancel: handlePaymentCancel,
      });
      
    } catch (err: any) {
      console.error('Add card initialization error:', err);
      toast.error(err.message || 'Failed to initialize card payment');
      setIsProcessing(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from('saved_cards')
        .update({ is_active: false })
        .eq('id', cardId);

      if (error) throw error;
      
      setSavedCards(prev => prev.filter(c => c.id !== cardId));
      if (selectedCardId === cardId) setSelectedCardId(null);
      toast.success('Card removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove card');
    }
    setShowDeleteCardConfirm(null);
  };

  const formatPrice = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₦0';
    return `₦${amount.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // ── NO SUBSCRIPTION STATE ────────────────────────────────────────────────
  // This now renders correctly for the admin and any user whose subscription
  // row is missing. The upgrade modal is immediately accessible so they are
  // never stuck — they can subscribe from this screen directly.
  if (!subscription) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your plan, billing, and payment methods</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center"
        >
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Active Subscription</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Choose a plan to activate your store and start selling.
          </p>
          <Button
            onClick={() => setShowUpgradeModal(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8"
          >
            <Crown className="w-4 h-4 mr-2" />
            View Plans
          </Button>
        </motion.div>

        {/* Upgrade Modal — rendered here too so it works from the empty state */}
        <AnimatePresence>
          {showUpgradeModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Choose a Plan</h3>

                  {/* Tier Selection */}
                  <div className="grid gap-3 mb-6">
                    {Object.entries(TIER_CONFIG).filter(([key]) => key !== 'free').map(([key, tier]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedTier(key as keyof typeof TIER_CONFIG)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          selectedTier === key
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                            : 'border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {key === 'one_niche' && <Zap className="w-5 h-5 text-orange-500" />}
                            {key === 'three_niches' && <TrendingUp className="w-5 h-5 text-blue-500" />}
                            {key === 'unlimited' && <Crown className="w-5 h-5 text-purple-500" />}
                            <span className="font-semibold text-gray-900 dark:text-white">{tier.name}</span>
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {formatPrice(tier.monthlyPrice)}<span className="text-sm font-normal text-gray-500">/mo</span>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Billing Type Toggle */}
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
                    <button
                      onClick={() => setIsLifetime(false)}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                        !isLifetime ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Monthly/Yearly
                    </button>
                    <button
                      onClick={() => setIsLifetime(true)}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                        isLifetime ? 'bg-white dark:bg-gray-600 shadow-sm text-orange-600' : 'text-gray-500'
                      }`}
                    >
                      <InfinityIcon className="w-4 h-4 inline mr-1" />
                      Lifetime
                    </button>
                  </div>

                  {/* Duration Selection */}
                  {!isLifetime && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Duration</label>
                      <div className="grid grid-cols-2 gap-3">
                        {DURATION_DISCOUNTS.map((plan) => (
                          <button
                            key={plan.months}
                            onClick={() => setSelectedDuration(plan.months)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              selectedDuration === plan.months
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                : 'border-gray-200 dark:border-gray-600'
                            }`}
                          >
                            <p className="font-medium text-gray-900 dark:text-white">{plan.label}</p>
                            {plan.discount > 0 && (
                              <p className="text-sm text-green-600">Save {plan.discount}%</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price Summary */}
                  {(() => {
                    const p = calculatePrice();
                    return (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6">
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Plan</span>
                          <span className="text-gray-900 dark:text-white">{TIER_CONFIG[selectedTier].name}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Billing</span>
                          <span className="text-gray-900 dark:text-white">
                            {isLifetime ? 'Lifetime' : `${selectedDuration} months`}
                          </span>
                        </div>
                        {!isLifetime && p.savings > 0 && (
                          <div className="flex justify-between mb-2">
                            <span className="text-green-600">Discount</span>
                            <span className="text-green-600">-{formatPrice(p.savings)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                          <span className="font-medium text-gray-900 dark:text-white">Total</span>
                          <span className="font-bold text-xl text-orange-600">{formatPrice(p.total)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowUpgradeModal(false)} className="flex-1" disabled={isProcessing}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubscribe}
                      disabled={isProcessing}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {isProcessing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                      ) : (
                        <><CreditCard className="w-4 h-4 mr-2" />Pay {formatPrice(calculatePrice().total)}</>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const pricing = calculatePrice();
  const currentTier = subscription ? TIER_CONFIG[subscription.tier as keyof typeof TIER_CONFIG] : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your plan, billing, and payment methods</p>
      </div>

      {/* Expiration Warning Banner */}
      {subscription && (isExpired || daysUntilExpiry <= 3) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-4 flex items-center gap-3 ${
            isExpired 
              ? 'bg-red-50 border border-red-200 text-red-800' 
              : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
          }`}
        >
          <AlertCircle className={`w-6 h-6 ${isExpired ? 'text-red-600' : 'text-yellow-600'}`} />
          <div className="flex-1">
            <p className="font-semibold">
              {isExpired ? 'Your plan has expired' : `Your plan expires in ${daysUntilExpiry} days`}
            </p>
            <p className="text-sm">
              {isExpired 
                ? 'Renew now to restore access to your store and products.' 
                : 'Renew now to avoid interruption to your store.'}
            </p>
          </div>
          <Button 
            onClick={() => setShowUpgradeModal(true)}
            className={isExpired ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}
          >
            {isExpired ? 'Renew Now' : 'Extend Plan'}
          </Button>
        </motion.div>
      )}

      {/* Current Plan Card */}
      {subscription && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5" />
                <span className="font-medium">Current Plan</span>
                {subscription.is_trial && (
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Trial</span>
                )}
              </div>
              <h2 className="text-3xl font-bold mb-1">{currentTier?.name || 'Free'}</h2>
              <p className="text-orange-100">
                {subscription.tier === 'free' 
                  ? 'Free Plan (7 days)'
                  : subscription.duration_months === 9999
                  ? 'Lifetime Access'
                  : subscription.cancel_at_period_end
                  ? `Cancels on ${formatDate(subscription.expires_at)}`
                  : `Renews on ${formatDate(subscription.expires_at)}`}
              </p>
              
              {subscription.tier !== 'free' && subscription.duration_months !== 9999 && (
                <SubscriptionProgressBar 
                  startDate={subscription.starts_at} 
                  endDate={subscription.expires_at} 
                />
              )}
              
              {subscription.cancel_at_period_end && (
                <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-red-500/20 rounded-full text-sm text-white">
                  <AlertTriangle className="w-4 h-4" />
                  Cancelling at period end
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">
                {subscription.tier === 'free' ? '₦0' : formatPrice(subscription.amount_paid)}
              </p>
              <p className="text-orange-100">
                {subscription.duration_months === 9999 ? 'One-time' : `/ ${subscription.duration_months} months`}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Auto-Renewal Settings */}
      {subscription && subscription.tier !== 'free' && subscription.duration_months !== 9999 && !isExpired && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Auto-Renewal</h3>
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Automatic Renewal</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {autoRenewEnabled ? 'Your subscription renews automatically' : 'Enable to avoid interruption'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleAutoRenew}
              disabled={isProcessing}
              className="relative disabled:opacity-50 transition-transform active:scale-95"
            >
              {autoRenewEnabled ? (
                <ToggleRight className="w-14 h-8 text-green-500" />
              ) : (
                <ToggleLeft className="w-14 h-8 text-gray-400" />
              )}
            </button>
          </div>

          <AnimatePresence>
            {autoRenewEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-3 overflow-hidden"
              >
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method for Auto-Renewal</p>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAutoRenewMethodChange('wallet')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      autoRenewMethod === 'wallet'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className={`w-5 h-5 ${autoRenewMethod === 'wallet' ? 'text-orange-500' : 'text-gray-400'}`} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Wallet Balance</p>
                        <p className="text-sm text-gray-500">
                          Current: {walletBalance !== undefined ? formatPrice(walletBalance) : 'Loading...'}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleAutoRenewMethodChange('card')}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      autoRenewMethod === 'card'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className={`w-5 h-5 ${autoRenewMethod === 'card' ? 'text-orange-500' : 'text-gray-400'}`} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Saved Card</p>
                        <p className="text-sm text-gray-500">
                          {savedCards.length > 0 ? `${savedCards.length} card(s) saved` : 'No cards saved'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {autoRenewMethod === 'card' && savedCards.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Select default card:</p>
                    {savedCards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedCardId === card.id
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                            : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">•••• {card.last4}</p>
                            <p className="text-xs text-gray-500">Expires {card.exp_month}/{card.exp_year}</p>
                          </div>
                        </div>
                        {card.is_default && (
                          <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full">Default</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Saved Payment Methods */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h3>
          <Button
            onClick={() => setShowAddCardModal(true)}
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-600 hover:bg-orange-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Card
          </Button>
        </div>

        {savedCards.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No saved cards</p>
            <p className="text-sm">Add a card for faster checkout</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-[10px] font-bold text-white">
                    {card.brand}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">•••• {card.last4}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Expires {card.exp_month}/{card.exp_year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {card.is_default && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Default</span>
                  )}
                  <button
                    onClick={() => setShowDeleteCardConfirm(card.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Change Plan Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Plan</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(TIER_CONFIG).filter(([key]) => key !== 'free').map(([key, tier]) => (
            <div
              key={key}
              className={`p-4 rounded-xl border-2 transition-all ${
                subscription?.tier === key
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                  : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {key === 'one_niche' && <Zap className="w-5 h-5 text-orange-500" />}
                {key === 'three_niches' && <TrendingUp className="w-5 h-5 text-blue-500" />}
                {key === 'unlimited' && <Crown className="w-5 h-5 text-purple-500" />}
                <h4 className="font-semibold text-gray-900 dark:text-white">{tier.name}</h4>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatPrice(tier.monthlyPrice)}
                <span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {tier.niches === Infinity ? 'Unlimited niches' : `${tier.niches} niche${tier.niches > 1 ? 's' : ''}`}
              </p>
              <Button
                onClick={() => {
                  setSelectedTier(key as keyof typeof TIER_CONFIG);
                  setShowUpgradeModal(true);
                }}
                disabled={subscription?.tier === key}
                variant={subscription?.tier === key ? 'default' : 'outline'}
                className="w-full"
              >
                {subscription?.tier === key ? 'Current Plan' : 'Select'}
              </Button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Cancel Subscription */}
      {subscription && subscription.tier !== 'free' && !subscription.cancel_at_period_end && !isExpired && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800 p-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-300">Cancel Subscription</h3>
              <p className="text-sm text-red-600 dark:text-red-400">
                Your store will remain active until the end of your billing period
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirm(true)}
              className="border-red-300 text-red-600 hover:bg-red-100"
            >
              Cancel Subscription
            </Button>
          </div>
        </motion.div>
      )}

      {/* Upgrade/Subscribe Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  {subscription?.tier === selectedTier ? 'Extend Subscription' : `Upgrade to ${TIER_CONFIG[selectedTier].name}`}
                </h3>

                {/* Billing Type Toggle */}
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
                  <button
                    onClick={() => setIsLifetime(false)}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                      !isLifetime ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    Monthly/Yearly
                  </button>
                  <button
                    onClick={() => setIsLifetime(true)}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                      isLifetime ? 'bg-white dark:bg-gray-600 shadow-sm text-orange-600' : 'text-gray-500'
                    }`}
                  >
                    <InfinityIcon className="w-4 h-4 inline mr-1" />
                    Lifetime
                  </button>
                </div>

                {/* Duration Selection */}
                {!isLifetime && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Duration</label>
                    <div className="grid grid-cols-2 gap-3">
                      {DURATION_DISCOUNTS.map((plan) => (
                        <button
                          key={plan.months}
                          onClick={() => setSelectedDuration(plan.months)}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            selectedDuration === plan.months
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <p className="font-medium text-gray-900 dark:text-white">{plan.label}</p>
                          {plan.discount > 0 && (
                            <p className="text-sm text-green-600">Save {plan.discount}%</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Summary */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Plan</span>
                    <span className="text-gray-900 dark:text-white">{TIER_CONFIG[selectedTier].name}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Billing</span>
                    <span className="text-gray-900 dark:text-white">
                      {isLifetime ? 'Lifetime' : `${selectedDuration} months`}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Original Price</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.original)}</span>
                  </div>
                  {!isLifetime && pricing.savings > 0 && (
                    <div className="flex justify-between mb-2">
                      <span className="text-green-600">Discount</span>
                      <span className="text-green-600">-{formatPrice(pricing.savings)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                    <span className="font-medium text-gray-900 dark:text-white">Total</span>
                    <span className="font-bold text-xl text-orange-600">{formatPrice(pricing.total)}</span>
                  </div>
                </div>

                {/* Auto-renew for monthly */}
                {!isLifetime && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Auto-Renewal</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Automatically renew at the end of the period</p>
                      </div>
                      <button onClick={() => setAutoRenewEnabled(!autoRenewEnabled)} className="relative">
                        {autoRenewEnabled ? (
                          <ToggleRight className="w-14 h-8 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-14 h-8 text-gray-400" />
                        )}
                      </button>
                    </div>

                    {autoRenewEnabled && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Auto-renewal requires card payment. Other payment methods will be disabled.
                        </p>
                      </div>
                    )}

                    <AnimatePresence>
                      {autoRenewEnabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3 overflow-hidden"
                        >
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method for Auto-Renewal</p>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => setAutoRenewMethod('wallet')}
                              className={`p-3 rounded-lg border-2 text-left transition-all ${
                                autoRenewMethod === 'wallet'
                                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                  : 'border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <Wallet className={`w-5 h-5 mb-2 ${autoRenewMethod === 'wallet' ? 'text-orange-500' : 'text-gray-400'}`} />
                              <p className="font-medium text-gray-900 dark:text-white text-sm">Wallet</p>
                              <p className="text-xs text-gray-500">
                                {walletBalance !== undefined ? formatPrice(walletBalance) : '...'} available
                              </p>
                            </button>

                            <button
                              onClick={() => setAutoRenewMethod('card')}
                              className={`p-3 rounded-lg border-2 text-left transition-all ${
                                autoRenewMethod === 'card'
                                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                  : 'border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <CreditCard className={`w-5 h-5 mb-2 ${autoRenewMethod === 'card' ? 'text-orange-500' : 'text-gray-400'}`} />
                              <p className="font-medium text-gray-900 dark:text-white text-sm">Card</p>
                              <p className="text-xs text-gray-500">{savedCards.length} saved</p>
                            </button>
                          </div>

                          {autoRenewMethod === 'card' && savedCards.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-sm text-gray-600 dark:text-gray-400">Select default card:</p>
                              {savedCards.map((card) => (
                                <div
                                  key={card.id}
                                  onClick={() => setSelectedCardId(card.id)}
                                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                                    selectedCardId === card.id
                                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                                      : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-5 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-[10px] font-bold text-white">
                                      {card.brand}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white text-sm">•••• {card.last4}</p>
                                      <p className="text-xs text-gray-500">Expires {card.exp_month}/{card.exp_year}</p>
                                    </div>
                                  </div>
                                  {selectedCardId === card.id && <Check className="w-4 h-4 text-orange-500" />}
                                </div>
                              ))}
                            </div>
                          )}

                          {autoRenewMethod === 'card' && savedCards.length === 0 && (
                            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                No saved cards. Add a card in Payment Methods first.
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800 pt-2 pb-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowUpgradeModal(false)}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubscribe}
                    disabled={
                      isProcessing || 
                      (autoRenewEnabled && autoRenewMethod === 'card' && savedCards.length === 0 && !isLifetime)
                    }
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                    ) : (
                      <><CreditCard className="w-4 h-4 mr-2" />Pay {formatPrice(pricing.total)}</>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cancel Subscription?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Your subscription will remain active until{' '}
                  <strong>{subscription?.expires_at ? formatDate(subscription.expires_at) : 'the end of your billing period'}</strong>.
                  After that, you will lose access to premium features.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowCancelConfirm(false)} className="flex-1">
                  Keep Subscription
                </Button>
                <Button
                  onClick={handleCancelSubscription}
                  disabled={isProcessing}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</>
                  ) : (
                    'Yes, Cancel'
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Card Confirmation Modal */}
      <AnimatePresence>
        {showDeleteCardConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Remove Card?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Are you sure you want to remove this {savedCards.find(c => c.id === showDeleteCardConfirm)?.brand} card
                  ending in <strong>{savedCards.find(c => c.id === showDeleteCardConfirm)?.last4}</strong>?
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowDeleteCardConfirm(null)} className="flex-1">
                  Keep Card
                </Button>
                <Button
                  onClick={() => handleDeleteCard(showDeleteCardConfirm)}
                  disabled={isProcessing}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Removing...</>
                  ) : (
                    'Remove'
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Card Modal */}
      <AnimatePresence>
        {showAddCardModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Add Payment Card</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Add a card for faster checkout and auto-renewal.
                  A temporary charge of ₦50 will be made to verify your card and refunded immediately.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowAddCardModal(false)}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddCard}
                  disabled={isProcessing}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" />Add Card</>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}