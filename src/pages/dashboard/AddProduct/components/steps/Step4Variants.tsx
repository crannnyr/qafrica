import { Package } from 'lucide-react';
import { InfoTip } from '../InfoTip';
import { VariantManager } from '../VariantManager';
import type { VariantCombination } from '../../types';

export function Step4Variants({ formData, set, variants, setVariants }: {
  formData: any;
  set: (patch: any) => void;
  variants: VariantCombination[];
  setVariants: (v: VariantCombination[]) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1">
            Product Variants
            <InfoTip text="Enable if your product comes in different options like size or colour." />
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Add size, colour, or other options</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.has_variants}
            onChange={e => { set({ has_variants: e.target.checked }); if (!e.target.checked) setVariants([]); }}
            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-xs font-medium text-gray-700">Enable Variants</span>
        </label>
      </div>

      {!formData.has_variants && (
        <div className="py-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Toggle variants on if this product comes in different sizes, colours, or styles.</p>
        </div>
      )}

      {formData.has_variants && (
        <VariantManager
          variants={variants}
          onChange={setVariants}
          basePrice={parseFloat(formData.selling_price) || 0}
        />
      )}
    </div>
  );
}