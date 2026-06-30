// src/pages/landing/StoreOwnerHeroSection.tsx

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Globe, Users, MessageCircle, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlipText } from './animations';
import { StoreCard, SalesChip, OrderChip } from './HeroCard';

const FEATURES = [
  {
    icon: <Globe className="w-4 h-4 text-orange-500" />,
    title: 'Your own website',
    badge: '₦5k/mo',
    desc: 'A proper storefront for your business. Accept orders, manage inventory, look legit.',
  },
  {
    icon: <Users className="w-4 h-4 text-orange-500" />,
    title: 'Dropshippers sell for you',
    desc: 'Other sellers import your products to their stores. They find buyers, you fulfil orders.',
  },
  {
    icon: <MessageCircle className="w-4 h-4 text-orange-500" />,
    title: 'Connect your group chat',
    desc: 'Link your WhatsApp or Telegram group. Share promo content dropshippers can post and sell with.',
  },
  {
    icon: <ShoppingCart className="w-4 h-4 text-orange-500" />,
    title: 'Push to Jumia, Konga & Jiji',
    desc: "List on Nigeria's biggest marketplaces from your dashboard. More reach, less stress.",
  },
];

export default function StoreOwnerHeroSection() {
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
              Your store.{' '}
              <span className="text-orange-500">Endless sellers.</span>
              <br />
              <FlipText
                first="Custom website."
                second="Sell on Jumia, Konga & Jiji."
                third="Custom website."
                className="text-gray-400 dark:text-gray-500"
              />
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="text-base text-gray-400 dark:text-gray-500 mb-10 max-w-sm leading-relaxed"
            >
              Get a full business website for{' '}
              <span className="text-gray-500 font-medium">₦5,000/month.</span>{' '}
              Dropshippers import your products and sell for you — connect your group chat,
              share promo content, and push to Jumia, Konga & Jiji too.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
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
              animate={{ opacity: 1, y: 0 }}
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

            {/* Feature list */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.55 }}
              className="mt-8 flex flex-col gap-3"
            >
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 1.55 + i * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
                >
                  <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0 mt-0.5">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      {f.title}
                      {f.badge && (
                        <span className="text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">
                          {f.badge}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mt-0.5">
                      {f.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

          </div>

          {/* ── Right: desktop card + chips ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="hidden lg:block relative flex-shrink-0"
            style={{ width: 280 }}
          >
            {/* Sales chip — top-left overhang */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
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
              animate={{ opacity: 1, y: 0 }}
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
