// src/pages/dashboard/NicheCustomization/UpgradeModal.tsx

import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Need More Niches?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upgrade your plan to add more niches to your store
              </p>
            </div>

            {/* Plan options */}
            <div className="space-y-3 mb-6">
              <div className="p-4 border-2 border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-900/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Three Niches
                  </span>
                  <span className="text-orange-600 font-bold">₦10,000/mo</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  3 niches + all features
                </p>
              </div>

              <div className="p-4 border-2 border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Unlimited
                  </span>
                  <span className="text-purple-600 font-bold">₦100,000/mo</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Unlimited niches + VIP support
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Maybe Later
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  window.location.href = '/dashboard/subscription';
                }}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                View Plans
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}