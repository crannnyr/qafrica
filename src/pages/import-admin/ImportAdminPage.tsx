// src/pages/import-admin/ImportAdminPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, LogOut, Package, Search, RefreshCw,
  Plus, Trash2, Edit2, Check, ChevronDown, ChevronUp,
  Upload, Loader, TrendingUp, AlertCircle, ExternalLink, X,
  Info, CheckCircle2,
} from 'lucide-react';
import { compressImage } from '@/lib/imageCompression';
import CONFIG from '@/lib/config';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';
import ImportAdminAnalytics from './ImportAdminAnalytics';
import ImportAdminCustomers from './ImportAdminCustomers';
import { CustomerDetail } from './ImportAdminCustomers';
import QuestionsManager from './QuestionsManager';
import TotalOrdersView from './TotalOrdersView';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

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
    variant_options?: Record<string, string>;
  }>;
  delivery_type: 'to_qafrica' | 'to_me';
  shipping_method?: 'flight' | 'sea_freight' | null;
  delivery_address?: {
    name: string; phone: string; address_line1: string; address_line2: string;
    city: string; state: string; landmark: string;
  } | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  location_shared?: boolean;
  subtotal_ngn: number;
  jumia_fee_ngn: number;
  shipping_ngn: number | null;
  total_ngn: number;
  status: 'pending' | 'confirmed' | 'billed' | 'to_review';
  payment_status: 'unpaid' | 'awaiting_confirmation' | 'paid' | 'failed';
  payment_method: 'paystack' | 'manual' | null;
  admin_note: string | null;
  created_at: string;
  user_id: string | null;
  staged_at: string | null;
}

interface VariantGroup {
  id: string;
  name: string;
  options: string[];
  price_deltas?: Record<string, number>;
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
  price_usd?: number;
  cost_ngn?: number;
  price_input_currency?: 'cny' | 'usd' | 'ngn';
  price_input_amount?: number;
  category: string;
  is_active: boolean;
  sort_order: number;
  moq?: number;
  has_variants?: boolean;
  variants?: VariantGroup[];
  units_sold?: number;
}

