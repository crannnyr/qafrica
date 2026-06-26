// src/pages/dashboard/Jumia/JumiaTermsModal.tsx
// User must scroll to bottom and check the box before the Pay button unlocks.
// Covers authenticity pledge, QC, consequences, self-dropoff 24hr/3-strike rule,
// honest warehouse disclosure, and agent pitch.

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  isOpen: boolean;
  onAccept: () => void;
  onClose: () => void;
}

const SECTIONS = [
  {
    title: '1. Product Authenticity & Quality',
    content: `By submitting, you confirm that every item you send is genuine, matches the photos and description provided, is not defective or used, and is safe for sale. Misrepresentation — including sending items that don't match the images — is a serious violation.`,
  },
  {
    title: '2. Two-Layer Quality Control',
    content: `Every item goes through two rounds of inspection before it reaches a customer. First at our Lagos facility, then at Jumia's own QC process. Any item deemed defective, counterfeit, or misrepresented will be seized. You will be responsible for retrieval costs, may be fined, and your store on Qafrica can be permanently blocked.`,
  },
  {
    title: '3. Our Fulfilment Model — Please Read',
    content: `We do not use Jumia's warehouse. Your items are stored at our Lagos-based facility. When a sale occurs, our team manually drops that item off at the relevant Jumia VDO location. This process works well and is fully managed for you — but it means all items must be delivered to us in Lagos.`,
  },
  {
    title: '4. Self Drop-Off Rules (if you chose to drop off yourself)',
    content: `If you selected self drop-off: you keep your stock at home and do not send us anything upfront. Each time an item sells, we will notify you. You must drop that specific item at your chosen Jumia VDO location within 24 hours of being notified.\n\nMissing a drop-off counts as one strike. Three strikes and your listing is permanently removed from the platform with no refund of your submission fee. This option is only recommended for sellers based in Lagos with reliable transportation.`,
  },
  {
    title: '5. Agent Pickup (recommended)',
    content: `If you selected agent pickup, we collect your stock and handle every drop-off on your behalf. You will never face a 24-hour deadline or risk strikes. Our team contacts you directly for packaging instructions after payment is confirmed. This is the smoother option for most sellers.`,
  },
  {
    title: '6. Platform & Jumia Fees',
    content: `Qafrica charges a 20% platform fee on every sale. This fee already includes Jumia's own commission, which ranges from 8–21% depending on the product category. Your actual payout per sale is calculated as: selling price × 80%.`,
  },
  {
    title: '7. Submission Fee',
    content: `The ₦1,500 submission fee is non-refundable in all cases, including if your product is rejected at QC. This fee exists to ensure only genuine, committed sellers use this service.`,
  },
];

export default function JumiaTermsModal({ isOpen, onAccept, onClose }: Props) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) { setHasScrolled(false); setAgreed(false); }
  }, [isOpen]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    if (atBottom) setHasScrolled(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Seller Agreement</h2>
                <p className="text-xs text-gray-500 mt-0.5">Please read fully before proceeding</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Warning */}
            <div className="mx-5 mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Scroll to the bottom and accept the terms to unlock payment.
              </p>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0"
            >
              {SECTIONS.map((s) => (
                <div key={s.title}>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">{s.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{s.content}</p>
                </div>
              ))}
              {/* Scroll anchor */}
              <div className="h-4" />
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 space-y-4 flex-shrink-0">
              {!hasScrolled && (
                <p className="text-xs text-center text-gray-400">↓ Scroll to the bottom to continue</p>
              )}

              {hasScrolled && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-500 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    I have read and agree to the Qafrica Jumia seller terms. I confirm my products are
                    authentic, match the photos, and I understand the drop-off rules and fee structure.
                  </span>
                </label>
              )}

              <Button
                onClick={() => { if (agreed) onAccept(); }}
                disabled={!agreed}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl disabled:opacity-40"
              >
                {agreed ? (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> I Agree — Proceed to Payment</>
                ) : 'Read the terms above to continue'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
