// src/pages/recommendations/ImportVerificationModal.tsx
// Shown once per browser session to logged-out visitors on the
// importation/recommendations section. Separate from DailyPromoModal
// (which shows product photos, and only to authenticated users).
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ShieldCheck } from 'lucide-react';

const CAC_DOC_URL = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.559419878718419.webp';
const SESSION_KEY = 'qafrica_seen_verification_modal';

export default function ImportVerificationModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    // Small delay so it doesn't compete with initial page paint.
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const close = () => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, '1');
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
            className="relative w-full max-w-sm sm:max-w-md rounded-2xl overflow-hidden bg-white max-h-[85vh] flex flex-col"
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="overflow-y-auto">
              <img
                src={CAC_DOC_URL}
                alt="QAFRICA CAC business registration document"
                className="w-full max-h-[45vh] object-contain bg-gray-100"
                draggable={false}
              />

              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <h3 className="font-bold text-gray-900 text-sm">
                    We're a fully verified business
                  </h3>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  QAFRICA is legally registered and authorized to operate in Nigeria,
                  helping you import items directly from China to your doorstep.
                  This is our official CAC (Corporate Affairs Commission) registration
                  document.
                </p>
                <p className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                  You can download our document and do your own personal verification
                  anywhere.
                </p>

                <a
                  href={CAC_DOC_URL}
                  download="QAFRICA-CAC-Certificate.webp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download document
                </a>

                <button
                  onClick={close}
                  className="w-full py-1.5 text-center text-[11px] text-gray-400 font-medium"
                >
                  Continue browsing
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
