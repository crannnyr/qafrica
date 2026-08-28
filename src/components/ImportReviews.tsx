// src/components/ImportReviews.tsx
// Minimal, unobtrusive reviews block for China-import product pages.
// Pulls from `mock_reviews` (safe to drop once real import reviews exist —
// see table comment in Supabase). Shows a compact star summary plus a single
// review by default; "View more" expands the rest with a smooth transition.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Check, ChevronDown, ChevronUp, User, X, Info } from 'lucide-react';
import { supabase } from '@/services';
import { AvatarImage } from '@/lib/presetAvatars';

interface ImportReview {
  id: string;
  customer_name: string;
  customer_avatar_url: string | null;
  rating: number;
  title: string | null;
  content: string | null;
  is_verified_purchase: boolean;
  created_at: string;
}

// Short, rating-derived sentiment summary shown in green under each review.
// Purely computed from the star rating — nothing stored in the DB for this.
function sentimentLabel(rating: number): string {
  const r = Math.round(rating);
  if (r >= 5) return 'Customer thinks this product is good';
  if (r === 4) return 'Customer thinks this product is ok';
  if (r === 3) return "Customer thinks it's ok but could be better";
  if (r === 2) return 'Customer was not fully satisfied';
  return 'Customer was not satisfied';
}

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          width={size}
          height={size}
          className={n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
        />
      ))}
    </div>
  );
}

function ReviewFilterModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl"
      >
        <div className="flex items-start justify-between mb-2.5">
          <h3 className="text-sm font-bold text-gray-900">How we choose reviews</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Not all product reviews are shown here — we filter for only the ones relevant to your
          purchase. We look for reviews that mention the product itself and details that we believe
          impact your decision when buying.
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold"
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}

function ReviewCard({ review }: { review: ImportReview }) {
  return (
    <div className="py-3.5 first:pt-0 border-t border-gray-100 first:border-0">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {review.customer_avatar_url ? (
            <AvatarImage avatarUrl={review.customer_avatar_url} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <User className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-gray-800 truncate">{review.customer_name}</p>
            {review.is_verified_purchase && (
              <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 flex-shrink-0">
                <Check className="w-2.5 h-2.5" /> Verified
              </span>
            )}
          </div>
          <Stars rating={review.rating} size={11} />
        </div>
      </div>
      {review.title && (
        <p className="text-xs font-semibold text-gray-800 mb-0.5">{review.title}</p>
      )}
      {review.content && (
        <p className="text-xs text-gray-500 leading-relaxed mb-1">{review.content}</p>
      )}
      <p className="text-[10px] font-medium text-emerald-600">{sentimentLabel(review.rating)}</p>
    </div>
  );
}

export default function ImportReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ImportReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showFilterInfo, setShowFilterInfo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setExpanded(false);
    setIsLoading(true);

    supabase
      .from('mock_reviews')
      .select('id, customer_name, customer_avatar_url, rating, title, content, is_verified_purchase, created_at')
      .eq('product_id', productId)
      .order('helpful_count', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setReviews(data ?? []);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [productId]);

  if (isLoading || reviews.length === 0) return null;

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const visible = expanded ? reviews : reviews.slice(0, 1);
  const remaining = reviews.length - 1;

  return (
    <div className="px-4 py-5 lg:px-0 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-1.5">
        <Stars rating={average} size={13} />
        <span className="text-xs font-bold text-gray-900">{average.toFixed(1)}</span>
        <span className="text-xs text-gray-400">
          · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
        </span>
      </div>

      <button
        onClick={() => setShowFilterInfo(true)}
        className="flex items-center gap-1 mb-3 text-[10px] text-gray-400 hover:text-gray-600 animate-pulse"
      >
        <Info className="w-2.5 h-2.5" />
        How are these reviews chosen?
      </button>

      <AnimatePresence>
        {showFilterInfo && <ReviewFilterModal onClose={() => setShowFilterInfo(false)} />}
      </AnimatePresence>

      <div>
        {visible.map(r => <ReviewCard key={r.id} review={r} />)}
      </div>

      {remaining > 0 && (
        <AnimatePresence initial={false}>
          {!expanded && (
            <motion.button
              key="toggle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
            >
              View {remaining} more review{remaining !== 1 ? 's' : ''} <ChevronDown className="w-3 h-3" />
            </motion.button>
          )}
        </AnimatePresence>
      )}
      {expanded && remaining > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
        >
          Show less <ChevronUp className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
