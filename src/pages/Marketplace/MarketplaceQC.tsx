// src/pages/Marketplace/MarketplaceQC.tsx

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle } from 'lucide-react';

const QC_NODES = [
  {
    emoji:  '🏭',
    label:  'Chinese Manufacturer',
    sub:    'Verified supplier network',
    style:  'border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20',
    badge:  { text: 'Source', style: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100' },
  },
  {
    emoji:  '🔍',
    label:  'QAFRICA QC Check 1',
    sub:    'Arrival inspection — quantity, packaging, condition',
    style:  'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20',
    badge:  { text: 'Layer 1', style: 'bg-orange-50 text-orange-600 border-orange-200' },
  },
  {
    emoji:  '✅',
    label:  'QAFRICA QC Check 2',
    sub:    'Pre-listing review — photos, specs, compliance',
    style:  'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20',
    badge:  { text: 'Layer 2', style: 'bg-orange-50 text-orange-600 border-orange-200' },
  },
  {
    emoji:  '🛒',
    label:  'Listed on all platforms',
    sub:    'Jumia · Konga · Jiji · Your store',
    style:  'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
    badge:  { text: 'Live ✓', style: 'bg-green-50 text-green-600 border-green-200' },
  },
];

const QC_POINTS = [
  'Every batch inspected at our Nigerian warehouse on arrival — quantity, packaging and product condition.',
  'Second check before listing — photos verified against actual product, dimensions measured, Jumia compliance confirmed.',
  'We reject ~12% of incoming batches that don\'t meet our standards. Your account health comes first.',
];

export default function MarketplaceQC() {
  return (
    <section className="py-20 px-4 sm:px-6 bg-orange-50 dark:bg-gray-900 border-t border-b border-orange-100 dark:border-gray-800">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: Copy ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              Seller Protection
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">
              Why your Jumia account stays safe with us
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              Jumia bans thousands of seller accounts every month — mostly for
              quality violations sellers didn't even know about. Our 2-layer QC
              system exists specifically to prevent this.
            </p>

            {/* Warning box */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start gap-3 mb-6">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                3 quality complaints in 30 days can trigger an automatic Jumia
                account review. 5 complaints = permanent ban with no appeal.
              </p>
            </div>

            {/* QC points */}
            <div className="space-y-4">
              {QC_POINTS.map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {point}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── Right: QC diagram ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="flex flex-col gap-3"
          >
            {QC_NODES.map((node, i) => (
              <div key={i}>
                <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${node.style}`}>
                  <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                    {node.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {node.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {node.sub}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex-shrink-0 ${node.badge.style}`}>
                    {node.badge.text}
                  </span>
                </div>

                {/* Arrow between nodes */}
                {i < QC_NODES.length - 1 && (
                  <div className="flex justify-center py-1 text-gray-300 dark:text-gray-700 text-lg">
                    ↓
                  </div>
                )}
              </div>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
}