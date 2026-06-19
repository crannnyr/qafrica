// src/pages/auth/PricingPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores';
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
  const navigate = useNavigate();
  const { fetchProfile } = useAuthStore();

  const [selectedPlan, setSelectedPlan]       = useState<string>('three_niches');
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [isLoading, setIsLoading]             = useState(false);
  const [isSkipLoading, setIsSkipLoading]     = useState(false);
  const [selectedNiches, setSelectedNiches]   = useState<string[]>([]);
  const [billingType, setBillingType]         = useState<'monthly' | 'lifetime'>('monthly');

  useEffect(() => {
    const niches = sessionStorage.getItem('selected_niches');
    if (niches) {
      setSelectedNiches(JSON.parse(niches));
    } else {
      toast.error('Please select a niche first');
      navigate('/select-niche');
    }
  }, [navigate]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const calculatePrice = (planId: string, duration: number) => {
    const plan = monthlyPlans.find((p) => p.id === planId);
    if (!plan) return 0;
    const multiplier = [
      { value: 1, multiplier: 1 }, { value: 3, multiplier: 2.7 },
      { value: 6, multiplier: 5 }, { value: 12, multiplier: 9 },
    ].find((d) => d.value === duration)?.multiplier || 1;
    return Math.round(plan.basePrice * multiplier);
  };

  const canSelectPlan = (maxNiches: number) => {
    if (!isFinite(maxNiches)) return true;
    return selectedNiches.length <= maxNiches;
  };

  // ── Subscribe ──────────────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      await loadPaystackScript();
      const isLifetime       = billingType === 'lifetime';
      const lifetimePlanData = lifetimePlans.find((p) => p.id === selectedPlan);
      const amount           = isLifetime
        ? lifetimePlanData?.price || 0
        : calculatePrice(selectedPlan, selectedDuration);
      const reference = generateReference(isLifetime ? 'LIFE' : 'SUB');
      const email     = sessionStorage.getItem('signup_email') || 'user@example.com';

      sessionStorage.setItem('subscription_plan',     selectedPlan);
      sessionStorage.setItem('subscription_duration', isLifetime ? 'lifetime' : selectedDuration.toString());
      sessionStorage.setItem('subscription_amount',   amount.toString());
      sessionStorage.setItem('payment_reference',     reference);
      sessionStorage.setItem('is_lifetime',           isLifetime ? 'true' : 'false');

      initializePayment({
        email,
        amount: toKobo(amount),
        reference,
        metadata: {
          plan:        selectedPlan,
          duration:    isLifetime ? 'lifetime' : selectedDuration,
          niches:      selectedNiches,
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

  // ── Free plan ──────────────────────────────────────────────────────────────
  const handleContinueWithFree = async () => {
    setIsSkipLoading(true);
    try {
      const storeId = sessionStorage.getItem('onboarding_store_id');
      const { supabase } = await import('@/services/supabase');
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) { toast.error('Please log in first'); navigate('/login'); return; }

      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id:           user.id,
          store_id:          storeId || undefined,
          tier:              'free',
          niches:            selectedNiches,
          duration_months:   0,
          amount_paid:       0,
          payment_reference: 'FREE_PLAN_DIRECT',
          starts_at:         new Date().toISOString(),
          expires_at:        new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
          is_active:         true,
          is_trial:          true,
        });

      if (subError) {
        toast.error('Failed to activate free plan');
        setIsSkipLoading(false);
        return;
      }

      await supabase
        .from('profiles')
        .update({
          onboarding_step:      4,
          onboarding_completed: true,
          updated_at:           new Date().toISOString(),
        })
        .eq('id', user.id);

      await fetchProfile();

      ['selected_niches','subscription_plan','subscription_duration',
       'subscription_amount','payment_reference','onboarding_store_id',
       'signup_email','signup_full_name','signup_phone',
      ].forEach((key) => sessionStorage.removeItem(key));

      toast.success('Free plan activated! Welcome to QAFRICA.');
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      toast.error('Failed to activate free plan. Please try again.');
      setIsSkipLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentPrice = billingType === 'monthly'
    ? calculatePrice(selectedPlan, selectedDuration)
    : lifetimePlans.find((p) => p.id === selectedPlan)?.price || 0;

  const selectedPlanName = billingType === 'monthly'
    ? monthlyPlans.find((p) => p.id === selectedPlan)?.name
    : lifetimePlans.find((p) => p.id === selectedPlan)?.name;

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <BillingToggle
            billingType={billingType}
            onToggle={setBillingType}
          />

          <FreePlanBanner
            isLoading={isSkipLoading}
            onContinue={handleContinueWithFree}
          />

          {billingType === 'monthly' && (
            <>
              <DurationPicker
                selectedDuration={selectedDuration}
                onSelect={setSelectedDuration}
              />
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
            onBack={() => navigate('/select-niche')}
          />
        </motion.div>
      </div>
    </div>
  );
}