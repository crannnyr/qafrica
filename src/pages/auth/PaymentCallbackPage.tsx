import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, ShoppingBag, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authService } from '@/services';
import { useAuthStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { checkSubscriptionPayment } from '@/services/flutterwave';

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateOnboardingStep } = useAuthStore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('Processing your request...');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    const processPayment = async () => {
      const reference = searchParams.get('reference');
      const provider = searchParams.get('provider');
      const { session, error: sessionError } = await authService.getSession();
      if (sessionError || !session?.user) { setStatus('failed'); setMessage('Session expired. Please log in again.'); setErrorDetails('Your session has expired. Please sign in again to continue.'); return; }
      const userId = session.user.id;
      const { data: profileData } = await supabase.from('profiles').select('onboarding_data, email').eq('id', userId).single();
      const onboardingData = profileData?.onboarding_data ?? {};
      const storeId = onboardingData.store_id ?? null;
      const selectedNiches = onboardingData.selected_niches ?? [];
      if (!storeId || !selectedNiches.length) { setStatus('failed'); setMessage('Missing onboarding data.'); setErrorDetails('Could not find your store or niche selection. Please contact support.'); return; }
      if (!reference) { setStatus('failed'); setMessage('Invalid payment reference.'); setErrorDetails('No payment reference found. Please try again.'); return; }
      try {
        let dbTier: string;
        if (provider === 'flutterwave') {
          setMessage('Confirming your transfer...');
          let res = await checkSubscriptionPayment(reference);
          for (let i = 0; i < 24 && res.ok && !res.paid && (res.status === 'pending' || res.status === 'activating'); i++) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            res = await checkSubscriptionPayment(reference);
          }
          if (!res.ok || !res.paid) {
            setStatus('failed');
            setMessage(res.ok && res.status === 'review' ? 'Your transfer needs a quick check.' : 'We haven’t received your transfer yet.');
            setErrorDetails(res.ok ? `If you sent the money, your plan will switch on by itself as soon as it lands, usually within minutes. Reference: ${reference}` : `${res.message} Reference: ${reference}`);
            return;
          }
          dbTier = res.tier;
        } else {
          setMessage('Confirming your payment...');
          const { data: act, error: actError } = await supabase.functions.invoke('activate-subscription', { body: { reference } });
          const result = (act ?? {}) as { ok?: boolean; message?: string; subscription?: { tier?: string } };
          if (actError || !result.ok) {
            let detail = result.message;
            const ctx = (actError as { context?: Response } | null)?.context;
            if (!detail && ctx && typeof ctx.json === 'function') detail = (await ctx.json().catch(() => ({})))?.message;
            setStatus('failed'); setMessage('We could not confirm your payment.'); setErrorDetails(`${detail ?? 'Please try again or contact support.'} Reference: ${reference}`); toast.error('Payment could not be confirmed.'); return;
          }
          dbTier = result.subscription?.tier ?? sessionStorage.getItem('subscription_plan') ?? 'one_niche';
        }
        await updateOnboardingStep(4, true);
        await supabase.from('profiles').update({ onboarding_data: { ...onboardingData, step: 4, completed: true, plan: dbTier } }).eq('id', userId);
        ['subscription_plan', 'subscription_duration', 'subscription_amount', 'payment_reference', 'is_lifetime'].forEach((key) => sessionStorage.removeItem(key));
        setStatus('success'); setMessage('Your payment was successful! Welcome to QAFRICA.'); toast.success('Payment successful! Your subscription is now active.');
      } catch (err) {
        console.error('Payment verification error:', err); setStatus('failed'); setMessage('An error occurred while verifying your payment.'); setErrorDetails('Please try again or contact support for assistance.'); toast.error('Payment verification error.');
      }
    };
    processPayment();
  }, [searchParams, updateOnboardingStep]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none"><div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" /><div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" /></div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-8"><div className="inline-flex items-center gap-2"><div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center"><ShoppingBag className="w-7 h-7 text-white" /></div><span className="text-2xl font-bold text-gray-900">QAFRICA</span></div></div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          {status === 'verifying' && <><div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div><h2 className="text-2xl font-bold text-gray-900 mb-2">Processing</h2><p className="text-gray-500">{message}</p></>}
          {status === 'success' && <><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-green-500" /></div><h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2><p className="text-gray-500 mb-8">{message}</p><div className="space-y-3"><Button onClick={() => navigate('/dashboard', { replace: true })} className="w-full bg-orange-500 hover:bg-orange-600 text-white"><Sparkles className="w-5 h-5 mr-2" />Go to Dashboard</Button><p className="text-sm text-gray-500 pt-2">Your store is ready! Start adding products from your dashboard.</p></div></>}
          {status === 'failed' && <><div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="w-10 h-10 text-red-500" /></div><h2 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h2><p className="text-gray-500 mb-4">{message}</p>{errorDetails && <div className="bg-red-50 rounded-lg p-4 mb-6"><p className="text-sm text-red-600">{errorDetails}</p></div>}<div className="space-y-3"><Button onClick={() => navigate('/pricing')} className="w-full bg-orange-500 hover:bg-orange-600 text-white">Try Again</Button><Button onClick={() => navigate('/login')} variant="outline" className="w-full">Go to Login</Button></div></>}
        </div>
      </motion.div>
    </div>
  );
}
