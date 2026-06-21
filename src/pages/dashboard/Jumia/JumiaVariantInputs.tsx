// src/pages/dashboard/Jumia/JumiaVariantInputs.tsx
// Small isolated component: lets the user add variant rows (e.g. Black 20, White 20).
// Enforces the 10-unit minimum per variant before the parent page allows submission.

import { Plus, Trash2 } from 'lucide-react';
import type { JumiaVariant } from '@/stores/jumiaStore';

const MIN_UNITS_PER_VARIANT = 10;

interface Props {
  hasVariants: boolean;
  onToggleVariants: (value: boolean) => void;
  variants: JumiaVariant[];
  onChange: (variants: JumiaVariant[]) => void;
  singleQuantity: number;
  onSingleQuantityChange: (qty: number) => void;
}

export default function JumiaVariantInputs({
  hasVariants, onToggleVariants, variants, onChange, singleQuantity, onSingleQuantityChange,
}: Props) {
  const addVariant = () => onChange([...variants, { label: '', quantity_sent: MIN_UNITS_PER_VARIANT, quantity_remaining: MIN_UNITS_PER_VARIANT }]);
  const removeVariant = (i: number) => onChange(variants.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: 'label' | 'quantity_sent', value: string | number) => {
    const next = [...variants];
    if (field === 'label') next[i] = { ...next[i], label: value as string };
    else next[i] = { ...next[i], quantity_sent: value as number, quantity_remaining: value as number };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onToggleVariants(false)}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${!hasVariants ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
        >
          Single Item
        </button>
        <button
          type="button"
          onClick={() => onToggleVariants(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${hasVariants ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
        >
          Has Variants (e.g. colors, sizes)
        </button>
      </div>

      <p className="text-xs text-gray-500">
        You need at least {MIN_UNITS_PER_VARIANT} units {hasVariants ? 'of each variant' : 'of this item'} ready before submitting.
      </p>

      {hasVariants && (
        <p className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg px-3 py-2">
          Example: if you sell polo shirts in Black and White, "Black — 10" means you have
          10 actual black polo shirts ready, and "White — 10" means 10 actual white polo
          shirts — each variant needs its own 10, not 10 shared between them.
        </p>
      )}

      {!hasVariants ? (
        <input
          type="number"
          min={MIN_UNITS_PER_VARIANT}
          value={singleQuantity}
          onChange={(e) => onSingleQuantityChange(Number(e.target.value))}
          placeholder={`Quantity (min ${MIN_UNITS_PER_VARIANT})`}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
        />
      ) : (
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={v.label}
                onChange={(e) => updateVariant(i, 'label', e.target.value)}
                placeholder="e.g. Black"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
              />
              <input
                type="number"
                min={MIN_UNITS_PER_VARIANT}
                value={v.quantity_sent}
                onChange={(e) => updateVariant(i, 'quantity_sent', Number(e.target.value))}
                className="w-28 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
              />
              <button type="button" onClick={() => removeVariant(i)} className="p-2 text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addVariant}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-600"
          >
            <Plus className="w-4 h-4" /> Add Variant
          </button>
        </div>
      )}
    </div>
  );
}
