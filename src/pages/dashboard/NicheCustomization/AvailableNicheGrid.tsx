// src/pages/dashboard/NicheCustomization/AvailableNicheGrid.tsx

import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NICHE_CATEGORIES, getNicheDisplayList } from '@/lib/nicheCategories';

interface Props {
  selectedNiches: string[];
  maxNiches: number | typeof Infinity;
  onToggle: (nicheId: string) => void;
  onUpgrade: () => void;
}

export default function AvailableNicheGrid({
  selectedNiches,
  maxNiches,
  onToggle,
  onUpgrade,
}: Props) {
  const allNiches    = getNicheDisplayList();
  const isAtLimit    = maxNiches !== Infinity && selectedNiches.length >= maxNiches;
  const available    = allNiches.filter((n) => !selectedNiches.includes(n.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Available Niches
      </h2>

      {/* Limit warning */}
      {isAtLimit && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-300">
              Niche limit reached
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              You've selected the maximum number of niches for your plan.
              Upgrade to add more niches.
            </p>
            <Button
              onClick={onUpgrade}
              className="mt-3 bg-orange-500 hover:bg-orange-600 text-white"
              size="sm"
            >
              Upgrade Plan
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {available.map((niche) => (
          <motion.div
            key={niche.id}
            whileHover={{ scale: isAtLimit ? 1 : 1.02 }}
            whileTap={{ scale: isAtLimit ? 1 : 0.98 }}
            onClick={() => !isAtLimit && onToggle(niche.id)}
            className={`border-2 rounded-xl p-4 transition-colors ${
              isAtLimit
                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50 cursor-pointer'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {niche.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {niche.description}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {NICHE_CATEGORIES[niche.id]?.categories.length || 0} categories
                </p>
              </div>

              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                isAtLimit ? 'border-gray-200' : 'border-gray-300'
              }`}>
                {isAtLimit
                  ? <Lock className="w-4 h-4 text-gray-400" />
                  : <span className="text-gray-400">+</span>
                }
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}