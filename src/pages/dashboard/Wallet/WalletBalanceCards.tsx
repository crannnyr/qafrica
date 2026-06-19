// src/pages/dashboard/Wallet/WalletBalanceCards.tsx

import { motion } from 'framer-motion';
import { Wallet, ArrowUpRight, Clock, AlertCircle } from 'lucide-react';

interface Props {
  availableBalance: number;
  escrowBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  onWithdraw: () => void;
}

export default function WalletBalanceCards({
  availableBalance,
  escrowBalance,
  totalEarned,
  totalWithdrawn,
  onWithdraw,
}: Props) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Available Balance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-orange-100 mb-1 font-medium">Available to Withdraw</p>
              <p className="text-4xl font-bold">₦{availableBalance.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
          <div className="flex gap-4 mt-6">
            <button
              onClick={onWithdraw}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-colors shadow-sm"
            >
              <ArrowUpRight className="w-4 h-4" />
              Withdraw
            </button>
          </div>
        </div>
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </motion.div>

      {/* Escrow Balance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-center"
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-1 font-medium flex items-center gap-2">
              In Escrow
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ₦{escrowBalance.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-100 dark:border-gray-600">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          Releases 7 days after seller marks order as shipped.
        </p>
      </motion.div>

      {/* Lifetime Earnings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm"
      >
        <p className="text-gray-500 dark:text-gray-400 mb-1 font-medium">
          Total Earned (Lifetime)
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          ₦{totalEarned.toLocaleString()}
        </p>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm">Total Withdrawn</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ₦{totalWithdrawn.toLocaleString()}
          </p>
        </div>
      </motion.div>
    </div>
  );
}