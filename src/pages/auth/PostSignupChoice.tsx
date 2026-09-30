import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBag, Sparkles, CheckCircle, Loader2, Users, GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import { toast } from 'sonner';

interface OnboardingData {
  step:            number;
  selected_niches: string[];
  store_id:        string;
}

// Flat promotional price for every new store — replaces the old 4-day free
// trial. Paid the same way as any other subscription (Paystack -> the
// existing PaymentCallbackPage activation flow), just with a fixed
// amount/duration instead of the regular per-plan pricing formula.
const STARTER_PACK_AMOUNT_NGN = 5000;
const STARTER_PACK_DURATION_MONTHS = 3;

export default function PostSignupChoice() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId    = user?.id;

  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [userEmail, setUserEmail]           = useState('');
  const [isChecking, setIsChecking]         = useState(true);
  const [isPaying, setIsPaying]             = useState(false);

  useEffect(() => {
    if (!userId) { navigate('/login'); return; }
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_data, email')
          .eq('id', userId)
          .single();

        if (cancelled) return;
        if (error) throw error;

        const saved = data?.onboarding_data as OnboardingData | null;

        if (!saved?.store_id || !saved?.selected_niches?.length) {
          toast.error('Please complete the previous steps first.');
          navigate(saved?.selected_niches?.length ? '/onboarding/store-setup' : '/select-niche');
          return;
        }

        setOnboardingData(saved);
        setUserEmail(data?.email ?? user?.email ?? '');
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
  }, [userId, navigate, user?.email]);

  const handleStartStarterPack = async () => {
    if (!onboardingData) return;

    setIsPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired. Please sign in again.');
        navigate('/login');
        return;
      }

      await loadPaystackScript();
      const reference = generateReference('STARTER');

      // Short-lived — read back by PaymentCallbackPage right after the
      // Paystack redirect, same pattern as a normal subscription purchase.
      sessionStorage.setItem('subscription_plan',     'one_niche');
      sessionStorage.setItem('subscription_duration', STARTER_PACK_DURATION_MONTHS.toString());
      sessionStorage.setItem('subscription_amount',   STARTER_PACK_AMOUNT_NGN.toString());
      sessionStorage.setItem('payment_reference',     reference);
      sessionStorage.setItem('is_lifetime',           'false');

      initializePayment({
        email:  userEmail,
        amount: toKobo(STARTER_PACK_AMOUNT_NGN),
        reference,
        metadata: {
          plan:        'one_niche',
          duration:    STARTER_PACK_DURATION_MONTHS,
          niches:      onboardingData.selected_niches,
          store_id:    onboardingData.store_id,
          is_lifetime: false,
          is_starter_pack: true,
        },
        onSuccess: (response) => {
          toast.success('Payment successful!');
          navigate(`/payment/callback?reference=${response.reference}`);
        },
        onCancel: () => {
          setIsPaying(false);
          toast.info('Payment cancelled. You can try again.');
        },
      });
    } catch (err: any) {
      console.error('Starter pack payment error:', err);
      toast.error(err?.message || 'Payment initialization failed. Please try again.');
      setIsPaying(false);
    }
  };

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

      <div className="max-w-lg mx-auto relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Everyone starts here</h1>
            <p className="text-gray-600">
              A simple starter pack gets your store live and gives you three months
              to learn the platform, build your community, and start selling.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border-2 border-orange-100 p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
              STARTER PACK
            </div>

            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <Sparkles className="w-7 h-7 text-orange-500" />
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold text-gray-900">₦5,000</span>
              <span className="text-gray-500">/ 3 months</span>
            </div>
            <p className="text-gray-500 mb-6">
              That's enough time to get trained up, set up your store properly, and see
              your first real sales — before you ever think about upgrading.
            </p>

            <ul className="space-y-3 mb-8">
              {[
                { icon: GraduationCap, text: 'Full training on setting up and running your store' },
                { icon: Users,         text: 'Access to the seller community for support & tips' },
                { icon: CheckCircle,   text: '1 niche, unlimited products, all core features' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm text-gray-700">
                  <Icon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  {text}
                </li>
              ))}
            </ul>

            <Button
              onClick={handleStartStarterPack}
              disabled={isPaying}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-lg font-semibold"
            >
              {isPaying ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Processing…
                </span>
              ) : (
                'Get Started — ₦5,000'
              )}
            </Button>

            <p className="text-center text-xs text-gray-400 mt-4">
              Secure payment powered by Paystack
            </p>
          </div>

          <p className="text-center mt-6 text-sm text-gray-500">
            Already outgrowing the basics?{' '}
            <button onClick={() => navigate('/pricing')} className="text-orange-600 hover:text-orange-700 font-medium">
              View Growth &amp; Enterprise plans
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
