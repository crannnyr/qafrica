// src/pages/dashboard/Jumia/JumiaCategorySelect.tsx
// Dropdown of admin-curated accepted categories with a warning about large items.
// User can type a custom category (open field) but sees a soft warning if it
// doesn't match the accepted list. Hard block is NOT applied — just a clear notice.

import { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { supabase } from '@/services';

interface Category {
  id: string;
  name: string;
  description: string;
  examples: string;
}

const CUSTOM_VALUE = '__custom__';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function JumiaCategorySelect({ value, onChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<Category | null>(null);

  useEffect(() => {
    supabase
      .from('jumia_accepted_categories')
      .select('id, name, description, examples')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setCategories(data as Category[]); });
  }, []);

  const handleSelect = (val: string) => {
    if (val === CUSTOM_VALUE) {
      setIsCustom(true);
      setSelectedInfo(null);
      onChange('');
      return;
    }
    setIsCustom(false);
    onChange(val);
    const found = categories.find((c) => c.name === val);
    setSelectedInfo(found ?? null);
  };

  const isAccepted = !isCustom && categories.some((c) => c.name === value);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-gray-500">Category</label>

      <select
        value={isCustom ? CUSTOM_VALUE : value}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
      >
        <option value="" disabled>Select a category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
        <option value={CUSTOM_VALUE}>Other (not listed)</option>
      </select>

      {/* Show examples for selected category */}
      {selectedInfo && (
        <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-900/30 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-800 dark:text-orange-300 leading-relaxed">
            <strong>{selectedInfo.description}.</strong> Examples: {selectedInfo.examples}.
          </p>
        </div>
      )}

      {/* Custom category input + warning */}
      {isCustom && (
        <div className="space-y-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe your category"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
          />
          {value.trim() && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                This category isn't on our standard list. Your item will still be reviewed —
                just make sure it is <strong>not large or heavy</strong>. We cannot currently
                accept bulky items regardless of category.
              </p>
            </div>
          )}
        </div>
      )}

      {/* General accepted categories notice */}
      <p className="text-xs text-gray-400 leading-relaxed">
        These are the categories we currently accept. As we expand to a larger facility,
        we'll be able to accept bigger items.
      </p>
    </div>
  );
}
