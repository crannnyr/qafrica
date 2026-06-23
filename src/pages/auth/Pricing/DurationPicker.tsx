// src/pages/auth/Pricing/DurationPicker.tsx

import { durations } from './constants';

interface Props {
  selectedDuration: number;
  onSelect: (duration: number) => void;
}

export default function DurationPicker({ selectedDuration, onSelect }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8 max-w-3xl mx-auto">
      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
        Select Billing Period
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {durations.map((duration) => {
          const isSelected = selectedDuration === duration.value;
          const hasDiscount = duration.value > 1;
          return (
            <button
              key={duration.value}
              onClick={() => onSelect(duration.value)}
              className={`p-3 rounded-lg border-2 transition-all relative ${
                isSelected
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              {hasDiscount && (
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {duration.discount}
                </span>
              )}
              <p className={`font-semibold text-sm ${
                isSelected ? 'text-orange-700' : 'text-gray-700'
              }`}>
                {duration.label}
              </p>
              <p className={`text-xs mt-0.5 ${
                isSelected ? 'text-orange-500' : 'text-gray-400'
              }`}>
                {hasDiscount ? `Save ${duration.discount}` : 'Standard rate'}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
