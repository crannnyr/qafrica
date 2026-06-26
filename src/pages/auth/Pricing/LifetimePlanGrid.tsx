// src/pages/auth/Pricing/LifetimePlanGrid.tsx

import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import { lifetimePlans } from './constants';

interface Props {
  selectedPlan: string;
  onSelectPlan: (planId: string) => void;
  canSelectPlan: (maxNiches: number) => boolean;
}

function NichePill({ count }: { count: number }) {
  if (!isFinite(count)) return (
    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border-2 border-green-200">
      Unlimited Niches
    </span>
  );
  if (count === 3) return (
    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border-2 border-amber-200">
      3 Niches
    </span>
  );
  return (
    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-600 border-2 border-orange-200">
      1 Niche
    </span>
  );
}

function StaffPill({ limit }: { limit: number }) {
  if (limit === 0) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-500 border border-red-200">
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

export default function LifetimePlanGrid({
  selectedPlan,
  onSelectPlan,
  canSelectPlan,
}: Props) {
  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Own It Forever</h2>
        <p className="text-gray-500 text-sm">One payment. Lifetime access. Never pay again.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-12">
        {lifetimePlans.map((plan, index) => {
          const Icon       = plan.icon;
          const isSelected = selectedPlan === plan.id;
          const canSelect  = canSelectPlan(plan.maxNiches);

          return (
            <motion.div
              key={`lifetime-${plan.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl border-2 transition-all duration-300 bg-white overflow-hidden ${
                isSelected
                  ? 'border-purple-500 shadow-xl scale-105'
                  : 'border-gray-200 hover:border-purple-300 hover:shadow-lg'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Niche limit overlay */}
              {!canSelect && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                  <div className="text-center p-4">
                    <p className="text-gray-600 font-medium text-sm">Too many niches selected</p>
                    <p className="text-xs text-gray-500">Choose a higher tier</p>
                  </div>
                </div>
              )}

              <div className="p-6">
                {/* Icon + name */}
                <div className="text-center mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                    isSelected ? 'bg-purple-500' : 'bg-purple-100'
                  }`}>
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-purple-500'}`} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mb-3">{plan.description}</p>

                  {/* Pills */}
                  <div className="flex flex-col items-center gap-2">
                    <NichePill count={plan.maxNiches} />
                    <StaffPill limit={plan.staffLimit} />
                  </div>
                </div>

                {/* Price */}
                <div className="text-center py-3 px-4 bg-gray-50 rounded-xl mb-4">
                  <div className="text-2xl font-bold text-gray-900">
                    ₦{plan.price.toLocaleString()}
                  </div>
                  <p className="text-xs text-green-600 font-bold mt-1">One-time payment</p>
                  <p className="text-xs text-gray-400">Never pay again</p>
                </div>

                {/* What's different */}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide text-center mb-3">
                  What's different
                </p>
                <ul className="space-y-2 mb-5">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className={`w-4 h-4 flex-shrink-0 ${
                      isSelected ? 'text-purple-500' : 'text-gray-400'
                    }`} />
                    {isFinite(plan.maxNiches)
                      ? `${plan.maxNiches} niche${plan.maxNiches > 1 ? 's' : ''} forever`
                      : 'Unlimited niches forever'}
                  </li>
                  {plan.staffLimit > 0 ? (
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? 'text-purple-500' : 'text-gray-400'
                      }`} />
                      Up to {plan.staffLimit} staff forever
                    </li>
                  ) : (
                    <li className="flex items-center gap-2 text-sm text-gray-400">
                      <XCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                      No staff management
                    </li>
                  )}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => canSelect && onSelectPlan(plan.id)}
                  disabled={!canSelect}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    isSelected
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isSelected ? '✓ Selected' : plan.cta}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
