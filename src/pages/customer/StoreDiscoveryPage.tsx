// src/pages/customer/StoreDiscoveryPage.tsx
// /stores — the public marketplace of QAFRICA stores.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Store as StoreIcon, RefreshCw } from 'lucide-react';
import { NICHE_CATEGORIES } from '@/lib/nicheCategories';
import { getLook, loadLookFonts } from '@/lib/storefrontLooks';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import SellerCallToAction from './StoreDiscovery/SellerCallToAction';
import StoreHeroCarousel from './StoreDiscovery/StoreHeroCarousel';
import MarketplaceStoreCard from './StoreDiscovery/MarketplaceStoreCard';
import { useMarketplaceStores } from './StoreDiscovery/useMarketplaceStores';

type SortBy = 'featured' | 'newest' | 'products' | 'rating';
const HERO_MAX = 6;

export default function StoreDiscoveryPage() {
  useForceLightMode();
  const { stores, status, reload } = useMarketplaceStores();
  const [query, setQuery] = useState('');
  const [niche, setNiche] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('featured');

  // Load the fonts of every look in use so store names render in their own type
  useEffect(() => {
    new Set(stores.map((s) => s.storefront_look)).forEach((id) => {
      const look = getLook(id);
      if (look) loadLookFonts(look);
    });
  }, [stores]);

  // Carousel: server order already puts verified, well-stocked stores first
  const featured = useMemo(() => stores.filter((s) => s.banner_url).slice(0, HERO_MAX), [stores]);

  // Only offer niches that listed stores actually sell in
  const niches = useMemo(() => {
    const counts = new Map<string, number>();
    stores.forEach((s) => s.niches.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1)));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({ id, name: NICHE_CATEGORIES[id]?.name ?? id.charAt(0).toUpperCase() + id.slice(1) }));
  }, [stores]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = stores.filter(
      (s) =>
        (niche === 'all' || s.niches.includes(niche)) &&
        (!q || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)),
    );
    if (sortBy === 'newest') return [...list].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    if (sortBy === 'products') return [...list].sort((a, b) => b.product_count - a.product_count);
    if (sortBy === 'rating')
      return [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.review_count - a.review_count);
    return list;
  }, [stores, niche, query, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="QAFRICA home">
            <img src="/qafrica-bag-logo.svg" alt="" className="w-7 h-7" />
            <span className="font-extrabold tracking-tight hidden sm:inline">QAFRICA</span>
          </Link>
          <div className="relative flex-1 max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stores"
              aria-label="Search stores"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-full bg-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <Link to="/signup" className="shrink-0 text-sm font-semibold text-orange-600 hover:text-orange-700">
            Sell<span className="hidden sm:inline"> on QAFRICA</span>
          </Link>
        </div>
      </header>

      {status === 'ready' && featured.length > 0 && <StoreHeroCarousel stores={featured} />}
      {status === 'loading' && <div className="h-[440px] sm:h-[420px] lg:h-[480px] bg-gray-200 animate-pulse" aria-hidden />}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shop independent stores</h1>
            <p className="text-sm text-gray-600 mt-1">Every store here is run by a seller on QAFRICA.</p>
          </div>
          {status === 'ready' && stores.length > 1 && (
            <label className="text-sm text-gray-600 flex items-center gap-2">
              Sort
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="products">Most products</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          )}
        </div>

        {niches.length > 1 && (
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 mb-6 flex gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="Filter by category">
            {[{ id: 'all', name: 'All stores' }, ...niches].map((n) => (
              <button
                key={n.id}
                type="button"
                aria-pressed={niche === n.id}
                onClick={() => setNiche(n.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                  niche === n.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                {n.name}
              </button>
            ))}
          </div>
        )}

        {status === 'loading' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Loading stores">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-16">
            <p className="text-gray-700">Stores couldn't load. Check your connection and try again.</p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-5 py-2 text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {status === 'ready' && visible.length === 0 && (
          <div className="text-center py-16">
            <StoreIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden />
            {stores.length === 0 ? (
              <p className="text-gray-700">New stores are being set up. Check back soon.</p>
            ) : (
              <>
                <p className="text-gray-700">No stores match that search.</p>
                <button
                  type="button"
                  onClick={() => { setQuery(''); setNiche('all'); }}
                  className="mt-2 text-sm font-semibold text-orange-600 underline underline-offset-4"
                >
                  Show all stores
                </button>
              </>
            )}
          </div>
        )}

        {status === 'ready' && visible.length > 0 && (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((s) => (
              <li key={s.id}>
                <MarketplaceStoreCard store={s} />
              </li>
            ))}
          </ul>
        )}

        <SellerCallToAction />
      </main>
    </div>
  );
}
