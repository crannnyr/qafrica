import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, ArrowRight, Check, Loader2, Star, Zap, Crown, CheckCircle, Infinity, SkipForward, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CONFIG from '@/lib/config';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores';

// Monthly/Yearly durations
const durations = [
  { value: 1, label: '1 Month', multiplier: 1, discount: '0%' },
  { value: 3, label: '3 Months', multiplier: 2.7, discount: '10%' },
  { value: 6, label: '6 Months', multiplier: 5, discount: '17%' },
  { value: 12, label: '1 Year', multiplier: 9, discount: '25%' },
];

// Monthly/Yearly plans
const monthlyPlans = [
  {
    id: 'one_niche',
    name: 'Starter',
    icon: Star,
    description: 'Perfect for beginners',
    basePrice: CONFIG.PRICING?.SINGLE_NICHE || 5000,
    maxNiches: 1,
    features: [
      '1 Niche Selection',
      'Unlimited Products',
      'Basic Analytics',
      'Standard Themes',
      'Email Support',
      'Import Catalog (View Only)',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    id: 'three_niches',
    name: 'Growth',
    icon: Zap,
    description: 'For expanding businesses',
    basePrice: CONFIG.PRICING?.THREE_NICHES || 10000,
    maxNiches: 3,
    features: [
      '3 Niche Selections',
      'Unlimited Products',
      'Advanced Analytics',
      'Premium Themes',
      'Priority Support',
      'Full Import Catalog Access',
      'Dropshipping Features',
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    id: 'unlimited',
    name: 'Enterprise',
    icon: Crown,
    description: 'For established brands',
    basePrice: CONFIG.PRICING?.UNLIMITED || 100000,
    maxNiches: Infinity,
    features: [
      'Unlimited Niches',
      'Unlimited Products',
      'Full Analytics Suite',
      'All Themes + Custom',
      '24/7 Priority Support',
      'Import Catalog + Dropship',
      'Dedicated Account Manager',
      'API Access',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

// Lifetime plans (One-time payment)
const lifetimePlans = [
  {
    id: 'one_niche',
    name: 'Starter Lifetime',
    icon: Star,
    description: 'One-time payment, lifetime access',
    price: 2000000,
    maxNiches: 1,
    features: [
      '1 Niche Selection - Forever',
      'Unlimited Products',
      'Basic Analytics',
      'Standard Themes',
      'Email Support',
      'No Monthly Fees Ever',
    ],
    cta: 'Buy Lifetime',
    popular: false,
    badge: 'Save 90%+',
  },
  {
    id: 'three_niches',
    name: 'Growth Lifetime',
    icon: Zap,
    description: 'Best value for serious sellers',
    price: 3800000,
    maxNiches: 3,
    features: [
      '3 Niche Selections - Forever',
      'Unlimited Products',
      'Advanced Analytics',
      'Premium Themes',
      'Priority Support',
      'Full Import Catalog',
      'Dropshipping Features',
      'No Monthly Fees Ever',
    ],
    cta: 'Buy Lifetime',
    popular: true,
    badge: 'Best Value',
  },
  {
    id: 'unlimited',
    name: 'Enterprise Lifetime',
    icon: Infinity,
    description: 'Ultimate power for big brands',
    price: 10000000,
    maxNiches: Infinity,
    features: [
      'Unlimited Niches - Forever',
      'Unlimited Products',
      'Full Analytics Suite',
      'All Themes + Custom',
      '24/7 Priority Support',
      'Import + Dropship',
      'Dedicated Manager',
      'API Access',
      'No Monthly Fees Ever',
    ],
    cta: 'Buy Lifetime',
    popular: false,
    badge: 'Ultimate',
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { fetchProfile } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<string>('three_niches');
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSkipLoading, setIsSkipLoading] = useState(false);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [billingType, setBillingType] = useState<'monthly' | 'lifetime'>('monthly');

  useEffect(() => {
    const niches = sessionStorage.getItem('selected_niches');
    if (niches) {
      setSelectedNiches(JSON.parse(niches));
    } else {
      toast.error('Please select a niche first');
      navigate('/select-niche');
    }
  }, [navigate]);

  const calculatePrice = (planId: string, duration: number) => {
    const plan = monthlyPlans.find((p) => p.id === planId);
    if (!plan) return 0;
    const durationConfig = durations.find((d) => d.value === duration);
    const multiplier = durationConfig?.multiplier || 1;
    return Math.round(plan.basePrice * multiplier);
  };

  const canSelectPlan = (planMaxNiches: number) => {
    if (planMaxNiches === Infinity || planMaxNiches === Number.POSITIVE_INFINITY) return true;
    return selectedNiches.length <= planMaxNiches;
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      await loadPaystackScript();
      const isLifetime = billingType === 'lifetime';
      const selectedPlanData = isLifetime
        ? lifetimePlans.find(p => p.id === selectedPlan)
        : monthlyPlans.find(p => p.id === selectedPlan);
      const amount = isLifetime
        ? selectedPlanData?.price || 0
        : calculatePrice(selectedPlan, selectedDuration);
      const reference = generateReference(isLifetime ? 'LIFE' : 'SUB');
      const email = sessionStorage.getItem('signup_email') || 'user@example.com';

      sessionStorage.setItem('subscription_plan', selectedPlan);
      sessionStorage.setItem('subscription_duration', isLifetime ? 'lifetime' : selectedDuration.toString());
      sessionStorage.setItem('subscription_amount', amount.toString());
      sessionStorage.setItem('payment_reference', reference);
      sessionStorage.setItem('is_lifetime', isLifetime ? 'true' : 'false');

      initializePayment({
        email,
        amount: toKobo(amount),
        reference,
        metadata: {
          plan: selectedPlan,
          duration: isLifetime ? 'lifetime' : selectedDuration,
          niches: selectedNiches,
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
    } catch (err) {
      setIsLoading(false);
      toast.error('Payment initialization failed. Please try again.');
    }
  };

  const handleContinueWithFree = async () => {
    setIsSkipLoading(true);
    try {
      const storeId = sessionStorage.getItem('onboarding_store_id');
      const { supabase } = await import('@/services/supabase');
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Please log in first');
        navigate('/login');
        return;
      }

      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          store_id: storeId || undefined,
          tier: 'free',
          niches: selectedNiches,
          duration_months: 0,
          amount_paid: 0,
          payment_reference: 'FREE_PLAN_DIRECT',
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
          is_trial: true,
        });

      if (subError) {
        console.error('Free plan error:', subError);
        toast.error('Failed to activate free plan');
        setIsSkipLoading(false);
        return;
      }

      await supabase
        .from('profiles')
        .update({
          onboarding_step: 4,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      await fetchProfile();

      sessionStorage.removeItem('selected_niches');
      sessionStorage.removeItem('subscription_plan');
      sessionStorage.removeItem('subscription_duration');
      sessionStorage.removeItem('subscription_amount');
      sessionStorage.removeItem('payment_reference');
      sessionStorage.removeItem('onboarding_store_id');
      sessionStorage.removeItem('signup_email');
      sessionStorage.removeItem('signup_full_name');
      sessionStorage.removeItem('signup_phone');

      toast.success('Free plan activated! Welcome to QAFRICA.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Error activating free plan:', error);
      toast.error('Failed to activate free plan. Please try again.');
      setIsSkipLoading(false);
    }
  };

  const currentPrice = billingType === 'monthly'
    ? calculatePrice(selectedPlan, selectedDuration)
    : lifetimePlans.find(p => p.id === selectedPlan)?.price || 0;

  const selectedPlanData = billingType === 'monthly'
    ? monthlyPlans.find((p) => p.id === selectedPlan)
    : lifetimePlans.find((p) => p.id === selectedPlan);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              <Check className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-green-600">Account</span>
          </div>
          <div className="w-12 h-0.5 bg-green-500" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              <Check className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-green-600">Niche</span>
          </div>
          <div className="w-12 h-0.5 bg-orange-500" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className="text-sm font-medium text-orange-600">Plan</span>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="text-center mb-12">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Choose Your Plan</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Flexible monthly plans or lifetime access with one-time payment. All plans include secure payments,
              escrow protection, and access to our import catalog.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex">
              <button
                onClick={() => setBillingType('monthly')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  billingType === 'monthly' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly / Yearly
              </button>
              <button
                onClick={() => setBillingType('lifetime')}
                className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  billingType === 'lifetime' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Infinity className="w-4 h-4" />
                Lifetime
              </button>
            </div>
          </div>

          {/* Continue with Free Plan Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl p-6 mb-8 text-white"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <SkipForward className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-1">Not ready to pay?</h2>
                  <p className="text-gray-200">Continue with our free plan. You can upgrade anytime.</p>
                </div>
              </div>
              <Button
                onClick={handleContinueWithFree}
                disabled={isSkipLoading}
                variant="secondary"
                className="bg-white text-gray-700 hover:bg-gray-100 px-8 h-12"
              >
                {isSkipLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue with Free Plan
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Monthly/Yearly Content */}
          {billingType === 'monthly' && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8 max-w-3xl mx-auto">
                <p className="text-sm font-medium text-gray-700 mb-3 text-center">Select Billing Period</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {durations.map((duration) => (
                    <button
                      key={duration.value}
                      onClick={() => setSelectedDuration(duration.value)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedDuration === duration.value
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <p className={`font-medium ${selectedDuration === duration.value ? 'text-orange-700' : 'text-gray-700'}`}>
                        {duration.label}
                      </p>
                      <p className={`text-xs ${selectedDuration === duration.value ? 'text-orange-600' : 'text-gray-500'}`}>
                        Save {duration.discount}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-8 mb-12">
                {monthlyPlans.map((plan, index) => {
                  const Icon = plan.icon;
                  const price = calculatePrice(plan.id, selectedDuration);
                  const isSelected = selectedPlan === plan.id;
                  const canSelect = canSelectPlan(plan.maxNiches);

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative rounded-2xl border-2 transition-all duration-300 ${
                        isSelected
                          ? 'border-orange-500 shadow-xl scale-105 bg-white'
                          : 'border-gray-200 hover:border-orange-300 hover:shadow-lg bg-white'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="px-4 py-1 bg-orange-500 text-white text-sm font-medium rounded-full">
                            Most Popular
                          </span>
                        </div>
                      )}

                      {!canSelect && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                          <div className="text-center p-4">
                            <p className="text-gray-600 font-medium">Too many niches selected</p>
                            <p className="text-sm text-gray-500">Upgrade to select more</p>
                          </div>
                        </div>
                      )}

                      <div className="p-8">
                        <div className="text-center mb-6">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                            isSelected ? 'bg-orange-500' : 'bg-orange-100'
                          }`}>
                            <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-orange-500'}`} />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                          <p className="text-sm text-gray-500">{plan.description}</p>
                        </div>

                        <div className="text-center mb-6">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-2xl font-bold text-gray-900">₦{price.toLocaleString()}</span>
                            <span className="text-gray-500">/{selectedDuration === 1 ? 'month' : `${selectedDuration} months`}</span>
                          </div>
                          {selectedDuration > 1 && (
                            <p className="text-sm text-green-600 mt-1">
                              You save ₦{((plan.basePrice * selectedDuration) - price).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <ul className="space-y-3 mb-8">
                          {plan.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                isSelected ? 'text-orange-500' : 'text-gray-400'
                              }`} />
                              <span className="text-sm text-gray-600">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <button
                          onClick={() => canSelectPlan(plan.maxNiches) && setSelectedPlan(plan.id)}
                          className={`w-full py-3 rounded-lg font-medium transition-all ${
                            isSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          disabled={!canSelectPlan(plan.maxNiches)}
                        >
                          {isSelected ? 'Selected' : 'Select Plan'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {/* Lifetime Content */}
          {billingType === 'lifetime' && (
            <div className="grid lg:grid-cols-3 gap-8 mb-12">
              {lifetimePlans.map((plan, index) => {
                const Icon = plan.icon;
                const isSelected = selectedPlan === plan.id;
                const canSelect = canSelectPlan(plan.maxNiches);

                return (
                  <motion.div
                    key={`lifetime-${plan.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative rounded-2xl border-2 transition-all duration-300 ${
                      isSelected
                        ? 'border-purple-500 shadow-xl scale-105 bg-white'
                        : 'border-gray-200 hover:border-purple-300 hover:shadow-lg bg-white'
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="px-4 py-1 bg-purple-500 text-white text-sm font-medium rounded-full">
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    {plan.popular && (
                      <div className="absolute top-8 -right-12 bg-orange-500 text-white text-xs font-bold px-12 py-1 rotate-45 shadow-lg">
                        POPULAR
                      </div>
                    )}

                    {!canSelect && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                        <div className="text-center p-4">
                          <p className="text-gray-600 font-medium">Too many niches selected</p>
                          <p className="text-sm text-gray-500">Choose a higher tier</p>
                        </div>
                      </div>
                    )}

                    <div className="p-8">
                      <div className="text-center mb-6">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                          isSelected ? 'bg-purple-500' : 'bg-purple-100'
                        }`}>
                          <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-purple-500'}`} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                        <p className="text-sm text-gray-500">{plan.description}</p>
                      </div>

                      <div className="text-center mb-6">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-3xl font-bold text-gray-900">₦{plan.price.toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-green-600 mt-1 font-medium">One-time payment</p>
                        <p className="text-xs text-gray-500 mt-1">Never pay again</p>
                      </div>

                      <ul className="space-y-3 mb-8">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                              isSelected ? 'text-purple-500' : 'text-gray-400'
                            }`} />
                            <span className="text-sm text-gray-600">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => canSelectPlan(plan.maxNiches) && setSelectedPlan(plan.id)}
                        className={`w-full py-3 rounded-lg font-medium transition-all ${
                          isSelected ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        disabled={!canSelectPlan(plan.maxNiches)}
                      >
                        {isSelected ? 'Selected' : plan.cta}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Summary & CTA */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-2xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-gray-500 mb-1">Your Selection</p>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedPlanData?.name}
                  {billingType === 'monthly' && ` • ${durations.find(d => d.value === selectedDuration)?.label}`}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedNiches.length} niche{selectedNiches.length > 1 ? 's' : ''} selected
                </p>
              </div>
              <div className="text-center md:text-right">
                <p className="text-3xl font-bold text-orange-600">₦{currentPrice.toLocaleString()}</p>
                <p className="text-sm text-gray-500">
                  {billingType === 'lifetime' ? 'One-time payment' : 'Total amount'}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <Button
                onClick={handleSubscribe}
                className={`w-full h-14 text-lg font-medium ${
                  billingType === 'lifetime'
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    {billingType === 'lifetime' ? 'Purchase Lifetime Access' : 'Proceed to Payment'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              {/* Secondary free plan option */}
              <button
                onClick={handleContinueWithFree}
                disabled={isSkipLoading}
                className="w-full mt-3 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSkipLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <SkipForward className="w-4 h-4" />
                    or Continue with Free Plan
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                Secure payment powered by Paystack
              </p>

              {/* WhatsApp Contact */}
              <div className="flex justify-center mt-3">
                <a
                  href="https://wa.me/447404707531"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1.5 underline underline-offset-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Having trouble with payment? Contact us on WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => navigate('/select-niche')}
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Back to Niche Selection
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}