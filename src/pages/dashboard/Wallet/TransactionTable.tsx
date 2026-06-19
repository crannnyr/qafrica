// src/pages/dashboard/Wallet/TransactionTable.tsx

import { motion } from 'framer-motion';
import { History } from 'lucide-react';

interface Transaction {
  id: string;
  description: string;
  created_at: string;
  amount: number;
  type: 'credit' | 'debit';
  status: string;
  balance_after: number;
}

interface Props {
  transactions: Transaction[];
}

export default function TransactionTable({ transactions }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-6 border-b border-gray-100 dark:border-gray-700">
        <History className="w-5 h-5 text-gray-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Transaction History
        </h2>
      </div>

      {/* Empty state */}
      {transactions.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-gray-600">
            <History className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">No transactions yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Your earnings and withdrawals will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['Date', 'Description', 'Type', 'Amount', 'Balance After'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${
                      i >= 3 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  {/* Date */}
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {new Date(tx.created_at).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </td>

                  {/* Description */}
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {tx.description}
                  </td>

                  {/* Type badge */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      tx.status === 'escrow'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : tx.status === 'pending'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : tx.status === 'reversed'
                        ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        : tx.type === 'credit'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {tx.status === 'escrow'    ? 'In Escrow'
                        : tx.status === 'pending'  ? 'Processing'
                        : tx.status === 'reversed' ? 'Reversed'
                        : tx.type === 'credit'     ? 'Credit'
                        : 'Debit'}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className={`px-6 py-4 text-sm font-bold text-right ${
                    tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                  </td>

                  {/* Balance after */}
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white text-right">
                    ₦{tx.balance_after.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}