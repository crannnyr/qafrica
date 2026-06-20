import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, ShoppingBag, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyTransaction } from '@/services/paystack';
import { authService } from '@/services';
import { useAuthStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

export default function PaymentCallbackPage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateOnboardingStep } = useAuthStore();

  const [status, setStatus]           = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage]         = useState('Processing your request...');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    const processPayment = async () => {
      const reference = searchParams.get('reference');

      // Verify session
      const { session, error: sessionError } = await authService.getSession();
      if (sessionError || !session?.user) {
        setStatus('failed');
        setMessage('Session expired. Please log in again.');
        setErrorDetails('Your session has expired. Please sign in again to continue.');
        return;
      }

      const userId = session.user.id;

      // ── Load onboarding_data from Supabase — single source of truth ──────
      const { data: profileData } = await supabase
        .from('profiles')
        .select('onboarding_data, email')
        .eq('id', userId)
        .single();

      const onboardingData = profileData?.onboarding_data ?? {};
      const storeId        = onboardingData.store_id ?? null;
      const selectedNiches = onboardingData.selected_niches ?? [];

      if (!storeId || !selectedNiches.length) {
        setStatus('failed');
        setMessage('Missing onboarding data.');
        setErrorDetails('Could not find your store or niche selection. Please contact support.');
        return;
      }

      // ── Handle paid payment ───────────────────────────────────────────────
      if (!reference) {
        setStatus('failed');
        setMessage('Invalid payment reference.');
        setErrorDetails('No payment reference found. Please try again.');
        return;
      }

      try {
        setMessage('Verifying your payment...');
        const result = await verifyTransaction(reference);

        if (!result.success) {
          setStatus('failed');
          setMessage(result.error || 'Payment verification failed.');
          setErrorDetails('The payment could not be verified. Please contact support if you were charged.');
          toast.error('Payment verification failed.');
          return;
        }

        // Read payment metadata from sessionStorage
        // (written by PricingPage just before Paystack redirect — short-lived use)
        const plan     = sessionStorage.getItem('subscription_plan') ?? 'one_niche';
        const duration = parseInt(sessionStorage.getItem('subscription_duration') || '1');
        const amount   = parseInt(sessionStorage.getItem('subscription_amount') || '0');
        const isLifetime = sessionStorage.getItem('is_lifetime') === 'true';

        // Normalize tier
        const tierMap: Record<string, 'one_niche' | 'three_niches' | 'unlimited'> = {
          single:       'one_niche',
          one_niche:    'one_niche',
          three:        'three_niches',
          three_niches: 'three_niches',
          unlimited:    'unlimited',
        };
        const dbTier = tierMap[plan] ?? 'one_niche';

        setMessage('Activating your subscription...');

        // Create subscription directly (paid plan — not via complete-onboarding
        // which is free-plan only)
        const expiresAt = isLifetime
          ? new Date('2099-12-31').toISOString()
          : new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000).toISOString();

        const { error: subError } = await supabase
          .from('subscriptions')
          .insert({
            user_id:           userId,
            store_id:          storeId,
            tier:              dbTier,
            niches:            selectedNiches,
            duration_months:   isLifetime ? 0 : duration,
            amount_paid:       amount,
            payment_reference: reference,
            starts_at:         new Date().toISOString(),
            expires_at:        expiresAt,
            is_active:         true,
            is_trial:          false,
          });

        if (subError) {
          setStatus('failed');
          setMessage('Failed to activate subscription.');
          setErrorDetails(subError.message);
          return;
        }

        // Activate the store
        await supabase
          .from('stores')
          .update({ niches: selectedNiches, is_active: true })
          .eq('id', storeId);

        // Mark onboarding complete via authStore
        // so isAuthenticated becomes true and ProtectedRoute stops redirecting
        await updateOnboardingStep(4, true);

        // Also persist completed state to onboarding_data
        await supabase
          .from('profiles')
          .update({
            onboarding_data: {
              ...onboardingData,
              step: 4,
              completed: true,
              plan: dbTier,
            },
          })
          .eq('id', userId);

        // Clean up short-lived payment sessionStorage keys
        ['subscription_plan','subscription_duration','subscription_amount',
         'payment_reference','is_lifetime',
        ].forEach((key) => sessionStorage.removeItem(key));

        setStatus('success');
        setMessage('Your payment was successful! Welcome to QAFRICA.');
        toast.success('Payment successful! Your subscription is now active.');
      } catch (err: any) {
        console.error('Payment verification error:', err);
        setStatus('failed');
        setMessage('An error occurred while verifying your payment.');
        setErrorDetails('Please try again or contact support for assistance.');
        toast.error('Payment verification error.');
      }
    };

    processPayment();
  }, [searchParams, updateOnboardingStep]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          {status === 'verifying' && (
            <>
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing</h2>
              <p className="text-gray-500">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
              <p className="text-gray-500 mb-8">{message}</p>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/dashboard', { replace: true })}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Go to Dashboard
                </Button>
                <p className="text-sm text-gray-500 pt-2">
                  Your store is ready! Start adding products from your dashboard.
                </p>
              </div>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h2>
              <p className="text-gray-500 mb-4">{message}</p>
              {errorDetails && (
                <div className="bg-red-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-600">{errorDetails}</p>
                </div>
              )}
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/pricing')}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="w-full"
                >
                  Go to Login
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
