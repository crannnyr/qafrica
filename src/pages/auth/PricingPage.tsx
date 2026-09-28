// src/pages/auth/PricingPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores';
import { supabase } from '@/services/supabase';
import FlutterwavePayDialog from '@/components/payments/FlutterwavePayDialog';
import type { SubscriptionPlanRequest } from '@/services/flutterwave';

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
  const { user } = useAuthStore();
  const userId           = user?.id;

  const [selectedPlan, setSelectedPlan]         = useState<string>('three_niches');
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [selectedNiches, setSelectedNiches]     = useState<string[]>([]);
  const [storeId, setStoreId]                   = useState<string | null>(null);
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

  // ── Pay (Flutterwave bank transfer). The server prices the plan and activates it. ──
  const [payment, setPayment] = useState<{ plan: SubscriptionPlanRequest; label: string } | null>(null);

  const handleSubscribe = () => {
    if (!storeId || !selectedNiches.length) {
      toast.error('Missing store or niche data. Please go back and try again.');
      return;
    }
    const isLifetime = billingType === 'lifetime';
    const name = (isLifetime ? lifetimePlans : monthlyPlans).find((p) => p.id === selectedPlan)?.name ?? 'Plan';
    setPayment({
      plan: { tier: selectedPlan, duration: isLifetime ? 'lifetime' : selectedDuration, niches: selectedNiches, store_id: storeId },
      label: `${name} · ${isLifetime ? 'Lifetime' : `${selectedDuration} month${selectedDuration > 1 ? 's' : ''}`}`,
    });
  };

  // ── Starter Pack: flat ₦5,000 for 3 months (priced on the server) ──────────
  const handleStartStarterPack = () => {
    if (!storeId || !selectedNiches.length) {
      toast.error('Missing store or niche data. Please go back and try again.');
      return;
    }
    setPayment({
      plan: { tier: 'one_niche', duration: 3, starter_pack: true, niches: selectedNiches, store_id: storeId },
      label: 'Starter Pack · 3 months',
    });
  };

  const onPaid = (reference: string) => {
    setPayment(null);
    navigate(`/payment/callback?provider=flutterwave&reference=${reference}`);
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

          <FreePlanBanner isLoading={!!payment?.plan.starter_pack} onContinue={handleStartStarterPack} />

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
            isLoading={!!payment && !payment.plan.starter_pack}
            onSubscribe={handleSubscribe}
            onBack={() => navigate('/onboarding/choice')}
          />
        </motion.div>
      </div>

      {payment && (
        <FlutterwavePayDialog plan={payment.plan} planLabel={payment.label} onClose={() => setPayment(null)} onPaid={onPaid} />
      )}
    </div>
  );
}
