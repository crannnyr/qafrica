// src/pages/recommendations/WhyTrustUsSheet.tsx
// "Why Trust Us" dashboard tab: shows the CAC registration document,
// explains the consolidation cost-sharing model in plain language, and
// answers common questions. Reuses the same CAC image as the first-visit
// verification modal.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, ShieldCheck, ChevronDown, Users, Package, TrendingDown } from 'lucide-react';

const CAC_DOC_URL = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.559419878718419.webp';

const FAQS = [
  {
    q: 'Is QAFRICA a registered business?',
    a: 'Yes. QAFRICA is registered with the Corporate Affairs Commission (CAC) and legally authorized to operate in Nigeria. You can download our CAC document above and verify it independently at any time.',
  },
  {
    q: 'How can shipping cost just ₦2–5 per item?',
    a: 'We combine many customers\' orders into one consolidated shipment. The total freight cost for that batch — which could be $20–$100+ — gets divided across everyone in it, sometimes hundreds or thousands of people. That\'s what brings an individual\'s share down to just a few dollars, instead of paying full freight alone.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Air freight takes about 20–30 days, and sea freight takes about 60–90 days, from when your order reaches our consolidation warehouse in China. These are estimates, not guarantees — customs and carrier delays can extend them. Full details are in our Import Terms & Conditions.',
  },
  {
    q: 'What if something goes wrong with my order?',
    a: 'Reach out through our WhatsApp community or the Help Center in your dashboard. Every order is tracked from consolidation through to delivery, and our team can look into any issue directly.',
  },
  {
    q: 'Why is QAFRICA cheaper than importing on my own?',
    a: 'Sourcing individually means paying full freight, handling customs alone, and navigating supplier communication in China without local support. We handle procurement, consolidation, compliance, and last-mile delivery as one service — cutting out the overhead an individual importer would otherwise absorb alone.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-800">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-xs text-gray-500 leading-relaxed pb-3 pr-6">{a}</p>}
    </div>
  );
}

export default function WhyTrustUsSheet({ onClose }: { onClose: () => void }) {
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
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Why Trust Us
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
          {/* CAC document */}
          <div>
            <img
              src={CAC_DOC_URL}
              alt="QAFRICA CAC business registration document"
              className="w-full rounded-xl border border-gray-100 mb-2"
            />
            <a
              href={CAC_DOC_URL}
              download="QAFRICA-CAC-Certificate.webp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-bold text-xs rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download CAC document
            </a>
            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              You can download this document and do your own personal verification anywhere.
            </p>
          </div>

          {/* Business model explainer */}
          <div>
            <h3 className="font-bold text-gray-900 text-sm mb-2">How we cut shipping cost</h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              We help you source items directly from China and deliver them to your doorstep
              in Nigeria — while cutting logistics cost to a fraction of what it would cost alone.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 bg-gray-50 rounded-xl p-3">
                <Package className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  Before consolidation, shipping one item — say a ₦1,000 polo — to a warehouse
                  could cost $5–$10 alone, nearly ₦10,000, before delivery fees.
                </p>
              </div>
              <div className="flex items-start gap-2.5 bg-gray-50 rounded-xl p-3">
                <Users className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  We combine hundreds — sometimes thousands — of customers' orders into one
                  shipment, and split the total freight cost across everyone in it.
                </p>
              </div>
              <div className="flex items-start gap-2.5 bg-gray-50 rounded-xl p-3">
                <TrendingDown className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  That brings your share down to as little as ₦2–₦5 per item, instead of
                  paying full freight alone.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">Common questions</h3>
            <div>
              {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
