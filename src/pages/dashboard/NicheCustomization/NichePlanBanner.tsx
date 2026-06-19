// src/pages/dashboard/NicheCustomization/NichePlanBanner.tsx

import { motion } from 'framer-motion';
import { Store } from 'lucide-react';
import { PRICING_TIERS } from '@/lib/pricing';

interface Props {
  normalizedTier: string;
  maxNiches: number | typeof Infinity;
  selectedCount: number;
  remainingSlots: number | string;
}

export default function NichePlanBanner({
  normalizedTier,
  maxNiches,
  selectedCount,
  remainingSlots,
}: Props) {
  const planName = PRICING_TIERS.find((t) => t.id === normalizedTier)?.name || 'Free Trial';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-5 h-5" />
            <span className="font-medium">Current Plan</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">{planName}</h2>
          <p className="text-orange-100">
            {maxNiches === Infinity
              ? 'Unlimited niches available'
              : `Up to ${maxNiches} niche${maxNiches > 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="text-right">
          <p className="text-3xl font-bold">{selectedCount}</p>
          <p className="text-orange-100">niche(s) selected</p>
          {maxNiches !== Infinity && (
            <p className="text-sm mt-1 text-orange-100">
              {remainingSlots} slot(s) remaining
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}