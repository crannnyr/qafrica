import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services';
import type { UnifiedFeedTab, UnifiedMarketplaceProduct } from './types';

const PAGE = 24;
type FeedStatus = 'idle' | 'loading' | 'error' | 'done';
type Args = { tab: UnifiedFeedTab; niche: string | null; category: string | null; search: string | null };
const cache = new Map<string, { items: UnifiedMarketplaceProduct[]; offset: number; status: FeedStatus; at: number }>();
const keyFor = (a: Args, viewerSeed: string) => JSON.stringify([a.tab, a.niche, a.category, a.search?.trim() || null, viewerSeed]);
const cached = (a: Args, viewerSeed: string) => {
  const hit = cache.get(keyFor(a, viewerSeed));
  return hit && Date.now() - hit.at < 10 * 60 * 1000 ? hit : null;
};

const createViewerSeed = () => {
  try {
    const existing = window.localStorage.getItem('qafrica_unified_marketplace_seed');
    if (existing) return existing;
    const seed = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    window.localStorage.setItem('qafrica_unified_marketplace_seed', seed);
    return seed;
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
};

const score = (seed: string, id: string) => {
  let hash = 2166136261;
  const value = `${seed}:${id}`;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const personalize = (rows: UnifiedMarketplaceProduct[], viewerSeed: string) =>
  [...rows].sort((a, b) => score(viewerSeed, a.id) - score(viewerSeed, b.id));

export function useUnifiedMarketplaceFeed(args: Args) {
  const [viewerSeed] = useState(createViewerSeed);
  const initialCache = cached(args, viewerSeed);
  const [items, setItems] = useState<UnifiedMarketplaceProduct[]>(initialCache?.items ?? []);
  const [status, setStatus] = useState<FeedStatus>(initialCache?.status ?? 'loading');
  const offset = useRef(initialCache?.offset ?? 0);
  const request = useRef(0);
  const statusRef = useRef(status);

  useEffect(() => { statusRef.current = status; }, [status]);

  const fetchPage = useCallback(async (reset: boolean) => {
    const requestId = ++request.current;
    if (reset) offset.current = 0;
    const { data, error } = await supabase.rpc('marketplace_unified_products', {
      p_tab: args.tab,
      p_niche: args.niche,
      p_category: args.category,
      p_search: args.search?.trim() || null,
      p_limit: PAGE,
      p_offset: offset.current,
    });
    if (requestId !== request.current) return;
    if (error) {
      console.error('marketplace_unified_products failed', error);
      setStatus('error');
      return;
    }
    const rows = personalize((data ?? []) as UnifiedMarketplaceProduct[], viewerSeed);
    offset.current += rows.length;
    const nextStatus: FeedStatus = rows.length < PAGE ? 'done' : 'idle';
    const cacheKey = keyFor(args, viewerSeed);
    setItems((previous) => {
      const next = reset ? rows : [...previous, ...rows.filter((r) => !previous.some((p) => p.id === r.id))];
      cache.set(cacheKey, { items: next, offset: offset.current, status: nextStatus, at: Date.now() });
      return next;
    });
    setStatus(nextStatus);
  }, [args.tab, args.niche, args.category, args.search, viewerSeed]);

  useEffect(() => {
    const hit = cached(args, viewerSeed);
    if (hit) {
      offset.current = hit.offset;
      setItems(hit.items);
      setStatus(hit.status);
      return;
    }
    setItems([]);
    setStatus('loading');
    void fetchPage(true);
  }, [fetchPage, args.tab, args.niche, args.category, args.search, viewerSeed]);

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

export const naira = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString('en-NG')}`;

export const soldLabel = (n: number) => {
  if (!n || n < 1) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k+ sold`;
  if (n >= 100) return `${Math.floor(n / 100) * 100}+ sold`;
  if (n >= 10) return `${Math.floor(n / 10) * 10}+ sold`;
  return `${n} sold`;
};
