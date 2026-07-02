// src/pages/dashboard/Jumia/JumiaItemDetailPage.tsx
// Store-owner facing detail view for a single Jumia item: stock remaining, total sold,
// per-variant breakdown, and the admin-entered daily sale history for this item.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuthStore, useStoreStore } from '@/stores';
import { useJumiaStore, type JumiaSubmission, variantLabel } from '@/stores/jumiaStore';
import JumiaSubmissionStatusBadge from './JumiaSubmissionStatusBadge';
import { generateJumiaLabel } from './generateJumiaLabel';

const LOW_STOCK_THRESHOLD = 5;

export default function JumiaItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentStore } = useStoreStore();
  const { dailySales, fetchDailySales, fetchSubmissionById } = useJumiaStore();

  const [submission, setSubmission] = useState<JumiaSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([fetchSubmissionById(id), fetchDailySales(id)])
      .then(([sub]) => setSubmission(sub))
      .finally(() => setIsLoading(false));
  }, [id, fetchSubmissionById, fetchDailySales]);

  if (isLoading) {
    return <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>;
  }

  if (!submission) {
    return (
      <div className="p-12 text-center">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium mb-1">Item not found</p>
        <Link to="/dashboard/jumia" className="text-orange-600 text-sm font-medium">
          Back to Jumia overview
        </Link>
      </div>
    );
  }

  const hasVariants = submission.variant_type !== 'none' && submission.variants?.length > 0;

  // Total sold = sum of the admin-entered daily sale log — this is the source of truth,
  // independent of whatever the current quantity_remaining snapshot says.
  const totalSold = dailySales.reduce((sum, s) => sum + s.units_sold, 0);
  const totalRevenue = dailySales.reduce((sum, s) => sum + s.units_sold * s.unit_price, 0);

  const overallRemaining = hasVariants
    ? submission.variants.reduce((sum, v) => sum + v.quantity_remaining, 0)
    : submission.quantity_remaining;

  const overallSent = hasVariants
    ? submission.variants.reduce((sum, v) => sum + v.quantity_sent, 0)
    : submission.quantity_sent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/dashboard/jumia')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{submission.name}</h1>
              <JumiaSubmissionStatusBadge status={submission.status} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{submission.category} · ₦{Number(submission.selling_price).toLocaleString()}</p>
          </div>
        </div>
        {submission.payment_status === 'paid' && (
          <button
            onClick={() => generateJumiaLabel(submission, currentStore?.name ?? 'My Store', user?.full_name ?? user?.email ?? '')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex-shrink-0"
          >
            <Download className="w-4 h-4" /> Shipping Label
          </button>
        )}
      </div>

      {/* Image */}
      {submission.images?.[0] && (
        <div className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700">
          <img src={submission.images[0]} alt={submission.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Stock overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Total Sent</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{overallSent}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Units Sold
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalSold}</p>
        </div>
        <div className={`rounded-2xl p-6 border shadow-sm ${
          overallRemaining <= LOW_STOCK_THRESHOLD
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
        }`}>
          <p className={`text-sm font-medium mb-1 flex items-center gap-1 ${
            overallRemaining <= LOW_STOCK_THRESHOLD ? 'text-red-600' : 'text-gray-500'
          }`}>
            {overallRemaining <= LOW_STOCK_THRESHOLD && <AlertTriangle className="w-3.5 h-3.5" />}
            Stock Remaining
          </p>
          <p className={`text-2xl font-bold ${
            overallRemaining <= LOW_STOCK_THRESHOLD ? 'text-red-600' : 'text-gray-900 dark:text-white'
          }`}>{overallRemaining}</p>
        </div>
      </div>

      {/* Per-variant breakdown */}
      {hasVariants && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <h2 className="px-5 py-4 text-sm font-bold text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700">
            Stock by Variant
          </h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {submission.variants.map((v) => {
              const label = variantLabel(v);
              const low = v.quantity_remaining <= LOW_STOCK_THRESHOLD;
              return (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">Sent: {v.quantity_sent}</span>
                    <span className={`font-bold ${low ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                      {v.quantity_remaining} left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sale history */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200">Sale History</h2>
          {dailySales.length > 0 && (
            <span className="text-xs text-gray-400">Total revenue: ₦{totalRevenue.toLocaleString()}</span>
          )}
        </div>
        {dailySales.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No sales logged yet for this item.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {dailySales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {sale.units_sold} unit{sale.units_sold > 1 ? 's' : ''}
                    {sale.variant_label ? ` · ${sale.variant_label}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(sale.sale_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <p className="font-bold text-gray-700 dark:text-gray-300">
                  ₦{(sale.units_sold * sale.unit_price).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
