// src/pages/landing/HeroSection.tsx

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NudgeWord, FlipText } from './animations';
import { StoreCard, SalesChip, OrderChip } from './HeroCard';

interface Props {
  sellRef:      React.RefObject<HTMLSpanElement | null>;
  anythingRef:  React.RefObject<HTMLSpanElement | null>;
  sellNudge:    boolean;
  anyNudge:     boolean;
}

export default function HeroSection({
  sellRef,
  anythingRef,
  sellNudge,
  anyNudge,
}: Props) {
  return (
    <section className="relative min-h-screen flex items-start lg:items-center bg-white dark:bg-gray-950 overflow-hidden pt-36 pb-20 lg:pt-48 lg:pb-32">

      {/* Left accent bar — desktop only */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-32 bg-orange-500 hidden lg:block" />

      <div className="container-custom relative z-10 w-full">
        <div className="flex items-center justify-between gap-16">

          {/* ── Left: text ── */}
          <div className="flex-1 lg:pl-12">

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight mb-6"
            >
              <NudgeWord nudge={sellNudge} innerRef={sellRef}>
                Scale
              </NudgeWord>{' '}
              <NudgeWord nudge={anyNudge} className="text-orange-500" innerRef={anythingRef}>
                smoothly.
              </NudgeWord>
              <br />
              <FlipText
                first="It's giving profit."
                second="Dropshippers' hub."
                third="Genz business model."
                className="text-gray-400 dark:text-gray-500"
              />
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0  }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="text-base text-gray-400 dark:text-gray-500 mb-10 max-w-sm leading-relaxed"
            >
              Sell your products or dropship products and access ready-made promo content
              from sellers' group chats. Grow your retailer base — all on QAFRICA.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0  }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="space-y-2 mb-0"
            >
              <Link to="/signup">
                <Button
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow"
                >
                  Start Your Store — Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <p className="text-sm text-gray-400 pl-1">
                ₦5,000/month after trial · Cancel anytime
              </p>
            </motion.div>

            {/* Mobile store card + chips */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0  }}
              transition={{ duration: 0.5, delay: 1.25 }}
              className="mt-8 flex flex-col gap-3 lg:hidden"
            >
              <StoreCard />
              <div className="flex gap-3">
                <div className="flex-1 min-w-0"><SalesChip /></div>
                <div className="flex-1 min-w-0"><OrderChip /></div>
              </div>
            </motion.div>

            {/* Trusted cities */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.4 }}
              className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800"
            >
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">
                Trusted by sellers in
              </p>
              <div className="flex flex-wrap gap-5 text-sm text-gray-400 dark:text-gray-500">
                <span>Lagos</span>
                <span>Abuja</span>
                <span>Kano</span>
                <span>Port Harcourt</span>
                <span>Ibadan</span>
              </div>
            </motion.div>
          </div>

          {/* ── Right: desktop card + chips ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0  }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="hidden lg:block relative flex-shrink-0"
            style={{ width: 280 }}
          >
            {/* Sales chip — top-left overhang */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0  }}
              transition={{ duration: 0.5, delay: 1.05 }}
              className="absolute z-10 w-52"
              style={{ top: 24, left: -80 }}
            >
              <SalesChip />
            </motion.div>

            <StoreCard />

            {/* Order chip — bottom-right overhang */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0  }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="absolute z-10 w-48"
              style={{ bottom: 32, right: -60 }}
            >
              <OrderChip />
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}