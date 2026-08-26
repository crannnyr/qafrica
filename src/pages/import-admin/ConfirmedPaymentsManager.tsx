// src/pages/import-admin/ConfirmedPaymentsManager.tsx
// Dedicated "Confirmed Payments" tab: every paid order, split into
// auto-confirmed (Paystack) vs manually confirmed (admin verified a bank
// transfer), filterable by date range. Each order expands to show its full
// item list (linking out to the live product), and links to the customer's
// full profile.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Calendar, ChevronDown, ExternalLink, User, Zap, Landmark,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { CustomerDetail } from './ImportAdminCustomers';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface ConfirmedOrder {
  id: string;
  code: string;
  customer_name: string;
  customer_whatsapp: string;
  customer_email?: string | null;
  user_id?: string | null;
  payment_method: 'paystack' | 'manual' | null;
  total_ngn: number;
  paid_at: string | null;
  created_at: string;
  items: Array<{
    id: string; name: string; image_url?: string; price_ngn: number; quantity: number;
    variant_options?: Record<string, string>;
  }>;
}

function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

const RANGE_PRESETS = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
] as const;

export default function ConfirmedPaymentsManager({ token }: { token: string }) {
  const [orders, setOrders] = useState<ConfirmedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<typeof RANGE_PRESETS[number]['key']>('30d');
  const [methodFilter, setMethodFilter] = useState<'all' | 'paystack' | 'manual'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const preset = RANGE_PRESETS.find(r => r.key === range)!;
      const body: any = { manager_token: token, payment_status: 'paid' };
      if (preset.days) body.date_from = new Date(Date.now() - preset.days * 86_400_000).toISOString();

      const res = await fetch(`${EDGE_URL}?action=all-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, range]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchMethod = methodFilter === 'all' || o.payment_method === methodFilter;
      const matchSearch = !search ||
        o.code.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        (o.customer_email ?? '').toLowerCase().includes(search.toLowerCase());
      return matchMethod && matchSearch;
    });
  }, [orders, methodFilter, search]);

  const autoCount = orders.filter(o => o.payment_method === 'paystack').length;
  const manualCount = orders.filter(o => o.payment_method === 'manual').length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_ngn ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Confirmed</p>
          <p className="font-black text-gray-900 text-lg leading-none">{orders.length}</p>
          <p className="text-[10px] text-gray-400 mt-1">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-1 mb-1">
            <Zap className="w-3 h-3 text-blue-400" />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Auto</p>
          </div>
          <p className="font-black text-gray-900 text-lg leading-none">{autoCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">via Paystack</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-1 mb-1">
            <Landmark className="w-3 h-3 text-emerald-400" />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Manual</p>
          </div>
          <p className="font-black text-gray-900 text-lg leading-none">{manualCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">admin verified</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1 flex-1">
          {RANGE_PRESETS.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                range === r.key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by code, name or email…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 outline-none"
        />
      </div>

      <div className="flex gap-1.5">
        {(['all', 'paystack', 'manual'] as const).map(m => (
          <button key={m} onClick={() => setMethodFilter(m)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              methodFilter === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
            {m === 'all' ? 'All' : m === 'paystack' ? 'Auto (Paystack)' : 'Manual'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-36 bg-gray-100 rounded" />
                <div className="h-2 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-300">No confirmed payments match this view.</p>
          </div>
        ) : (
          filtered.map(o => {
            const isExpanded = expandedId === o.id;
            const isAuto = o.payment_method === 'paystack';
            return (
              <div key={o.id} className="px-5 py-3.5">
                <button onClick={() => setExpandedId(isExpanded ? null : o.id)} className="w-full flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-gray-800">{o.code}</span>
                      <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        isAuto ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {isAuto ? <Zap className="w-2.5 h-2.5" /> : <Landmark className="w-2.5 h-2.5" />}
                        {isAuto ? 'Auto' : 'Manual'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">
                      {o.customer_name} · {o.paid_at ? new Date(o.paid_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-semibold text-gray-900 text-sm">{fmt(o.total_ngn)}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-50 space-y-2.5">
                    {(o.items ?? []).map((item, i) => (
                      <a key={`${item.id}-${i}`} href={`/recommendations/${item.id}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 group">
                        {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100" />}
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
                    ))}
                    {o.user_id && (
                      <button
                        onClick={() => setProfileCustomerId(o.user_id!)}
                        className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-gray-600 hover:text-orange-600 transition-colors"
                      >
                        <User className="w-3 h-3" /> View customer profile
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {profileCustomerId && (
        <CustomerDetail
          token={token}
          customerId={profileCustomerId}
          onClose={() => setProfileCustomerId(null)}
          onFavoriteToggled={() => {}}
        />
      )}
    </div>
  );
}
