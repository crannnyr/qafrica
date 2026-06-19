// src/pages/auth/StoreSetup/StoreBrandingPicker.tsx

import { Check } from 'lucide-react';
import { COLOR_PRESETS } from './constants';

interface FormData {
  name: string;
  description: string;
  primary_color: string;
  secondary_color: string;
}

interface Props {
  formData: FormData;
  onSelectPreset: (primary: string, secondary: string) => void;
}

export default function StoreBrandingPicker({ formData, onSelectPreset }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose Your Brand Colors</h2>
        <p className="text-gray-500">Make your store uniquely yours.</p>
      </div>

      {/* Color presets */}
      <div className="grid grid-cols-3 gap-3">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onSelectPreset(preset.primary, preset.secondary)}
            className={`p-4 rounded-xl border-2 transition-all ${
              formData.primary_color === preset.primary
                ? 'border-orange-500 bg-orange-50 shadow-md'
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            <div className="flex gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-full border border-gray-100"
                style={{ backgroundColor: preset.primary }}
              />
              <div
                className="w-7 h-7 rounded-full border border-gray-100"
                style={{ backgroundColor: preset.secondary }}
              />
            </div>
            <p className="text-sm font-medium text-gray-900">{preset.name}</p>
            {formData.primary_color === preset.primary && (
              <div className="mt-1 flex items-center gap-1 text-orange-600 text-xs font-medium">
                <Check className="w-3 h-3" /> Selected
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Live preview */}
      <div className="bg-gray-50 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-600 mb-3">Live Preview</p>
        <div
          className="rounded-xl p-5 text-white"
          style={{ backgroundColor: formData.primary_color }}
        >
          <h3 className="text-lg font-bold mb-1">
            {formData.name || 'Your Store Name'}
          </h3>
          <p className="opacity-80 text-sm mb-3">
            {formData.description || 'Your store tagline'}
          </p>
          <button
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              backgroundColor: formData.secondary_color,
              color: formData.primary_color,
            }}
          >
            Shop Now
          </button>
        </div>
      </div>
    </div>
  );
}