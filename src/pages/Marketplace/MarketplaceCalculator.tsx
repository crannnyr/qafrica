// src/pages/Marketplace/MarketplaceCalculator.tsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Package } from 'lucide-react';

interface Result {
  sellingPrice: number;
  jumiaFee:     number;
  vat:          number;
  logistics:    number;
  productCost:  number;
  profit:       number;
}

function calculate(cost: number, price: number): Result {
  const jumiaFee  = price * 0.12;
  const vat       = price * 0.075;
  const logistics = price * 0.005;
  const profit    = price - jumiaFee - vat - logistics - cost;
  return { sellingPrice: price, jumiaFee, vat, logistics, productCost: cost, profit };
}

function fmt(n: number) {
  return '₦' + Math.round(n).toLocaleString();
}

export default function MarketplaceCalculator() {
  const [cost,   setCost]   = useState('');
  const [price,  setPrice]  = useState('');
  const result = cost && price
    ? calculate(parseFloat(cost) || 0, parseFloat(price) || 0)
    : null;

  return (
    <section className="bg-gray-50 dark:bg-gray-900 py-20 px-4 sm:px-6 border-t border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-5xl mx-auto">

        <div className="grid lg:grid-cols-2 gap-12 items-start">

          {/* ── Calculator ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              Profit Calculator
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">
              How much will you make?
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-8 max-w-sm">
              Enter your product cost and selling price. We'll show you exactly
              what you take home after Jumia commission, VAT, packaging and logistics.
            </p>

            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">

              {/* Inputs */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Your product cost (₦)
                  </label>
                  <input
                    type="number"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    placeholder="e.g. 8,000"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Your selling price (₦)
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="e.g. 15,000"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                  />
                </div>
              </div>

              {/* Results */}
              {result ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2"
                >
                  {[
                    { label: 'Selling price',              value: fmt(result.sellingPrice), neg: false  },
                    { label: 'Jumia commission (~12%)',     value: fmt(result.jumiaFee),     neg: true   },
                    { label: 'VAT (7.5%)',                  value: fmt(result.vat),          neg: true   },
                    { label: 'Packaging + logistics (~0.5%)', value: fmt(result.logistics),  neg: true   },
                    { label: 'Your product cost',          value: fmt(result.productCost),  neg: true   },
                  ].map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-600 last:border-0 text-sm"
                    >
                      <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                      <span className={`font-semibold ${row.neg ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                        {row.neg ? '-' : ''}{row.value}
                      </span>
                    </div>
                  ))}

                  {/* Profit row */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                      Your profit 🎉
                    </span>
                    <span className={`text-xl font-black ${
                      result.profit >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {result.profit >= 0 ? '' : '-'}{fmt(Math.abs(result.profit))}
                    </span>
                  </div>

                  {/* Margin % */}
                  {result.profit > 0 && (
                    <p className="text-xs text-gray-400 text-right">
                      {Math.round((result.profit / result.sellingPrice) * 100)}% net margin
                    </p>
                  )}
                </motion.div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 text-center">
                  <p className="text-sm text-gray-400">
                    Enter your cost and price above to see your profit breakdown
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Right: Import CTA + mini stats ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="flex flex-col gap-4"
          >
            {/* Import card */}
            <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-7 text-white">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">
                Want affordable items to sell?
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-2">
                We'll help you{' '}
                <span className="text-yellow-400 font-semibold">
                  import top-selling items directly from China
                </span>{' '}
                — verified suppliers, strict QC, warehoused in Nigeria and
                ready to list on Jumia, Konga and Jiji.
              </p>
              <p className="text-xs text-gray-500 mb-5">
                No freight agent. No Alibaba risk. Factory prices.
              </p>
              <Link
                to="/importations"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                Explore Import Catalog
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mini stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: '12%',    lbl: 'QC rejection rate\nkeeps your account safe', color: 'text-orange-500'  },
                { val: '40–80%', lbl: 'Average margin on\nChina-sourced products',  color: 'text-green-600'   },
                { val: '24hr',   lbl: 'Order fulfilment\nafter confirmation',        color: 'text-gray-900 dark:text-white' },
                { val: '₦0',     lbl: 'Upfront cost to\nstart dropshipping',        color: 'text-purple-600'  },
              ].map((s, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-center"
                >
                  <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-[10px] text-gray-400 mt-1 leading-tight whitespace-pre-line">
                    {s.lbl}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}