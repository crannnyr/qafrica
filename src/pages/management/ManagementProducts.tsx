import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Package, Loader,
  Plus, Pencil, Eye, Trash2,
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

  const navigate = useNavigate();

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
            <button onClick={() => navigate('/management/products/add')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold">
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
                    <button onClick={() => navigate(`/recommendations/${product.id}`)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="View product"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => navigate(`/management/products/edit/${product.id}`)} className="p-2 rounded-lg hover:bg-orange-50 text-orange-500" title="Edit product"><Pencil className="w-3.5 h-3.5" /></button>
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

    </div>
  );
}
