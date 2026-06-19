// src/pages/dashboard/NicheCustomization/SelectedNicheGrid.tsx

import { motion } from 'framer-motion';
import { Check, Lock, X, Package, TrendingUp } from 'lucide-react';
import { NICHE_CATEGORIES } from '@/lib/nicheCategories';

interface NicheStatus {
  id: string;
  name: string;
  canRemove: boolean;
  reason: string;
  productCount: number;
  hasSales: boolean;
}

interface Props {
  selectedNiches: string[];
  nicheStatuses: Record<string, NicheStatus>;
  onToggle: (nicheId: string) => void;
}

export default function SelectedNicheGrid({
  selectedNiches,
  nicheStatuses,
  onToggle,
}: Props) {
  if (selectedNiches.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Your Selected Niches
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {selectedNiches.map((nicheId) => {
          const niche  = NICHE_CATEGORIES[nicheId];
          const status = nicheStatuses[nicheId];

          return (
            <motion.div
              key={nicheId}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {niche?.name || nicheId}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {niche?.description}
                  </p>

                  {status && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className={status.productCount > 0 ? 'text-orange-600' : 'text-gray-500'}>
                          {status.productCount} product{status.productCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {status.hasSales && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <TrendingUp className="w-4 h-4" />
                          <span>Has sales</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* Remove button */}
              <button
                onClick={() => onToggle(nicheId)}
                disabled={status && !status.canRemove}
                title={status?.reason}
                className={`mt-4 w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  status && !status.canRemove
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                {status && !status.canRemove ? (
                  <span className="flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" /> Locked
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <X className="w-4 h-4" /> Remove
                  </span>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}