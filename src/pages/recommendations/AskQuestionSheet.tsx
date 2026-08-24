// src/pages/recommendations/AskQuestionSheet.tsx
// "Ask about this product" flow. If the customer isn't signed in, this shows
// the auth flow first and only opens the question form after a successful
// sign-in — matching the sign-in-gated requirement without a separate modal
// hop the customer has to manage themselves.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, CheckCircle2, MessageCircleQuestion } from 'lucide-react';
import CONFIG from '@/lib/config';
import { useCustomerAuthStore } from '@/stores';
import ImportAuthSheet from './ImportAuthSheet';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

export default function AskQuestionSheet({ productId, productName, onClose }: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const { customer, isAuthenticated } = useCustomerAuthStore();
  const [question, setQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!question.trim() || !customer) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=ask-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customer.id, product_id: productId, question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not submit your question');
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Not signed in yet — show the auth flow first. On success, the person
  // lands right back here able to actually ask their question.
  if (!isAuthenticated) {
    return <ImportAuthSheet onClose={onClose} onSuccess={() => {}} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-lg">Ask about this product</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-gray-500 text-sm mb-1">Question sent!</p>
            <p className="text-gray-400 text-xs mb-6">We'll email you at {customer?.email} once it's answered.</p>
            <button onClick={onClose}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-1">About</p>
            <p className="text-sm font-semibold text-gray-800 mb-4 line-clamp-2">{productName}</p>
            <textarea
              value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="What would you like to know? e.g. sizing, real photos, shipping time…"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none resize-none mb-3"
            />
            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
            <button
              onClick={submit}
              disabled={isSubmitting || !question.trim()}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : <MessageCircleQuestion className="w-4 h-4" />}
              Send question
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
