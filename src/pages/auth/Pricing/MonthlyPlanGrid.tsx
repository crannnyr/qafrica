// src/pages/auth/Pricing/MonthlyPlanGrid.tsx

import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { monthlyPlans } from './constants';

interface Props {
  selectedPlan: string;
  selectedDuration: number;
  onSelectPlan: (planId: string) => void;
  calculatePrice: (planId: string, duration: number) => number;
  canSelectPlan: (maxNiches: number) => boolean;
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
        const Icon      = plan.icon;
        const price     = calculatePrice(plan.id, selectedDuration);
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
              {/* Plan header */}
              <div className="text-center mb-6">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                  isSelected ? 'bg-orange-500' : 'bg-orange-100'
                }`}>
                  <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-orange-500'}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-bold text-gray-900">
                    ₦{price.toLocaleString()}
                  </span>
                  <span className="text-gray-500">
                    /{selectedDuration === 1 ? 'month' : `${selectedDuration} months`}
                  </span>
                </div>
                {selectedDuration > 1 && (
                  <p className="text-sm text-green-600 mt-1">
                    You save ₦{((plan.basePrice * selectedDuratio