// src/pages/import-admin/RefundsManager.tsx
// Admin "Refunds" tab: shows every cancelled order's refund status. Admin's
// job here is just to see the customer's bank details once submitted, pay
// them externally, and mark it paid — history stays visible permanently.
import { useState, useEffect, useCallback } from 'react';
import { Loader, Landmark, Clock, CheckCircle2, Copy } from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/refunds`;

interface Refund {
  id: string;
  code: string;
  customer_name: string;
  items: Array<{ name: string; quantity: number }>;
  total_ngn: number;
  cancel_reason: string;
  status: 'pending' | 'submitted' | 'paid';
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_details_submitted_at: string | null;
  paid_at: string | null;
  cancelled_at: string;
}

function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting bank details',
  submitted: 'Ready to pay',
  paid: 'Paid',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  submitted: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
};

export default function RefundsManager({ token }: { token: string }) {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'paid'>('submitted');
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-list-refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      setRefunds(data.refunds ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (refund: Refund) => {
    setPayingId(refund.id);
    try {
      await fetch(`${EDGE_URL}?action=admin-mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, refund_id: refund.id }),
      });
      toast.success(`Marked ${refund.code} as paid — customer notified`);
      await load();
    } finally {
      setPayingId(null);
    }
  };

  const copyDetails = (r: Refund) => {
    navigator.clipboard.writeText(`${r.bank_account_name}\n${r.bank_account_number}\n${r.bank_name}`);
    toast.success('Bank details copied');
  };

  const filtered = filter === 'all' ? refunds : refunds.filter(r => r.status === filter);
  const counts = {
    pending: refunds.filter(r => r.status === 'pending').length,
    submitted: refunds.filter(r => r.status === 'submitted').length,
    paid: refunds.filter(r => r.status === 'paid').length,
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto">
        {(['submitted', 'pending', 'paid', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
            {f === 'all' ? `All (${refunds.length})` : `${STATUS_LABELS[f]} (${counts[f]})`}
          </button>
        ))}
      </div>

      <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse h-20" />
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-300">No refunds in this view.</p>
          </div>
        ) : (
          filtered.map(r => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-gray-800">{r.code}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{r.customer_name}</p>
              <p className="text-xs text-gray-400 mb-2">{fmt(r.total_ngn)} · cancelled {new Date(r.cancelled_at).toLocaleDateString()}</p>
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 mb-2">{r.cancel_reason}</p>

              {r.status === 'pending' && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Waiting for customer to submit bank details.
                </p>
              )}

              {(r.status === 'submitted' || r.status === 'paid') && r.bank_account_number && (
                <div className="bg-gray-50 rounded-xl p-3 flex items-start justify-between gap-2">
                  <div className="text-xs text-gray-700 space-y-0.5">
                    <p className="font-semibold">{r.bank_account_name}</p>
                    <p className="font-mono">{r.bank_account_number}</p>
                    <p className="text-gray-500">{r.bank_name}</p>
                  </div>
                  <button onClick={() => copyDetails(r)} className="p-1.5 hover:bg-gray-200 rounded-lg flex-shrink-0">
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              )}

              {r.status === 'submitted' && (
                <button
                  onClick={() => markPaid(r)}
                  disabled={payingId === r.id}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-3 py-2 rounded-lg transition-colors"
                >
                  {payingId === r.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />}
                  Mark as Paid
                </button>
              )}

              {r.status === 'paid' && (
                <p className="mt-2 text-[11px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Paid {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : ''}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
