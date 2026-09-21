// src/pages/recommendations/HelpCenterSheet.tsx
// Help Center: bold WhatsApp community banner up top (click -> community
// link), then FAQ covering how QAFRICA operates — delivery times, how
// orders are fulfilled, how to get an order, etc. Opened from the "Help
// Center" quick-action in ImporterDashboardPage, which used to link
// straight out to WhatsApp — now it opens this sheet instead.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Headset, ChevronDown, MessageCircle, ArrowRight } from 'lucide-react';

const WHATSAPP_COMMUNITY_LINK = 'https://chat.whatsapp.com/CzoAid17ZbxEuzbQtvMQ6t';

const FAQS = [
  {
    q: 'How long does delivery take?',
    a: 'Air freight takes about 20–30 days, and sea freight takes about 60–90 days, counted from when your order reaches our consolidation warehouse in China — not from when you place your order. These are estimates, not guarantees; customs and carrier delays can extend them.',
  },
  {
    q: 'How does QAFRICA actually operate?',
    a: 'We combine many customers\' orders into one consolidated shipment from China. The total freight cost for that batch gets divided across everyone in it, which is what keeps your shipping fee low compared to importing alone. Once a batch closes, it moves through sourcing, consolidation, shipping, customs clearance, and then delivery or pickup.',
  },
  {
    q: 'How do I get my order once it arrives?',
    a: 'You choose at checkout: have it delivered to your address, or pick it up from a Jumia pickup station near you — pickup is usually the fastest and cheapest option. You can change your default delivery method anytime from Settings in your dashboard.',
  },
  {
    q: 'How do I track my order?',
    a: 'Use your order code on the Track Order page, or check the Orders tab in your dashboard. You\'ll see which stage it\'s at — ordered, at the consolidation warehouse, in transit, or delivered/ready for pickup.',
  },
  {
    q: 'What are the fees involved?',
    a: 'Your item price already includes our markup. Separately, once your batch closes, you\'ll get a consolidation & shipping bill. If any additional charge applies to your order, it will be shown in your dashboard before you pay; there is not a separate customer-facing clearance bill in the current import flow.',
  },
  {
    q: 'What if something goes wrong with my order?',
    a: 'Message us in the WhatsApp community above, or reach out with your order code and we\'ll look into it directly — every order is tracked end to end from consolidation through to delivery.',
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

export default function HelpCenterSheet({ onClose }: { onClose: () => void }) {
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
            <Headset className="w-4 h-4 text-orange-500" />
            Help Center
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
          {/* Bold WhatsApp community banner */}
          <a
            href={WHATSAPP_COMMUNITY_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-emerald-600 hover:bg-emerald-700 rounded-2xl p-4 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-sm leading-snug">
                  Join the QAFRICA WhatsApp community
                </p>
                <p className="text-emerald-50 text-xs mt-0.5">
                  Meet other QAFRICA importers like yourself
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-white flex-shrink-0" />
            </div>
          </a>

          {/* FAQ */}
          <div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">Frequently asked questions</h3>
            <div>
              {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
