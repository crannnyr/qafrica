// src/pages/import-admin/ImportAdminPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, LogOut, Package, Search, RefreshCw,
  Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp,
  Upload, Loader, DollarSign, TrendingUp, Clock,
  AlertCircle, ExternalLink, Copy,
} from 'lucide-react';
import { compressImage } from '@/lib/imageCompression';
import { supabase } from '@/services/supabase';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/china-import`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImportOrder {
  id: string;
  code: string;
  customer_name: string;
  customer_whatsapp: string;
  items: Array<{
    id: string;
    name: string;
    price_ngn: number;
    price_cny: number;
    quantity: number;
    image_url: string;
  }>;
  delivery_type: 'to_qafrica' | 'to_me';
  subtotal_ngn: number;
  jumia_fee_ngn: number;
  shipping_ngn: number | null;
  total_ngn: number;
  status: 'pending' | 'shipping_quoted' | 'order_placed' | 'shipped' | 'delivered';
  admin_note: string | null;
  created_at: string;
}

interface ImportProduct {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price_cny: number;
  price_ngn: number;
  category: string;
  is_active: boolean;
  sort_order: number;
}

interface Rates {
  cnyToNgn: number;
  usdToNgn: number;
  cnyToUsd: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `₦${Math.round(n).toLocaleString()}`;
}

function fmtCny(n: number) { return `¥${n.toFixed(2)}`; }
function fmtUsd(n: number) { return `$${n.toFixed(2)}`; }

function timeSince(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_LABELS: Record<string, string> = {
  pending:          'Pending',
  shipping_quoted:  'Quoted',
  order_placed:     'Ordered',
  shipped:          'Shipped',
  delivered:        'Delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending:         'bg-yellow-100 text-yellow-800',
  shipping_quoted: 'bg-blue-100 text-blue-800',
  order_placed:    'bg-purple-100 text-purple-800',
  shipped:         'bg-indigo-100 text-indigo-800',
  delivered:       'bg-green-100 text-green-800',
};

const STATUS_FLOW = ['pending', 'shipping_quoted', 'order_placed', 'shipped', 'delivered'];

// ── Auth guard ────────────────────────────────────────────────────────────────
function useImportAuth() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('import_manager_token');
  const managerRaw = sessionStorage.getItem('import_manager');
  const manager = managerRaw ? JSON.parse(managerRaw) : null;

  const logout = () => {
    sessionStorage.removeItem('import_manager_token');
    sessionStorage.removeItem('import_manager');
    navigate('/importations/admin/login');
  };

  useEffect(() => {
    if (!token || !manager) navigate('/import-admin/login');
  }, []);

  return { token, manager, logout };
}

// ── Load Code Panel ───────────────────────────────────────────────────────────
function LoadCodePanel({ token }: { token: string }) {
  const [code, setCode]         = useState('');
  const [order, setOrder]       = useState<ImportOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');
  const [shipping, setShipping] = useState('');
  const [note, setNote]         = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [rates, setRates]       = useState<Rates | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch(`${EDGE_URL}?action=rates`)
      .then(r => r.json())
      .then(d => setRates(d.rates))
      .catch(() => {});
  }, []);

  const loadCode = async () => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await fetch(`${EDGE_URL}?action=load-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase().trim(), manager_token: token }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Order not found'); return; }
      setOrder(data.order);
      setNote(data.order.admin_note ?? '');
      setShipping(data.order.shipping_ngn?.toString() ?? '');
    } catch {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrder = async (newStatus?: string) => {
    if (!order) return;
    setIsSaving(true);
    try {
      const body: any = { id: order.id, manager_token: token };
      if (newStatus) body.status = newStatus;
      else body.status = order.status;
      if (shipping) body.shipping_ngn = parseFloat(shipping);
      if (note !== undefined) body.admin_note = note;

      const res = await fetch(`${EDGE_URL}?action=update-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.order) setOrder(data.order);
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  const shippingNgn = parseFloat(shipping) || 0;
  const shippingCny = rates ? shippingNgn / rates.cnyToNgn : null;
  const shippingUsd = rates ? shippingNgn / rates.usdToNgn : null;

  const nextStatus = order ? STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1] : null;

  const waLink = order
    ? `https://wa.me/${order.customer_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hi ${order.customer_name}! Your QAFRICA import order *${order.code}* has been received. ${
          shippingNgn ? `Shipping cost: ₦${Math.round(shippingNgn).toLocaleString()}. ` : ''
        }We'll keep you updated!`
      )}`
    : '';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
            <Search className="w-4 h-4 text-orange-500" />
          </div>
          <h2 className="font-bold text-gray-900">Load Order Code</h2>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Code input */}
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && loadCode()}
              placeholder="e.g. AB3X7K"
              maxLength={6}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono font-bold tracking-widest uppercase focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
            />
            <button
              onClick={loadCode}
              disabled={isLoading || !code.trim()}
              className="px-5 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : 'Load'}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Order details */}
          {order && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 space-y-4"
            >
              {/* Customer */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-900">{order.customer_name}</p>
                    <p className="text-sm text-gray-500">{order.customer_whatsapp}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeSince(order.created_at)}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.delivery_type === 'to_qafrica'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {order.delivery_type === 'to_qafrica' ? '→ To QAFRICA (Jumia)' : '→ To Customer'}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <p className="font-semibold text-gray-900 text-sm">Items ordered</p>
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <img src={item.image_url} alt={item.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {fmtCny(item.price_cny)} · qty {item.quantity}
                      </p>
                    </div>
                    <p className="font-bold text-gray-900 text-sm flex-shrink-0">
                      ₦{(item.price_ngn * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-orange-50 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items subtotal</span>
                  <span className="font-medium">{fmt(order.subtotal_ngn)}</span>
                </div>
                {order.jumia_fee_ngn > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Jumia fee</span>
                    <span className="font-medium">{fmt(order.jumia_fee_ngn)}</span>
                  </div>
                )}
                {order.shipping_ngn && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">{fmt(order.shipping_ngn)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-orange-200">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-orange-600">{fmt(order.total_ngn)}</span>
                </div>
              </div>

              {/* Shipping cost input */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Set Shipping Cost (₦)
                </label>
                <input
                  type="number"
                  value={shipping}
                  onChange={e => setShipping(e.target.value)}
                  placeholder="Enter shipping cost in Naira"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none mb-2"
                />
                {/* Live currency conversion */}
                {shippingNgn > 0 && rates && (
                  <div className="flex gap-2">
                    <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-semibold">
                      {fmtCny(shippingCny!)} CNY
                    </span>
                    <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-lg font-semibold">
                      {fmtUsd(shippingUsd!)} USD
                    </span>
                    {rates && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg">
                        Rate: ¥1 = ₦{Math.round(rates.cnyToNgn)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Admin note */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Admin Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Internal notes about this order..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {/* Save shipping + note */}
                <button
                  onClick={() => updateOrder()}
                  disabled={isSaving}
                  className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Changes
                </button>

                {/* Advance status */}
                {nextStatus && (
                  <button
                    onClick={() => updateOrder(nextStatus)}
                    disabled={isSaving}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                    Mark as {STATUS_LABELS[nextStatus]}
                  </button>
                )}

                {/* WhatsApp customer */}
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Message Customer on WhatsApp
                </a>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

// ── All Orders List ───────────────────────────────────────────────────────────
function OrdersList({ token }: { token: string }) {
  const [orders, setOrders]       = useState<ImportOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=all-orders`, {
        headers: { 'x-manager-token': token },
      });
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter;
    const matchSearch = !search ||
      o.code.includes(search.toUpperCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_whatsapp.includes(search);
    return matchStatus && matchSearch;
  });

  const counts = STATUS_FLOW.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-purple-500" />
          </div>
          <h2 className="font-bold text-gray-900">All Orders</h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {orders.length}
          </span>
        </div>
        <button onClick={load} disabled={isLoading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-5 py-3 border-b border-gray-100 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, name or number..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none"
          />
        </div>
        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All ({orders.length})
          </button>
          {STATUS_FLOW.map(s => counts[s] > 0 && (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {STATUS_LABELS[s]} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-gray-100 rounded" />
                <div className="h-2 w-48 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No orders found</p>
          </div>
        ) : (
          filtered.map(order => (
            <div key={order.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-gray-900 font-mono tracking-wider text-sm">
                    {order.code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <span className="font-bold text-gray-900 text-sm flex-shrink-0">
                  {fmt(order.total_ngn)}
                </span>
              </div>
              <p className="text-sm text-gray-700 font-medium">{order.customer_name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">{order.customer_whatsapp}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">{timeSince(order.created_at)}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className={`text-[10px] font-medium ${
                  order.delivery_type === 'to_qafrica' ? 'text-orange-500' : 'text-blue-500'
                }`}>
                  {order.delivery_type === 'to_qafrica' ? 'Jumia' : 'To customer'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Product Management ────────────────────────────────────────────────────────
function ProductsManager({ token }: { token: string }) {
  const [products, setProducts]   = useState<ImportProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editProduct, setEditProduct] = useState<ImportProduct | null>(null);
  const [rates, setRates]         = useState<Rates | null>(null);

  // Form state
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [category, setCategory]   = useState('General');
  const [priceCny, setPriceCny]   = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSaving, setIsSaving]   = useState(false);

  // Derived NGN from CNY
  const priceNgn = rates && priceCny ? parseFloat(priceCny) * rates.cnyToNgn : 0;

  useEffect(() => {
    loadProducts();
    fetch(`${EDGE_URL}?action=rates`)
      .then(r => r.json())
      .then(d => setRates(d.rates))
      .catch(() => {});
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=products`);
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const openAdd = () => {
    setEditProduct(null);
    setName(''); setDesc(''); setCategory('General');
    setPriceCny(''); setImageFile(null); setImagePreview('');
    setShowForm(true);
  };

  const openEdit = (p: ImportProduct) => {
    setEditProduct(p);
    setName(p.name); setDesc(p.description); setCategory(p.category);
    setPriceCny(p.price_cny.toString());
    setImagePreview(p.image_url); setImageFile(null);
    setShowForm(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, { maxWidth: 600, maxHeight: 600, targetSizeKb: 80 });
    setImageFile(compressed);
    setImagePreview(URL.createObjectURL(compressed));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext  = file.name.split('.').pop() ?? 'webp';
    const path = `import-products/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!name || !priceCny || (!imagePreview && !imageFile)) return;
    setIsSaving(true);
    try {
      let imageUrl = editProduct?.image_url ?? '';
      if (imageFile) imageUrl = await uploadImage(imageFile);

      const payload = {
        name,
        description,
        category,
        price_cny: parseFloat(priceCny),
        price_ngn: Math.round(priceNgn),
        image_url: imageUrl,
        manager_token: token,
      };

      const action = editProduct ? 'update-product' : 'add-product';
      const body   = editProduct ? { ...payload, id: editProduct.id } : payload;

      const res = await fetch(`${EDGE_URL}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        loadProducts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await fetch(`${EDGE_URL}?action=delete-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, manager_token: token }),
    });
    loadProducts();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-green-600" />
          </div>
          <h2 className="font-bold text-gray-900">Products</h2>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Product
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100"
          >
            <div className="px-5 py-5 space-y-4 bg-gray-50">
              <h3 className="font-bold text-gray-900 text-sm">
                {editProduct ? 'Edit Product' : 'Add New Product'}
              </h3>

              {/* Image upload */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Product Image</label>
                <label className="cursor-pointer block">
                  <div className={`w-full h-36 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                    imagePreview ? 'border-orange-300' : 'border-gray-200 hover:border-orange-300'
                  }`}>
                    {imagePreview ? (
                      <img src={imagePreview} className="w-full h-full object-cover" alt="preview" />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-400">Tap to upload image</p>
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Product Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Wireless Earbuds Pro"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Description</label>
                <textarea value={description} onChange={e => setDesc(e.target.value)}
                  rows={2} placeholder="Brief product description..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none resize-none" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Category</label>
                <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Electronics, Fashion, Home"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Price (CNY ¥)</label>
                <input type="number" value={priceCny} onChange={e => setPriceCny(e.target.value)}
                  placeholder="e.g. 45.00"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                {/* Live conversion */}
                {priceNgn > 0 && rates && (
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-lg font-semibold">
                      ₦{Math.round(priceNgn).toLocaleString()} NGN
                    </span>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-semibold">
                      ${(parseFloat(priceCny) * rates.cnyToUsd).toFixed(2)} USD
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={isSaving || !name || !priceCny}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editProduct ? 'Save Changes' : 'Add Product'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-3 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products list */}
      <div className="divide-y divide-gray-50">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 bg-gray-100 rounded" />
                <div className="h-2 w-24 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : products.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No products yet. Add your first one.</p>
          </div>
        ) : (
          products.map(p => (
            <div key={p.id} className="px-5 py-4 flex items-center gap-3">
              <img src={p.image_url} alt={p.name}
                className="w-12 h-12 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{fmtCny(p.price_cny)}</span>
                  <span className="text-xs text-orange-500 font-semibold">
                    ₦{Math.round(p.price_ngn).toLocaleString()}
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {p.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(p)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(p.id)}
                  className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function ImportAdminPage() {
  const { token, manager, logout } = useImportAuth();
  const [tab, setTab] = useState<'orders' | 'products'>('orders');

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">Import Admin</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">{manager?.full_name}</p>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-100 p-1">
          <button
            onClick={() => setTab('orders')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'orders'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => setTab('products')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'products'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Products
          </button>
        </div>

        {tab === 'orders' ? (
          <>
            <LoadCodePanel token={token} />
            <OrdersList token={token} />
          </>
        ) : (
          <ProductsManager token={token} />
        )}
      </div>
    </div>
  );
}
