// src/pages/auth/PricingPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';

import PricingHeader from './Pricing/PricingHeader';
import BillingToggle from './Pricing/BillingToggle';
import FreePlanBanner from './Pricing/FreePlanBanner';
import DurationPicker from './Pricing/DurationPicker';
import MonthlyPlanGrid from './Pricing/MonthlyPlanGrid';
import LifetimePlanGrid from './Pricing/LifetimePlanGrid';
import PricingSummary from './Pricing/PricingSummary';
import { monthlyPlans, lifetimePlans } from './Pricing/constants';

export default function PricingPage() {
  const navigate         = useNavigate();
  const { user, updateOnboardingStep } = useAuthStore();
  const userId           = user?.id;

  const [selectedPlan, setSelectedPlan]         = useState<string>('three_niches');
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [isLoading, setIsLoading]               = useState(false);
  const [isSkipLoading, setIsSkipLoading]       = useState(false);
  const [selectedNiches, setSelectedNiches]     = useState<string[]>([]);
  const [storeId, setStoreId]                   = useState<string | null>(null);
  const [userEmail, setUserEmail]               = useState<string>('');
  const [billingType, setBillingType]           = useState<'monthly' | 'lifetime'>('monthly');

  // ── Load onboarding_data from Supabase — no sessionStorage ───────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_data, email')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        toast.error('Could not load your session. Please try again.');
        navigate('/select-niche');
        return;
      }

      const saved = data.onboarding_data ?? {};

      if (!saved.selected_niches?.length) {
        toast.error('Please select a niche first.');
        navigate('/select-niche');
        return;
      }

      if (!saved.store_id) {
        toast.error('Please complete store setup first.');
        navigate('/onboarding/store-setup');
        return;
      }

      setSelectedNiches(saved.selected_niches);
      setStoreId(saved.store_id);
      setUserEmail(data.email ?? user?.email ?? '');
    };

    load();
    return () => { cancelled = true; };
  }, [userId, navigate, user?.email]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const calculatePrice = (planId: string, duration: number) => {
    const plan = monthlyPlans.find((p) => p.id === planId);
    if (!plan) return 0;
    const multiplier = [
      { value: 1,  multiplier: 1   },
      { value: 3,  multiplier: 2.7 },
      { value: 6,  multiplier: 5   },
      { value: 12, multiplier: 9   },
    ].find((d) => d.value === duration)?.multiplier || 1;
    return Math.round(plan.basePrice * multiplier);
  };

  const canSelectPlan = (maxNiches: number) => {
    if (!isFinite(maxNiches)) return true;
    return selectedNiches.length <= maxNiches;
  };

  // ── Subscribe (paid) ──────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    if (!storeId || !selectedNiches.length) {
      toast.error('Missing store or niche data. Please go back and try again.');
      return;
    }

    setIsLoading(true);
    try {
      await loadPaystackScript();

      const isLifetime       = billingType === 'lifetime';
      const lifetimePlanData = lifetimePlans.find((p) => p.id === selectedPlan);
      const amount           = isLifetime
        ? lifetimePlanData?.price || 0
        : calculatePrice(selectedPlan, selectedDuration);
      const reference = generateReference(isLifetime ? 'LIFE' : 'SUB');

      // Store payment metadata in sessionStorage only for the callback
      // (short-lived: just for the redirect back from Paystack)
      sessionStorage.setItem('subscription_plan',     selectedPlan);
      sessionStorage.setItem('subscription_duration', isLifetime ? 'lifetime' : selectedDuration.toString());
      sessionStorage.setItem('subscription_amount',   amount.toString());
      sessionStorage.setItem('payment_reference',     reference);
      sessionStorage.setItem('is_lifetime',           isLifetime ? 'true' : 'false');

      initializePayment({
        email:  userEmail,
        amount: toKobo(amount),
        reference,
        metadata: {
          plan:        selectedPlan,
          duration:    isLifetime ? 'lifetime' : selectedDuration,
          niches:      selectedNiches,
          store_id:    storeId,
          is_lifetime: isLifetime,
        },
        onSuccess: (response) => {
          toast.success(isLifetime ? 'Lifetime access purchased!' : 'Payment successful!');
          navigate(`/payment/callback?reference=${response.reference}`);
        },
        onCancel: () => {
          setIsLoading(false);
          toast.info('Payment cancelled. You can try again.');
        },
      });
    } catch {
      setIsLoading(false);
      toast.error('Payment initialization failed. Please try again.');
    }
  };

  // ── Free plan: call complete-onboarding edge function ─────────────────────
  const handleContinueWithFree = async () => {
    if (!storeId || !selectedNiches.length) {
      toast.error('Missing store or niche data. Please go back and try again.');
      return;
    }

    setIsSkipLoading(true);
    try {
      const res = await supabase.functions.invoke('complete-onboarding', {
        body: {
          store_id:        storeId,
          selected_niches: selectedNiches,
          plan:            'free',
        },
      });

      if (res.error) throw res.error;

      // Update Zustand store so ProtectedRoute sees isAuthenticated: true
      await updateOnboardingStep(4, true);

      toast.success('Free plan activated! Welcome to QAFRICA.');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate free plan. Please try again.');
      setIsSkipLoading(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentPrice = billingType === 'monthly'
    ? calculatePrice(selectedPlan, selectedDuration)
    : lifetimePlans.find((p) => p.id === selectedPlan)?.price || 0;

  const selectedPlanName = billingType === 'monthly'
    ? monthlyPlans.find((p) => p.id === selectedPlan)?.name
    : lifetimePlans.find((p) => p.id === selectedPlan)?.name;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <PricingHeader />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <BillingToggle billingType={billingType} onToggle={setBillingType} />

          <FreePlanBanner isLoading={isSkipLoading} onContinue={handleContinueWithFree} />

          {billingType === 'monthly' && (
            <>
              <DurationPicker selectedDuration={selectedDuration} onSelect={setSelectedDuration} />
              <MonthlyPlanGrid
                selectedPlan={selectedPlan}
                selectedDuration={selectedDuration}
                onSelectPlan={setSelectedPlan}
                calculatePrice={calculatePrice}
                canSelectPlan={canSelectPlan}
              />
            </>
          )}

          {billingType === 'lifetime' && (
            <LifetimePlanGrid
              selectedPlan={selectedPlan}
              onSelectPlan={setSelectedPlan}
              canSelectPlan={canSelectPlan}
            />
          )}

          <PricingSummary
            selectedPlanName={selectedPlanName}
            selectedDuration={selectedDuration}
            selectedNiches={selectedNiches}
            currentPrice={currentPrice}
            billingType={billingType}
            isLoading={isLoading}
            isSkipLoading={isSkipLoading}
            onSubscribe={handleSubscribe}
            onContinueWithFree={handleContinueWithFree}
            onBack={() => navigate('/onboarding/choice')}
          />
        </motion.div>
      </div>
    </div>
  );
}
