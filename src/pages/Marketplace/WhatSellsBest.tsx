// src/pages/Marketplace/WhatSellsBest.tsx

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const HOT = [
  { label: 'Phone Accessories', hot: true  },
  { label: 'Hair Extensions',   hot: true  },
  { label: 'Skincare',          hot: true  },
  { label: 'Sneakers',          hot: false },
  { label: 'Kitchen Gadgets',   hot: false },
  { label: 'Baby Products',     hot: false },
];

export default function WhatSellsBest() {
  return (
    <section className="bg-gray-900 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

          {/* Left */}
          <div className="flex-shrink-0">
            <h3 className="text-base font-bold text-white mb-1">
              What's flying off Jumia right now?
            </h3>
            <p className="text-xs text-gray-500">
              Real data · Updated monthly · Free to read
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 flex-1">
            {HOT.map(item => (
              <span
                key={item.label}
                className={`px-3 py-1.5 rounded-lg text-xs font-500 border ${
                  item.hot
                    ? 'bg-orange-900/40 border-orange-700/50 text-orange-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                {item.hot ? '🔥 ' : ''}{item.label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <Link
            to="/blog/what-sells-best-on-jumia-2026"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex-shrink-0"
          >
            View Full Data
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

        </div>
      </div>
    </section>
  );
}