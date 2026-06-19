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
          return (
            <button
              key={duration.value}
              onClick={() => onSelect(duration.value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <p className={`font-medium ${
                isSelected ? 'text-orange-700' : 'text-gray-700'
              }`}>
                {duration.label}
              </p>
              <p className={`text-xs ${
                isSelected ? 'text-orange-600' : 'text-gray-500'
              }`}>
                Save {duration.discount}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}