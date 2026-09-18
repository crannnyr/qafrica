import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader, RefreshCw, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
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

export default function CategoryManager({ token }: Props) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSubcategory, setEditingSubcategory] = useState<SubcategoryRow | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openNewSubcategory = (categoryId: string) => {
    setEditingSubcategory(null); setSubcategoryName(''); setSubcategoryCategoryId(categoryId);
  };
  const openEditSubcategory = (subcategory: SubcategoryRow) => {
    setEditingSubcategory(subcategory); setSubcategoryName(subcategory.name); setSubcategoryCategoryId(subcategory.category_id);
  };
  const closeSubcategoryForm = () => {
    setEditingSubcategory(null); setSubcategoryName(''); setSubcategoryCategoryId('');
  };
  const saveSubcategory = async () => {
    const name = subcategoryName.trim(); const category = categories.find(c => c.id === subcategoryCategoryId);
    if (!name || !category) return; setSaving(true); setError('');
    try {
      const res = await fetch(CATEGORY_EDGE_URL + '?action=save-subcategory', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, id: editingSubcategory?.id, name, category_id: category.id, niche_id: category.niche_id, sort_order: editingSubcategory?.sort_order ?? category.subcategories.length }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'Could not save subcategory');
      closeSubcategoryForm(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save subcategory'); } finally { setSaving(false); }
  };
  const deleteSubcategory = async (subcategory: SubcategoryRow) => {
    if (!window.confirm('Delete "' + subcategory.name + '"?')) return; setError('');
    try {
      const res = await fetch(CATEGORY_EDGE_URL + '?action=delete-subcategory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manager_token: token, id: subcategory.id }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'Could not delete subcategory'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete subcategory'); }
  };


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

      </div>

      {(subcategoryName || editingSubcategory) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3"><p className="font-bold text-gray-900 text-sm">{editingSubcategory ? 'Edit Subcategory' : 'Add Subcategory'}</p><button onClick={closeSubcategoryForm} className="p-1.5 text-gray-400"><X className="w-4 h-4" /></button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={subcategoryCategoryId} onChange={e => setSubcategoryCategoryId(e.target.value)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"><option value="">Select category</option>{categories.map(category => <option key={category.niche_id + ':' + category.id} value={category.id}>{category.name}</option>)}</select>
            <input value={subcategoryName} onChange={e => setSubcategoryName(e.target.value)} placeholder="Subcategory name" className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
          </div>
          <div className="flex justify-end mt-3"><button onClick={saveSubcategory} disabled={saving || !subcategoryName.trim() || !subcategoryCategoryId} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold disabled:opacity-40">{saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{saving ? 'Saving…' : 'Save subcategory'}</button></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex items-center justify-center py-14">
          <Loader className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : categories.length === 0 ? (
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
            {categories.map(category => {
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
                          <div key={subcategory.id} className="group flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100">
                            <span className="text-[11px] text-gray-600">{subcategory.name}</span>
                            <button onClick={() => openEditSubcategory(subcategory)} className="hidden group-hover:block text-gray-400" title="Edit"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => deleteSubcategory(subcategory)} className="hidden group-hover:block text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <button onClick={() => openNewSubcategory(category.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-gray-200 text-[11px] text-gray-400 hover:text-gray-700"><Plus className="w-3 h-3" /> Add</button>
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
        {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} loaded.
      </div>
    </div>
  );
}
