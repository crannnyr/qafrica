import { Truck } from 'lucide-react';
import { InfoTip } from '../InfoTip';

const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors text-sm";
const labelClass = "block text-xs font-medium text-gray-600 mb-1.5";

export function Step5Shipping({ formData, set, isTerminalMode }: {
  formData: any;
  set: (patch: any) => void;
  isTerminalMode: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Shipping & Inventory</h2>

      {isTerminalMode && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-2">
          <Truck className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-800">
            <strong>Terminal Africa enabled.</strong> Weight is required for accurate carrier rates.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {!formData.has_variants && (
          <div>
            <label className={labelClass}>
              Stock Quantity <span className="text-orange-500">*</span>
              <InfoTip text="How many units you currently have available." />
            </label>
            <input type="number" value={formData.stock_quantity}
              onChange={e => set({ stock_quantity: e.target.value })}
              className={inputClass} placeholder="0" min="0" />
          </div>
        )}

        <div>
          <label className={labelClass}>
            Low Stock Threshold
            <InfoTip text="Get an alert when stock falls to or below this number." />
          </label>
          <input type="number" value={formData.low_stock_threshold}
            onChange={e => set({ low_stock_threshold: e.target.value })}
            className={inputClass} placeholder="10" min="1" />
        </div>

        {!formData.has_variants && (
          <div>
            <label className={labelClass}>
              SKU
              <InfoTip text="Your internal stock keeping code." />
            </label>
            <input type="text" value={formData.sku}
              onChange={e => set({ sku: e.target.value })}
              className={inputClass} placeholder="e.g. PROD-001 (optional)" />
          </div>
        )}

        <div>
          <label className={labelClass}>
            Barcode
            <InfoTip text="EAN, UPC, or ISBN if your product has one." />
          </label>
          <input type="text" value={formData.barcode}
            onChange={e => set({ barcode: e.target.value })}
            className={inputClass} placeholder="e.g. 8901234567890 (optional)" />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-xs font-semibold text-gray-600 mb-3">Shipping Details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Weight (kg)
              {isTerminalMode
                ? <span className="text-orange-500"> *</span>
                : <span className="text-gray-400 font-normal"> — Optional</span>}
              <InfoTip text="Product weight in kg. E.g. a pair of shoes ≈ 0.8 kg." />
            </label>
            <input type="number" step="0.01" min="0.01" value={formData.weight_kg}
              onChange={e => set({ weight_kg: e.target.value, weight: e.target.value })}
              className={`${inputClass} ${isTerminalMode && !formData.weight_kg ? 'border-orange-300 bg-orange-50' : ''}`}
              placeholder="e.g. 0.8" />
          </div>

          <div>
            <label className={labelClass}>
              HS Code <span className="text-gray-400 font-normal">— Optional</span>
              <InfoTip text="4 or 6 digit customs classification code." />
            </label>
            <input type="text" value={formData.hs_code}
              onChange={e => set({ hs_code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              className={`${inputClass} font-mono tracking-widest`}
              placeholder="e.g. 640399" maxLength={6} inputMode="numeric" />
            {formData.hs_code && formData.hs_code.length !== 4 && formData.hs_code.length !== 6 && (
              <p className="text-[10px] text-amber-600 mt-1">Must be 4 or 6 digits</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Product Type
              <InfoTip text="Physical products are Parcel. Use Document only for printed papers." />
            </label>
            <select value={formData.product_type}
              onChange={e => set({ product_type: e.target.value as 'parcel' | 'document' })}
              className={inputClass}>
              <option value="parcel">Physical Product (Parcel)</option>
              <option value="document">Document</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>
            Dimensions (cm) <span className="text-gray-400 font-normal">— Optional</span>
            <InfoTip text="Length × Width × Height in cm." />
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['length', 'width', 'height'] as const).map(dim => (
              <input key={dim} type="number" min="0"
                value={formData.dimensions[dim]}
                onChange={e => set({ dimensions: { ...formData.dimensions, [dim]: e.target.value } })}
                className={inputClass}
                placeholder={dim.charAt(0).toUpperCase() + dim.slice(1)} />
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Length × Width × Height in cm</p>
        </div>
      </div>
    </div>
  );
}