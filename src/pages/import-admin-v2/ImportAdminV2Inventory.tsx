import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Search, RefreshCw, ChevronLeft, ChevronRight, Loader, Save, Plus, Pencil } from 'lucide-react';
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
  variant_options?: Record<string, string> | null;
  variant_label?: string;
  stock_quantity: number;
  stock_updated_at?: string | null;
};

type Pagination = { page: number; per_page: number; total: number; page_count: number };

const variantKey = (row: InventoryRow) => row.id + '|' + JSON.stringify(row.variant_options ?? {});
const variantLabel = (row: InventoryRow) => row.variant_label || (
  row.variant_options && Object.keys(row.variant_options).length
    ? Object.entries(row.variant_options).map(([key, value]) => key + ': ' + value).join(', ')
    : 'Base / no variant'
);

export default function ImportAdminV2Inventory() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: PAGE_SIZE, total: 0, page_count: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

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
      setDrafts(Object.fromEntries(next.map((row: InventoryRow) => [variantKey(row), String(row.stock_quantity ?? 0)])));
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
    const quantity = Number(drafts[variantKey(row)]);
    if (!Number.isInteger(quantity) || quantity < 0) {
      toast.error('Stock must be a non-negative whole number');
      return;
    }

    setSaving(row.id);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, product_id: row.id, variant_options: row.variant_options ?? {}, quantity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update stock');
      const nextQuantity = Number(data.inventory?.quantity ?? quantity);
      setRows(current => current.map(item => variantKey(item) === variantKey(row)
        ? { ...item, stock_quantity: nextQuantity, stock_updated_at: data.inventory?.updated_at ?? new Date().toISOString() }
        : item));
      setDrafts(current => ({ ...current, [variantKey(row)]: String(nextQuantity) }));
      toast.success(row.name + ' stock updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update stock');
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
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{pagination.total.toLocaleString()} products · {rows.length.toLocaleString()} variants shown</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Register physical stock at QAfrica HQ by product variant. Fulfillment consumes the exact ordered variant when an item is received.</p>
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
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-bold">Product</th>
                <th className="px-4 py-3 font-bold">Category</th>
                <th className="px-4 py-3 font-bold">In stock</th>
                <th className="px-4 py-3 font-bold">Register / adjust</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Variants</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center"><Loader className="w-5 h-5 text-orange-500 animate-spin mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">No inventory products found.</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">{row.image_url ? <img src={row.image_url} alt="" className="w-full h-full object-cover" /> : null}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate max-w-[330px]">{row.name}</p>
                        <p className="text-[11px] font-semibold text-orange-600 mt-0.5">{variantLabel(row)}</p>
                        <p className="text-[10px] text-gray-400">{row.stock_updated_at ? 'Updated ' + new Date(row.stock_updated_at).toLocaleString('en-NG') : 'Stock not registered yet'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{row.parent_category || row.category || '—'}</td>
                  <td className="px-4 py-3"><span className={row.stock_quantity > 0 ? 'inline-flex min-w-[52px] justify-center px-2.5 py-1.5 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700' : 'inline-flex min-w-[52px] justify-center px-2.5 py-1.5 rounded-lg text-xs font-black bg-gray-100 text-gray-500'}>{row.stock_quantity.toLocaleString()}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" step="1" value={drafts[variantKey(row)] ?? String(row.stock_quantity)} onChange={e => setDrafts(current => ({ ...current, [variantKey(row)]: e.target.value }))} className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold outline-none focus:border-orange-500" />
                      <button onClick={() => void saveStock(row)} disabled={saving === row.id} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-[11px] font-bold disabled:opacity-40"><Save className="w-3.5 h-3.5" />{saving === row.id ? 'Saving…' : 'Save'}</button>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={row.is_active ? 'inline-flex px-2 py-1 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600' : 'inline-flex px-2 py-1 rounded-full text-[9px] font-bold bg-gray-100 text-gray-500'}>{row.is_active ? 'Active product' : 'Inactive product'}</span></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate('/import-admin-v2/products/edit/' + row.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-[11px] font-bold hover:border-orange-300 hover:text-orange-600 whitespace-nowrap"
                      title={variantLabel(row) === 'Base / no variant' ? 'Add variant to this product' : 'Edit this product\'s variants'}
                    >
                      {variantLabel(row) === 'Base / no variant' ? <Plus className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      {variantLabel(row) === 'Base / no variant' ? 'Add variant' : 'Edit variants'}
                    </button>
                  </td>
                </tr>
              ))}
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
