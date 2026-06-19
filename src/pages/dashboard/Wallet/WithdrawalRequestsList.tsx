// src/pages/dashboard/Wallet/WithdrawalRequestsList.tsx

import { motion } from 'framer-motion';

interface WithdrawalRequest {
  id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  status: 'pending' | 'paid' | 'rejected';
  created_at: string;
}

interface Props {
  withdrawalRequests: WithdrawalRequest[];
}

export default function WithdrawalRequestsList({ withdrawalRequests }: Props) {
  if (withdrawalRequests.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6"
    >
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Withdrawal Requests
      </h2>

      <div className="space-y-3">
        {withdrawalRequests.slice(0, 5).map((req) => (
          <div
            key={req.id}
            className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700 last:border-0"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                ₦{req.amount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {req.bank_name} · ••••{req.account_number.slice(-4)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(req.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>

            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              req.status === 'paid'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : req.status === 'rejected'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {req.status}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}