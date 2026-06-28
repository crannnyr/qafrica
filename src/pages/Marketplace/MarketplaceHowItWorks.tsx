// src/pages/Marketplace/MarketplaceHowItWorks.tsx

import { motion } from 'framer-motion';

const STEPS = [
  {
    num:   '01',
    title: 'Browse our catalog',
    desc:  'Pick from thousands of verified products sourced directly from Chinese manufacturers. Already QC\'d and warehoused in Nigeria.',
    icon:  '📦',
  },
  {
    num:   '02',
    title: 'Set your price',
    desc:  'Choose your selling price and margin. You decide what you make. Our calculator shows you the exact breakdown before you commit.',
    icon:  '₦',
  },
  {
    num:   '03',
    title: 'We list everywhere',
    desc:  'Your products go live on Jumia, Konga, Jiji and your own QAFRICA store simultaneously. One listing, four channels.',
    icon:  '🛒',
  },
  {
    num:   '04',
    title: 'Orders in, money out',
    desc:  'Orders come in from any platform. We pick, pack and ship. Your margin hits your wallet. You never touch the product.',
    icon:  '💸',
  },
];

export default function MarketplaceHowItWorks() {
  return (
    <section id="how" className="py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-14">
          <span className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            How It Works
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            One upload. Four sales channels.<br className="hidden sm:block"/> Zero extra work.
          </h2>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-700 z-0" />
              )}

              {/* Step number */}
              <div className="text-5xl font-black text-gray-100 dark:text-gray-800 leading-none mb-3 select-none">
                {step.num}
              </div>

              {/* Icon */}
              <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mb-4 text-lg">
                {step.icon}
              </div>

              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                {step.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}