import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Search, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Loader, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';

const EDGE_URL = CONFIG.SUPABASE_URL + '/functions/v1/import-management';
const PAGE_SIZE = 50;

type InventoryRow = {
  id: string;
  name: string;
  image_url?: string | null;
  category?: string | null;
  parent_category?: string | null;
  is_active?: boolean;
  has_variants?: boolean;
  variant_options?: Record<string, string> | null;
  variant_label?: string;
  stock_quantity: number;
  stock_updated_at?: string | null;
};

type ProductGroup = {
  id: string;
  name: string;
  image_url?: string | null;
  category?: string | null;
  parent_category?: string | null;
  is_active?: boolean;
  variants: InventoryRow[];
};

type Pagination = { page: number; per_page: number; total: number; page_count: number };

const variantKey = (row: InventoryRow) => row.id + '|' + JSON.stringify(row.variant_options ?? {});

export default function ImportAdminV2Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: PAGE_SIZE, total: 0, page_count: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const products = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    rows.forEach(row => {
      const existing = map.get(row.id);
      if (existing) {
        existing.variants.push(row);
      } else {
        map.set(row.id, {
          id: row.id,
          name: row.name,
          image_url: row.image_url,
          category: row.category,
          parent_category: row.parent_category,
          is_active: row.is_active,
          variants: [row],
        });
      }
    });
    return Array.from(map.values());
  }, [rows]);

  const load = useCallback(async (page = 1, signal?: AbortSignal) => {
    const token = getManagementToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, page, per_page: PAGE_SIZE, search: search.trim() }),
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load inventory');
      const next = Array.isArray(data.products) ? data.products : [];
      setRows(next);
      setDrafts(Object.fromEntries(next.map((row: InventoryRow) => [variantKey(row), ''])));
      setPagination(data.pagination ?? { page, per_page: PAGE_SIZE, total: 0, page_count: 1 });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Could not load inventory');
      setRows([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(1, controller.signal), search.trim() ? 350 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const saveStock = async (row: InventoryRow) => {
    const token = getManagementToken();
    if (!token) {
      toast.error('Management session expired');
      return;
    }
    const quantityToAdd = Number(drafts[variantKey(row)] || 0);
    if (!Number.isInteger(quantityToAdd) || quantityToAdd <= 0) {
      toast.error('Enter a whole number greater than 0 to add');
      return;
    }

    const key = variantKey(row);
    setSaving(key);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          product_id: row.id,
          variant_options: row.variant_options ?? {},
          quantity_to_add: quantityToAdd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not add stock');
      const nextQuantity = Number(data.inventory?.quantity ?? row.stock_quantity + quantityToAdd);
      setRows(current => current.map(item => variantKey(item) === key
        ? { ...item, stock_quantity: nextQuantity, stock_updated_at: data.inventory?.updated_at ?? new Date().toISOString() }
        : item));
      setDrafts(current => ({ ...current, [key]: '' }));
      toast.success('Added ' + quantityToAdd.toLocaleString() + ' unit' + (quantityToAdd === 1 ? '' : 's') + '. New stock: ' + nextQuantity.toLocaleString());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add stock');
    } finally {
      setSaving(null);
    }
  };

  const totalStock = rows.reduce((sum, row) => sum + Number(row.stock_quantity || 0), 0);
  const lowStock = rows.filter(row => row.stock_quantity > 0 && row.stock_quantity <= 5).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-orange-500" />
              <h1 className="font-bold text-gray-900 text-sm">Inventory</h1>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{pagination.total.toLocaleString()} products</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Tap a product to view and add stock to each variant combination.</p>
          </div>
          <button onClick={() => void load(pagination.page)} disabled={loading} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh inventory">
            <RefreshCw className={loading ? 'w-4 h-4 text-gray-400 animate-spin' : 'w-4 h-4 text-gray-400'} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inventory products…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500" />
          </div>
          <span className="px-3 py-2.5 rounded-xl bg-gray-50 text-[11px] font-semibold text-gray-500">Visible stock: {totalStock.toLocaleString()}</span>
          {lowStock > 0 && <span className="px-3 py-2.5 rounded-xl bg-amber-50 text-[11px] font-semibold text-amber-700">{lowStock} low-stock</span>}
        </div>

        {error && <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-bold">Product</th>
                <th className="px-4 py-3 font-bold">Category</th>
                <th className="px-4 py-3 font-bold">Total stock</th>
                <th className="px-4 py-3 font-bold">Variants</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center"><Loader className="w-5 h-5 text-orange-500 animate-spin mx-auto" /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">No inventory products found.</td></tr>
              ) : products.map(product => {
                const isOpen = !!expanded[product.id];
                const productStock = product.variants.reduce((sum, row) => sum + Number(row.stock_quantity || 0), 0);
                const hasRealVariants = product.variants.some(row => row.variant_options && Object.keys(row.variant_options).length > 0);
                const optionNames = Array.from(new Set(product.variants.flatMap(row => Object.keys(row.variant_options ?? {}))));
                return (
                  <tr key={product.id} className="align-top">
                    <td colSpan={5} className="p-0">
                      <button
                        type="button"
                        onClick={() => setExpanded(current => ({ ...current, [product.id]: !isOpen }))}
                        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-gray-50"
                      >
                        <ChevronDown className={isOpen ? 'w-4 h-4 text-orange-500 transition-transform' : 'w-4 h-4 text-gray-400 -rotate-90 transition-transform'} />
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{hasRealVariants ? product.variants.length.toLocaleString() + ' variant combinations' : 'No variants'}</p>
                        </div>
                        <div className="hidden sm:block w-28 text-xs text-gray-600">{product.parent_category || product.category || '—'}</div>
                        <span className={productStock > 0 ? 'inline-flex min-w-[58px] justify-center px-2.5 py-1.5 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700' : 'inline-flex min-w-[58px] justify-center px-2.5 py-1.5 rounded-lg text-xs font-black bg-gray-100 text-gray-500'}>{productStock.toLocaleString()}</span>
                        <span className="inline-flex min-w-[110px] justify-center px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-[10px] font-bold">
                          {isOpen ? 'Hide variants' : hasRealVariants ? 'View variants' : 'View stock'}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="bg-gray-50/70 border-t border-gray-100 px-5 py-3">
                          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-gray-800">{hasRealVariants ? 'Variant inventory' : 'Base inventory'}</p>
                                <p className="text-[10px] text-gray-400">Adding stock increases the current quantity; it never replaces it.</p>
                              </div>
                              <span className="text-[10px] font-semibold text-gray-500">{productStock.toLocaleString()} total units</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[560px] text-left">
                                <thead className="bg-gray-50">
                                  <tr className="text-[9px] uppercase tracking-wide text-gray-400">
                                    {optionNames.map(name => <th key={name} className="px-4 py-2.5 font-bold">{name}</th>)}
                                    {!optionNames.length && <th className="px-4 py-2.5 font-bold">Stock type</th>}
                                    <th className="px-4 py-2.5 font-bold">Stock</th>
                                    <th className="px-4 py-2.5 font-bold">Add stock</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {product.variants.map(row => {
                                    const key = variantKey(row);
                                    const options = row.variant_options ?? {};
                                    return (
                                      <tr key={key}>
                                        {optionNames.map(name => <td key={name} className="px-4 py-3 text-xs font-semibold text-gray-700">{options[name] || '—'}</td>)}
                                        {!optionNames.length && <td className="px-4 py-3 text-xs font-semibold text-gray-700">Base / no variant</td>}
                                        <td className="px-4 py-3">
                                          <span className={row.stock_quantity > 0 ? 'inline-flex min-w-[48px] justify-center px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-black' : 'inline-flex min-w-[48px] justify-center px-2 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-black'}>
                                            {row.stock_quantity.toLocaleString()}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-2">
                                            <div className="relative">
                                              <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                              <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                placeholder="0"
                                                value={drafts[key] ?? ''}
                                                onChange={e => setDrafts(current => ({ ...current, [key]: e.target.value }))}
                                                className="w-24 pl-7 pr-2 py-2 rounded-lg border border-gray-200 text-sm font-semibold outline-none focus:border-orange-500"
                                              />
                                            </div>
                                            <button
                                              onClick={() => void saveStock(row)}
                                              disabled={saving === key}
                                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-bold disabled:opacity-40"
                                            >
                                              <Save className="w-3.5 h-3.5" />
                                              {saving === key ? 'Adding…' : 'Add'}
                                            </button>
                                          </div>
                                          <p className="text-[9px] text-gray-400 mt-1">{row.stock_updated_at ? 'Updated ' + new Date(row.stock_updated_at).toLocaleString('en-NG') : 'No stock registered yet'}</p>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">{pagination.total === 0 ? '0 products' : 'Showing ' + (((pagination.page - 1) * PAGE_SIZE) + 1) + '–' + Math.min(pagination.page * PAGE_SIZE, pagination.total) + ' of ' + pagination.total.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => void load(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-semibold text-gray-600 min-w-[80px] text-center">Page {pagination.page} of {pagination.page_count}</span>
            <button onClick={() => void load(pagination.page + 1)} disabled={loading || pagination.page >= pagination.page_count} className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
