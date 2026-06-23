// src/pages/auth/Pricing/PricingHeader.tsx

import { ShoppingBag, Check } from 'lucide-react';

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
      <div className="flex items-center justify-center gap-4 mb-12">
        {['Account', 'Niche', 'Store'].map((label) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-green-600">{label}</span>
            <div className="w-12 h-0.5 bg-orange-300 hidden sm:block" />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
            4
          </div>
          <span className="text-sm font-medium text-orange-600">Plan</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
          Choose Your Plan
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Every plan includes all features. The only difference is how many niches
          you can sell in and how many staff members you can invite.
        </p>
      </div>
    </>
  );
}
