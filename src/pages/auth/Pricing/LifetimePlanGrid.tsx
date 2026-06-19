// src/pages/auth/Pricing/LifetimePlanGrid.tsx

import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { lifetimePlans } from './constants';

interface Props {
  selectedPlan: string;
  onSelectPlan: (planId: string) => void;
  canSelectPlan: (maxNiches: number) => boolean;
}

export default function LifetimePlanGrid({
  selectedPlan,
  onSelectPlan,
  canSelectPlan,
}: Props) {
  return (
    <div className="grid lg:grid-cols-3 gap-8 mb-12">
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
            className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
              isSelected
                ? 'border-purple-500 shadow-xl scale-105 bg-white'
                : 'border-gray-200 hover:border-purple-300 hover:shadow-lg bg-white'
            }`}
          >
            {/* Badge */}
            {plan.badge && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-purple-500 text-white text-sm font-medium rounded-full">
                  {plan.badge}
                </span>
              </div>
            )}

            {/* Popular ribbon */}
            {plan.popular && (
              <div className="absolute top-8 -right-12 bg-orange-500 text-white text-xs font-bold px-12 py-1 rotate-45 shadow-lg">
                POPULAR
              </div>
            )}

            {/* Niche limit overlay */}
            {!canSelect && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                <div className="text-center p-4">
                  <p className="text-gray-600 font-medium">Too many niches selected</p>
                  <p className="text-sm text-gray-500">Choose a higher tier</p>
                </div>
              </div>
            )}

            <div className="p-8">
              {/* Plan header */}
              <div className="text-center mb-6">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                  isSelected ? 'bg-purple-500' : 'bg-purple-100'
                }`}>
                  <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-purple-500'}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    ₦{plan.price.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-green-600 mt-1 font-medium">One-time payment</p>
                <p className="text-xs text-gray-500 mt-1">Never pay again</p>
              </div>

              {/* Features */}
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

              {/* Select button */}
              <button
                onClick={() => canSelect && onSelectPlan(plan.id)}
                disabled={!canSelect}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
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