// src/pages/Marketplace/MarketplaceFaq.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const FAQS = [
  {
    q: 'How do I start selling on Jumia in Nigeria?',
    a: 'To sell on Jumia you need to register as a vendor on their seller centre, submit your business documents, list your products and manage fulfilment. With QAFRICA, we handle the listing, QC and fulfilment for you — you just pick your products and set your price.',
  },
  {
    q: 'How much does Jumia charge sellers in Nigeria?',
    a: 'Jumia charges approximately 12% commission per sale, plus VAT at 7.5% and logistics/packaging costs. Total deductions are around 20% of your selling price. Our profit calculator above shows you exactly what you take home on any product.',
  },
  {
    q: 'How many orders does Jumia get per day in Nigeria?',
    a: 'Jumia Nigeria processes tens of thousands of orders daily with over 3 million monthly active users. During sales events like Black Friday, this number increases significantly — making it the highest-traffic marketplace to be listed on in Nigeria.',
  },
  {
    q: 'Can I sell on Jumia without having my own products?',
    a: 'Yes — through dropshipping via QAFRICA. You select products from our import catalog, set your price, and we list them on Jumia under your store. When an order comes in, we fulfil it. You never hold inventory or touch the product.',
  },
  {
    q: 'How do I sell on Konga Nigeria?',
    a: 'Konga requires seller registration, product listing and fulfilment management. QAFRICA handles all of this for you and lists your products on Konga simultaneously with Jumia and Jiji — from one dashboard, with one upload.',
  },
  {
    q: 'How do I sell on Jiji Nigeria?',
    a: 'Jiji works differently from Jumia and Konga — it is more of a classifieds marketplace. QAFRICA manages your Jiji presence alongside your other channels so you reach Jiji\'s 1.5 million monthly users without any extra work on your end.',
  },
  {
    q: 'Why do Jumia seller accounts get banned?',
    a: "The most common reasons are quality violations — products that don't match the listing description, arrive damaged, or are counterfeit. QAFRICA's 2-layer QC system prevents all of these by inspecting every batch before it is listed on any platform.",
  },
  {
    q: 'What products sell best on Jumia Nigeria?',
    a: 'Phone accessories, hair extensions, skincare products, sneakers and kitchen gadgets consistently top Jumia\'s bestseller lists in Nigeria. See our full breakdown with margins and supplier tips in our dedicated blog post.',
    link: { label: 'View what sells best →', to: '/blog/what-sells-best-on-jumia-2026' },
  },
  {
    q: 'How much can I make selling on Jumia?',
    a: 'Margins vary by product but most QAFRICA sellers make between 40% and 80% net margin on China-sourced products after all Jumia fees, VAT and logistics. Use our profit calculator above to see your exact numbers.',
  },
  {
    q: 'Is it safe to import products from China to sell on Jumia?',
    a: 'It is safe when done correctly. The risk comes from unverified suppliers and poor quality control. QAFRICA sources only from verified manufacturers and runs two quality checks on every batch before listing — protecting both your customers and your Jumia account.',
  },
];

export default function MarketplaceFaq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 px-4 sm:px-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            FAQ
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">
            Questions Nigerian sellers ask
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Everything you need to know about selling on Jumia, Konga and Jiji.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              {/* Question */}
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 group"
              >
                <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors leading-snug">
                  {faq.q}
                </span>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${
                  open === i
                    ? 'rotate-90 text-orange-500'
                    : 'text-gray-300 dark:text-gray-600'
                }`} />
              </button>

              {/* Answer */}
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{   height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-1 border-t border-gray-50 dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        {faq.a}
                      </p>
                      {faq.link && (
                        <a
                          href={faq.link.to}
                          className="inline-flex items-center gap-1 text-xs text-orange-600 font-semibold mt-3 hover:text-orange-700 transition-colors"
                        >
                          {faq.link.label}
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}