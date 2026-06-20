import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBag, Sparkles, CreditCard,
  Loader2, CheckCircle, Clock, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { useAuthStore } from '@/stores';
import OnboardingProgress from './NicheSelectionPage'
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingData {
  step:            number;
  selected_niches: string[];
  store_id:        string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PostSignupChoice() {
  const navigate                       = useNavigate();
  // Pull both user and the store setter so we can update auth state directly
  const { user, updateOnboardingStep } = useAuthStore();
  const userId                         = user?.id;

  const [onboardingData, setOnboardingData]   = useState<OnboardingData | null>(null);
  const [hasUsedFreePlan, setHasUsedFreePlan] = useState(false);
  const [isChecking, setIsChecking]           = useState(true);
  const [isActivating, setIsActivating]       = useState(false);

  // ── Load state — stable dep ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { navigate('/login'); return; }
    let cancelled = false;

    const load = async () => {
      try {
        const [profileRes, subRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('onboarding_data')
            .eq('id', userId)
            .single(),
          supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('tier', 'free')
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const saved = profileRes.data?.onboarding_data as OnboardingData | null;

        if (!saved?.store_id || !saved?.selected_niches?.length) {
          toast.error('Please complete the previous steps first.');
          navigate(saved?.selected_niches?.length ? '/onboarding/store-setup' : '/select-niche');
          return;
        }

        setOnboardingData(saved);
        setHasUsedFreePlan(!!subRes.data);
      } catch (err) {
        console.error('Failed to load onboarding state:', err);
        toast.error('Could not load your progress. Please try again.');
        navigate('/select-niche');
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userId, navigate]); // ← primitive, not full user object

  // ── Activate free trial ────────────────────────────────────────────────────
  const handleStartTrial = async () => {
    if (!user || !onboardingData) return;
    if (hasUsedFreePlan) {
      toast.error('Free plan already used. Please choose a paid plan.');
      return;
    }

    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired. Please sign in again.');
        navigate('/login');
        return;
      }

      // Call complete-onboarding edge function
      const res = await supabase.functions.invoke('complete-onboarding', {
        body: {
          store_id:        onboardingData.store_id,
          selected_niches: onboardingData.selected_niches,
          plan:            'free',
        },
      });

      if (res.error) throw res.error;

      // ── FIX: use updateOnboardingStep from authStore so isAuthenticated
      //    is set to true in the store — this stops ProtectedRoute from
      //    redirecting back to /select-niche ──────────────────────────────
      const { error: stepError } = await updateOnboardingStep(4, true);
      if (stepError) throw new Error(stepError);

      // Also persist the completed state to onboarding_data
      await supabase
        .from('profiles')
        .update({
          onboarding_data: { ...onboardingData, step: 4, completed: true },
        })
        .eq('id', user.id);

      toast.success('Free plan activated! You have 4 days to explore.');

      // Small delay so Zustand state propagates before route check
      setTimeout(() => navigate('/dashboard'), 300);
    } catch (err: any) {
      console.error('Trial activation error:', err);
      toast.error(err?.message || 'Failed to activate free plan. Please try again.');
    } finally {
      setIsActivating(false);
    }
  };

  // ── If free plan already used: let them continue with existing store ───────
  const handleContinueExisting = () => {
    // They already have a store + subscription from a prior session
    // Just mark onboarding complete in the store and go to dashboard
    updateOnboardingStep(4, true).then(() => {
      navigate('/dashboard');
    });
  };

  const handlePayNow = () => navigate('/pricing');

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p className="text-sm text-gray-500">Loading your options…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
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
          transition={{ duration: 0.4 }}
        >
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Choose Your Path</h1>
            <p className="text-gray-600 text-lg">
              Start selling immediately with your free plan or subscribe now.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* ── Free Plan card ── */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`bg-white rounded-2xl shadow-xl border-2 p-8 relative overflow-hidden ${
                hasUsedFreePlan ? 'border-gray-200' : 'border-orange-100'
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
                Full access to start selling with 1 niche for 4 days. No credit card required.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  { icon: CheckCircle, color: 'text-green-500',  text: '1 Niche selection'    },
                  { icon: CheckCircle, color: 'text-green-500',  text: 'Unlimited products'    },
                  { icon: CheckCircle, color: 'text-green-500',  text: 'All features included' },
                  { icon: Clock,       color: 'text-orange-500', text: '4-day trial duration'  },
                ].map(({ icon: Icon, color, text }) => (
                  <li key={text} className="flex items-center gap-2 text-sm text-gray-700">
                    <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                    {text}
                  </li>
                ))}
              </ul>

              {hasUsedFreePlan ? (
                // ── FIX: restored "Continue to Dashboard" button ──────────
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-sm text-amber-700">Free plan already used on this account.</p>
                  </div>
                  <Button
                    onClick={handleContinueExisting}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-lg font-semibold"
                  >
                    Continue to Dashboard →
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleStartTrial}
                  disabled={isActivating}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-lg"
                >
                  {isActivating ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Activating…
                    </span>
                  ) : (
                    'Start Free Plan'
                  )}
                </Button>
              )}
            </motion.div>

            {/* ── Subscribe card ── */}
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
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {text}
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
              ? 'The free plan can only be used once per account.'
              : 'You can upgrade anytime during or after your free plan.'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
