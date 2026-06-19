import { BarChart2 } from 'lucide-react';
import { InfoTip } from '../InfoTip';

const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors text-sm";
const labelClass = "block text-xs font-medium text-gray-600 mb-1.5";

export function Step6SEO({ formData, set, currentStore }: {
  formData: any;
  set: (patch: any) => void;
  currentStore: any;
}) {
  return (
    <div className="space-y-4">
      {/* SEO */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4" /> SEO
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Helps your product appear in Google. Left blank, your product name and description are used.
          </p>
        </div>

        <div>
          <label className={labelClass}>
            SEO Title <span className="text-gray-400 font-normal">— Optional</span>
            <InfoTip text="Title shown in Google results. Keep under 60 characters." />
          </label>
          <input type="text" value={formData.seo_title}
            onChange={e => set({ seo_title: e.target.value })}
            className={inputClass}
            placeholder={formData.name || 'e.g. Red Silk Dress – Free Delivery Nigeria'}
            maxLength={60} />
          <p className="text-[10px] text-gray-400 mt-1">{formData.seo_title.length}/60</p>
        </div>

        <div>
          <label className={labelClass}>
            SEO Description <span className="text-gray-400 font-normal">— Optional</span>
            <InfoTip text="Description shown under your link in Google. Keep under 160 characters." />
          </label>
          <textarea value={formData.seo_description}
            onChange={e => set({ seo_description: e.target.value })}
            className={`${inputClass} min-h-[70px] resize-none`}
            placeholder="Brief compelling description for search engines..."
            maxLength={160} />
          <p className="text-[10px] text-gray-400 mt-1">{formData.seo_description.length}/160</p>
        </div>

        {(formData.seo_title || formData.name) && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-[10px] text-gray-400 mb-1.5 font-medium">Google preview</p>
            <p className="text-blue-600 text-sm font-medium truncate">
              {formData.seo_title || formData.name}
            </p>
            <p className="text-green-700 text-[10px]">
              qafrica.store/{currentStore?.slug}/...
            </p>
            <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">
              {formData.seo_description || formData.description || 'No description set.'}
            </p>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Settings</h2>

        <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
          <input type="checkbox" checked={formData.allowOtherSellers}
            onChange={e => set({ allowOtherSellers: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 mt-0.5" />
          <div>
            <span className="text-sm font-medium text-gray-900 block">
              Allow other sellers to sell this product
              <InfoTip text="Other store owners can import and list your product. You still fulfil all orders." />
            </span>
            <span className="text-xs text-gray-400">They promote it, you fulfil it, you both earn.</span>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
          <input type="checkbox" checked={formData.is_active}
            onChange={e => set({ is_active: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 mt-0.5" />
          <div>
            <span className="text-sm font-medium text-gray-900 block">Product is active</span>
            <span className="text-xs text-gray-400">Uncheck to save as draft — customers won't see it until activated.</span>
          </div>
        </label>
      </div>
    </div>
  );
}