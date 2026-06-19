// src/pages/dashboard/Wallet/EscrowTimeline.tsx

import { motion } from 'framer-motion';
import { Clock, Lock, Info } from 'lucide-react';

interface Transaction {
  id: string;
  description: string;
  created_at: string;
  amount: number;
  status: string;
}

interface Props {
  escrowTxs: Transaction[];
}

export default function EscrowTimeline({ escrowTxs }: Props) {
  if (escrowTxs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <Clock className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Expected Funds
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Escrow releases — when they become withdrawable
          </p>
        </div>
      </div>

      {/* Escrow transactions */}
      <div className="space-y-3">
        {escrowTxs.slice(0, 5).map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700 last:border-0"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {tx.description}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Held since{' '}
                {new Date(tx.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-blue-600">
                +₦{tx.amount.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Lock className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400">In escrow</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Funds release 7 days after the seller marks the order as shipped,
          provided no dispute is filed. Once released, they appear in your
          available balance and can be withdrawn on the next payout day.
        </p>
      </div>
    </motion.div>
  );
}