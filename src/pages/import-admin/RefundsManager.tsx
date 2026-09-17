// src/pages/import-admin/RefundsManager.tsx
// Admin "Refunds" tab: shows every cancelled order's refund status.
// Paystack refunds are returned through the original payment method.
// Manual refunds use the customer's submitted bank details.

import { useState, useEffect, useCallback } from 'react';
import {
  Loader,
  Landmark,
  Clock,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/refunds`;

interface Refund {
  id: string;
  code: string;
  customer_name: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;

  // Original order amount
  total_ngn: number;

  // Calculated refund
  refund_amount_ngn: number;
  cancellation_fee_ngn: number;
  refund_policy: string | null;

  cancel_reason: string;

  status: 'pending' | 'submitted' | 'paid';

  // Payment information
  payment_method: 'paystack' | 'manual' | null;
  payment_reference: string | null;
  refund_method: 'paystack' | 'bank' | null;

  // Bank refund
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_details_submitted_at: string | null;

  // Paystack refund
  paystack_refund_id: string | null;
  paystack_refund_status: string | null;
  paystack_refunded_at: string | null;
  refund_error: string | null;

  paid_at: string | null;
  cancelled_at: string;
}

function fmt(n: number) {
  return `₦${Math.round(Number(n || 0)).toLocaleString()}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting refund',
  submitted: 'Ready to refund',
  paid: 'Refunded',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  submitted: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
};

