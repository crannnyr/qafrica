// src/pages/auth/StoreSetup/StoreThemePicker.tsx

import { Check } from 'lucide-react';
import { THEMES } from './constants';

interface Props {
  selectedTheme: string;
  onSelect: (themeId: string) => void;
}

export default function StoreThemePicker({ selectedTheme, onSelect }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose a Theme</h2>
        <p className="text-gray-500">Pick the style that fits your brand.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onSelect(theme.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedTheme === theme.id
                ? 'border-orange-500 bg-orange-50 shadow-md'
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            <div
              className="w-full h-20 rounded-lg mb-3"
              style={{ backgroundColor: theme.color }}
            />
            <p className="font-semibold text-gray-900">{theme.name}</p>
            <p className="text-sm text-gray-500">{theme.description}</p>

            {selectedTheme === theme.id && (
              <div className="mt-2 flex items-center gap-1 text-orange-600 text-xs font-medium">
                <Check className="w-3 h-3" /> Selected
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}