// src/pages/admin/AdminJumiaWithdrawals.tsx
// Mirrors AdminWithdrawals.tsx's approve/reject pattern exactly, calling the new
// admin-jumia-withdrawal-action Edge Function (JWT + role-checked, RPC-backed, sends email).

import { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, XCircle, Building2, User, X } from 'lucide-react';
import { useJumiaStore } from '@/stores/jumiaStore';
import { useAuthStore } from '@/stores';
import { supabase } from '@/services';
import { toast } from 'sonner';

export default function AdminJumiaWithdrawals() {
  const { user } = useAuthStore();
  const { allWithdrawalRequests, fetchAllWithdrawalRequests } = useJumiaStore();
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; amount: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchAllWithdrawalRequests();
  }, [fetchAllWithdrawalRequests]);

  const pending = allWithdrawalRequests.filter((w) => w.status === 'pending');
  const totalPending = pending.reduce((s, w) => s + Number(w.amount), 0);

  const callAction = async (action: 'paid' | 'rejected', requestId: string, reason?: string) => {
    const { error } = await supabase.functions.invoke('admin-jumia-withdrawal-action', {
      body: { action, request_id: requestId, admin_id: user!.id, reason },
    });
    return error;
  };

  const handleApprovePaid = async (id: string) => {
    setProcessing(id);
    const error = await callAction('paid', id);
    if (!error) {
      toast.success('Marked as paid — user notified by email');
      fetchAllWithdrawalRequests();
    } else {
      toast.error(error.message || 'Failed to mark as paid');
    }
    setProcessing(null);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !rejectReason.trim()) { toast.error('Please enter a reason for rejection'); return; }
    setProcessing(rejectTarget.id);
    const error = await callAction('rejected', rejectTarget.id, rejectReason.trim());
    if (!error) {
      toast.success('Rejected — user notified by email');
      fetchAllWithdrawalRequests();
      setRejectTarget(null);
      setRejectReason('');
    } else {
      toast.error(error.message || 'Failed to reject withdrawal');
    }
    setProcessing(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jumia Withdrawals</h1>
        <p className="text-gray-500 mt-1">Review and manually pay out Jumia earnings withdrawals</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Pending Requests</p>
          <p className="text-3xl font-bold text-gray-900">{pending.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Pending Amount</p>
          <p className="text-3xl font-bold text-gray-900">₦{totalPending.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Pending Requests</h2>
        </div>

        {pending.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No pending Jumia withdrawals</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map((w) => (
              <div key={w.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{w.user?.full_name || '—'}</p>
                      <p className="text-xs text-gray-500">{w.user?.email}</p>
                      <p className="font-bold text-gray-900 mt-1">₦{Number(w.amount).toLocaleString()}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{w.bank_name}</span>
                        <span>{w.account_number}</span>
                        <span className="font-medium text-gray-700">{w.account_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprovePaid(w.id)}
                      disabled={processing === w.id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-60"
                    >
                      {processing === w.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : <CheckCircle className="w-4 h-4" />}
                      Mark Paid
                    </button>
                    <button
                      onClick={() => setRejectTarget({ id: w.id, amount: Number(w.amount) })}
                      disabled={processing === w.id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium border border-red-200"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Reject Withdrawal</h3>
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Rejecting ₦{rejectTarget.amount.toLocaleString()} — the user will be notified by email.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none text-sm resize-none mb-5"
              placeholder="e.g. Invalid account details, please update and resubmit."
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || !!processing}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {processing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