function paystackStatusLabel(status: string | null) {
  if (!status) return null;

  switch (status.toLowerCase()) {
    case 'processing':
      return 'Processing';
    case 'processed':
      return 'Processed';
    case 'completed':
      return 'Completed';
    case 'refunded':
      return 'Refunded';
    case 'needs_attention':
      return 'Needs attention';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export default function RefundsManager({ token }: { token: string }) {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'submitted' | 'paid'
  >('submitted');

  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const res = await fetch(
        `${EDGE_URL}?action=admin-list-refunds`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manager_token: token,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'Failed to load refunds'
        );
      }

      setRefunds(data.refunds ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to load refunds'
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * Manual bank refund.
   *
   * Only available after the customer has submitted bank details.
   */
  const markPaid = async (refund: Refund) => {
    if (refund.payment_method !== 'manual') {
      toast.error('This refund is not a manual bank refund.');
      return;
    }

    if (!refund.bank_account_number) {
      toast.error('Customer bank details have not been submitted.');
      return;
    }

    setPayingId(refund.id);

    try {
      const res = await fetch(
        `${EDGE_URL}?action=admin-mark-paid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manager_token: token,
            refund_id: refund.id,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.refund) {
        throw new Error(
          data.error || 'Failed to mark refund as paid'
        );
      }

      toast.success(
        `Marked ${refund.code} as paid — customer notified`
      );

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to mark refund as paid'
      );
    } finally {
      setPayingId(null);
    }
  };

  /*
   * Paystack refund.
   *
   * The server calculates the refund amount.
   * The frontend only sends the refund ID.
   */
  const refundViaPaystack = async (refund: Refund) => {
    if (refund.payment_method !== 'paystack') {
      toast.error('This refund was not paid through Paystack.');
      return;
    }

    if (!refund.payment_reference) {
      toast.error('Original Paystack payment reference is missing.');
      return;
    }

    if (!refund.refund_amount_ngn || refund.refund_amount_ngn <= 0) {
      toast.error('Invalid refund amount.');
      return;
    }

    if (
      refund.paystack_refund_id ||
      refund.paystack_refund_status === 'processing' ||
      refund.paystack_refund_status === 'processed' ||
      refund.paystack_refund_status === 'completed' ||
      refund.paystack_refund_status === 'refunded'
    ) {
      toast.error('A Paystack refund has already been submitted.');
      return;
    }

    setPayingId(refund.id);

    try {
      const res = await fetch(
        `${EDGE_URL}?action=admin-refund-paystack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manager_token: token,
            refund_id: refund.id,
          }),
        }
      );

      const data = await res.json();

      /*
       * IMPORTANT:
       * The Edge Function returns `success`, not `ok`.
       */
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || 'Paystack refund failed'
        );
      }

      toast.success(
        `${refund.code}: ${fmt(
          refund.refund_amount_ngn
        )} refund submitted to Paystack`
      );

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Paystack refund failed'
      );
    } finally {
      setPayingId(null);
    }
  };

  const copyDetails = (refund: Refund) => {
    const details = [
      refund.bank_account_name,
      refund.bank_account_number,
      refund.bank_name,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard
      .writeText(details)
      .then(() => {
        toast.success('Bank details copied');
      })
      .catch(() => {
        toast.error('Could not copy bank details');
      });
  };

  const filtered =
    filter === 'all'
      ? refunds
      : refunds.filter(
          (refund) => refund.status === filter
        );

  const counts = {
    pending: refunds.filter(
      (refund) => refund.status === 'pending'
    ).length,

    submitted: refunds.filter(
      (refund) => refund.status === 'submitted'
    ).length,

    paid: refunds.filter(
      (refund) => refund.status === 'paid'
    ).length,
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

      {/* Filters */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto">
        {(
          ['submitted', 'pending', 'paid', 'all'] as const
        ).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {f === 'all'
              ? `All (${refunds.length})`
              : `${STATUS_LABELS[f]} (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Refund list */}
      <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="px-5 py-4 animate-pulse h-20"
            />
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-300">
              No refunds in this view.
            </p>
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="px-5 py-4"
            >

              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-gray-800">
                  {r.code}
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    STATUS_COLORS[r.status]
                  }`}
                >
                  {STATUS_LABELS[r.status]}
                </span>
              </div>

              <p className="text-sm font-semibold text-gray-900">
                {r.customer_name}
              </p>

              <p className="text-xs text-gray-400 mb-2">
                Cancelled{' '}
                {new Date(
                  r.cancelled_at
                ).toLocaleDateString()}
              </p>

              {/* Refund calculation */}
              <div className="bg-gray-50 rounded-xl p-3 mb-2 space-y-1.5">

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    Original amount
                  </span>

                  <span className="font-semibold text-gray-800">
                    {fmt(r.total_ngn)}
                  </span>
                </div>

                {r.cancellation_fee_ngn > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">
                      Cancellation fee
                    </span>

                    <span className="font-semibold text-red-600">
                      -{fmt(r.cancellation_fee_ngn)}
                    </span>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm">
                  <span className="font-semibold text-gray-700">
                    Refund amount
                  </span>

                  <span className="font-bold text-gray-900">
                    {fmt(r.refund_amount_ngn)}
                  </span>
                </div>

                {r.refund_policy && (
                  <p className="text-[10px] text-gray-400">
                    Policy {r.refund_policy}
                  </p>
                )}
              </div>

              {/* Cancellation reason */}
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 mb-2">
                {r.cancel_reason}
              </p>

              {/* Payment method */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  Payment
                </span>

                <span className="text-xs font-semibold text-gray-700">
                  {r.payment_method === 'paystack'
                    ? 'Paystack'
                    : r.payment_method === 'manual'
                    ? 'Manual / Bank'
                    : 'Unknown'}
                </span>
              </div>

              {/* Paystack payment information */}
              {r.payment_method === 'paystack' && (
                <div className="bg-blue-50 rounded-xl p-3 mb-2">

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-blue-800">
                      Paystack payment
                    </p>

                    {r.paystack_refund_status && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-blue-700">
                        {paystackStatusLabel(
                          r.paystack_refund_status
                        )}
                      </span>
                    )}
                  </div>

                  {r.payment_reference && (
                    <p className="text-[11px] text-blue-600 mt-1 font-mono break-all">
                      {r.payment_reference}
                    </p>
                  )}

                  {r.paystack_refund_id && (
                    <p className="text-[10px] text-blue-500 mt-1 font-mono break-all">
                      Refund ID: {r.paystack_refund_id}
                    </p>
                  )}

                  {r.refund_error && (
                    <p className="text-[11px] text-red-600 mt-2">
                      {r.refund_error}
                    </p>
                  )}
                </div>
              )}

              {/* Manual refund: waiting for bank details */}
              {r.payment_method === 'manual' &&
                r.status === 'pending' && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Waiting for customer to submit bank details.
                  </p>
                )}

              {/* Manual bank details */}
              {r.payment_method === 'manual' &&
                (r.status === 'submitted' ||
                  r.status === 'paid') &&
                r.bank_account_number && (
                  <div className="bg-gray-50 rounded-xl p-3 flex items-start justify-between gap-2">

                    <div className="text-xs text-gray-700 space-y-0.5">
                      <p className="font-semibold">
                        {r.bank_account_name}
                      </p>

                      <p className="font-mono">
                        {r.bank_account_number}
                      </p>

                      <p className="text-gray-500">
                        {r.bank_name}
                      </p>
                    </div>

                    <button
                      onClick={() => copyDetails(r)}
                      className="p-1.5 hover:bg-gray-200 rounded-lg flex-shrink-0"
                      title="Copy bank details"
                    >
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                )}

              {/* Paystack refund button */}
              {r.payment_method === 'paystack' &&
                r.status !== 'paid' &&
                !r.paystack_refund_id &&
                r.paystack_refund_status !== 'processing' &&
                r.paystack_refund_status !== 'processed' &&
                r.paystack_refund_status !== 'completed' &&
                r.paystack_refund_status !== 'refunded' && (
                  <button
                    onClick={() =>
                      refundViaPaystack(r)
                    }
                    disabled={payingId === r.id}
                    className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-3 py-2 rounded-lg transition-colors"
                  >
                    {payingId === r.id ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Landmark className="w-3.5 h-3.5" />
                    )}

                    Refund{' '}
                    {fmt(r.refund_amount_ngn)}{' '}
                    via Paystack
                  </button>
                )}

              {/* Paystack processing */}
              {r.payment_method === 'paystack' &&
                r.paystack_refund_status === 'processing' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-600">
                    <Loader className="w-3 h-3 animate-spin" />
                    Paystack refund is processing...
                  </div>
                )}

              {/* Paystack needs attention */}
              {r.payment_method === 'paystack' &&
                r.paystack_refund_status === 'needs_attention' && (
                  <div className="mt-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-[11px]">
                    Paystack requires attention for this refund.
                    Check the Paystack refund status before retrying.
                  </div>
                )}

              {/* Paystack failed */}
              {r.payment_method === 'paystack' &&
                r.paystack_refund_status === 'failed' && (
                  <div className="mt-2 bg-red-50 text-red-600 rounded-lg px-3 py-2 text-[11px]">
                    Paystack refund failed.
                    {r.refund_error
                      ? ` ${r.refund_error}`
                      : ''}
                  </div>
                )}

              {/* Manual payment button */}
              {r.payment_method === 'manual' &&
                r.status === 'submitted' && (
                  <button
                    onClick={() => markPaid(r)}
                    disabled={payingId === r.id}
                    className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-3 py-2 rounded-lg transition-colors"
                  >
                    {payingId === r.id ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Landmark className="w-3.5 h-3.5" />
                    )}

                    Mark as Paid
                  </button>
                )}

              {/* Completed refund */}
              {r.status === 'paid' && (
                <p className="mt-2 text-[11px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />

                  Refunded{' '}
                  {r.paid_at
                    ? new Date(
                        r.paid_at
                      ).toLocaleDateString()
                    : ''}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
