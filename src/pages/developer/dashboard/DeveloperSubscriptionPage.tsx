// src/pages/developer/dashboard/DeveloperSubscriptionPage.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Zap, Crown, Rocket, Building2, User,
  CreditCard, AlertCircle, Loader2, ExternalLink, Calendar,
} from 'lucide-react';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import { developerSubscriptionService } from '@/services/developer';
import type { DeveloperSubscription, DeveloperPlan, DeveloperAccountType } from '@/types/developer';
import { toast } from 'sonner';

// ── Plan definitions ──────────────────────────────────────────
const PLANS: {
  id: DeveloperPlan;
  name: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  individual: number;
  company: number;
  rateLimit: string;
  maxKeys: number | string;
  features: string[];
  notIncluded?: string[];
  popular?: boolean;
}[] = [
  {
    id: 'free',
    name: 'Free',
    icon: Zap,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    individual: 0,
    company: 0,
    rateLimit: '20 req/min',
    maxKeys: 1,
    features: [
      'Browse product catalog',
      'View delivery zones',
      '1 API key',
    ],
    notIncluded: [
      'Create orders',
      'Import products',
      'Webhooks',
      'Inbound product push',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    icon: Rocket,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    individual: 10000,
    company: 15000,
    rateLimit: '60 req/min',
    maxKeys: 3,
    features: [
      'Everything in Free',
      'Import products from catalog',
      'Create orders via API',
      'Webhook notifications',
      'Paystack Split payouts',
      '3 API keys',
    ],
    popular: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    icon: Crown,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    individual: 25000,
    company: 40000,
    rateLimit: '150 req/min',
    maxKeys: 10,
    features: [
      'Everything in Starter',
      'Push products into QAFRICA',
      'Bulk operations',
      'Advanced webhook filtering',
      'Priority support',
      '10 API keys',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    icon: Building2,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    individual: 75000,
    company: 120000,
    rateLimit: '500 req/min',
    maxKeys: 'Unlimited',
    features: [
      'Everything in Growth',
      'Unlimited API keys',
      'Dedicated support',
      'Custom split rates',
      'SLA agreement',
      'Early API access',
    ],
  },
];

const ANNUAL_DISCOUNT = 20; // percent

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString()}`;
}

// ── Plan card ─────────────────────────────────────────────────
function PlanCard({
  plan,
  accountType,
  billingCycle,
  isCurrent,
  isDowngrade,
  onSelect,
}: {
  plan: typeof PLANS[number];
  accountType: DeveloperAccountType;
  billingCycle: 'monthly' | 'annual';
  isCurrent: boolean;
  isDowngrade: boolean;
  onSelect: () => void;
}) {
  const Icon         = plan.icon;
  const basePrice    = accountType === 'company' ? plan.company : plan.individual;
  const monthlyPrice = billingCycle === 'annual'
    ? Math.round(basePrice * (1 - ANNUAL_DISCOUNT / 100))
    : basePrice;
  const annualTotal  = monthlyPrice * 12;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col transition-all duration-200
        ${isCurrent  ? 'border-orange-500 shadow-lg shadow-orange-500/10' :
          plan.popular ? 'border-orange-200 hover:border-orange-400' :
                         'border-gray-100 hover:border-gray-300'}`}
    >
      {/* Popular badge */}
      {plan.popular && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            Most popular
          </span>
        </div>
      )}

      {/* Current badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3" /> Current plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${plan.bg}`}>
          <Icon className={`w-4.5 h-4.5 ${plan.color}`} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{plan.name}</h3>
          <p className="text-xs text-gray-500">{plan.rateLimit} · {plan.maxKeys} {typeof plan.maxKeys === 'number' ? 'keys' : 'API keys'}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-5">
        {basePrice === 0 ? (
          <p className="text-3xl font-bold text-gray-900">Free</p>
        ) : (
          <>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-gray-900">{formatNaira(monthlyPrice)}</span>
              <span className="text-sm text-gray-400 mb-1">/mo</span>
            </div>
            {billingCycle === 'annual' && (
              <p className="text-xs text-green-600 font-medium mt-0.5">
                {formatNaira(annualTotal)}/yr · {ANNUAL_DISCOUNT}% saved
              </p>
            )}
            {billingCycle === 'monthly' && (
              <p className="text-xs text-gray-400 mt-0.5">
                or {formatNaira(Math.round(basePrice * (1 - ANNUAL_DISCOUNT / 100)))}/mo billed annually
              </p>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2 flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
        {plan.notIncluded?.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
            <span className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 flex items-center justify-center">
              <span className="w-1 h-px bg-gray-300 block" />
            </span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrent ? (
        <div className="h-10 flex items-center justify-center rounded-xl bg-orange-50 text-orange-600 text-sm font-semibold">
          Current plan
        </div>
      ) : plan.id === 'enterprise' ? (
        <a
          href="mailto:support@qafrica.store?subject=Enterprise API Plan"
          className="h-10 flex items-center justify-center rounded-xl border border-gray-200
            text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors gap-1.5"
        >
          Contact sales <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ) : (
        <button
          onClick={onSelect}
          className={`h-10 flex items-center justify-center rounded-xl text-sm font-semibold transition-colors
            ${isDowngrade
              ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              : plan.popular
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
            }`}
        >
          {isDowngrade ? 'Downgrade' : basePrice === 0 ? 'Downgrade to Free' : 'Upgrade'}
        </button>
      )}
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperSubscriptionPage() {
  const { developer } = useDeveloperAuthStore();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [accountType,  setAccountType]  = useState<DeveloperAccountType>('individual');
  const [history,      setHistory]      = useState<DeveloperSubscription[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selecting,    setSelecting]    = useState<DeveloperPlan | null>(null);

  useEffect(() => {
    if (developer) {
      setAccountType(developer.account_type);
    }
  }, [developer]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await developerSubscriptionService.getSubscription();
        setHistory(data.history);
      } catch {
        // non-fatal
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, []);

  if (!developer) return null;

  const currentPlan = developer.plan;
  const planOrder: DeveloperPlan[] = ['free', 'starter', 'growth', 'scale', 'enterprise'];
  const currentIdx = planOrder.indexOf(currentPlan);

  const daysLeft = developer.plan_expires_at
    ? Math.ceil((new Date(developer.plan_expires_at).getTime() - Date.now()) / 86_400_000)
    : null;

  async function handleSelectPlan(planId: DeveloperPlan) {
    if (planId === currentPlan) return;
    setSelecting(planId);
    try {
      // In production this would open a Paystack payment flow.
      // For now, show a clear next step.
      toast.info(`To ${planOrder.indexOf(planId) > currentIdx ? 'upgrade' : 'downgrade'} to ${planId}, complete payment via Paystack. Feature coming soon.`);
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your developer plan and billing.</p>
      </div>

      {/* Current plan banner */}
      <div className={`mb-8 p-5 rounded-2xl border flex items-center gap-5 ${
        daysLeft !== null && daysLeft <= 3 ? 'bg-red-50 border-red-200' :
        daysLeft !== null && daysLeft <= 7 ? 'bg-yellow-50 border-yellow-200' :
        'bg-orange-50 border-orange-100'
      }`}>
        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 capitalize">{currentPlan} Plan</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {developer.account_type === 'company' ? 'Company account' : 'Individual account'}
            {daysLeft !== null && (
              <span className={`ml-2 font-medium ${daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-yellow-700' : 'text-gray-500'}`}>
                · {daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
              </span>
            )}
          </p>
        </div>
        {daysLeft !== null && daysLeft <= 7 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 px-3 py-1.5 rounded-full">
            <AlertCircle className="w-3.5 h-3.5" />
            Renew soon
          </div>
        )}
      </div>

      {/* Billing controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Account type toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
          {(['individual', 'company'] as DeveloperAccountType[]).map((type) => (
            <button
              key={type}
              onClick={() => setAccountType(type)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                accountType === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {type === 'individual' ? <User className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
          {(['monthly', 'annual'] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billingCycle === cycle ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
              {cycle === 'annual' && (
                <span className="ml-1.5 text-xs font-bold text-green-600">-{ANNUAL_DISCOUNT}%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            accountType={accountType}
            billingCycle={billingCycle}
            isCurrent={plan.id === currentPlan}
            isDowngrade={planOrder.indexOf(plan.id) < currentIdx}
            onSelect={() => handleSelectPlan(plan.id)}
          />
        ))}
      </div>

      {/* Billing history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Billing history</h2>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400">No billing history yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((sub) => (
              <div key={sub.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    sub.is_trial ? 'bg-orange-100' : 'bg-gray-100'
                  }`}>
                    {sub.is_trial
                      ? <Zap className="w-4 h-4 text-orange-500" />
                      : <CreditCard className="w-4 h-4 text-gray-500" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 capitalize">
                      {sub.plan} Plan
                      {sub.is_trial && (
                        <span className="ml-2 text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                          Trial
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(sub.starts_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' → '}
                      {new Date(sub.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {sub.amount_paid === 0 ? 'Free' : formatNaira(sub.amount_paid)}
                  </p>
                  <p className={`text-xs font-medium mt-0.5 ${
                    sub.is_active ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {sub.is_active ? 'Active' : 'Expired'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enterprise note */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Need custom limits or a white-label integration?{' '}
          <a
            href="mailto:support@qafrica.store?subject=Enterprise API"
            className="text-orange-600 font-semibold hover:underline"
          >
            Contact our sales team
          </a>
        </p>
      </div>
    </div>
  );
}