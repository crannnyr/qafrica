import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, ShoppingBag, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyTransaction } from '@/services/paystack';
import { subscriptionService, authService, userService } from '@/services/supabase';
import { useAuthStore } from '@/stores'; // NEW: Import auth store
import { toast } from 'sonner';

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('Processing your request...');
  const [errorDetails, setErrorDetails] = useState('');
  const { fetchProfile } = useAuthStore(); // NEW: Get auth store function

  useEffect(() => {
    const processPayment = async () => {
      const reference = searchParams.get('reference');
      const isTrial = searchParams.get('trial') === 'true';
      
      // Get current user session
      const { session, error: sessionError } = await authService.getSession();
      
      if (sessionError || !session?.user) {
        setStatus('failed');
        setMessage('Session expired. Please log in again.');
        setErrorDetails('Your session has expired. Please sign up or log in again to continue.');
        return;
      }

      const userId = session.user.id;
      
      // Handle Free Trial
      if (isTrial) {
        setMessage('Activating your free trial...');
        
        try {
          const niches = JSON.parse(sessionStorage.getItem('selected_niches') || '[]');
          const storeId = sessionStorage.getItem('onboarding_store_id');
          
          // Create free trial subscription (4 days)
          const trialSubscription = {
            user_id: userId,
            store_id: storeId || undefined,
            tier: 'free' as const,
            niches,
            duration_months: 0,
            amount_paid: 0,
            payment_reference: 'FREE_TRIAL',
            starts_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days
            is_active: true,
            is_trial: true,
          };

          const { error: subError } = await subscriptionService.createSubscription(trialSubscription);
          
          if (subError) {
            console.error('Trial subscription error:', subError);
            setStatus('failed');
            setMessage('Failed to activate trial');
            setErrorDetails(subError.message);
            return;
          }

          // Mark onboarding as completed in database
          await userService.updateProfile(userId, {
            onboarding_step: 4,
            onboarding_completed: true
          });

          // NEW: Refresh auth store to update user state before navigation
          await fetchProfile();

          // Clear session storage only after successful DB updates
          clearSessionData();

          setStatus('success');
          setMessage('Your 4-day free trial is active! Welcome to QAFRICA.');
          toast.success('Free trial activated! Enjoy exploring QAFRICA.');
        } catch (error) {
          console.error('Trial activation error:', error);
          setStatus('failed');
          setMessage('An error occurred while activating your trial');
          setErrorDetails('Please contact support if this issue persists.');
        }
        return;
      }
      
      // Handle Regular Payment
      if (!reference) {
        setStatus('failed');
        setMessage('Invalid payment reference');
        setErrorDetails('No payment reference was found. Please try again.');
        return;
      }

      try {
        setMessage('Verifying your payment...');
        
        // Verify the transaction with Paystack
        const result = await verifyTransaction(reference);
        
        if (result.success) {
          const plan = sessionStorage.getItem('subscription_plan');
          const duration = parseInt(sessionStorage.getItem('subscription_duration') || '1');
          const amount = parseInt(sessionStorage.getItem('subscription_amount') || '0');
          const niches = JSON.parse(sessionStorage.getItem('selected_niches') || '[]');
          const storeId = sessionStorage.getItem('onboarding_store_id');
          
          // Map plan IDs to correct DB tier values
          let dbTier: 'one_niche' | 'three_niches' | 'unlimited';
          if (plan === 'single' || plan === 'one_niche') {
            dbTier = 'one_niche';
          } else if (plan === 'three' || plan === 'three_niches') {
            dbTier = 'three_niches';
          } else if (plan === 'unlimited') {
            dbTier = 'unlimited';
          } else {
            dbTier = 'one_niche'; // fallback
          }
          
          // Create subscription record
          const subscriptionData = {
            user_id: userId,
            store_id: storeId || undefined,
            tier: dbTier,
            niches,
            duration_months: duration,
            amount_paid: amount,
            payment_reference: reference,
            starts_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000).toISOString(),
            is_active: true,
            is_trial: false,
          };

          const { error: subError } = await subscriptionService.createSubscription(subscriptionData);
          
          if (subError) {
            console.error('Subscription creation error:', subError);
            setStatus('failed');
            setMessage('Failed to activate subscription');
            setErrorDetails(subError.message);
            return;
          }

          // Mark onboarding as completed in database
          await userService.updateProfile(userId, {
            onboarding_step: 4,
            onboarding_completed: true
          });

          // NEW: Refresh auth store to update user state before navigation
          // This ensures the dashboard recognizes the user as authenticated
          await fetchProfile();

          // Clear session storage only after successful DB updates
          clearSessionData();

          setStatus('success');
          setMessage('Your payment was successful! Welcome to QAFRICA.');
          toast.success('Payment successful! Your subscription is now active.');
        } else {
          setStatus('failed');
          setMessage(result.error || 'Payment verification failed');
          setErrorDetails('The payment could not be verified. Please contact support if you were charged.');
          toast.error('Payment verification failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('failed');
        setMessage('An error occurred while verifying your payment');
        setErrorDetails('Please try again or contact support for assistance.');
        toast.error('Payment verification error');
      }
    };

    processPayment();
  }, [searchParams, navigate, fetchProfile]); // Added fetchProfile to dependencies

  const clearSessionData = () => {
    sessionStorage.removeItem('selected_niches');
    sessionStorage.removeItem('subscription_plan');
    sessionStorage.removeItem('subscription_duration');
    sessionStorage.removeItem('subscription_amount');
    sessionStorage.removeItem('payment_reference');
    sessionStorage.removeItem('onboarding_store_id');
    sessionStorage.removeItem('signup_email');
    sessionStorage.removeItem('signup_full_name');
    sessionStorage.removeItem('signup_phone');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      {/* Background Elements */}
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

        {/* Status Card */}
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
                <p className="text-sm text-gray-500 text-center pt-2">
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