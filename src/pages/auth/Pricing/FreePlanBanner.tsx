// src/pages/auth/Pricing/FreePlanBanner.tsx

import { ArrowRight, Loader2, SkipForward } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface Props {
  isLoading: boolean;
  onContinue: () => void;
}

export default function FreePlanBanner({ isLoading, onContinue }: Props) {
  return (
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
            <p className="text-gray-200">
              Continue with our free plan. You can upgrade anytime.
            </p>
          </div>
        </div>

        <Button
          onClick={onContinue}
          disabled={isLoading}
          variant="secondary"
          className="bg-white text-gray-700 hover:bg-gray-100 px-8 h-12"
        >
          {isLoading ? (
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
  );
}