// One-time notice: Opticsview.store is shutting down and merging into
// QAFRICA. Shown once per browser (localStorage, not tied to login — many
// visitors arriving via the Opticsview redirect won't be signed in yet).
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ArrowRight } from 'lucide-react';

const SEEN_KEY = 'opticsview_merger_notice_seen';

export default function OpticsviewMergerNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setShow(true);
    } catch {
      // localStorage unavailable (e.g. private browsing edge cases) — just
      // skip the notice rather than risk showing it every visit.
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28 }}
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-4.5 h-4.5 text-white" />
              </div>
              <button onClick={dismiss} className="p-1.5 hover:bg-gray-100 rounded-xl">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <h2 className="font-bold text-gray-900 text-lg mb-2">Opticsview is now QAFRICA</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Opticsview.store is moved it's Activity, and everything over to QAFRICA — this is where all importing now happens. If you had an order in progress or want to reorder something you got from Opticsview before, you can pick it up right here.
            </p>

            <button
              onClick={dismiss}
              className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Continue to QAFRICA <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
