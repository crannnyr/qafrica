// src/pages/auth/Pricing/MonthlyPlanGrid.tsx

import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import { monthlyPlans } from './constants';

interface Props {
  selectedPlan: string;
  selectedDuration: number;
  onSelectPlan: (planId: string) => void;
  calculatePrice: (planId: string, duration: number) => number;
  canSelectPlan: (maxNiches: number) => boolean;
}

// Colourful marketplace badges — eye-catching per the design
function MarketplaceBadges() {
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FF6600', color: 'white' }}>Jumia</span>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#C8202F', color: 'white' }}>Konga</span>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#4CAF50', color: 'white' }}>Jiji</span>
    </span>
  );
}

function NichePill({ count }: { count: number }) {
  if (!isFinite(count)) return (
    <span className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-green-50 text-green-700 border-2 border-green-200">
      Unlimited Niches
    </span>
  );
  if (count === 3) return (
    <span className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-amber-50 text-amber-700 border-2 border-amber-200">
      3 Niches
    </span>
  );
  return (
    <span className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-orange-50 text-orange-600 border-2 border-orange-200">
      1 Niche
    </span>
  );
}

function StaffPill({ limit }: { limit: number }) {
  if (limit === 0) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
      <Users className="w-3 h-3" /> No Staff Management
    </span>
  );
  if (limit === 3) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      <Users className="w-3 h-3" /> Up to 3 Staff
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
      <Users className="w-3 h-3" /> Up to 10 Staff
    </span>
  );
}

export default function MonthlyPlanGrid({
  selectedPlan,
  selectedDuration,
  onSelectPlan,
  calculatePrice,
  canSelectPlan,
}: Props) {
  return (
    <div className="grid lg:grid-cols-3 gap-8 mb-12">
      {monthlyPlans.map((plan, index) => {
        const Icon       = plan.icon;
        const price      = calculatePrice(plan.id, selectedDuration);
        const isSelected = selectedPlan === plan.id;
        const canSelect  = canSelectPlan(plan.maxNiches);

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
            {/* Popular badge */}
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-orange-500 text-white text-sm font-medium rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            {/* Niche limit overlay */}
            {!canSelect && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                <div className="text-center p-4">
                  <p className="text-gray-600 font-medium">Too many niches selected</p>
                  <p className="text-sm text-gray-500">Upgrade to select more</p>
                </div>
              </div>
            )}

            <div className="p-8">
              {/* Icon + name */}
              <div className="text-center mb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                  isSelected ? 'bg-orange-500' : 'bg-orange-100'
                }`}>
                  <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-orange-500'}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-3">{plan.description}</p>

                {/* Niche pill */}
                <div className="mb-2">
                  <NichePill count={plan.maxNiches} />
                </div>

                {/* Staff pill */}
                <StaffPill limit={plan.staffLimit} />
              </div>

              {/* Price */}
              <div className="text-center mb-6 py-3 px-4 bg-gray-50 rounded-xl">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-bold text-gray-900">
                    ₦{price.toLocaleString()}
                  </span>
                  <span className="text-gray-500">
                    /{selectedDuration === 1 ? 'month' : `${selectedDuration} months`}
                  </span>
                </div>
                {selectedDuration > 1 && (
                  <p className="text-sm text-green-600 mt-1 font-medium">
                    You save ₦{((plan.basePrice * selectedDuration) - price).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-8">
                {plan.features.map((feature, i) => {
                  const isMarketplace = feature.includes('Jumia');
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        isSelected ? 'text-orange-500' : 'text-gray-400'
                      }`} />
                      {isMarketplace ? (
                        <span className="text-sm text-gray-600 flex items-center gap-1.5 flex-wrap">
                          Push to <MarketplaceBadges />
                        </span>
                      ) : (
                        <span className="text-sm text-gray-600">{feature}</span>
                      )}
                    </li>
                  );
                })}
                {/* Staff row — crossed out for Starter */}
                {plan.staffLimit === 0 && (
                  <li className="flex items-start gap-2.5">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    <span className="text-sm text-gray-400">Staff management (Growth+)</span>
                  </li>
                )}
              </ul>

              {/* Select button */}
              <button
                onClick={() => canSelect && onSelectPlan(plan.id)}
                disabled={!canSelect}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  isSelected
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isSelected ? 'Selected' : plan.cta}
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