// Quick-add presets for the variant builder
const PRESET_COLORS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Grey', 'Pink', 'Purple', 'Orange', 'Brown', 'Beige'];
const PRESET_SIZES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'One Size',
  '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46',
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// Mirrors the china-import edge function's getTieredMarkupNgn() — used only
// for the live price preview shown to the admin while typing.
function getTieredMarkupNgn(baseNgn: number): number {
  if (baseNgn < 10_000) return 1_000;
  if (baseNgn < 20_000) return 1_500;
  if (baseNgn < 50_000) return 2_000;
  if (baseNgn < 100_000) return 5_000;
  if (baseNgn < 200_000) return 9_000;
  return 25_000;
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

// Prefers precise GPS coords when the customer shared them; falls back to a
// text search built from the manually entered address.
function googleMapsLink(order: Pick<ImportOrder, 'delivery_latitude' | 'delivery_longitude' | 'delivery_address'>) {
  if (order.delivery_latitude != null && order.delivery_longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${order.delivery_latitude},${order.delivery_longitude}`;
  }
  const a = order.delivery_address;
  if (!a) return null;
  const parts = [a.address_line1, a.address_line2, a.landmark, a.city, a.state].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

const SHIPPING_METHOD_LABELS: Record<string, string> = {
  flight: 'Flight', sea_freight: 'Sea freight',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  billed: 'Billed — fee due',
  to_review: 'To Review',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-sky-50 text-sky-700',
  billed: 'bg-rose-50 text-rose-700',
  to_review: 'bg-emerald-50 text-emerald-700',
};

// Simplified pipeline: pending -> confirmed -> billed -> to_review. Folded
// from the old 7-stage pipeline (shipping_quoted/order_placed -> confirmed;
// awaiting_shipment -> billed; shipped/delivered -> to_review) via an
// expand -> migrate -> contract DB migration.
const STATUS_FLOW = ['pending', 'confirmed', 'billed', 'to_review'];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  awaiting_confirmation: 'Awaiting confirmation',
  paid: 'Paid',
  failed: 'Failed',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-gray-100 text-gray-500',
  awaiting_confirmation: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-600',
};

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
    if (!token || !manager) navigate('/importations/admin/login');
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
  const [statusDraft, setStatusDraft] = useState('');
  const [isSaving, setIsSaving]   = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [rates, setRates]         = useState<Rates | null>(null);
  const [expanded, setExpanded]   = useState(false);

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
      setStatusDraft(data.order.status);
    } catch {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  // overrides lets a single call update status and/or payment_status together
  // (e.g. "Confirm Payment" sets payment_status without touching status).
  const updateOrder = async (overrides?: { status?: string; payment_status?: string }) => {
    if (!order) return;
    setIsSaving(true);
    try {
      const body: any = { id: order.id, manager_token: token };
      body.status = overrides?.status ?? statusDraft ?? order.status;
      if (overrides?.payment_status) body.payment_status = overrides.payment_status;
      if (shipping) body.shipping_ngn = parseFloat(shipping);
      if (note !== undefined) body.admin_note = note;

      const res = await fetch(`${EDGE_URL}?action=update-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.order) { setOrder(data.order); setStatusDraft(data.order.status); }
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  const confirmPayment = () => { setIsConfirmingPayment(true); updateOrder({ payment_status: 'paid' }).finally(() => setIsConfirmingPayment(false)); };
  const rejectPayment = () => { setIsConfirmingPayment(true); updateOrder({ payment_status: 'failed' }).finally(() => setIsConfirmingPayment(false)); };

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
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.delivery_type === 'to_qafrica'
                        ? 'bg-orange-50 text-orange-600'
                        : 'bg-sky-50 text-sky-600'
                    }`}>
                      {order.delivery_type === 'to_qafrica' ? 'To QAFRICA / Jumia' : 'To Customer'}
                    </span>
                    {order.shipping_method && (
                      <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {SHIPPING_METHOD_LABELS[order.shipping_method] ?? order.shipping_method}
                      </span>
                    )}
                    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[order.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                      {order.payment_method === 'paystack' && order.payment_status === 'paid' ? ' · auto-verified' : ''}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              {/* Manual transfer awaiting verification — admin must confirm or reject before it counts as paid */}
              {order.payment_status === 'awaiting_confirmation' && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                  <p className="text-xs text-amber-800 font-semibold mb-0.5">Customer says they've paid by bank transfer</p>
                  <p className="text-[11px] text-amber-600 mb-2.5">Check your bank statement before confirming — this is a self-report, not a verified payment.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmPayment}
                      disabled={isConfirmingPayment}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isConfirmingPayment ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Confirm Payment
                    </button>
                    <button
                      onClick={rejectPayment}
                      disabled={isConfirmingPayment}
                      className="flex-1 py-2 bg-white border border-amber-200 hover:bg-amber-100 disabled:opacity-40 text-amber-700 text-xs font-bold rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Delivery address — only present for to_me orders */}
              {order.delivery_type === 'to_me' && order.delivery_address && (
                <div className="bg-gray-50 rounded-xl px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-gray-600 leading-relaxed">
                      <p className="font-semibold text-gray-800">{order.delivery_address.name} · {order.delivery_address.phone}</p>
                      <p>{order.delivery_address.address_line1}{order.delivery_address.address_line2 ? `, ${order.delivery_address.address_line2}` : ''}</p>
                      <p>{order.delivery_address.city}, {order.delivery_address.state}</p>
                      {order.delivery_address.landmark && <p className="text-gray-400">Near: {order.delivery_address.landmark}</p>}
                      {order.location_shared && (
                        <p className="text-emerald-600 font-semibold mt-1">📍 GPS location shared</p>
                      )}
                    </div>
                    {googleMapsLink(order) && (
                      <a
                        href={googleMapsLink(order)!} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-white bg-gray-900 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

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

              {/* Status — jump directly to any status (confirmed/billed/to_review are usually set automatically by payment/billing actions, but can be overridden here) */}
              <div>
                <Label>Order status</Label>
                <select
                  value={statusDraft}
                  onChange={e => setStatusDraft(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none bg-white"
                >
                  {STATUS_FLOW.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

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
                    onClick={() => updateOrder({ status: nextStatus })}
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
  const [billingOrder, setBillingOrder] = useState<ImportOrder | null>(null);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=all-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load orders');
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
            <div
              key={order.id}
              onClick={() => order.user_id && setProfileCustomerId(order.user_id)}
              className={`px-5 py-3.5 hover:bg-gray-50 transition-colors ${order.user_id ? 'cursor-pointer' : ''}`}
            >
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
              {order.user_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); setBillingOrder(order); }}
                  className="mt-2 text-[11px] font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Bill this customer
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {billingOrder && (
        <BillCustomerModal
          token={token}
          order={billingOrder}
          onClose={() => setBillingOrder(null)}
        />
      )}

      {profileCustomerId && (
        <CustomerDetail
          token={token}
          customerId={profileCustomerId}
          onClose={() => { setProfileCustomerId(null); load(); }}
          onFavoriteToggled={() => {}}
        />
      )}
    </div>
  );
}

// ── Bill Customer Modal (consolidation drop-off fee) ────────────────────────
function BillCustomerModal({
  token,
  order,
  onClose,
}: {
  token: string;
  order: ImportOrder;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<'consolidation' | 'shipping'>('consolidation');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Consolidation drop-off fee');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const selectKind = (k: 'consolidation' | 'shipping') => {
    setKind(k);
    // Only swap the reason if it still matches one of the two defaults —
    // if admin already typed something custom, don't clobber it.
    if (reason === 'Consolidation drop-off fee' || reason === 'Shipping fee to Nigeria') {
      setReason(k === 'shipping' ? 'Shipping fee to Nigeria' : 'Consolidation drop-off fee');
    }
  };

  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { setError('Enter a valid amount'); return; }
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-create-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          user_id: order.user_id,
          order_id: order.id,
          amount_ngn: amountNum,
          reason: reason.trim() || undefined,
          kind,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create bill');
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6">
        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Bill sent</h3>
            <p className="text-gray-400 text-xs mb-5">
              {order.customer_name} will see this on their dashboard and can pay by bank transfer.
              {kind === 'shipping' && ' Once confirmed paid, this order moves to To Review.'}
            </p>
            <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white font-bold text-sm rounded-xl">
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Bill this customer</h3>
            <p className="text-gray-400 text-xs mb-4">
              Order {order.code} · {order.customer_name}
            </p>

            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Fee type</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => selectKind('consolidation')}
                className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${
                  kind === 'consolidation' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-100 text-gray-400'
                }`}
              >
                Consolidation
              </button>
              <button
                onClick={() => selectKind('shipping')}
                className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${
                  kind === 'shipping' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-100 text-gray-400'
                }`}
              >
                Shipping to Nigeria
              </button>
            </div>
            <p className="text-[11px] text-gray-400 -mt-2.5 mb-4">
              {kind === 'shipping'
                ? 'This is the final fee — once paid, the order moves to "To Review".'
                : 'The warehouse drop-off/consolidation fee. Paying this keeps the order at "Billed" in case a shipping fee follows later.'}
            </p>

            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Amount (₦)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none mb-3"
            />

            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none mb-4"
            />

            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-3 text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || !amount}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Send bill'}
              </button>
            </div>
          </>
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
  const [priceAmount, setPriceAmount] = useState(''); // raw price as entered by admin
  const [priceCurrency, setPriceCurrency] = useState<'cny' | 'usd' | 'ngn'>('cny');
  const [moq, setMoq]                 = useState('1');
  const [unitsSold, setUnitsSold]     = useState('');
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);
  const [expandedVariantGroups, setExpandedVariantGroups] = useState<Set<string>>(new Set());
  const toggleVariantGroupExpanded = (key: string) =>
    setExpandedVariantGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const [customGroupName, setCustomGroupName] = useState('');
  const [customOptionDrafts, setCustomOptionDrafts] = useState<Record<string, string>>({});
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); // up to 3 preview URLs
  const [imageFiles, setImageFiles]   = useState<(File | null)[]>([null, null, null]);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveError, setSaveError]     = useState('');

  // Live preview using the same tiered-markup logic the backend applies
  const rawAmount = parseFloat(priceAmount) || 0;
  let previewCostNgn = 0;
  if (rawAmount > 0 && rates) {
    if (priceCurrency === 'ngn') previewCostNgn = rawAmount;
    else if (priceCurrency === 'usd') previewCostNgn = rawAmount * rates.usdToNgn;
    else previewCostNgn = (rawAmount / rates.cnyToUsd) * rates.usdToNgn; // cny -> usd -> ngn
  }
  const previewMarkupNgn = previewCostNgn > 0 ? getTieredMarkupNgn(previewCostNgn) : 0;
  const priceNgn = previewCostNgn > 0 ? previewCostNgn + previewMarkupNgn : 0;
  const priceUsd = rates && priceNgn ? priceNgn / rates.usdToNgn : 0;
  const priceCnyPreview = rates && priceUsd ? priceUsd * rates.cnyToUsd : 0;

  // ── Variant helpers ─────────────────────────────────────────────────────
  const toggleGroupOption = (groupName: string, option: string) => {
    setVariantGroups(prev => {
      const existingGroup = prev.find(g => g.name === groupName);
      if (!existingGroup) {
        return [...prev, { id: genId(), name: groupName, options: [option] }];
      }
      const hasOption = existingGroup.options.includes(option);
      const updatedOptions = hasOption
        ? existingGroup.options.filter(o => o !== option)
        : [...existingGroup.options, option];
      if (updatedOptions.length === 0) {
        return prev.filter(g => g.id !== existingGroup.id);
      }
      return prev.map(g => g.id === existingGroup.id ? { ...g, options: updatedOptions } : g);
    });
  };

  const addCustomGroup = () => {
    const trimmed = customGroupName.trim();
    if (!trimmed) return;
    if (variantGroups.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) return;
    setVariantGroups(prev => [...prev, { id: genId(), name: trimmed, options: [] }]);
    setCustomGroupName('');
  };

  const addCustomOption = (groupId: string) => {
    const draft = (customOptionDrafts[groupId] ?? '').trim();
    if (!draft) return;
    setVariantGroups(prev => prev.map(g =>
      g.id === groupId && !g.options.includes(draft) ? { ...g, options: [...g.options, draft] } : g
    ));
    setCustomOptionDrafts(prev => ({ ...prev, [groupId]: '' }));
  };

  const removeCustomOption = (groupId: string, option: string) => {
    setVariantGroups(prev => prev
      .map(g => g.id === groupId ? { ...g, options: g.options.filter(o => o !== option) } : g)
      .filter(g => g.options.length > 0));
  };

  const removeGroup = (groupId: string) => {
    setVariantGroups(prev => prev.filter(g => g.id !== groupId));
  };

  // Sets (or clears, if left blank/0) the NGN price adjustment for one
  // specific option within a group — e.g. Size "XL" costs +₦1,500 more.
  const setOptionDelta = (groupId: string, option: string, deltaStr: string) => {
    const trimmed = deltaStr.trim();
    const delta = trimmed === '' ? undefined : Number(trimmed);
    setVariantGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const price_deltas = { ...(g.price_deltas ?? {}) };
      if (delta === undefined || Number.isNaN(delta) || delta === 0) {
        delete price_deltas[option];
      } else {
        price_deltas[option] = delta;
      }
      return { ...g, price_deltas: Object.keys(price_deltas).length ? price_deltas : undefined };
    }));
  };

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
      const res = await fetch(`${EDGE_URL}?action=admin-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
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
    setPriceAmount(''); setPriceCurrency('cny'); setMoq('1'); setUnitsSold('');
    setVariantGroups([]); setCustomGroupName(''); setCustomOptionDrafts({}); setExpandedVariantGroups(new Set());
    setImagePreviews([]); setImageFiles([null, null, null]);
    setSaveError('');
    setShowForm(true);
  };

  const openEdit = (p: ImportProduct) => {
    setEditProduct(p);
    setName(p.name); setDesc(p.description); setCategory(p.category);
    // Restore exactly what the admin originally typed — the currency they
    // picked and the raw amount — instead of guessing. Falls back to the
    // old CNY-only assumption only for products saved before this field existed.
    if (p.price_input_currency && p.price_input_amount != null) {
      setPriceAmount(p.price_input_amount.toString());
      setPriceCurrency(p.price_input_currency);
    } else {
      setPriceAmount((p.price_cny_original ?? p.price_cny).toString());
      setPriceCurrency('cny');
    }
    setMoq((p.moq ?? 1).toString());
    setUnitsSold((p.units_sold ?? 0).toString());
    setVariantGroups(p.variants?.length ? p.variants.map(g => ({ ...g, id: g.id || genId() })) : []);
    setExpandedVariantGroups(new Set());
    setCustomGroupName(''); setCustomOptionDrafts({});
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
    // Both arrays must shift together — previously imagePreviews spliced
    // (compacting slots) while imageFiles only nulled the slot in place,
    // which silently misaligned "this file" with "this preview" after any
    // removal and could save the wrong (or a stale) image on the next edit.
    const newPreviews = [...imagePreviews];
    newPreviews.splice(slot, 1);
    setImagePreviews(newPreviews);
    const newFiles = [...imageFiles];
    newFiles.splice(slot, 1);
    newFiles.push(null); // keep a fixed length of 3 for the slot-index checks in handleSave
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
    if (!name || !priceAmount || imagePreviews.length === 0) return;
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
        price_amount:   rawAmount,
        price_currency: priceCurrency,
        moq:             parseInt(moq, 10) >= 1 ? parseInt(moq, 10) : 1,
        has_variants:    variantGroups.length > 0,
        variants:        variantGroups,
        image_url:       resolvedUrls[0] ?? '',
        image_urls:      resolvedUrls,
        manager_token:   token,
        ...(unitsSold.trim() !== '' ? { units_sold: parseInt(unitsSold, 10) } : {}),
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
                <Label>Price from source</Label>

                {/* Markup info banner */}
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-600 leading-relaxed">
                    Enter the <strong>exact cost price</strong> in whatever currency you have it. A tiered platform markup (₦1,000–₦25,000 depending on price band) is added automatically before saving.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input type="number" value={priceAmount} onChange={e => setPriceAmount(e.target.value)}
                    placeholder="e.g. 45.00"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
                  <select value={priceCurrency} onChange={e => setPriceCurrency(e.target.value as 'cny' | 'usd' | 'ngn')}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:border-gray-400 outline-none">
                    <option value="cny">CNY ¥</option>
                    <option value="usd">USD $</option>
                    <option value="ngn">NGN ₦</option>
                  </select>
                </div>

                {/* Live conversion preview */}
                {priceNgn > 0 && rates && (
                  <div className="mt-2 bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Cost price</span>
                      <span className="font-medium">{fmt(previewCostNgn)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>+ Platform markup</span>
                      <span className="font-medium text-orange-500">{fmt(previewMarkupNgn)}</span>
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
                        ¥{priceCnyPreview.toFixed(2)} CNY
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>Minimum order quantity</Label>
                <input type="number" min={1} value={moq} onChange={e => setMoq(e.target.value)}
                  placeholder="1"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
              </div>

              <div>
                <Label>Sold count</Label>
                <input type="number" min={0} value={unitsSold} onChange={e => setUnitsSold(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
                <p className="text-[11px] text-gray-400 mt-1">
                  Shown to customers as "X sold". Set this to seed prior real sales, or give a new listing a head start. Leave blank to keep it unchanged — it otherwise only increases automatically when a real order is confirmed paid.
                </p>
              </div>

              {/* Variants */}
              <div>
                <Label>Variants (optional)</Label>

                {/* Quick-add: Colors */}
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Colors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map(color => {
                      const active = variantGroups.find(g => g.name === 'Color')?.options.includes(color);
                      return (
                        <button key={color} type="button" onClick={() => toggleGroupOption('Color', color)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}>
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick-add: Sizes */}
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Sizes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SIZES.map(size => {
                      const active = variantGroups.find(g => g.name === 'Size')?.options.includes(size);
                      return (
                        <button key={size} type="button" onClick={() => toggleGroupOption('Size', size)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}>
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom variant groups (also covers "unspecified" variants) */}
                {variantGroups.filter(g => g.name !== 'Color' && g.name !== 'Size').map(group => {
                  const isLong = group.options.length > 10;
                  const isExpanded = expandedVariantGroups.has(`chips:${group.id}`);
                  const visibleOptions = isLong && !isExpanded ? group.options.slice(0, 10) : group.options;
                  return (
                    <div key={group.id} className="mb-3 bg-white border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-gray-700">{group.name} <span className="text-gray-400 font-normal">({group.options.length})</span></p>
                        <button type="button" onClick={() => removeGroup(group.id)} className="text-gray-300 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {visibleOptions.map(opt => (
                          <span key={opt} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-600">
                            {opt}
                            <button type="button" onClick={() => removeCustomOption(group.id, opt)} className="text-gray-400 hover:text-red-400">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        {isLong && (
                          <button type="button" onClick={() => toggleVariantGroupExpanded(`chips:${group.id}`)}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-gray-400">
                            {isExpanded ? 'Show less' : `+${group.options.length - 10} more`}
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <input type="text" value={customOptionDrafts[group.id] ?? ''}
                          onChange={e => setCustomOptionDrafts(prev => ({ ...prev, [group.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomOption(group.id); } }}
                          placeholder="Add an option…"
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-gray-400" />
                        <button type="button" onClick={() => addCustomOption(group.id)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Per-option price adjustments — lets a costly variant (e.g. a larger
                    size or premium color) actually cost more than the base price. */}
                {variantGroups.length > 0 && (() => {
                  const allOptionRows = variantGroups.flatMap(group => group.options.map(opt => ({ group, opt })));
                  const isLong = allOptionRows.length > 10;
                  const isExpanded = expandedVariantGroups.has('price-panel');
                  const visibleRows = isLong && !isExpanded ? allOptionRows.slice(0, 10) : allOptionRows;
                  return (
                    <div className="mb-3 bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-[11px] font-semibold text-gray-700 mb-0.5">Price adjustments (optional)</p>
                      <p className="text-[10px] text-gray-400 mb-2.5">Leave blank for no change vs. the base price above. Customers see this reflected live when they pick options.</p>
                      <div className="space-y-2">
                        {visibleRows.map(({ group, opt }) => (
                          <div key={`${group.id}:${opt}`} className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500 flex-1 truncate">{group.name}: <span className="font-semibold text-gray-700">{opt}</span></span>
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-gray-400">₦</span>
                              <input
                                type="number"
                                value={group.price_deltas?.[opt] ?? ''}
                                onChange={e => setOptionDelta(group.id, opt, e.target.value)}
                                placeholder="0"
                                className="w-24 px-2 py-1 rounded-lg border border-gray-200 text-xs text-right outline-none focus:border-gray-400"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {isLong && (
                        <button type="button" onClick={() => toggleVariantGroupExpanded('price-panel')}
                          className="mt-2.5 w-full text-center py-1.5 rounded-lg text-[11px] font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-gray-400">
                          {isExpanded ? 'Show less' : `Show all ${allOptionRows.length} options`}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Add a fully custom variant group — for anything not covered by color/size */}
                <div className="flex gap-1.5">
                  <input type="text" value={customGroupName}
                    onChange={e => setCustomGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomGroup(); } }}
                    placeholder="Custom variant name (e.g. Material)"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-gray-400" />
                  <button type="button" onClick={addCustomGroup}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 text-xs font-semibold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {saveError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave}
                  disabled={isSaving || !name || !priceAmount || imagePreviews.length === 0}
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
                  {p.has_variants && p.variants?.length ? (
                    <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">
                      {p.variants.map(g => g.name).join(', ')}
                    </span>
                  ) : null}
                  {!!p.units_sold && (
                    <span className="text-[10px] text-gray-400">{p.units_sold.toLocaleString()} sold</span>
                  )}
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
  useImportPwaManifest();
  const { token, manager, logout } = useImportAuth();
  const [tab, setTab] = useState<'analytics' | 'orders' | 'total-orders' | 'products' | 'clients' | 'questions'>('analytics');

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto">
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

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1 overflow-x-auto">
          {(['analytics', 'orders', 'total-orders', 'products', 'clients', 'questions'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize whitespace-nowrap ${
                tab === t
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {t === 'total-orders' ? 'Total Orders' : t}
            </button>
          ))}
        </div>

        {tab === 'analytics' ? (
          <ImportAdminAnalytics token={token} />
        ) : tab === 'orders' ? (
          <>
            <OrdersList token={token} />
            <LoadCodePanel token={token} />
          </>
        ) : tab === 'total-orders' ? (
          <TotalOrdersView token={token} />
        ) : tab === 'products' ? (
          <ProductsManager token={token} />
        ) : tab === 'questions' ? (
          <QuestionsManager token={token} />
        ) : (
          <ImportAdminCustomers token={token} />
        )}
      </div>
    </div>
  );
}
