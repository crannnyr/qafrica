// src/pages/import-admin/ImportAdminPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, LogOut, Package, Search, RefreshCw,
  Plus, Trash2, Edit2, Check, ChevronDown, ChevronUp,
  Upload, Loader, TrendingUp, AlertCircle, ExternalLink, X,
  Info,
} from 'lucide-react';
import { compressImage } from '@/lib/imageCompression';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const PLATFORM_MARKUP = 0.01; // 1%

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
  image_urls: string[];
  price_cny: number;
  price_cny_original: number;
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
  pending: 'Pending',
  shipping_quoted: 'Quoted',
  order_placed: 'Ordered',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  shipping_quoted: 'bg-sky-50 text-sky-700',
  order_placed: 'bg-violet-50 text-violet-700',
  shipped: 'bg-indigo-50 text-indigo-700',
  delivered: 'bg-emerald-50 text-emerald-700',
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

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="h-px bg-gray-100 my-1" />;
}

// ── Field label ───────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
      {children}
    </p>
  );
}

// ── Load Code Panel ───────────────────────────────────────────────────────────
function LoadCodePanel({ token }: { token: string }) {
  const [code, setCode]           = useState('');
  const [order, setOrder]         = useState<ImportOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');
  const [shipping, setShipping]   = useState('');
  const [note, setNote]           = useState('');
  const [isSaving, setIsSaving]   = useState(false);
  const [rates, setRates]         = useState<Rates | null>(null);
  const [expanded, setExpanded]   = useState(true);

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
      body.status = newStatus ?? order.status;
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
        <div className="flex items-center gap-2.5">
          <Search className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">Load order by code</span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-300" />
          : <ChevronDown className="w-4 h-4 text-gray-300" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && loadCode()}
              placeholder="e.g. AB3X7K"
              maxLength={6}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono font-bold tracking-widest uppercase focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
            />
            <button
              onClick={loadCode}
              disabled={isLoading || !code.trim()}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              {isLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Load'}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {order && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 space-y-4"
            >
              {/* Customer block */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{order.customer_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{order.customer_whatsapp} · {timeSince(order.created_at)}</p>
                  <span className={`inline-flex mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    order.delivery_type === 'to_qafrica'
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-sky-50 text-sky-600'
                  }`}>
                    {order.delivery_type === 'to_qafrica' ? 'To QAFRICA / Jumia' : 'To Customer'}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              <Divider />

              {/* Items */}
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <img src={item.image_url} alt={item.name}
                      className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-[11px] text-gray-400">{fmtCny(item.price_cny)} · qty {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 flex-shrink-0">
                      {fmt(item.price_ngn * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <Divider />

              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{fmt(order.subtotal_ngn)}</span>
                </div>
                {order.jumia_fee_ngn > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Jumia fee</span><span>{fmt(order.jumia_fee_ngn)}</span>
                  </div>
                )}
                {order.shipping_ngn && (
                  <div className="flex justify-between text-gray-500">
                    <span>Shipping</span><span>{fmt(order.shipping_ngn)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
                  <span>Total</span><span className="text-orange-500">{fmt(order.total_ngn)}</span>
                </div>
              </div>

              <Divider />

              {/* Shipping input */}
              <div>
                <Label>Shipping cost (₦)</Label>
                <input
                  type="number"
                  value={shipping}
                  onChange={e => setShipping(e.target.value)}
                  placeholder="Enter amount in Naira"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
                />
                {shippingNgn > 0 && rates && (
                  <div className="flex gap-2 mt-2">
                    <span className="text-[11px] bg-red-50 text-red-600 px-2 py-1 rounded-lg font-semibold">
                      {fmtCny(shippingCny!)} CNY
                    </span>
                    <span className="text-[11px] bg-green-50 text-green-600 px-2 py-1 rounded-lg font-semibold">
                      {fmtUsd(shippingUsd!)} USD
                    </span>
                    <span className="text-[11px] bg-gray-50 text-gray-400 px-2 py-1 rounded-lg">
                      ¥1 = ₦{Math.round(rates.cnyToNgn)}
                    </span>
                  </div>
                )}
              </div>

              {/* Admin note */}
              <div>
                <Label>Internal note</Label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Notes visible only to admins..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => updateOrder()}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save changes
                </button>

                {nextStatus && (
                  <button
                    onClick={() => updateOrder(nextStatus)}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    Mark as {STATUS_LABELS[nextStatus]}
                  </button>
                )}

                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Message on WhatsApp
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
        <div className="flex items-center gap-2.5">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">All orders</span>
          <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
            {orders.length}
          </span>
        </div>
        <button onClick={load} disabled={isLoading}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-5 py-3 border-b border-gray-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, name or number…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 outline-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            All ({orders.length})
          </button>
          {STATUS_FLOW.map(s => counts[s] > 0 && (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
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
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 bg-gray-100 rounded" />
                <div className="h-2 w-44 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-300">No orders found</p>
          </div>
        ) : (
          filtered.map(order => (
            <div key={order.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 font-mono tracking-wider text-xs">
                    {order.code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <span className="font-semibold text-gray-800 text-xs flex-shrink-0">
                  {fmt(order.total_ngn)}
                </span>
              </div>
              <p className="text-sm text-gray-700">{order.customer_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-gray-400">{order.customer_whatsapp}</span>
                <span className="text-gray-200">·</span>
                <span className="text-[11px] text-gray-400">{timeSince(order.created_at)}</span>
                <span className="text-gray-200">·</span>
                <span className={`text-[10px] font-medium ${
                  order.delivery_type === 'to_qafrica' ? 'text-orange-500' : 'text-sky-500'
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

// ── Image slot component ───────────────────────────────────────────────────────
function ImageSlot({
  src,
  index,
  onAdd,
  onRemove,
}: {
  src?: string;
  index: number;
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  if (src) {
    return (
      <div className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
        <img src={src} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        >
          <X className="w-3 h-3 text-gray-700" />
        </button>
        {index === 0 && (
          <span className="absolute bottom-1.5 left-1.5 text-[9px] bg-gray-900/70 text-white px-1.5 py-0.5 rounded font-semibold">
            Main
          </span>
        )}
      </div>
    );
  }

  return (
    <label className="cursor-pointer aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-gray-400 transition-colors">
      <Upload className="w-4 h-4 text-gray-300 mb-1" />
      <span className="text-[10px] text-gray-300">Add photo</span>
      <input type="file" accept="image/*" className="hidden" onChange={onAdd} />
    </label>
  );
}

// ── Product Management ────────────────────────────────────────────────────────
function ProductsManager({ token }: { token: string }) {
  const [products, setProducts]       = useState<ImportProduct[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editProduct, setEditProduct] = useState<ImportProduct | null>(null);
  const [rates, setRates]             = useState<Rates | null>(null);

  // Form state
  const [name, setName]               = useState('');
  const [description, setDesc]        = useState('');
  const [category, setCategory]       = useState('General');
  const [priceCnyOriginal, setPriceCnyOriginal] = useState(''); // raw 1688 price entered by admin
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); // up to 3 preview URLs
  const [imageFiles, setImageFiles]   = useState<(File | null)[]>([null, null, null]);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveError, setSaveError]     = useState('');

  // Derived values with 1% markup
  const rawCny = parseFloat(priceCnyOriginal) || 0;
  const markedUpCny = rawCny > 0 ? rawCny * (1 + PLATFORM_MARKUP) : 0;
  const priceNgn = rates && markedUpCny ? markedUpCny * rates.cnyToNgn : 0;
  const priceUsd = rates && markedUpCny ? markedUpCny * rates.cnyToUsd : 0;

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
    setPriceCnyOriginal('');
    setImagePreviews([]); setImageFiles([null, null, null]);
    setSaveError('');
    setShowForm(true);
  };

  const openEdit = (p: ImportProduct) => {
    setEditProduct(p);
    setName(p.name); setDesc(p.description); setCategory(p.category);
    // Show the original (pre-markup) price for editing
    setPriceCnyOriginal(p.price_cny_original?.toString() ?? p.price_cny.toString());
    // Populate previews from existing image_urls or fallback to image_url
    const existing = p.image_urls?.length ? p.image_urls : (p.image_url ? [p.image_url] : []);
    setImagePreviews(existing.slice(0, 3));
    setImageFiles([null, null, null]);
    setSaveError('');
    setShowForm(true);
  };

  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>, slot: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, targetSizeKb: 100 });
    const newFiles = [...imageFiles];
    newFiles[slot] = compressed;
    setImageFiles(newFiles);
    const newPreviews = [...imagePreviews];
    newPreviews[slot] = URL.createObjectURL(compressed);
    setImagePreviews(newPreviews);
  };

  const handleImageRemove = (slot: number) => {
    const newPreviews = [...imagePreviews];
    newPreviews.splice(slot, 1);
    setImagePreviews(newPreviews);
    const newFiles = [...imageFiles];
    newFiles[slot] = null;
    setImageFiles(newFiles);
  };

  const uploadImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const ext = file.name.split('.').pop() ?? 'webp';
          const res = await fetch(`${EDGE_URL}?action=upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: base64, extension: ext, manager_token: token }),
          });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload failed');
          resolve(data.url);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    if (!name || !priceCnyOriginal || imagePreviews.length === 0) return;
    setIsSaving(true);
    setSaveError('');
    try {
      // Upload any new files; keep existing URLs where no new file was uploaded
      const resolvedUrls: string[] = [];
      for (let i = 0; i < 3; i++) {
        if (imageFiles[i]) {
          resolvedUrls.push(await uploadImage(imageFiles[i]!));
        } else if (imagePreviews[i]) {
          resolvedUrls.push(imagePreviews[i]);
        }
      }

      const payload = {
        name,
        description,
        category,
        price_cny_original: rawCny,
        price_cny:          parseFloat(markedUpCny.toFixed(4)),
        price_ngn:          Math.round(priceNgn),
        image_url:          resolvedUrls[0] ?? '',
        image_urls:         resolvedUrls,
        manager_token:      token,
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
      } else {
        setSaveError(data.error ?? 'Save failed');
      }
    } catch (e: any) {
      setSaveError(e?.message ?? 'Unexpected error');
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

  // How many image slots to show: always show filled + 1 empty (up to 3 max)
  const slotsToShow = Math.min(3, imagePreviews.length + 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">Products</span>
          <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
            {products.length}
          </span>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
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
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-800 text-sm">
                  {editProduct ? 'Edit product' : 'New product'}
                </p>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Image slots — max 3 */}
              <div>
                <Label>Photos (up to 3)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: slotsToShow }).map((_, i) => (
                    <ImageSlot
                      key={i}
                      index={i}
                      src={imagePreviews[i]}
                      onAdd={e => handleImageAdd(e, i)}
                      onRemove={() => handleImageRemove(i)}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">First photo is the main display image.</p>
              </div>

              <div>
                <Label>Product name</Label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Wireless Earbuds Pro"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
              </div>

              <div>
                <Label>Description</Label>
                <textarea value={description} onChange={e => setDesc(e.target.value)}
                  rows={2} placeholder="Brief product description…"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none resize-none" />
              </div>

              <div>
                <Label>Category</Label>
                <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Electronics, Fashion, Home"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
              </div>

              {/* Price input with markup note */}
              <div>
                <Label>Price from 1688 (CNY ¥)</Label>

                {/* Markup info banner */}
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-600 leading-relaxed">
                    Enter the <strong>exact price from 1688</strong>. A 1% platform markup is added automatically before saving.
                  </p>
                </div>

                <input type="number" value={priceCnyOriginal} onChange={e => setPriceCnyOriginal(e.target.value)}
                  placeholder="e.g. 45.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />

                {/* Live conversion preview */}
                {markedUpCny > 0 && rates && (
                  <div className="mt-2 bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>1688 price</span>
                      <span className="font-medium">¥{rawCny.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>+ 1% markup</span>
                      <span className="font-medium text-orange-500">¥{markedUpCny.toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div className="flex justify-between text-xs font-bold text-gray-800">
                      <span>Customer price</span>
                      <span>{fmt(priceNgn)}</span>
                    </div>
                    <div className="flex gap-2 pt-0.5">
                      <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-lg font-semibold">
                        ${priceUsd.toFixed(2)} USD
                      </span>
                      <span className="text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded-lg font-semibold">
                        ¥{markedUpCny.toFixed(2)} CNY
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {saveError && (
                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {saveError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave}
                  disabled={isSaving || !name || !priceCnyOriginal || imagePreviews.length === 0}
                  className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editProduct ? 'Save changes' : 'Add product'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
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
              <div className="w-10 h-10 bg-gray-100 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-36 bg-gray-100 rounded" />
                <div className="h-2 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : products.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-300">No products yet. Add your first one.</p>
          </div>
        ) : (
          products.map(p => (
            <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
              {/* Show first image; if image_urls exists show stacked hint */}
              <div className="relative flex-shrink-0">
                <img src={p.image_url} alt={p.name}
                  className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                {p.image_urls?.length > 1 && (
                  <span className="absolute -bottom-1 -right-1 text-[8px] bg-gray-800 text-white px-1 rounded-full font-bold">
                    +{p.image_urls.length - 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-400">¥{p.price_cny_original ?? p.price_cny}</span>
                  <span className="text-[10px] text-gray-300">→</span>
                  <span className="text-[11px] text-orange-500 font-semibold">
                    ₦{Math.round(p.price_ngn).toLocaleString()}
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
                    {p.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(p)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-300 hover:text-gray-600 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(p.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
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
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">Import Admin</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">{manager?.full_name}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1">
          {(['orders', 'products'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                tab === t
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
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
