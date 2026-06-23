// src/pages/auth/Pricing/BillingToggle.tsx

import { Infinity as InfinityIcon } from 'lucide-react';

interface Props {
  billingType: 'monthly' | 'lifetime';
  onToggle: (type: 'monthly' | 'lifetime') => void;
}

export default function BillingToggle({ billingType, onToggle }: Props) {
  return (
    <div className="flex justify-center mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex">
        <button
          onClick={() => onToggle('monthly')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            billingType === 'monthly'
              ? 'bg-orange-500 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Monthly / Yearly
        </button>
        <button
          onClick={() => onToggle('lifetime')}
          className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
            billingType === 'lifetime'
              ? 'bg-orange-500 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <InfinityIcon className="w-4 h-4" />
          Lifetime
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            billingType === 'lifetime'
              ? 'bg-white/25 text-white'
              : 'bg-green-100 text-green-700'
          }`}>
            SAVE 90%+
          </span>
        </button>
      </div>
    </div>
  );
}
