// src/pages/recommendations/ImportVerificationModal.tsx
// Shown once ever (per browser/device) to logged-out visitors on the
// importation/recommendations section. Lets former OpticsView.store
// visitors know the business has moved fully under QAFRICA.shop.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart } from 'lucide-react';

const STORAGE_KEY = 'qafrica_seen_opticsview_notice_v2';

export default function ImportVerificationModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Small delay so it doesn't compete with initial page paint.
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const close = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 sm:p-6"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', damping: 26 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm sm:max-w-md rounded-2xl overflow-hidden bg-white"
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 pt-8 space-y-3">
              <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center mb-1">
                <Heart className="w-5 h-5 text-orange-500" fill="currentColor" />
              </div>

              <h3 className="font-bold text-gray-900 text-lg leading-snug">
                We've moved — and we're excited about it!
              </h3>

              <p className="text-sm text-gray-600 leading-relaxed">
                OpticsView.store has now moved to our parent website,{' '}
                <span className="font-semibold text-gray-800">QAFRICA.shop</span>, as
                we're fully focused on importation these days.
              </p>

              <p className="text-sm text-gray-600 leading-relaxed">
                If you have a pending deal with us on OpticsView, don't worry — one of
                our agents will reach out to you soon to make sure it's taken care of.
              </p>

              <p className="text-sm text-gray-500 leading-relaxed">
                Thank you for being with us. We can't wait for you to see what we've
                built here. 💛
              </p>

              <button
                onClick={close}
                className="w-full mt-2 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors"
              >
                Continue to QAFRICA
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
