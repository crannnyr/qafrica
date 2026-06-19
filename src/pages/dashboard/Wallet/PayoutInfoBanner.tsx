// src/pages/dashboard/Wallet/PayoutInfoBanner.tsx

import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

export default function PayoutInfoBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="rounded-xl p-4 flex items-start gap-3 border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
    >
      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-800 dark:text-blue-300">
        Payouts are processed every Wednesday, Friday, and Sunday within 34 hours.
        Minimum withdrawal is ₦20,000. No fees.
      </p>
    </motion.div>
  );
}