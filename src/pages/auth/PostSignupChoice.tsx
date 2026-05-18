import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Sparkles, CreditCard, Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { subscriptionService, storeService, supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores';
import { OnboardingProgress } from './NicheSelectionPage';
import { toast } from 'sonner';

function clearOnboardingStorage() {
  sessionStorage.removeItem('onboarding_store_id');
  sessionStorage.removeItem('selected_niches');
  sessionStorage.removeItem('signup_email');
  sessionStorage.removeItem('signup_full_name');
  sessionStorage.removeItem('signup_phone');
}

export default function PostSignupChoice() {
  const navigate = useNavigate();
  const { user, updateOnboardingStep } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [hasUsedFreePlan, setHasUsedFreePlan] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const storedStoreId = sessionStorage.getItem('onboarding_store_id');
    if (!storedStoreId || !user) {
      navigate('/signup');
      return;
    }
    setStoreId(storedStoreId);
    
    // Check if user has already used free plan
    checkFreePlanUsage();
  }, [user, navigate]);

  const checkFreePlanUsage = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('tier', 'free')
        .maybeSingle();
      
      if (data) {
        setHasUsedFreePlan(true);
      }
    } catch (err) {
      console.error('Error checking free plan usage:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleStartTrial = async () => {
    if (!user || !storeId) return;
    
    if (hasUsedFreePlan) {
      toast.error('You have already used the free plan. Please choose a paid plan.');
      return;
    }

    setIsLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 4); // 4 days free trial

      const { error } = await subscriptionService.createSubscription({
        user_id: user.id,
        store_id: storeId,
        tier: 'free',
        is_trial: true,
        // FIXED: Removed is_free_plan: true - column doesn't exist in database schema
        starts_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        duration_months: 0,
        amount_paid: 0,
        niches: JSON.parse(sessionStorage.getItem('selected_niches') || '[]'),
        auto_renew: false,
        payment_reference: 'FREE_TRIAL',
      });

      if (error) {
        console.error('Subscription creation error:', error);
        throw error;
      }

      // Activate the store
      const { error: storeError } = await storeService.updateStore(storeId, { is_active: true });
      
      if (storeError) {
        console.error('Store activation error:', storeError);
        throw storeError;
      }
      
      // Update onboarding step to 4 (plan selected) and mark as complete
      const { error: onboardingError } = await updateOnboardingStep(4, true);
      
      if (onboardingError) {
        console.error('Onboarding update error:', onboardingError);
        throw onboardingError;
      }

      toast.success('Free plan activated! You have 4 days to explore.');
      clearOnboardingStorage();
      
      // Small delay to ensure state updates propagate
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
      
    } catch (err: any) {
      console.error('Trial activation error:', err);
      toast.error(err?.message || 'Failed to activate free plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayNow = () => {
    navigate('/pricing');
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4">
      {/* Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
          </div>
        </div>

        <OnboardingProgress step={4} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Choose Your Path</h1>
            <p className="text-gray-600 text-lg">
              Start selling immediately with your free plan or subscribe now
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free Plan */}
            <motion.div
              whileHover={{ scale: hasUsedFreePlan ? 1 : 1.02 }}
              className={`bg-white rounded-2xl shadow-xl border-2 p-8 relative overflow-hidden ${
                hasUsedFreePlan ? 'border-gray-200 opacity-75' : 'border-orange-100'
              }`}
            >
              {!hasUsedFreePlan && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  RECOMMENDED
                </div>
              )}

              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="w-7 h-7 text-orange-500" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Start Free Plan</h2>
              <div className="text-3xl font-bold text-orange-600 mb-4">₦0</div>
              <p className="text-gray-600 mb-6">
                Get full access to start selling with 1 niche for 4 days. No credit card required.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  { icon: CheckCircle, color: 'text-green-500', text: '1 Niche selection' },
                  { icon: CheckCircle, color: 'text-green-500', text: 'Unlimited products' },
                  { icon: CheckCircle, color: 'text-green-500', text: 'All features included' },
                  { icon: Clock,       color: 'text-orange-500', text: '4 days duration'   },
                ].map(({ icon: Icon, color, text }) => (
                  <li key={text} className="flex items-center gap-2 text-sm text-gray-700">
                    <Icon className={`w-5 h-5 ${color}`} />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

            {hasUsedFreePlan ? (
  <div className="space-y-3">
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <p className="text-sm text-amber-700">Free plan already used on this account</p>
    </div>
    <Button
      onClick={() => {
        clearOnboardingStorage();
        navigate('/dashboard');
      }}
      className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-lg font-semibold"
    >
      Continue with Free Plan →
    </Button>
  </div>
) : (
                <Button
                  onClick={handleStartTrial}
                  disabled={isLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-lg"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Free Plan'}
                </Button>
              )}
            </motion.div>

            {/* Pay Now */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8"
            >
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <CreditCard className="w-7 h-7 text-gray-600" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscribe Now</h2>
              <div className="text-3xl font-bold text-gray-900 mb-4">From ₦5,000</div>
              <p className="text-gray-600 mb-6">
                Choose a plan that fits your business. Upgrade or downgrade anytime.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  '1, 3, or Unlimited niches',
                  'Unlimited products',
                  'Priority support',
                  'No expiration',
                ].map((text) => (
                  <li key={text} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={handlePayNow}
                variant="outline"
                className="w-full border-2 border-gray-300 hover:border-orange-500 hover:text-orange-600 h-12 text-lg"
              >
                View Plans & Pricing
              </Button>
            </motion.div>
          </div>

          <p className="text-center mt-8 text-sm text-gray-500">
            {hasUsedFreePlan 
              ? 'Free plan can only be used once per account.'
              : 'You can upgrade anytime during or after your free plan.'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}