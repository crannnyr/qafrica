// src/pages/recommendations/DailyPromoModal.tsx
// Swipeable, closable promo modal — shows once per calendar day per viewer,
// scoped to the importation/recommendations section only.
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

const PROMO_IMAGES = [
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.2928853494085587.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.47853263406407076.webp',
];

const DEVICE_KEY_STORAGE = 'qafrica_import_viewer_key';

function getViewerKey(customerId?: string | null): string {
  if (customerId) return customerId;
  let key = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY_STORAGE, key);
  }
  return key;
}

export default function DailyPromoModal({ customerId }: { customerId?: string | null }) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const viewerKeyRef = useRef<string>(getViewerKey(customerId));

  useEffect(() => {
    viewerKeyRef.current = getViewerKey(customerId);
    let cancelled = false;

    fetch(`${EDGE_URL}?action=modal-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewer_key: viewerKeyRef.current }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.shouldShow) setVisible(true); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [customerId]);

  const close = () => {
    setVisible(false);
    fetch(`${EDGE_URL}?action=modal-seen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewer_key: viewerKeyRef.current }),
    }).catch(() => {});
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 && index < PROMO_IMAGES.length - 1) setIndex(i => i + 1);
    else if (info.offset.x > 60 && index > 0) setIndex(i => i - 1);
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
            className="relative w-full max-w-sm sm:max-w-md rounded-2xl overflow-hidden bg-black"
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Progress bars */}
            <div className="absolute top-3 left-3 right-14 z-10 flex gap-1.5">
              {PROMO_IMAGES.map((_, i) => (
                <div key={i} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                  <div className={`h-full bg-white transition-all ${i === index ? 'w-full' : i < index ? 'w-full' : 'w-0'}`} />
                </div>
              ))}
            </div>

            <motion.div
              className="flex"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              animate={{ x: `-${index * 100}%` }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {PROMO_IMAGES.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`QAFRICA import update ${i + 1}`}
                  className="w-full flex-shrink-0 object-contain select-none"
                  draggable={false}
                />
              ))}
            </motion.div>

            {/* Tap zones for navigation (in addition to swipe) */}
            <div className="absolute inset-y-0 left-0 w-1/3" onClick={() => index > 0 && setIndex(i => i - 1)} />
            <div className="absolute inset-y-0 right-0 w-1/3" onClick={() => index < PROMO_IMAGES.length - 1 ? setIndex(i => i + 1) : close()} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
