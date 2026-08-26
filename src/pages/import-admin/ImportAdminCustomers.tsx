// src/pages/import-admin/ImportAdminCustomers.tsx
// Client management for the import admin: favorite clients for quick access,
// filter by newly-joined / has-ordered / awaiting-confirmation, drill into a
// client to see their full order history, and trigger a WhatsApp payment
// reminder for orders stuck awaiting manual-transfer confirmation.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, ChevronRight, X, MessageCircle, Package,
  Clock, UserPlus, Loader, Plus, ListPlus, Trash2, Tag,
  ExternalLink, ChevronDown,
} from 'lucide-react';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const LISTS_EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/client-lists`;

interface CustomerRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  joined_at: string;
  is_favorite: boolean;
  order_count: number;
  total_spent_ngn: number;
  last_order_at: string | null;
  awaiting_confirmation_count: number;
  failed_order_count: number;
}

interface OrderRow {
  id: string;
  code: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string;
  customer_whatsapp: string;
  total_ngn: number;
  delivery_type: string;
  created_at: string;
  items?: Array<{
    id: string;
    name: string;
    image_url?: string;
    price_ngn: number;
    quantity: number;
    variant_options?: Record<string, string>;
  }>;
}

function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}
function timeAgo(d: string | null) {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

const REMINDER_MESSAGE = (name: string, code: string) =>
  `Hi ${name}! Did something go wrong? We noticed you haven't completed payment for your order ${code}. Kindly reach out to us on WhatsApp so we can assist you further.`;

const BILL_REMINDER_MESSAGE = (name: string, reason: string, amount: number) =>
  `Hi ${name}! Just a friendly reminder that you have an outstanding fee — ${reason} (₦${Math.round(amount).toLocaleString()}). Please make payment when you can so we can keep your order moving. Let us know if you have any questions!`;

