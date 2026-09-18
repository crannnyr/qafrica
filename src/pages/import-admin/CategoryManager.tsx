import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader, RefreshCw } from 'lucide-react';
import CONFIG from '@/lib/config';

const CATEGORY_EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/category`;

interface CategoryRow {
  id: string;
  niche_id: string;
  name: string;
  sort_order: number;
  subcategories: SubcategoryRow[];
}

interface SubcategoryRow {
  id: string;
  category_id: string;
  niche_id: string;
  name: string;
  sort_order: number;
}

interface Props {
  token: string;
}

const NICHE_ORDER = [
  'fashion', 'electronics', 'beauty', 'home', 'food', 'health', 'sports',
  'baby', 'automotive', 'books', 'jewelry', 'handmade', 'pets', 'office', 'agriculture',
];

export default function CategoryManager({ token }: Props) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selectedNiche, setSelectedNiche] = useState('fashion');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${CATEGORY_EDGE_URL}?action=list`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load categories');
      setCategories(data.categories ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleCategories = useMemo(
    () => categories.filter(category => category.niche_id === selectedNiche),
    [categories, selectedNiche],
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-gray-900 text-sm">Categories</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Manage the categories and subcategories used by products.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-100 text-gray-500 hover:text-gray-900 disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Category group</label>
          <select
            value={selectedNiche}
            onChange={e => setSelectedNiche(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-gray-400"
          >
            {NICHE_ORDER.map(niche => (
              <option key={niche} value={niche}>
                {niche.replace(/-/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex items-center justify-center py-14">
          <Loader className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : visibleCategories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 text-center py-14 text-sm text-gray-400">
          No categories found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            <span>Categories</span>
            <span>Subcategories</span>
          </div>

          <div className="divide-y divide-gray-100">
            {visibleCategories.map(category => {
              const isOpen = expanded[category.id] ?? true;
              return (
                <div key={`${category.niche_id}:${category.id}`}>
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [category.id]: !isOpen }))}
                    className="w-full grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-gray-800 truncate">{category.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {category.subcategories.length} subcategor{category.subcategories.length === 1 ? 'y' : 'ies'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 px-4 pb-3">
                      <div />
                      <div className="flex flex-wrap gap-1.5">
                        {category.subcategories.map(subcategory => (
                          <span
                            key={subcategory.id}
                            className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-600"
                          >
                            {subcategory.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-[10px] text-gray-400 px-1">
        {visibleCategories.length} categor{visibleCategories.length === 1 ? 'y' : 'ies'} loaded.
      </div>
    </div>
  );
}
