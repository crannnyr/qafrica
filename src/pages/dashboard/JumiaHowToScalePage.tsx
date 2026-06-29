// src/pages/dashboard/JumiaHowToScalePage.tsx
// Static educational content. No data dependencies, safe to build standalone.

import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, TrendingUp, Package, AlertCircle } from 'lucide-react';

const SOURCING_TIPS = [
  {
    title: 'Phone accessories',
    body: 'Look at markets like Computer Village (Ikeja) or Alaba International. Pouches, chargers, earphones, and screen protectors sell fast and are cheap to stock 10+ units of.',
  },
  {
    title: 'Clothing & fashion',
    body: 'Trade fairs and wholesale markets like Yaba or Balogun Market have bulk clothing at low per-unit cost. Pick items with consistent sizing so variants are easy to manage.',
  },
  {
    title: 'Home & kitchen items',
    body: 'Practical, affordable items (storage, kitchen tools) move well on Jumia. Look for suppliers who can guarantee the same item in bulk — consistency matters more than novelty.',
  },
];

const SCALING_STEPS = [
  { title: 'Start with one product', body: 'Pick a single item you can comfortably get 10+ units of. Prove it sells before spreading across many products.' },
  { title: 'Reinvest your first payout', body: 'When you withdraw, put part of it back into restocking the same item or testing a second product.' },
  { title: 'Watch what sells, not what you like', body: "Your daily sales log tells the real story. If an item isn't moving, switch suppliers or try a different product instead of waiting it out." },
  { title: 'Keep suppliers reliable', body: 'A supplier who can\'t consistently provide the same item in bulk will slow you down. Build a relationship with 2-3 trusted suppliers per category.' },
];

export default function JumiaHowToScalePage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link to="/dashboard/jumia" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Jumia
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">How to Scale on Jumia Locally</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Practical advice for sourcing products and growing steadily with this model.
        </p>
      </div>

      <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-orange-800 dark:text-orange-300">
          Remember: every item needs at least 10 units of the same product ready before you submit.
          Choosing affordable, consistent items makes this far easier to hit.
        </p>
      </div>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-4">
          <MapPin className="w-5 h-5 text-orange-500" /> Where to Source
        </h2>
        <div className="space-y-3">
          {SOURCING_TIPS.map((tip) => (
            <div key={tip.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <p className="font-bold text-gray-900 dark:text-white text-sm mb-1">{tip.title}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{tip.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-4">
          <TrendingUp className="w-5 h-5 text-orange-500" /> Scaling Steps
        </h2>
        <div className="space-y-3">
          {SCALING_STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0 font-bold text-orange-500 text-sm">
                {i + 1}
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-sm mb-1">{step.title}</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Link
        to="/dashboard/jumia/add"
        className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold transition-colors"
      >
        <Package className="w-4 h-4" /> Send Your First Item
      </Link>
    </div>
  );
}
