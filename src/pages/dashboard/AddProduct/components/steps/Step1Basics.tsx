import { InfoTip } from '../InfoTip';
import { getNicheCategories, getSubcategories } from '@/lib/nicheCategories';
import CONFIG from '@/lib/config';
import { useNavigate } from 'react-router-dom';

const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors text-sm";
const labelClass = "block text-xs font-medium text-gray-600 mb-1.5";

export function Step1Basics({ formData, set, allowedNiches }: {
  formData: any;
  set: (patch: any) => void;
  allowedNiches: string[];
}) {
  const navigate = useNavigate();
  const nicheCategories = formData.niche ? getNicheCategories(formData.niche) : [];
  const subcategories   = formData.niche && formData.category ? getSubcategories(formData.niche, formData.category) : [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Basic Information</h2>

      <div>
        <label className={labelClass}>Product Name <span className="text-orange-500">*</span></label>
        <input type="text" value={formData.name} onChange={e => set({ name: e.target.value })}
          className={inputClass} placeholder="Enter product name" />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea value={formData.description} onChange={e => set({ description: e.target.value })}
          className={`${inputClass} min-h-[100px] resize-none`} placeholder="Describe your product..." />
      </div>

      <div>
        <label className={labelClass}>
          Niche <span className="text-orange-500">*</span>
          <InfoTip text="The broad market your product belongs to." />
        </label>
        <select value={formData.niche} onChange={e => set({ niche: e.target.value, category: '', subcategory: '' })}
          className={inputClass}>
          <option value="">Select a niche...</option>
          {allowedNiches.map(nicheId => {
            const niche = CONFIG.NICHES.find((n: any) => n.id === nicheId);
            return <option key={nicheId} value={nicheId}>{niche?.name || nicheId}</option>;
          })}
        </select>
        <p className="text-[10px] text-gray-400 mt-1">
          Only your subscribed niches are shown.{' '}
          <button type="button" onClick={() => navigate('/dashboard/subscription')}
            className="text-orange-500 hover:underline">
            Upgrade for more
          </button>
        </p>
      </div>

      {formData.niche && (
        <div>
          <label className={labelClass}>Category <span className="text-orange-500">*</span></label>
          <select value={formData.category} onChange={e => set({ category: e.target.value, subcategory: '' })}
            className={inputClass}>
            <option value="">Select a category...</option>
            {nicheCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
      )}

      {formData.category && subcategories.length > 0 && (
        <div>
          <label className={labelClass}>
            Subcategory <span className="text-gray-400 font-normal">— Optional</span>
          </label>
          <select value={formData.subcategory} onChange={e => set({ subcategory: e.target.value })}
            className={inputClass}>
            <option value="">Select a subcategory...</option>
            {subcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}