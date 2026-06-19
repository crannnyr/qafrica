// src/pages/dashboard/Wallet/WithdrawModal.tsx

import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SavedAccount {
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface Props {
  isOpen: boolean;
  savedAccount: SavedAccount | null;
  availableBalance: number;
  escrowBalance: number;
  withdrawAmount: string;
  isSubmitting: boolean;
  onClose: () => void;
  onAmountChange: (value: string) => void;
  onSetMax: () => void;
  onWithdraw: () => void;
  onAddAccount: () => void;
  onChangeAccount: () => void;
}

export default function WithdrawModal({
  isOpen,
  savedAccount,
  availableBalance,
  escrowBalance,
  withdrawAmount,
  isSubmitting,
  onClose,
  onAmountChange,
  onSetMax,
  onWithdraw,
  onAddAccount,
  onChangeAccount,
}: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Withdraw Funds
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* No account state */}
            {!savedAccount ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                  <Building2 className="w-7 h-7 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    No withdrawal account saved
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Add your bank account details before withdrawing.
                  </p>
                </div>
                <Button
                  onClick={onAddAccount}
                  className="bg-orange-500 hover:bg-orange-600 text-white w-full"
                >
                  Add Bank Account
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Amount input */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Amount (₦)
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 outline-none font-medium text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.00"
                    max={availableBalance}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm font-medium text-orange-600">
                      Available: ₦{availableBalance.toLocaleString()}
                    </p>
                    <button
                      onClick={onSetMax}
                      className="text-xs font-bold text-gray-500 hover:text-gray-900 uppercase tracking-wider bg-gray-100 dark:bg-gray-600 dark:text-gray-300 px-2 py-1 rounded"
                    >
                      Max
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Minimum ₦20,000 · No fees · Processed within 34 hours
                  </p>
                </div>

                {/* Escrow notice */}
                {escrowBalance > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-xl flex gap-3 items-start">
                    <Lock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      <span className="font-bold">
                        ₦{escrowBalance.toLocaleString()}
                      </span>{' '}
                      is in escrow and cannot be withdrawn yet. It releases 7
                      days after orders are shipped.
                    </p>
                  </div>
                )}

                {/* Account preview */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Withdrawing to
                    </p>
                    <button
                      onClick={onChangeAccount}
                      className="text-xs text-orange-500 hover:text-orange-600 underline"
                    >
                      Change
                    </button>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {savedAccount.account_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {savedAccount.bank_name} · ••••{savedAccount.account_number.slice(-4)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={onWithdraw}
                    disabled={
                      isSubmitting ||
                      !withdrawAmount ||
                      parseFloat(withdrawAmount) < 20000
                    }
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    {isSubmitting
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : 'Submit Request'}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}