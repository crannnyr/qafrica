// src/pages/auth/Pricing/FreePlanBanner.tsx

import { Clock, Loader2, ArrowRight } from 'lucide-react';
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
      className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 mb-8 text-white"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">Try Free for 4 Days</h2>
              <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                NO CARD NEEDED
              </span>
            </div>
            <p className="text-orange-100">
              Full access to all features with 1 niche. Upgrade anytime.
            </p>
          </div>
        </div>

        <Button
          onClick={onContinue}
          disabled={isLoading}
          className="bg-white text-orange-600 hover:bg-orange-50 font-bold px-8 h-12 flex-shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
