// src/pages/import-admin/TrendingManager.tsx
// Admin tab for managing the recommendations page's Trending section: shows
// every product with its trending state, lets admin manually pin/unpin any
// product (up to 20), and a "Refresh" button that tops up remaining slots
// with best-sellers via the auto_refresh_trending DB function — manual picks
// are never touched by the refresh.
import { useState, useEffect, useCallback } from 'react';
import { Loader, TrendingUp, RefreshCw, Search, Star, Zap } from 'lucide-react';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/trending-admin`;

interface TrendingProduct {
  id: string;
  name: string;
  image_url: string;
  category: string;
  units_sold: number;
  is_active: boolean;
  is_trending: boolean;
  trending_order: number;
  trending_source: 'manual' | 'auto';
  created_at: string;
}

export default function TrendingManager({ token }: { token: string }) {
  const [products, setProducts] = useState<TrendingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      setProducts(data.products ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const trendingCount = products.filter(p => p.is_trending).length;

  const toggleTrending = async (p: TrendingProduct) => {
    setTogglingId(p.id);
    const nextValue = !p.is_trending;
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_trending: nextValue, trending_source: nextValue ? 'manual' : x.trending_source } : x));
    try {
      await fetch(`${EDGE_URL}?action=set-trending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, product_id: p.id, is_trending: nextValue }),
      });
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const autoRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${EDGE_URL}?action=auto-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, target_count: 20 }),
      });
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = products.filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span className="font-semibold text-gray-800 text-sm">Trending</span>
            <span className="text-[11px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
              {trendingCount} / 20
            </span>
          </div>
          <button
            onClick={autoRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 px-3 py-2 rounded-xl transition-colors"
          >
            {refreshing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
          Pin specific products to trending, or hit Refresh to auto-fill any empty slots with your current
          best-sellers. Manually pinned products are never removed by Refresh.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:border-gray-400 outline-none"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 animate-pulse flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-36 bg-gray-100 rounded" />
                <div className="h-2 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-300">No products found.</p>
          </div>
        ) : (
          filtered.map(p => (
            <div key={p.id} className="px-5 py-3 flex items-center gap-3">
              <img src={p.image_url} alt={p.name}
                className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">{p.category}</span>
                  {!!p.units_sold && (
                    <span className="text-[10px] text-gray-400">{p.units_sold.toLocaleString()} sold</span>
                  )}
                  {p.is_trending && p.trending_source === 'manual' && (
                    <span className="flex items-center gap-0.5 text-[10px] text-orange-500 font-medium">
                      <Star className="w-2.5 h-2.5 fill-orange-400 text-orange-400" /> Pinned
                    </span>
                  )}
                  {p.is_trending && p.trending_source === 'auto' && (
                    <span className="flex items-center gap-0.5 text-[10px] text-blue-500 font-medium">
                      <Zap className="w-2.5 h-2.5" /> Auto
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleTrending(p)}
                disabled={togglingId === p.id}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${
                  p.is_trending ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {togglingId === p.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : p.is_trending ? 'Remove' : 'Add'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
