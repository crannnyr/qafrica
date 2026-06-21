// src/pages/dashboard/Jumia/JumiaWalletBalanceCards.tsx
// Jumia has no escrow — money is credited straight to balance when admin logs a sale.
// Deliberately NOT reusing WalletBalanceCards.tsx, which hardcodes escrow copy that doesn't apply here.

import { motion } from 'framer-motion';
import { Wallet, ArrowUpRight, TrendingUp } from 'lucide-react';

interface Props {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  onWithdraw: () => void;
}

export default function JumiaWalletBalanceCards({ balance, totalEarned, totalWithdrawn, onWithdraw }: Props) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-orange-100 mb-1 font-medium">Jumia Wallet Balance</p>
              <p className="text-4xl font-bold">₦{balance.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
          <button
            onClick={onWithdraw}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-colors shadow-sm mt-6"
          >
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </button>
        </div>
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm"
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-gray-500 dark:text-gray-400 font-medium">Total Earned from Jumia</p>
          <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">₦{totalEarned.toLocaleString()}</p>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm">Total Withdrawn</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">₦{totalWithdrawn.toLocaleString()}</p>
        </div>
      </motion.div>
    </div>
  );
}
