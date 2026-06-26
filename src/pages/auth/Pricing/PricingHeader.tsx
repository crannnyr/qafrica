// src/pages/auth/Pricing/PricingHeader.tsx

import { ShoppingBag, Check } from 'lucide-react';
import { ALL_INCLUSIVE_FEATURES } from './constants';

// Colourful marketplace badges
function MarketplaceBadges() {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#FF6600' }}>Jumia</span>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#C8202F' }}>Konga</span>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#4CAF50' }}>Jiji</span>
    </div>
  );
}

export default function PricingHeader() {
  return (
    <>
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2">
          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2 mb-12">
        {['Account', 'Niche', 'Store'].map((label, i) => (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-green-600 hidden sm:block">{label}</span>
            </div>
            <div className="w-8 sm:w-12 h-0.5 mx-2 bg-orange-300" />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
            4
          </div>
          <span className="text-sm font-medium text-orange-600 hidden sm:block">Plan</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
          Choose Your Plan
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          All features included in every plan — plans differ only by niches and staff seats.
        </p>
      </div>

      {/* All inclusive grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h3 className="text-sm font-bold text-center text-gray-700 mb-5 uppercase tracking-wide">
          ✅ Included in every plan
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ALL_INCLUSIVE_FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />
              {feature}
            </div>
          ))}
          {/* Marketplace row */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />
              <strong>Push to Marketplaces</strong>
            </div>
            <div className="pl-3.5">
              <MarketplaceBadges />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
