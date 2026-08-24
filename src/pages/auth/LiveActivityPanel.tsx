// src/pages/auth/LiveActivityPanel.tsx
// Desktop-only visual panel for auth pages: a dark, warm counterpart to the
// light form side, carrying a looping "live activity" ticker so the empty
// half of the screen shows the platform actually working rather than a
// generic illustration. Reuses the icon/chip vocabulary already established
// on the landing hero (StoreCard/SalesChip/OrderChip), just at a different,
// darker register — the "other angle" on the same idea.
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, TrendingUp, Package, ShoppingBag, Sparkles } from 'lucide-react';

const LIVE_EVENTS = [
  { icon: Store, text: 'New store created', detail: 'Lagos', tint: '#34D399' },
  { icon: TrendingUp, text: 'First sale', detail: '₦18,500', tint: '#F97316' },
  { icon: Package, text: 'Order from China placed', detail: 'Abuja', tint: '#38BDF8' },
  { icon: ShoppingBag, text: 'Listed on Jumia', detail: 'Ibadan', tint: '#A78BFA' },
  { icon: Store, text: 'New store created', detail: 'Kano', tint: '#34D399' },
  { icon: TrendingUp, text: 'First sale', detail: '₦42,000', tint: '#F97316' },
  { icon: Store, text: 'New store created', detail: 'Port Harcourt', tint: '#34D399' },
];

export default function LiveActivityPanel({ headline, sub }: { headline: string; sub: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % LIVE_EVENTS.length), 2400);
    return () => clearInterval(id);
  }, []);

  const event = LIVE_EVENTS[index];
  const Icon = event.icon;

  return (
    <div className="relative hidden lg:flex flex-col justify-between h-full w-full overflow-hidden bg-gray-950 px-14 py-16">
      {/* Ambient glow — the one bold move on this panel */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-500/20 rounded-full blur-[100px]" />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-orange-600/10 rounded-full blur-[100px]" />

      <div className="relative z-10">
        <h2 className="text-3xl font-bold text-white leading-tight tracking-tight mb-3 max-w-sm">
          {headline}
        </h2>
        <p className="text-gray-400 max-w-xs leading-relaxed">
          {sub}
        </p>
      </div>

      {/* Live ticker — the signature element */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Happening now</p>
        </div>

        <div className="h-20 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center gap-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 backdrop-blur-sm"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${event.tint}1A` }}
              >
                <Icon className="w-5 h-5" style={{ color: event.tint }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{event.text}</p>
                <p className="text-xs text-gray-500 mt-0.5">{event.detail}</p>
              </div>
              <Sparkles className="w-4 h-4 text-gray-600 ml-auto flex-shrink-0" />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-1.5 mt-5">
          {LIVE_EVENTS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-orange-500' : 'w-1.5 bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
