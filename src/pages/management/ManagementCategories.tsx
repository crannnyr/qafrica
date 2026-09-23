import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Loader, RefreshCw, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';

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
  markup_percent: number;
}

interface NicheRow {
  id: string;
  name: string;
}

type CategoryFormMode = 'new' | 'edit';

export default function ManagementCategories() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [niches, setNiches] = useState<NicheRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryFormMode, setCategoryFormMode] = useState<CategoryFormMode>('new');
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryNicheId, setCategoryNicheId] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState('0');

  const [subcategoryFormOpen, setSubcategoryFormOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<SubcategoryRow | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState('');
  const [subcategoryMarkupPercent, setSubcategoryMarkupPercent] = useState('0');

  const modalScrollPosition = useRef(0);

  const load = useCallback(async () => {
    const token = getManagementToken();
    if (!token) {
      setError('Management session expired. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${CATEGORY_EDGE_URL}?action=list&manager_token=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load categories');
      setCategories(data.categories ?? []);
      setNiches(data.niches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openNewCategory = () => {
    modalScrollPosition.current = window.scrollY;
    setEditingCategory(null);
    setCategoryFormMode('new');
    setCategoryName('');
    setCategoryNicheId(niches[0]?.id ?? categories[0]?.niche_id ?? '');
    setCategorySortOrder(String(categories.length));
    setCategoryFormOpen(true);
  };

  const openEditCategory = (category: CategoryRow) => {
    modalScrollPosition.current = window.scrollY;
    setEditingCategory(category);
    setCategoryFormMode('edit');
    setCategoryName(category.name);
    setCategoryNicheId(category.niche_id);
    setCategorySortOrder(String(category.sort_order ?? 0));
    setCategoryFormOpen(true);
  };

  const closeCategoryForm = () => {
    setCategoryFormOpen(false);
    setEditingCategory(null);
    setCategoryName('');
    setCategoryNicheId('');
    setCategorySortOrder('0');
    requestAnimationFrame(() => window.scrollTo({ top: modalScrollPosition.current, behavior: 'auto' }));
  };

  const saveCategory = async () => {
    const token = getManagementToken();
    const name = categoryName.trim();
    if (!token || !name || !categoryNicheId) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${CATEGORY_EDGE_URL}?action=save-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          id: editingCategory?.id,
          name,
          niche_id: categoryNicheId,
          sort_order: Number(categorySortOrder) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save category');
      closeCategoryForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save category');
    } finally {
      setSaving(false);
    }
  };

  const openNewSubcategory = (categoryId: string) => {
    modalScrollPosition.current = window.scrollY;
    setEditingSubcategory(null);
    setSubcategoryName('');
    setSubcategoryCategoryId(categoryId);
    setSubcategoryMarkupPercent('0');
    setSubcategoryFormOpen(true);
  };

  const openEditSubcategory = (subcategory: SubcategoryRow) => {
    modalScrollPosition.current = window.scrollY;
    setEditingSubcategory(subcategory);
    setSubcategoryName(subcategory.name);
    setSubcategoryCategoryId(subcategory.category_id);
    setSubcategoryMarkupPercent(String(subcategory.markup_percent ?? 0));
    setSubcategoryFormOpen(true);
  };

  const closeSubcategoryForm = () => {
    setSubcategoryFormOpen(false);
    setEditingSubcategory(null);
    setSubcategoryName('');
    setSubcategoryCategoryId('');
    setSubcategoryMarkupPercent('0');
    requestAnimationFrame(() => window.scrollTo({ top: modalScrollPosition.current, behavior: 'auto' }));
  };

  const saveSubcategory = async () => {
    const token = getManagementToken();
    const name = subcategoryName.trim();
    const category = categories.find(c => c.id === subcategoryCategoryId);
    const markupPercent = Number(subcategoryMarkupPercent);

    if (!token || !name || !category || !Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 100) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${CATEGORY_EDGE_URL}?action=save-subcategory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          id: editingSubcategory?.id,
          name,
          category_id: category.id,
          niche_id: category.niche_id,
          sort_order: editingSubcategory?.sort_order ?? category.subcategories.length,
          markup_percent: markupPercent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save subcategory');
      closeSubcategoryForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save subcategory');
    } finally {
      setSaving(false);
    }
  };

  const deleteSubcategory = async (subcategory: SubcategoryRow) => {
    const token = getManagementToken();
    if (!token) return;
    if (!window.confirm(`Delete "${subcategory.name}"?`)) return;

    setError('');
    try {
      const res = await fetch(`${CATEGORY_EDGE_URL}?action=delete-subcategory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, id: subcategory.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not delete subcategory');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete subcategory');
    }
  };

  const groupedNiches = Array.from(new Set(categories.map(category => category.niche_id)));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-gray-900 text-sm">Categories</h1>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{categories.length}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Manage main categories and their subcategories used by import products.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openNewCategory}
              disabled={loading || niches.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Add category
            </button>
            <button onClick={() => void load()} disabled={loading} className="p-2 rounded-lg border border-gray-100 text-gray-500 hover:text-gray-900 disabled:opacity-40" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3">{error}</div>}

      {categoryFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onMouseDown={e => { if (e.target === e.currentTarget) closeCategoryForm(); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900 text-sm">{categoryFormMode === 'edit' ? 'Edit Category' : 'Add Category'}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Create or update a main import category.</p>
              </div>
              <button onClick={closeCategoryForm} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Niche</label>
                <select value={categoryNicheId} onChange={e => setCategoryNicheId(e.target.value)} disabled={categoryFormMode === 'edit'} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white disabled:bg-gray-50">
                  <option value="">Select niche</option>
                  {niches.map(niche => <option key={niche.id} value={niche.id}>{niche.name} ({niche.id})</option>)}
                </select>
                {categoryFormMode === 'edit' && <p className="text-[10px] text-gray-400 mt-1">The niche is kept unchanged when editing a category.</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Category name</label>
                <input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g. Phones" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Sort order</label>
                <input type="number" min="0" step="1" value={categorySortOrder} onChange={e => setCategorySortOrder(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
              <button onClick={closeCategoryForm} disabled={saving} className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold disabled:opacity-40">Cancel</button>
              <button onClick={() => void saveCategory()} disabled={saving || !categoryName.trim() || !categoryNicheId} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold disabled:opacity-40">
                {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : categoryFormMode === 'edit' ? 'Save changes' : 'Save category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {subcategoryFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onMouseDown={e => { if (e.target === e.currentTarget) closeSubcategoryForm(); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900 text-sm">{editingSubcategory ? 'Edit Subcategory' : 'Add Subcategory'}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Set the subcategory name and markup percentage.</p>
              </div>
              <button onClick={closeSubcategoryForm} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Category</label>
                <select value={subcategoryCategoryId} onChange={e => setSubcategoryCategoryId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
                  <option value="">Select category</option>
                  {categories.map(category => <option key={category.niche_id + ':' + category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Subcategory name</label>
                <input value={subcategoryName} onChange={e => setSubcategoryName(e.target.value)} placeholder="e.g. Phones" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Markup percentage</label>
                <div className="relative">
                  <input type="number" min="0" max="100" step="0.01" value={subcategoryMarkupPercent} onChange={e => setSubcategoryMarkupPercent(e.target.value)} className="w-full px-3 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
              <button onClick={closeSubcategoryForm} disabled={saving} className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold">Cancel</button>
              <button onClick={() => void saveSubcategory()} disabled={saving || !subcategoryName.trim() || !subcategoryCategoryId || !Number.isFinite(Number(subcategoryMarkupPercent)) || Number(subcategoryMarkupPercent) < 0 || Number(subcategoryMarkupPercent) > 100} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold disabled:opacity-40">
                {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : editingSubcategory ? 'Save changes' : 'Save subcategory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex items-center justify-center py-14">
          <Loader className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 text-center py-14 text-sm text-gray-400">No categories found.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            <span>Categories</span>
            <span>Subcategories</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-gray-100">
            {categories.map(category => {
              const isOpen = expanded[category.id] ?? true;
              return (
                <div key={`${category.niche_id}:${category.id}`}>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-4 px-4 py-3 items-center hover:bg-gray-50">
                    <button onClick={() => setExpanded(prev => ({ ...prev, [category.id]: !isOpen }))} className="flex items-center gap-2 min-w-0 text-left">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                      <span className="text-sm font-semibold text-gray-800 truncate">{category.name}</span>
                    </button>
                    <span className="text-xs text-gray-400">{category.subcategories.length} subcategor{category.subcategories.length === 1 ? 'y' : 'ies'}</span>
                    <button onClick={() => openEditCategory(category)} className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50" title="Edit category"><Pencil className="w-3.5 h-3.5" /></button>
                  </div>
                  {isOpen && (
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-4 px-4 pb-3">
                      <div />
                      <div className="flex flex-wrap gap-1.5">
                        {category.subcategories.map(subcategory => (
                          <div key={subcategory.id} className="group flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100">
                            <span className="text-[11px] text-gray-600">{subcategory.name}</span>
                            <span className="text-[10px] font-semibold text-gray-400">{Number(subcategory.markup_percent ?? 0)}%</span>
                            <button onClick={() => openEditSubcategory(subcategory)} className="hidden group-hover:block text-gray-400" title="Edit"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => void deleteSubcategory(subcategory)} className="hidden group-hover:block text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <button onClick={() => openNewSubcategory(category.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-gray-200 text-[11px] text-gray-400 hover:text-gray-700"><Plus className="w-3 h-3" /> Add</button>
                      </div>
                      <div />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-[10px] text-gray-400 px-1">
        {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} loaded{groupedNiches.length ? ` across ${groupedNiches.length} niche${groupedNiches.length === 1 ? '' : 's'}.` : '.'}
      </div>
    </div>
  );
}
