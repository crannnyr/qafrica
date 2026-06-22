import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Building2, User, Clock, X, RefreshCw, Copy } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  admin_note: string | null;
  created_at: string;
  paid_at: string | null;
  full_name: string;
  email: string;
  phone: string | null;
}

export default function AdminWithdrawals() {
  const { user } = useAuthStore();
  const [withdrawals, setWithdrawals]   = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [processing, setProcessing]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [rejectModal, setRejectModal]   = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processedToday, setProcessedToday] = useState(0);

  const fetchWithdrawals = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select(`
        id, amount, status, bank_name, account_number,
        account_name, admin_note, created_at, paid_at,
        profiles!withdrawal_requests_user_id_fkey (full_name, email, phone)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setWithdrawals(data.map((w: any) => ({
        ...w,
        full_name: w.profiles?.full_name || '—',
        email:     w.profiles?.email     || '—',
        phone:     w.profiles?.phone     || null,
      })));
    } else {
      toast.error('Failed to load withdrawals');
    }
    setIsLoading(false);
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

  useEffect(() => {
    fetchWithdrawals();
    fetchProcessedToday();
  }, []);

  const filtered = withdrawals.filter(w => w.status === statusFilter);
  const pending  = withdrawals.filter(w => w.status === 'pending');
  const totalPending = pending.reduce((s, w) => s + Number(w.amount), 0);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleApprovePaid = async (w: Withdrawal) => {
    if (!user?.id) return;
    setProcessing(w.id);
    const { error } = await supabase.functions.invoke('admin-withdrawal-action', {
      body: { action: 'paid', request_id: w.id, admin_id: user.id },
    });
    if (error) toast.error(error.message || 'Failed to mark as paid');
    else {
      toast.success('Marked as paid — user notified');
      await fetchWithdrawals();
      await fetchProcessedToday();
    }
    setProcessing(null);
  };

  const handleReject = async () => {
    if (!rejectModal || !user?.id) return;
    if (!rejectReason.trim()) { toast.error('Enter a rejection reason'); return; }
    setProcessing(rejectModal.id);
    const { error } = await supabase.functions.invoke('admin-withdrawal-action', {
      body: { action: 'rejected', request_id: rejectModal.id, admin_id: user.id, reason: rejectReason.trim() },
    });
    if (error) toast.error(error.message || 'Failed to reject');
    else {
      toast.success('Rejected — funds returned to wallet');
      setRejectModal(null);
      setRejectReason('');
      await fetchWithdrawals();
    }
    setProcessing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Withdrawals</h1>
          <p className="text-xs text-gray-400 mt-0.5">Process within 34 hours of submission</p>
        </div>
        <button onClick={() => { fetchWithdrawals(); fetchProcessedToday(); }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending',          value: pending.length,                         color: 'text-amber-600', bg: 'bg-amber-50'  },
          { label: 'Total Pending ₦',  value: `₦${totalPending.toLocaleString()}`,    color: 'text-red-600',   bg: 'bg-red-50'    },
          { label: 'Processed Today',  value: processedToday,                         color: 'text-green-600', bg: 'bg-green-50'  },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 border border-gray-100`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['pending', 'paid', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              statusFilter === s
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
            }`}>
            {s} ({withdrawals.filter(w => w.status === s).length})
          </button>
        ))}
      </div>

      {/* Withdrawals List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-12 text-center">
            <p className="text-sm text-gray-400">No {statusFilter} withdrawals</p>
          </div>
        ) : filtered.map(w => {
          const hoursOld = Math.floor((Date.now() - new Date(w.created_at).getTime()) / 3600000);
          const isUrgent = w.status === 'pending' && hoursOld >= 24;

          return (
            <div key={w.id} className={`bg-white rounded-xl border shadow-sm p-4 ${
              isUrgent ? 'border-red-200 bg-red-50/30' : 'border-gray-100'
            }`}>
              <div className="flex items-start justify-between gap-4">
                {/* Left: user + bank info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isUrgent ? 'bg-red-100' : 'bg-orange-100'
                  }`}>
                    <User className={`w-4 h-4 ${isUrgent ? 'text-red-500' : 'text-orange-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* User details with copy */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-gray-900">{w.full_name}</p>
                      {isUrgent && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">
                          OVERDUE {hoursOld}h
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-[10px] text-gray-400">{w.email}</p>
                      <button onClick={() => copy(w.email, 'Email')} className="p-0.5 hover:bg-gray-100 rounded">
                        <Copy className="w-2.5 h-2.5 text-gray-300 hover:text-gray-500" />
                      </button>
                    </div>
                    {w.phone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[10px] text-gray-400">{w.phone}</p>
                        <button onClick={() => copy(w.phone!, 'Phone')} className="p-0.5 hover:bg-gray-100 rounded">
                          <Copy className="w-2.5 h-2.5 text-gray-300 hover:text-gray-500" />
                        </button>
                      </div>
                    )}

                    {/* Bank details */}
                    <div className="mt-2 p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        <p className="text-xs font-medium text-gray-700">{w.bank_name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-gray-600 font-mono">{w.account_number}</p>
                        <button onClick={() => copy(w.account_number, 'Account number')} className="p-0.5 hover:bg-gray-200 rounded">
                          <Copy className="w-2.5 h-2.5 text-gray-400" />
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{w.account_name}</p>
                    </div>

                    {/* Amount + time */}
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-sm font-bold text-gray-900">₦{Number(w.amount).toLocaleString()}</p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        {w.status === 'paid' && w.paid_at
                          ? `Paid ${new Date(w.paid_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`
                          : `${hoursOld}h ago`
                        }
                      </div>
                    </div>

                    {w.admin_note && (
                      <p className="text-[10px] text-gray-400 mt-1 italic">Note: {w.admin_note}</p>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                {w.status === 'pending' && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => handleApprovePaid(w)} disabled={processing === w.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
                      {processing === w.id
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle className="w-3.5 h-3.5" />
                      }
                      Mark Paid
                    </button>
                    <button onClick={() => setRejectModal(w)} disabled={processing === w.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                )}

                {w.status === 'paid' && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-medium flex-shrink-0">
                    <CheckCircle className="w-3 h-3" /> Paid
                  </span>
                )}

                {w.status === 'rejected' && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-lg text-[10px] font-medium flex-shrink-0">
                    <XCircle className="w-3 h-3" /> Rejected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Reject Withdrawal</h3>
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-1">
              Rejecting <strong>₦{Number(rejectModal.amount).toLocaleString()}</strong> for <strong>{rejectModal.full_name}</strong>.
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Funds will be returned to their wallet and they'll be notified by email.
            </p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid account details, please update and resubmit..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 min-h-[80px] resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleReject} disabled={!!processing || !rejectReason.trim()}
                className="flex-1 px-3 py-2 text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 transition-colors">
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}