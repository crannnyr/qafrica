// src/pages/dashboard/Jumia/JumiaFeeCalculator.tsx
// Shows exactly what the user takes home after the flat 20% platform cut.
// Two modes: "I'll sell at ₦X, what do I get?" and "I want ₦X per sale, what should I charge?"
// Per spec: only shows OUR 20% cut, does not attempt to estimate Jumia's separate unknown commission.

import { useState, useMemo } from 'react';
import { Calculator, ArrowRight } from 'lucide-react';

const PLATFORM_CUT_PERCENT = 20;

interface Props {
  sellingPrice: string;
  onSellingPriceChange: (value: string) => void;
}

export default function JumiaFeeCalculator({ sellingPrice, onSellingPriceChange }: Props) {
  const [mode, setMode] = useState<'price_to_payout' | 'payout_to_price'>('price_to_payout');
  const [desiredPayout, setDesiredPayout] = useState('');

  const price = Number(sellingPrice) || 0;
  const payout = useMemo(() => Math.round(price * (1 - PLATFORM_CUT_PERCENT / 100)), [price]);
  const cutAmount = price - payout;

  const recommendedPrice = useMemo(() => {
    const wanted = Number(desiredPayout) || 0;
    if (wanted <= 0) return 0;
    return Math.ceil(wanted / (1 - PLATFORM_CUT_PERCENT / 100));
  }, [desiredPayout]);

  return (
    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Earnings Calculator</h3>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('price_to_payout')}
          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === 'price_to_payout' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'
          }`}
        >
          What will I earn?
        </button>
        <button
          type="button"
          onClick={() => setMode('payout_to_price')}
          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            mode === 'payout_to_price' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'
          }`}
        >
          What should I charge?
        </button>
      </div>

      {mode === 'price_to_payout' ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Your selling price feeds this automatically.</p>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Selling price</span>
              <span className="font-semibold text-gray-900 dark:text-white">₦{price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Platform fee ({PLATFORM_CUT_PERCENT}%)</span>
              <span className="font-semibold text-red-500">−₦{cutAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm pt-1.5 border-t border-gray-100 dark:border-gray-700">
              <span className="font-bold text-gray-900 dark:text-white">You receive</span>
              <span className="font-bold text-green-600">₦{payout.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500">How much do you want to make per sale?</label>
          <input
            type="number"
            value={desiredPayout}
            onChange={(e) => setDesiredPayout(e.target.value)}
            placeholder="e.g. 5000"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
          />
          {recommendedPrice > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Recommended selling price</p>
                <p className="font-bold text-gray-900 dark:text-white text-lg">₦{recommendedPrice.toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => onSellingPriceChange(String(recommendedPrice))}
                className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-500/10 px-3 py-2 rounded-lg hover:bg-orange-100 transition-colors"
              >
                Use This Price <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
