import { useEffect, useState } from 'react';
import {
  CreditCard, CheckCircle, XCircle, Building2, User,
  AlertTriangle, RefreshCw, Clock, X
} from 'lucide-react';
import { useWalletStore } from '@/stores';
import { useAuthStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

interface FailureLog {
  id: string;
  failure_type: string;
  entity_type: string;
  entity_id: string;
  error_message: string;
  metadata: Record<string, any>;
  is_resolved: boolean;
  created_at: string;
  affected_user_name: string | null;
  affected_user_email: string | null;
  affected_user_phone: string | null;
}

export default function AdminWithdrawals() {
  const { user } = useAuthStore();
  const { pendingWithdrawals, fetchPendingWithdrawals } = useWalletStore();
  const [processing, setProcessing] = useState<string | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<{ id: string; amount: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Failure logs
  const [failureLogs, setFailureLogs] = useState<FailureLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Processed today count
  const [processedToday, setProcessedToday] = useState(0);

  useEffect(() => {
    fetchPendingWithdrawals();
    fetchFailureLogs();
    fetchProcessedToday();
  }, [fetchPendingWithdrawals]);

  const fetchFailureLogs = async () => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('admin_failure_dashboard')
      .select('*')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setFailureLogs(data as FailureLog[]);
    setLogsLoading(false);
  };

  const fetchProcessedToday = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid')
      .gte('paid_at', today.toISOString());
    setProcessedToday(count ?? 0);
  };

  const resolveFailureLog = async (logId: string) => {
    await supabase
      .from('system_failure_logs')
      .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id })
      .eq('id', logId);
    setFailureLogs(prev => prev.filter(l => l.id !== logId));
    toast.success('Marked as resolved');
  };

  const handleApprovePaid = async (withdrawal: { id: string }) => {
    if (!user?.id) return;
    setProcessing(withdrawal.id);

    const { error } = await supabase.functions.invoke('admin-withdrawal-action', {
      body: { action: 'paid', request_id: withdrawal.id, admin_id: user.id },
    });

    if (!error) {
      toast.success('Marked as paid — user notified by email');
      fetchPendingWithdrawals();
      fetchProcessedToday();
    } else {
      toast.error(error.message || 'Failed to mark as paid');
    }
    setProcessing(null);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !user?.id || !rejectReason.trim()) {
      toast.error('Please enter a reason for rejection'); return;
    }
    setProcessing(rejectTarget.id);

    const { error } = await supabase.functions.invoke('admin-withdrawal-action', {
      body: { action: 'rejected', request_id: rejectTarget.id, admin_id: user.id, reason: rejectReason.trim() },
    });

    if (!error) {
      toast.success('Rejected — funds returned to user wallet, user notified');
      fetchPendingWithdrawals();
      setRejectTarget(null);
      setRejectReason('');
    } else {
      toast.error(error.message || 'Failed to reject withdrawal');
    }
    setProcessing(null);
  };

  const totalPending = pendingWithdrawals.reduce((s, w) => s + w.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Withdrawals</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage withdrawal requests — process within 34 hours</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 mb-1">Pending</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingWithdrawals.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 mb-1">Total Pending Amount</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">₦{totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 mb-1">Processed Today</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{processedToday}</p>
        </div>
      </div>

      {/* Failure Logs */}
      {(logsLoading || failureLogs.length > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-red-800 dark:text-red-300">System Failures Requiring Attention</h2>
              {failureLogs.length > 0 && (
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{failureLogs.length}</span>
              )}
            </div>
            <button onClick={fetchFailureLogs} className="text-red-600 hover:text-red-800 p-1 rounded">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {logsLoading ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading failure logs…</div>
          ) : (
            <div className="divide-y divide-red-100 dark:divide-red-900/30">
              {failureLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded uppercase tracking-wider">
                        {log.failure_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{log.error_message}</p>
                    {log.affected_user_name && (
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.affected_user_name}</span>
                        {log.affected_user_email && <span>{log.affected_user_email}</span>}
                        {log.affected_user_phone && <span>{log.affected_user_phone}</span>}
                      </div>
                    )}
                    {log.entity_id && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        {log.entity_type}: {log.entity_id.slice(0, 8)}…
                        {log.metadata?.order_number && ` (${log.metadata.order_number})`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => resolveFailureLog(log.id)}
                    className="flex-shrink-0 text-xs text-green-600 hover:text-green-800 font-semibold border border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Withdrawals */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Requests</h2>
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            Process within 34 hours of submission
          </div>
        </div>

        {pendingWithdrawals.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No pending withdrawals</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {pendingWithdrawals.map((withdrawal) => {
              const w = withdrawal as any;
              const hoursOld = Math.floor((Date.now() - new Date(withdrawal.created_at).getTime()) / 3600000);
              const isUrgent = hoursOld >= 24;

              return (
                <div key={withdrawal.id} className={`p-6 ${isUrgent ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isUrgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
                      }`}>
                        <User className={`w-6 h-6 ${isUrgent ? 'text-red-500' : 'text-orange-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {w.user?.full_name && (
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">{w.user.full_name}</p>
                        )}
                        {w.user?.email && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{w.user.email}</p>
                        )}
                        <p className="font-bold text-gray-900 dark:text-white mt-1">₦{withdrawal.amount.toLocaleString()}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {withdrawal.bank_name}
                          </span>
                          <span>{withdrawal.account_number}</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{withdrawal.account_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs font-medium ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                            {hoursOld}h ago
                          </span>
                          {isUrgent && (
                            <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprovePaid({ id: withdrawal.id })}
                        disabled={processing === withdrawal.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-60"
                      >
                        {processing === withdrawal.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Mark Paid
                      </button>
                      <button
                        onClick={() => setRejectTarget({ id: withdrawal.id, amount: withdrawal.amount })}
                        disabled={processing === withdrawal.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium border border-red-200 dark:border-red-800"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reject Withdrawal</h3>
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Rejecting ₦{rejectTarget.amount.toLocaleString()} — funds will be returned to the user's wallet and they will be notified by email.
            </p>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reason for rejection</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="e.g. Invalid account details, please update your bank account and resubmit."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || !!processing}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {processing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}