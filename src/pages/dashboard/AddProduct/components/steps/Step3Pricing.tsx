import { InfoTip } from '../InfoTip';

const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors text-sm";
const labelClass = "block text-xs font-medium text-gray-600 mb-1.5";

export function Step3Pricing({ formData, set }: {
  formData: any;
  set: (patch: any) => void;
}) {
  const sp = parseFloat(formData.selling_price) || 0;
  const cp = parseFloat(formData.compare_at_price) || 0;
  const discount = cp > sp && sp > 0 ? Math.round((1 - sp / cp) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Pricing</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Selling Price (₦) <span className="text-orange-500">*</span>
            <InfoTip text="The price customers pay in your store." />
          </label>
          <input type="number" value={formData.selling_price}
            onChange={e => set({ selling_price: e.target.value })}
            className={inputClass} placeholder="0.00" min="0" />
        </div>

        <div>
          <label className={labelClass}>
            Compare-at Price (₦)
            <InfoTip text="The original crossed-out price. Must be higher than selling price." />
          </label>
          <input type="number" value={formData.compare_at_price}
            onChange={e => set({ compare_at_price: e.target.value })}
            className={inputClass} placeholder="0.00 (optional)" min="0" />
        </div>

        <div>
          <label className={labelClass}>
            Cost Price (₦)
            <InfoTip text="What you paid. Only used for profit calculations — customers never see it." />
          </label>
          <input type="number" value={formData.cost_price}
            onChange={e => set({ cost_price: e.target.value })}
            className={inputClass} placeholder="0.00" min="0" />
        </div>

        <div>
          <label className={labelClass}>
            Dropship Price (₦)
            <InfoTip text="What other sellers pay you. Must be lower than selling price." />
          </label>
          <input type="number" value={formData.dropship_price}
            onChange={e => set({ dropship_price: e.target.value })}
            className={inputClass} placeholder="0.00" min="0" />
        </div>

        <div>
          <label className={labelClass}>
            Wholesale Price (₦)
            <InfoTip text="Discounted price for bulk buyers. Leave blank if not applicable." />
          </label>
          <input type="number" value={formData.wholesale_price}
            onChange={e => set({ wholesale_price: e.target.value })}
            className={inputClass} placeholder="0.00" min="0" />
        </div>
      </div>

      {sp > 0 && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Customer preview</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-orange-500">₦{sp.toLocaleString()}</span>
            {discount > 0 && (
              <>
                <span className="text-sm text-gray-400 line-through">₦{cp.toLocaleString()}</span>
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded-full">
                  {discount}% OFF
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}