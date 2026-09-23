import { useCallback, useEffect, useState } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Package, Loader,
  Plus, Pencil, Eye, Trash2, Power, X,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-management`;
const PAGE_SIZE = 50;

type Product = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  price_ngn?: number | null;
  price_cny?: number | null;
  price_usd?: number | null;
  category?: string | null;
  parent_category?: string | null;
  is_active?: boolean;
  units_sold?: number | null;
  moq?: number | null;
  ship_only?: boolean | null;
  delivery_time?: string | null;
  source_url?: string | null;
  sort_order?: number | null;
  created_at: string;
  updated_at?: string;
};

type ProductForm = {
  name: string;
  description: string;
  image_url: string;
  price_cny: string;
  price_ngn: string;
  category: string;
  parent_category: string;
  moq: string;
  delivery_time: string;
  source_url: string;
  ship_only: boolean;
  is_active: boolean;
  sort_order: string;
};

type Pagination = { page: number; per_page: number; total: number; page_count: number };

const EMPTY_FORM: ProductForm = {
  name: '', description: '', image_url: '', price_cny: '', price_ngn: '',
  category: 'General', parent_category: '', moq: '1', delivery_time: 'air',
  source_url: '', ship_only: false, is_active: true, sort_order: '0',
};

export default function ManagementProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: PAGE_SIZE, total: 0, page_count: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'view' | 'edit' | 'add' | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const request = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const token = getManagementToken();
    if (!token) throw new Error('Management session expired');
    const res = await fetch(`${EDGE_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_token: token, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Request failed');
    return data;
  }, []);

  const load = useCallback(async (page = 1, signal?: AbortSignal) => {
    const token = getManagementToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token, page, per_page: PAGE_SIZE,
          search: search.trim(), status,
        }),
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load products');
      setProducts(data.products ?? []);
      setPagination(data.pagination ?? { page, per_page: PAGE_SIZE, total: 0, page_count: 1 });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Could not load products');
      setProducts([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(1, controller.signal), search.trim() ? 350 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const money = (value?: number | null) =>
    value == null ? '—' : `₦${Number(value).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

  const openAdd = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setModal('add');
    setError('');
  };

  const openEdit = (product: Product) => {
    setSelected(product);
    setForm({
      name: product.name ?? '',
      description: product.description ?? '',
      image_url: product.image_url ?? '',
      price_cny: product.price_cny == null ? '' : String(product.price_cny),
      price_ngn: product.price_ngn == null ? '' : String(product.price_ngn),
      category: product.category ?? 'General',
      parent_category: product.parent_category ?? '',
      moq: String(product.moq ?? 1),
      delivery_time: product.delivery_time ?? 'air',
      source_url: product.source_url ?? '',
      ship_only: Boolean(product.ship_only),
      is_active: product.is_active !== false,
      sort_order: String(product.sort_order ?? 0),
    });
    setModal('edit');
    setError('');
  };

  const openView = async (product: Product) => {
    try {
      setError('');
      const data = await request('admin-product', { id: product.id });
      setSelected(data.product);
      setModal('view');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load product');
    }
  };

  const save = async () => {
    if (!form.name.trim()) return setError('Product name is required.');
    if (!form.image_url.trim()) return setError('Product image URL is required.');
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...(modal === 'edit' ? { id: selected?.id } : {}),
        name: form.name.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim(),
        price_cny: Number(form.price_cny) || 0,
        price_ngn: Number(form.price_ngn) || 0,
        category: form.category.trim() || 'General',
        parent_category: form.parent_category.trim() || null,
        moq: Math.max(1, Number(form.moq) || 1),
        delivery_time: form.delivery_time.trim() || null,
        source_url: form.source_url.trim() || null,
        ship_only: form.ship_only,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      await request(modal === 'add' ? 'admin-product-create' : 'admin-product-update', payload);
      setModal(null);
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: Product) => {
    try {
      setError('');
      await request('admin-product-toggle', { id: product.id, is_active: !product.is_active });
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update product');
    }
  };

  const deleteProduct = async (product: Product) => {
    const confirmed = window.confirm(`Delete "${product.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      setError('');
      await request('admin-product-delete', { id: product.id });
      const nextPage = pagination.page > 1 && products.length === 1 ? pagination.page - 1 : pagination.page;
      await load(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete product');
    }
  };

  const field = (label: string, key: keyof ProductForm, type = 'text') => (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</span>
      <input
        type={type}
        value={String(form[key])}
        onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <h1 className="font-bold text-gray-900 text-sm">Products</h1>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{pagination.total.toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">50 products per page</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Add product
            </button>
            <button onClick={() => void load(pagination.page)} disabled={loading} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh products">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none">
            <option value="all">All products</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {error && <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-bold">Product</th><th className="px-4 py-3 font-bold">Category</th>
                <th className="px-4 py-3 font-bold">Price</th><th className="px-4 py-3 font-bold">MOQ</th>
                <th className="px-4 py-3 font-bold">Sold</th><th className="px-4 py-3 font-bold">Shipping</th>
                <th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center"><Loader className="w-5 h-5 text-orange-500 animate-spin mx-auto" /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-400">No products found.</td></tr>
              ) : products.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3"><div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">{product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : null}</div>
                    <div className="min-w-0"><p className="text-sm font-semibold text-gray-900 truncate max-w-[300px]">{product.name}</p><p className="text-[10px] text-gray-400">{new Date(product.created_at).toLocaleDateString('en-NG')}</p></div>
                  </div></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{product.parent_category || product.category || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-800">{money(product.price_ngn)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{product.moq ?? 1}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{Number(product.units_sold ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{product.ship_only ? 'Sea only' : 'Air / Sea'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-[9px] font-bold ${product.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>{product.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1">
                    <button onClick={() => void openView(product)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="View"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openEdit(product)} className="p-2 rounded-lg hover:bg-orange-50 text-orange-500" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => void toggleActive(product)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title={product.is_active ? 'Deactivate' : 'Activate'}><Power className="w-3.5 h-3.5" /></button>
                    <button onClick={() => void deleteProduct(product)} className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">{pagination.total === 0 ? '0 products' : `Showing ${((pagination.page - 1) * PAGE_SIZE) + 1}–${Math.min(pagination.page * PAGE_SIZE, pagination.total)} of ${pagination.total.toLocaleString()}`}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => void load(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-semibold text-gray-600 min-w-[80px] text-center">Page {pagination.page} of {pagination.page_count}</span>
            <button onClick={() => void load(pagination.page + 1)} disabled={loading || pagination.page >= pagination.page_count} className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <div><h2 className="font-bold text-gray-900">{modal === 'add' ? 'Add product' : modal === 'edit' ? 'Edit product' : 'Product details'}</h2><p className="text-[11px] text-gray-400 mt-0.5">{modal === 'view' ? 'Read-only product information' : 'Update the product information used by the import catalogue.'}</p></div>
              <button onClick={() => setModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            {modal === 'view' && selected ? (
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 flex gap-4"><div className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden">{selected.image_url && <img src={selected.image_url} alt="" className="w-full h-full object-cover" />}</div><div><h3 className="font-bold text-gray-900">{selected.name}</h3><p className="text-xs text-gray-500 mt-1">{selected.description || 'No description'}</p></div></div>
                <div><span className="text-[10px] text-gray-400">NGN price</span><p className="text-sm font-semibold">{money(selected.price_ngn)}</p></div>
                <div><span className="text-[10px] text-gray-400">CNY price</span><p className="text-sm font-semibold">{selected.price_cny ?? '—'}</p></div>
                <div><span className="text-[10px] text-gray-400">Category</span><p className="text-sm">{selected.parent_category || selected.category || '—'}</p></div>
                <div><span className="text-[10px] text-gray-400">MOQ</span><p className="text-sm">{selected.moq ?? 1}</p></div>
                <div><span className="text-[10px] text-gray-400">Shipping</span><p className="text-sm">{selected.ship_only ? 'Sea only' : 'Air / Sea'}</p></div>
                <div><span className="text-[10px] text-gray-400">Delivery time</span><p className="text-sm">{selected.delivery_time || '—'}</p></div>
                <div><span className="text-[10px] text-gray-400">Units sold</span><p className="text-sm">{Number(selected.units_sold ?? 0).toLocaleString()}</p></div>
                <div><span className="text-[10px] text-gray-400">Status</span><p className="text-sm">{selected.is_active ? 'Active' : 'Inactive'}</p></div>
                {selected.source_url && <div className="sm:col-span-2"><span className="text-[10px] text-gray-400">Source URL</span><p className="text-sm break-all">{selected.source_url}</p></div>}
                <div className="sm:col-span-2 flex justify-end gap-2"><button onClick={() => openEdit(selected)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold"><Pencil className="w-3.5 h-3.5" /> Edit</button></div>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('Product name', 'name')}
                {field('Image URL', 'image_url')}
                {field('Price (NGN)', 'price_ngn', 'number')}
                {field('Price (CNY)', 'price_cny', 'number')}
                {field('Category', 'category')}
                {field('Parent category', 'parent_category')}
                {field('MOQ', 'moq', 'number')}
                {field('Delivery time', 'delivery_time')}
                {field('Source URL', 'source_url')}
                {field('Sort order', 'sort_order', 'number')}
                <label className="sm:col-span-2 block"><span className="block text-[11px] font-semibold text-gray-500 mb-1">Description</span><textarea value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} rows={4} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500 resize-y" /></label>
                <div className="sm:col-span-2 flex flex-wrap gap-5">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600"><input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} /> Active</label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600"><input type="checkbox" checked={form.ship_only} onChange={e => setForm(v => ({ ...v, ship_only: e.target.checked }))} /> Sea shipping only</label>
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <button onClick={() => setModal(null)} disabled={saving} className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600">Cancel</button>
                  <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold disabled:opacity-60">{saving && <Loader className="w-3.5 h-3.5 animate-spin" />}{modal === 'add' ? 'Create product' : 'Save changes'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
