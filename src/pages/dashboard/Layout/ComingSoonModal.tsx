// src/pages/dashboard/Layout/ComingSoonModal.tsx

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Zap } from 'lucide-react';
import { MARKETPLACE_BRANDS, type MarketplaceBrand } from './constants';

interface Props {
  brand: MarketplaceBrand | null;
  onClose: () => void;
}

// ── Brand logo SVGs (accurate to real brands) ─────────────────────────────────

function KongaLogo() {
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md border border-pink-100">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#E91E8C" />
        <text
          x="50%"
          y="55%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="white"
          fontSize="14"
          fontWeight="800"
          fontFamily="Arial, sans-serif"
        >
          K
        </text>
      </svg>
    </div>
  );
}

function JijiLogo() {
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md border border-green-100">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#00A651" />
        <text
          x="50%"
          y="55%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="white"
          fontSize="14"
          fontWeight="800"
          fontFamily="Arial, sans-serif"
        >
          Jiji
        </text>
      </svg>
    </div>
  );
}

export default function ComingSoonModal({ brand, onClose }: Props) {
  if (!brand) return null;
  const config = MARKETPLACE_BRANDS[brand];

  return (
    <AnimatePresence>
      {brand && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.85, y: 30  }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-8 z-10"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            {/* Logo + pulse ring */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className={`absolute inset-0 rounded-2xl opacity-30`}
                  style={{ backgroundColor: config.color }}
                />
                {brand === 'konga' ? <KongaLogo /> : <JijiLogo />}
              </div>
            </div>

            {/* Coming soon badge */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1,  y: 0  }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: `${config.color}18`,
                  color: config.color,
                }}
              >
                <Clock className="w-4 h-4" />
                Coming Soon
              </motion.div>
            </div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1,  y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-xl font-bold text-gray-900 dark:text-white text-center mb-3"
            >
              {config.message}
            </motion.h2>

            {/* Sub message */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1,  y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 leading-relaxed"
            >
              {config.subMessage}
            </motion.p>

            {/* Stats pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1,  scale: 1  }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl p-4 mb-6 text-center"
              style={{ backgroundColor: `${config.color}12` }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Zap className="w-5 h-5" style={{ color: config.color }} />
                <span
                  className="text-2xl font-extrabold"
                  style={{ color: config.color }}
                >
                  {config.visitors}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                monthly visitors on {config.name}
              </p>
            </motion.div>

            {/* Progress bar animation */}
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '70%' }}
                transition={{ delay: 0.4, duration: 1.2, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: config.color }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Integration 70% complete
            </p>

            {/* Close button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={onClose}
              className="mt-6 w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: config.color }}
            >
              Got it, I'll check back soon!
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}