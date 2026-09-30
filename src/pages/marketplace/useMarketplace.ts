import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services';

export type FeedTab = 'for_you' | 'new' | 'deals' | 'bestsellers';

export type MarketProduct = {
  id: string;
  name: string;
  image: string;
  image2: string | null;
  price: number;
  compare_at_price: number | null;
  discount_pct: number;
  category: string | null;
  niche: string | null;
  has_variants: boolean;
  store_id: string;
  store_name: string;
  store_slug: string;
  store_verified: boolean;
  sold: number;
  rating: number | null;
  review_count: number;
  created_at: string;
};

export type MarketCategory = { value: string; name: string; count: number; image: string; niches: string[] };
export type MarketNiche = { id: string; count: number; image: string };

const PAGE = 24;

type FeedArgs = { tab: FeedTab; niche: string | null; category: string | null; search: string | null };
type FeedStatus = 'idle' | 'loading' | 'error' | 'done';

// Remembers loaded pages per filter set, so coming back to /stores (e.g. from a product)
// shows the same products instantly and the scroll position can be restored.
const FEED_TTL_MS = 10 * 60 * 1000;
const feedCache = new Map<string, { items: MarketProduct[]; offset: number; status: FeedStatus; at: number }>();
const feedKey = (a: FeedArgs) => JSON.stringify([a.tab, a.niche, a.category, a.search?.trim() || null]);
function cachedFeed(a: FeedArgs) {
  const hit = feedCache.get(feedKey(a));
  return hit && Date.now() - hit.at < FEED_TTL_MS ? hit : null;
}

/** Paged product feed; call loadMore when the sentinel scrolls into view. */
export function useMarketFeed({ tab, niche, category, search }: FeedArgs) {
  const args = { tab, niche, category, search };
  const [items, setItems] = useState<MarketProduct[]>(() => cachedFeed(args)?.items ?? []);
  const [status, setStatus] = useState<FeedStatus>(() => {
    const hit = cachedFeed(args);
    return hit ? (hit.status === 'done' ? 'done' : 'idle') : 'loading';
  });
  const offset = useRef(cachedFeed(args)?.offset ?? 0);
  const reqId = useRef(0);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      const id = ++reqId.current;
      if (reset) offset.current = 0;
      const { data, error } = await supabase.rpc('marketplace_products', {
        p_tab: tab,
        p_niche: niche,
        p_category: category,
        p_search: search && search.trim() ? search.trim() : null,
        p_limit: PAGE,
        p_offset: offset.current,
      });
      if (id !== reqId.current) return; // a newer request replaced this one
      if (error) {
        console.error('marketplace_products failed', error);
        setStatus('error');
        return;
      }
      const rows = (data ?? []) as MarketProduct[];
      offset.current += rows.length;
      const nextStatus: FeedStatus = rows.length < PAGE ? 'done' : 'idle';
      const key = feedKey({ tab, niche, category, search });
      setItems((prev) => {
        const next = reset ? rows : [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))];
        feedCache.set(key, { items: next, offset: offset.current, status: nextStatus, at: Date.now() });
        return next;
      });
      setStatus(nextStatus);
    },
    [tab, niche, category, search],
  );

  // New filters: start over (or reuse what we already loaded for these filters)
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      const hit = cachedFeed({ tab, niche, category, search });
      if (hit) {
        offset.current = hit.offset;
        setItems(hit.items);
        setStatus(hit.status === 'done' ? 'done' : 'idle');
        return;
      }
      setItems([]);
      setStatus('loading');
      void fetchPage(true);
    });
    return () => {
      alive = false;
    };
  }, [fetchPage, tab, niche, category, search]);

  const loadMore = useCallback(() => {
    if (statusRef.current !== 'idle') return;
    statusRef.current = 'loading';
    setStatus('loading');
    void fetchPage(false);
  }, [fetchPage]);

  const retry = useCallback(() => {
    setStatus('loading');
    void fetchPage(items.length === 0);
  }, [fetchPage, items.length]);

  return { items, status, loadMore, retry };
}

let categoriesCache: { niches: MarketNiche[]; categories: MarketCategory[] } | null = null;

export function useMarketCategories() {
  const [data, setData] = useState(categoriesCache);
  useEffect(() => {
    if (categoriesCache) return;
    let alive = true;
    supabase.rpc('marketplace_categories').then(({ data: d, error }) => {
      if (!alive || error || !d) return;
      categoriesCache = { niches: d.niches ?? [], categories: d.categories ?? [] };
      setData(categoriesCache);
    });
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

export const naira = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString('en-NG')}`;

export const nicheLabel = (id: string) =>
  ({
    fashion: 'Fashion',
    electronics: 'Electronics',
    jewelry: 'Jewelry',
    beauty: 'Beauty',
    home: 'Home',
    magic: 'Magic & Tricks',
    sports: 'Sports',
    kids: 'Kids',
    food: 'Food',
  })[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

/** "1.2k+ sold" style counts, only for real sales */
export function soldLabel(n: number): string | null {
  if (!n || n < 1) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k+ sold`;
  if (n >= 100) return `${Math.floor(n / 100) * 100}+ sold`;
  if (n >= 10) return `${Math.floor(n / 10) * 10}+ sold`;
  return `${n} sold`;
}
