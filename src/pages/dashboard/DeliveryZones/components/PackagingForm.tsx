import { Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PACKAGING_FIELDS } from '../constants';
import type { PackagingDimensions } from '../types';

export function PackagingForm({ packaging, setPackaging, isSaving, onSave }: {
  packaging: PackagingDimensions;
  setPackaging: (p: PackagingDimensions) => void;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Package className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-semibold text-gray-900">Default Package Dimensions</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Used for rate calculation. Be accurate — couriers may charge extra for incorrect dimensions.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {PACKAGING_FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
            <input
              type="number"
              min="0"
              step={f.step}
              value={(packaging as any)[f.key]}
              onChange={e => setPackaging({ ...packaging, [f.key]: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
            />
          </div>
        ))}
      </div>

      <Button onClick={onSave} disabled={isSaving}
        className="bg-orange-500 hover:bg-orange-600 text-white px-5 h-9 text-xs">
        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Dimensions'}
      </Button>
    </div>
  );
}