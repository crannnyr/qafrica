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
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<'category' | 'subcategory'>('subcategory');
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryNicheId, setCategoryNicheId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const load = useCallback(async (restoreScroll = false) => {
    const scrollY = window.scrollY;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${CATEGORY_EDGE_URL}?action=list`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load categories');
      setCategories(data.categories ?? []);
      if (restoreScroll) requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNewCategory = (category: CategoryRow) => {
    setFormType('category'); setEditingCategory(null); setCategoryName(''); setCategoryId(''); setCategoryNicheId(category.niche_id); setFormOpen(true);
  };
  const openEditCategory = (category: CategoryRow) => {
    setFormType('category'); setEditingCategory(category); setCategoryName(category.name); setCategoryId(category.id); setCategoryNicheId(category.niche_id); setFormOpen(true);
  };
  const openNewSubcategory = (categoryId: string) => {
    setFormType('subcategory');
    setEditingSubcategory(null); setSubcategoryName(''); setSubcategoryCategoryId(categoryId); setFormOpen(true);
  };
  const openEditSubcategory = (subcategory: SubcategoryRow) => {
    setFormType('subcategory'); setEditingSubcategory(subcategory); setSubcategoryName(subcategory.name); setSubcategoryCategoryId(subcategory.category_id); setFormOpen(true);
  };
  const closeSubcategoryForm = () => {
    setEditingSubcategory(null); setSubcategoryName(''); setSubcategoryCategoryId(''); setEditingCategory(null); setCategoryName(''); setCategoryId(''); setCategoryNicheId(''); setFormOpen(false);
  };
  const saveCategory = async () => {
    const name = categoryName.trim(); if (!name || !categoryNicheId) return; setSaving(true); setError('');
    try {
      const res = await fetch(CATEGORY_EDGE_URL + '?action=save-category', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, id: editingCategory?.id || categoryId || undefined, name, niche_id: categoryNicheId, sort_order: editingCategory?.sort_order ?? categories.filter(c => c.niche_id === categoryNicheId).length }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'Could not save category');
      closeSubcategoryForm(); await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save category'); } finally { setSaving(false); }
  };
  const deleteCategory = async (category: CategoryRow) => {
    if (category.subcategories.length) { setError('Delete the subcategories first before deleting this category.'); return; }
    if (!window.confirm('Delete "' + category.name + '"?')) return; setError('');
    try {
      const res = await fetch(CATEGORY_EDGE_URL + '?action=delete-category', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manager_token: token, id: category.id, niche_id: category.niche_id }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'Could not delete category'); await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete category'); }
  };
  const saveSubcategory = async () => {
    const name = subcategoryName.trim(); const category = categories.find(c => c.id === subcategoryCategoryId);
    if (!name || !category) return; setSaving(true); setError('');
    try {
      const res = await fetch(CATEGORY_EDGE_URL + '?action=save-subcategory', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, id: editingSubcategory?.id, name, category_id: category.id, niche_id: category.niche_id, sort_order: editingSubcategory?.sort_order ?? category.subcategories.length }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'Could not save subcategory');
      closeSubcategoryForm(); await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save subcategory'); } finally { setSaving(false); }
  };
  const deleteSubcategory = async (subcategory: SubcategoryRow) => {
    if (!window.confirm('Delete "' + subcategory.name + '"?')) return; setError('');
    try {
      const res = await fetch(CATEGORY_EDGE_URL + '?action=delete-subcategory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manager_token: token, id: subcategory.id }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? 'Could not delete subcategory'); await load(true);
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
                      <span className="text-sm font-semibold text-gray-800 truncate">{category.name}</span>\n                      <div className="flex items-center gap-1 ml-auto">\n                        <button onClick={e => { e.stopPropagation(); openEditCategory(category); }} className="p-1 text-gray-400 hover:text-gray-800" title="Edit category"><Pencil className="w-3 h-3" /></button>\n                        <button onClick={e => { e.stopPropagation(); deleteCategory(category); }} className="p-1 text-gray-400 hover:text-red-600" title="Delete category"><Trash2 className="w-3 h-3" /></button>\n                        <button onClick={e => { e.stopPropagation(); openNewCategory(category); }} className="p-1 text-gray-400 hover:text-gray-800" title="Add category"><Plus className="w-3 h-3" /></button>\n                      </div>
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

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) closeSubcategoryForm(); }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div><p className="font-bold text-gray-900 text-sm">{formType === 'category' ? (editingCategory ? 'Edit Category' : 'Add Category') : (editingSubcategory ? 'Edit Subcategory' : 'Add Subcategory')}</p><p className="text-[11px] text-gray-400 mt-0.5">{formType === 'category' ? 'The category stays in its existing category group.' : 'Changes apply to the selected category.'}</p></div>
              <button onClick={closeSubcategoryForm} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {formType === 'category' ? (
                <>
                <input autoFocus value={categoryName} onChange={e => setCategoryName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !saving && categoryName.trim()) saveCategory(); if (e.key === 'Escape') closeSubcategoryForm(); }} placeholder="Category name" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
                <p className="text-[10px] text-gray-400">New categories are added to the same category group as the category you clicked.</p>
                </>
              ) : <>
              <select value={subcategoryCategoryId} onChange={e => setSubcategoryCategoryId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-gray-400"><option value="">Select category</option>{categories.map(category => <option key={category.niche_id + ':' + category.id} value={category.id}>{category.name}</option>)}</select>
              <input autoFocus value={subcategoryName} onChange={e => setSubcategoryName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !saving && subcategoryName.trim() && subcategoryCategoryId) saveSubcategory(); if (e.key === 'Escape') closeSubcategoryForm(); }} placeholder="Subcategory name" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400" />
              </>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeSubcategoryForm} className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={formType === 'category' ? saveCategory : saveSubcategory} disabled={saving || (formType === 'category' ? !categoryName.trim() : !subcategoryName.trim() || !subcategoryCategoryId)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold disabled:opacity-40">{saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{saving ? 'Saving…' : formType === 'category' ? 'Save category' : 'Save subcategory'}</button>
            </div>
          </div>
        </div>
      )}
      <div className="text-[10px] text-gray-400 px-1">
        {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} loaded.
      </div>
    </div>
  );
}
