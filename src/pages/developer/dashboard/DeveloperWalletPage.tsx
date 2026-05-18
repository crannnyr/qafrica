// src/pages/developer/dashboard/DeveloperWalletPage.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw,
  Loader2, AlertTriangle, ChevronLeft, ChevronRight,
  TrendingUp, Clock,
} from 'lucide-react';
import { developerWalletService } from '@/services/developer';
import { useDeveloperAuthStore }  from '@/stores/developerAuthStore';
import { WithdrawalModal }        from '@/components/developer/WithdrawalModal';
import type {
  DeveloperWalletSummary,
  DeveloperWalletTransaction,
  DeveloperTransactionType,
  PaginatedResponse,
} from '@/types/developer';

// ── Balance card ──────────────────────────────────────────────
function BalanceCard({
  label, value, sub, icon: Icon, color, delay = 0,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

// ── Transaction type config ───────────────────────────────────
const TX_CONFIG: Record<DeveloperTransactionType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  commission:    { label: 'Commission',    icon: ArrowDownLeft, color: 'text-green-600', bgColor: 'bg-green-50' },
  refund:        { label: 'Refund',        icon: ArrowDownLeft, color: 'text-blue-600',  bgColor: 'bg-blue-50'  },
  adjustment:    { label: 'Adjustment',    icon: ArrowDownLeft, color: 'text-gray-600',  bgColor: 'bg-gray-100' },
  withdrawal:    { label: 'Withdrawal',    icon: ArrowUpRight,  color: 'text-red-600',   bgColor: 'bg-red-50'   },
  plan_payment:  { label: 'Plan Payment',  icon: ArrowUpRight,  color: 'text-orange-600',bgColor: 'bg-orange-50'},
};

// ── Transaction row ───────────────────────────────────────────
function TxRow({ tx }: { tx: DeveloperWalletTransaction }) {
  const cfg     = TX_CONFIG[tx.type] ?? TX_CONFIG.adjustment;
  const Icon    = cfg.icon;
  const isDebit = tx.type === 'withdrawal' || tx.type === 'plan_payment';

  const date = new Date(tx.created_at).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const time = new Date(tx.created_at).toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-50 last:border-0">
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{tx.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {cfg.label} · {date} {time}
        </p>
        {tx.reference && (
          <p className="text-xs font-mono text-gray-300 mt-0.5 truncate">{tx.reference}</p>
        )}
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
          {isDebit ? '−' : '+'}₦{tx.amount.toLocaleString()}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Bal: ₦{tx.balance_after.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperWalletPage() {
  const { developer } = useDeveloperAuthStore();

  const [wallet,           setWallet]           = useState<DeveloperWalletSummary | null>(null);
  const [transactions,     setTransactions]     = useState<DeveloperWalletTransaction[]>([]);
  const [txPage,           setTxPage]           = useState(1);
  const [txTotal,          setTxTotal]          = useState(0);
  const [txPages,          setTxPages]          = useState(1);
  const [isLoading,        setIsLoading]        = useState(true);
  const [txLoading,        setTxLoading]        = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [showWithdrawal,   setShowWithdrawal]   = useState(false);

  const LIMIT = 20;

  async function loadWallet(page = 1) {
    if (page === 1) setIsLoading(true);
    else            setTxLoading(true);
    setError(null);

    try {
      const result = await developerWalletService.getWallet(page, LIMIT);
      setWallet(result.wallet);
      setTransactions(result.transactions.data);
      setTxPage(result.transactions.meta.page);
      setTxTotal(result.transactions.meta.total);
      setTxPages(result.transactions.meta.pages);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load wallet data.');
    } finally {
      setIsLoading(false);
      setTxLoading(false);
    }
  }

  useEffect(() => {
    loadWallet(1);
  }, []);

  // After successful withdrawal, reload wallet
  function handleWithdrawalSuccess() {
    setShowWithdrawal(false);
    loadWallet(1);
  }

  const balance = wallet?.balance ?? 0;
  const canWithdraw = balance >= 1000; // minimum ₦1,000

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
            <p className="text-sm text-gray-500 mt-1">
              Commission tracking and withdrawal history.
            </p>
          </div>
          <button
            onClick={() => loadWallet(txPage)}
            disabled={isLoading || txLoading}
            className="h-9 px-4 border border-gray-200 text-gray-600 font-medium
              rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || txLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        )}

        {!isLoading && wallet && (
          <>
            {/* Balance cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <BalanceCard
                label="Available balance"
                value={`₦${balance.toLocaleString()}`}
                sub="Ready to withdraw"
                icon={Wallet}
                color="bg-orange-50 text-orange-600"
                delay={0}
              />
              <BalanceCard
                label="Total earned"
                value={`₦${wallet.total_earned.toLocaleString()}`}
                sub="All time commissions"
                icon={TrendingUp}
                color="bg-green-50 text-green-600"
                delay={0.1}
              />
              <BalanceCard
                label="Withdrawn"
                value={`₦${wallet.total_withdrawn.toLocaleString()}`}
                sub="All time payouts"
                icon={ArrowUpRight}
                color="bg-blue-50 text-blue-600"
                delay={0.15}
              />
              <BalanceCard
                label="Pending"
                value={`₦${wallet.pending_withdrawal.toLocaleString()}`}
                sub="In review"
                icon={Clock}
                color="bg-gray-100 text-gray-500"
                delay={0.2}
              />
            </div>

            {/* Paystack split info banner */}
            {developer?.paystack_connected && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    Your commissions land directly via Paystack Split
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                    For most orders, your 92% share is deposited into your Paystack account
                    automatically on Paystack's settlement schedule.
                    The balance shown here covers residual tracking amounts only.
                  </p>
                </div>
              </div>
            )}

            {/* Withdraw CTA */}
            <div className="mb-6 flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl shadow-sm">
              <div>
                <p className="font-semibold text-gray-900">Request withdrawal</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Minimum: ₦1,000 · Processing: 2–3 business days
                </p>
              </div>
              <button
                onClick={() => setShowWithdrawal(true)}
                disabled={!canWithdraw}
                title={!canWithdraw ? 'Minimum withdrawal is ₦1,000' : undefined}
                className="h-10 px-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                  disabled:cursor-not-allowed text-white font-semibold rounded-xl
                  transition-colors text-sm"
              >
                Withdraw
              </button>
            </div>

            {/* Transaction list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Transaction history</h2>
                <p className="text-xs text-gray-400">{txTotal.toLocaleString()} transactions</p>
              </div>

              {txLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                </div>
              )}

              {!txLoading && transactions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400">No transactions yet.</p>
                </div>
              )}

              {!txLoading && transactions.length > 0 && (
                <div className="px-5">
                  {transactions.map((tx) => (
                    <TxRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {txPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Page {txPage} of {txPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadWallet(txPage - 1)}
                      disabled={txPage <= 1 || txLoading}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center
                        justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => loadWallet(txPage + 1)}
                      disabled={txPage >= txPages || txLoading}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center
                        justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Withdrawal modal */}
      <AnimatePresence>
        {showWithdrawal && (
          <WithdrawalModal
            walletBalance={wallet?.balance ?? 0}
            onClose={() => setShowWithdrawal(false)}
            onSuccess={handleWithdrawalSuccess}
          />
        )}
      </AnimatePresence>
    </>
  );
}