function waLink(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

interface ClientList {
  id: string;
  name: string;
  customer_ids: string[];
}

const BUILT_IN_FILTERS = ['All', 'Favorites', 'Newly joined', 'Awaiting confirmation'] as const;
type Filter = typeof BUILT_IN_FILTERS[number] | { listId: string; name: string };

// ── Customer detail panel ──────────────────────────────────────────────────
export function CustomerDetail({ token, customerId, onClose, onFavoriteToggled, lists = [], onToggleListMember = () => {} }: {
  token: string; customerId: string; onClose: () => void; onFavoriteToggled: (id: string, val: boolean) => void;
  lists?: ClientList[]; onToggleListMember?: (listId: string, customerId: string) => void;
}) {
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [failedOrders, setFailedOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    return fetch(`${EDGE_URL}?action=admin-customer-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_token: token, customer_id: customerId }),
    })
      .then(r => r.json())
      .then(d => { setCustomer(d.customer ?? null); setOrders(d.orders ?? []); setBills(d.bills ?? []); setFailedOrders(d.failed_orders ?? []); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token, customerId]);

  useEffect(() => { load(); }, [load]);

  const toggleFavorite = async () => {
    if (!customer) return;
    const res = await fetch(`${EDGE_URL}?action=admin-toggle-favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_token: token, customer_id: customerId }),
    });
    const data = await res.json();
    setCustomer((c: any) => ({ ...c, is_favorite: data.is_favorite }));
    onFavoriteToggled(customerId, data.is_favorite);
  };

  // Quick "Confirm Order" — flips payment_status straight to paid for orders
  // still unpaid/awaiting confirmation (e.g. a manual transfer admin has
  // verified outside the app). Reuses the same update-order action that
  // already handles the sold-counter increment and confirmation email.
  const confirmOrder = async (orderId: string) => {
    setConfirmingId(orderId);
    try {
      await fetch(`${EDGE_URL}?action=update-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, id: orderId, payment_status: 'paid' }),
      });
      await load();
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-white flex flex-col sm:left-auto sm:w-[440px] sm:shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 text-sm">Client details</h2>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      ) : !customer ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-300">Couldn't load this client.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {/* Profile */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
              {customer.avatar_url
                ? <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">{customer.full_name?.[0] ?? '?'}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">{customer.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{customer.email}</p>
            </div>
            <button onClick={toggleFavorite} className="p-2 hover:bg-amber-50 rounded-lg">
              <Star className={`w-4 h-4 ${customer.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Orders</p>
              <p className="font-bold text-gray-900 text-sm">{orders.length}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Joined</p>
              <p className="font-bold text-gray-900 text-sm">{timeAgo(customer.created_at)}</p>
            </div>
          </div>

          {/* Custom lists */}
          {lists.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Lists</p>
              <div className="flex flex-wrap gap-1.5">
                {lists.map(l => {
                  const isMember = l.customer_ids.includes(customerId);
                  return (
                    <button key={l.id} onClick={() => onToggleListMember(l.id, customerId)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                        isMember ? 'bg-orange-500 text-white' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:border-orange-300'
                      }`}>
                      <Tag className="w-2.5 h-2.5" />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Orders */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Order history</p>
            {orders.length === 0 ? (
              <p className="text-xs text-gray-300">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {orders.map(o => {
                  const needsReminder = o.payment_status === 'unpaid' && o.payment_method === 'manual';
                  const needsConfirmation = o.payment_status === 'unpaid' || o.payment_status === 'awaiting_confirmation';
                  const isExpanded = expandedOrderId === o.id;
                  const items = o.items ?? [];
                  return (
                    <div key={o.id} className="bg-white border border-gray-100 rounded-xl px-3.5 py-3">
                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                        className="w-full flex items-center justify-between mb-1 text-left"
                      >
                        <span className="font-mono text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          {o.code}
                          <ChevronDown className={`w-3 h-3 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                        <span className="font-semibold text-gray-900 text-xs">{fmt(o.total_ngn)}</span>
                      </button>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-gray-400 capitalize">{o.status.replace(/_/g, ' ')} · {o.payment_status}</p>
                        {needsReminder && (
                          <a
                            href={waLink(o.customer_whatsapp, REMINDER_MESSAGE(o.customer_name, o.code))}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                          >
                            <MessageCircle className="w-3 h-3" /> Remind
                          </a>
                        )}
                      </div>

                      {/* Item drill-down — every line item in this order, each
                          linking out to its live product page */}
                      {isExpanded && (
                        <div className="mt-2.5 pt-2.5 border-t border-gray-50 space-y-2">
                          {items.length === 0 ? (
                            <p className="text-[10px] text-gray-300">No item details on this order.</p>
                          ) : (
                            items.map((item, i) => (
                              <a
                                key={`${item.id}-${i}`}
                                href={`/recommendations/${item.id}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 group"
                              >
                                {item.image_url && (
                                  <img src={item.image_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-gray-700 group-hover:text-orange-600 transition-colors truncate flex items-center gap-1">
                                    {item.name}
                                    <ExternalLink className="w-2.5 h-2.5 text-gray-300 group-hover:text-orange-400 flex-shrink-0" />
                                  </p>
                                  {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                                    <p className="text-[10px] text-gray-400">
                                      {Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[10px] text-gray-400">×{item.quantity}</p>
                                  <p className="text-[11px] font-semibold text-gray-700">{fmt(item.price_ngn * item.quantity)}</p>
                                </div>
                              </a>
                            ))
                          )}
                        </div>
                      )}

                      {needsConfirmation && (
                        <button
                          onClick={() => confirmOrder(o.id)}
                          disabled={confirmingId === o.id}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          {confirmingId === o.id ? <Loader className="w-3 h-3 animate-spin" /> : null}
                          Confirm Order
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bills — consolidation & shipping fees, with a reminder action for any still pending */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bills</p>
            {bills.length === 0 ? (
              <p className="text-xs text-gray-300">No bills yet.</p>
            ) : (
              <div className="space-y-2">
                {bills.map((b: any) => (
                  <div key={b.id} className="bg-white border border-gray-100 rounded-xl px-3.5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-800">{b.reason}</span>
                      <span className="font-semibold text-gray-900 text-xs">{fmt(b.amount_ngn)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-400 capitalize">
                        {b.kind === 'shipping' ? 'Shipping fee' : 'Consolidation fee'} · {b.status.replace(/_/g, ' ')}
                      </p>
                      {b.status === 'pending' && customer.phone && (
                        <a
                          href={waLink(customer.phone, BILL_REMINDER_MESSAGE(customer.full_name, b.reason, b.amount_ngn))}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                        >
                          <MessageCircle className="w-3 h-3" /> Remind
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Failed orders — expired unpaid orders, kept as history only */}
          {failedOrders.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Failed orders</p>
              <div className="space-y-2">
                {failedOrders.map((f: any) => (
                  <div key={f.id} className="bg-red-50/40 border border-red-100 rounded-xl px-3.5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-gray-700">{f.code}</span>
                      <span className="font-semibold text-gray-600 text-xs">{fmt(f.total_ngn)}</span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Never paid · expired {timeAgo(f.failed_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────
export default function ImportAdminCustomers({ token }: { token: string }) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lists, setLists] = useState<ClientList[]>([]);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  const loadLists = useCallback(async () => {
    try {
      const res = await fetch(`${LISTS_EDGE_URL}?action=list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      setLists(data.lists ?? []);
    } catch {
      setLists([]);
    }
  }, [token]);

  useEffect(() => { loadLists(); }, [loadLists]);

  const createList = async () => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const res = await fetch(`${LISTS_EDGE_URL}?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, name: newListName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.list) {
        setLists(prev => [...prev, data.list]);
        setNewListName('');
        setShowNewList(false);
      }
    } finally {
      setCreatingList(false);
    }
  };

  const deleteList = async (listId: string) => {
    setLists(prev => prev.filter(l => l.id !== listId));
    if (typeof filter === 'object' && filter.listId === listId) setFilter('All');
    await fetch(`${LISTS_EDGE_URL}?action=delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_token: token, list_id: listId }),
    });
  };

  const toggleListMember = async (listId: string, customerId: string) => {
    // Optimistic update
    setLists(prev => prev.map(l => {
      if (l.id !== listId) return l;
      const isMember = l.customer_ids.includes(customerId);
      return { ...l, customer_ids: isMember ? l.customer_ids.filter(id => id !== customerId) : [...l.customer_ids, customerId] };
    }));
    await fetch(`${LISTS_EDGE_URL}?action=toggle-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_token: token, list_id: listId, customer_id: customerId }),
    });
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, search: search.trim() || undefined }),
      });
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const toggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`${EDGE_URL}?action=admin-toggle-favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_token: token, customer_id: id }),
    });
    const data = await res.json();
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, is_favorite: data.is_favorite } : c));
  };

  const filtered = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    let list = customers;
    if (filter === 'Favorites') list = list.filter(c => c.is_favorite);
    else if (filter === 'Newly joined') list = list.filter(c => new Date(c.joined_at).getTime() >= sevenDaysAgo);
    else if (filter === 'Awaiting confirmation') list = list.filter(c => c.awaiting_confirmation_count > 0);
    else if (typeof filter === 'object') {
      const activeList = lists.find(l => l.id === filter.listId);
      const idSet = new Set(activeList?.customer_ids ?? []);
      list = list.filter(c => idSet.has(c.id));
    }
    // Favorites always float to top within whatever filter is active
    return [...list].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
  }, [customers, filter, lists]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {BUILT_IN_FILTERS.map(f => {
          const count = f === 'Favorites' ? customers.filter(c => c.is_favorite).length
            : f === 'Awaiting confirmation' ? customers.filter(c => c.awaiting_confirmation_count > 0).length
            : f === 'Newly joined' ? customers.filter(c => new Date(c.joined_at).getTime() >= Date.now() - 7 * 86_400_000).length
            : customers.length;
          const isActive = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1 ${
                isActive ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'
              }`}>
              {f}
              <span className="text-[9px] text-gray-300">{count}</span>
            </button>
          );
        })}

        {lists.map(l => {
          const isActive = typeof filter === 'object' && filter.listId === l.id;
          return (
            <button key={l.id} onClick={() => setFilter({ listId: l.id, name: l.name })}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1 ${
                isActive ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-600'
              }`}>
              <Tag className="w-2.5 h-2.5" />
              {l.name}
              <span className={`text-[9px] ${isActive ? 'text-orange-100' : 'text-orange-300'}`}>{l.customer_ids.length}</span>
            </button>
          );
        })}

        <button onClick={() => setShowNewList(v => !v)}
          className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1 bg-white border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600">
          <Plus className="w-3 h-3" />
          New list
        </button>
      </div>

      {showNewList && (
        <div className="flex items-center gap-2">
          <input
            type="text" value={newListName} onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createList()}
            placeholder="List name, e.g. VIP customers"
            autoFocus
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
          />
          <button onClick={createList} disabled={creatingList || !newListName.trim()}
            className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5">
            {creatingList ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ListPlus className="w-3.5 h-3.5" />}
            Create
          </button>
        </div>
      )}

      {typeof filter === 'object' && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-gray-400">Viewing list: <span className="font-semibold text-gray-600">{filter.name}</span></p>
          <button onClick={() => deleteList(filter.listId)} className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600">
            <Trash2 className="w-3 h-3" /> Delete list
          </button>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 animate-pulse flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-32 bg-gray-100 rounded" />
                <div className="h-2 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <UserPlus className="w-6 h-6 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-300">No clients match this view.</p>
          </div>
        ) : (
          filtered.map(c => (
            <button key={c.id} onClick={() => setDetailId(c.id)}
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
              <button onClick={(e) => toggleFavorite(c.id, e)} className="flex-shrink-0 p-0.5">
                <Star className={`w-4 h-4 ${c.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
              </button>
              <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                {c.avatar_url
                  ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-xs">{c.full_name?.[0] ?? '?'}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-800 text-sm truncate">{c.full_name}</p>
                  {c.awaiting_confirmation_count > 0 && (
                    <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                      <Clock className="w-2.5 h-2.5" /> {c.awaiting_confirmation_count}
                    </span>
                  )}
                  {c.failed_order_count > 0 && (
                    <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                      <X className="w-2.5 h-2.5" /> {c.failed_order_count} failed
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 truncate">
                  {c.order_count} order{c.order_count !== 1 ? 's' : ''} · {fmt(c.total_spent_ngn)} · joined {timeAgo(c.joined_at)}
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            </button>
          ))
        )}
      </div>

      <AnimatePresence>
        {detailId && (
          <CustomerDetail
            token={token}
            customerId={detailId}
            onClose={() => setDetailId(null)}
            onFavoriteToggled={(id, val) => setCustomers(prev => prev.map(c => c.id === id ? { ...c, is_favorite: val } : c))}
            lists={lists}
            onToggleListMember={toggleListMember}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
