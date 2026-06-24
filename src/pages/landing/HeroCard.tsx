// src/pages/landing/Landing/HeroCard.tsx

import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { MARKETPLACES } from './constants';

// ── Store Card ────────────────────────────────────────────────────────────────

export function StoreCard() {
  const navigate                    = useNavigate();
  const [mktIndex, setMktIndex]     = useState(0);
  const [cycling, setCycling]       = useState(false);
  const marketplace                 = MARKETPLACES[mktIndex];

  const handleMarketplaceClick = () => {
    if (cycling) return;
    setCycling(true);

    const next = (mktIndex + 1) % MARKETPLACES.length;

    // If cycling back to start after Jiji, navigate
    if (mktIndex === MARKETPLACES.length - 1) {
      navigate('/marketplace');
      setCycling(false);
      return;
    }

    setMktIndex(next);
    setCycling(false);
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl shadow-orange-500/5">
      {/* Banner */}
      <div className="h-32 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
        <ShoppingBag className="w-10 h-10 text-white/90" />
      </div>

      <div className="p-4">
        {/* Store header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-orange-600 font-bold text-xs">Q</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">
              Your Store
            </p>
            {/* URL + marketplace button on same row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-xs text-gray-400">
                qafrica.store/yourstore
              </p>

              {/* Marketplace cycle button */}
              <AnimatePresence mode="wait">
                <motion.button
                  key={mktIndex}
                  onClick={handleMarketplaceClick}
                  initial={{ opacity: 0, scale: 0.8, y: 4  }}
                  animate={{ opacity: 1, scale: 1,   y: 0  }}
                  exit={{   opacity: 0, scale: 0.8,  y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all hover:opacity-80 active:scale-95 cursor-pointer flex-shrink-0"
                  style={{
                    background:   marketplace.bg,
                    color:        marketplace.color,
                    borderColor:  marketplace.border,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: marketplace.color }}
                  />
                  {marketplace.label}
                </motion.button>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Skeleton lines */}
        <div className="space-y-1.5 mb-3">
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4" />
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-12 bg-orange-50 dark:bg-orange-950/30 rounded-lg" />
          <div className="h-12 bg-orange-50 dark:bg-orange-950/30 rounded-lg" />
          <div className="h-12 bg-orange-50 dark:bg-orange-950/30 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ── Sales Chip ────────────────────────────────────────────────────────────────

export function SalesChip() {
  return (
    <div className="flex items-center gap-3 w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 shadow-lg shadow-black/5">
      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
        <TrendingUp className="w-4 h-4 text-green-600" />
      </div>
      <div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">Today's sales</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">₦125,000</p>
      </div>
    </div>
  );
}

// ── Order Chip ────────────────────────────────────────────────────────────────

export function OrderChip() {
  return (
    <div className="flex items-center gap-3 w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 shadow-lg shadow-black/5">
      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
        <ShoppingBag className="w-4 h-4 text-blue-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">New order</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Just now</p>
      </div>
    </div>
  );
}