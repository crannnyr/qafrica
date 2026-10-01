import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Package, Search, Sparkles, X } from 'lucide-react';
import CONFIG from '@/lib/config';
import type { ImportProduct } from './RecommendationsPage';
import { fmt } from './RecommendationsPage';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';

const BROWSE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-browse`;
const PAGE_SIZE = 24;
const MAX_RESULTS = 96;
const RELATED_LIMIT = 8;

type Keyword = {
  label: string;
  value: string;
  mode: 'product' | 'category';
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig');
  return <>{text.split(pattern).map((part, index) =>
    terms.some(term => part.toLowerCase() === term.toLowerCase())
      ? <mark key={index} className="rounded px-0.5 bg-orange-100 text-orange-700">{part}</mark>
      : <span key={index}>{part}</span>
  )}</>;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ProductTile({ product, query }: { product: ImportProduct; query: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(`/recommendations/${product.id}`, { state: { product } })} className="group text-left bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all">
      <div className="aspect-square bg-gray-50 overflow-hidden">
        <img src={product.image_url} alt={product.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="p-3">
        <p className="text-xs lg:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[2.25rem]"><HighlightedText text={product.name} query={query} /></p>
        <p className="mt-2 text-sm lg:text-base font-bold text-orange-500">{fmt(product.price_ngn)}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-400">
          <span className="truncate"><HighlightedText text={product.category ?? ''} query={query} /></span>
          {product.moq > 1 && <span>Min. {product.moq}</span>}
        </div>
      </div>
    </button>
  );
}

function keywordLabel(name: string) {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean.length <= 24) return clean;
  return `${clean.slice(0, 23).trimEnd()}…`;
}

export default function RecommendationsSearchPage() {
  useImportPwaManifest();
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const initialMode = params.get('type') === 'category' ? 'category' : 'product';
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [searchMode, setSearchMode] = useState<'product' | 'category'>(initialMode);
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<ImportProduct[]>([]);
  const [relatedCategory, setRelatedCategory] = useState('');
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    fetch(`${BROWSE_URL}?action=browse-products&sort=trending&limit=50`)
      .then(r => r.json())
      .then(data => {
        const trending: ImportProduct[] = shuffle(data.products ?? []);
        const next: Keyword[] = [];
        const seen = new Set<string>();
        for (const product of trending) {
          const category = product.category?.trim();
          if (!category) continue;
          const key = `category:${category.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          next.push({ label: category, value: category, mode: 'category' });
          if (next.length === 5) break;
        }
        if (next.length < 5) {
          for (const product of trending) {
            const value = product.name?.trim();
            if (!value) continue;
            const key = `product:${value.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            next.push({ label: keywordLabel(value), value, mode: 'product' });
            if (next.length === 5) break;
          }
        }
        setKeywords(shuffle(next).slice(0, 5));
      })
      .catch(() => setKeywords([]))
      .finally(() => setKeywordsLoading(false));
  }, []);

  const fetchRelated = async (items: ImportProduct[]) => {
    if (!items.length) {
      setRelatedProducts([]);
      setRelatedCategory('');
      return;
    }
    const counts = new Map<string, number>();
    for (const item of items.slice(0, 12)) {
      const category = item.category?.trim();
      if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    const category = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!category) {
      setRelatedProducts([]);
      setRelatedCategory('');
      return;
    }
    setRelatedCategory(category);
    setRelatedLoading(true);
    try {
      const url = new URL(BROWSE_URL);
      url.searchParams.set('action', 'browse-products');
      url.searchParams.set('subcategory', category);
      url.searchParams.set('limit', String(RELATED_LIMIT + 12));
      url.searchParams.set('offset', '0');
      const response = await fetch(url.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Related search failed');

      const relatedCandidates = (data.products ?? []) as ImportProduct[];
      const mainIds = new Set(items.map(item => item.id));
      const related = shuffle(relatedCandidates.filter(item => !mainIds.has(item.id))).slice(0, RELATED_LIMIT);
      setRelatedProducts(related);
    } catch {
      setRelatedProducts([]);
    } finally {
      setRelatedLoading(false);
    }
  };

  const fetchPage = async (q: string, mode: 'product' | 'category', nextOffset: number, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(false);
    try {
      const url = new URL(BROWSE_URL);
      url.searchParams.set('action', 'browse-products');
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(nextOffset));
      if (mode === 'category') {
        url.searchParams.set('subcategory', q);
      } else {
        url.searchParams.set('search', q);
        url.searchParams.set('strict_search', 'true');
      }
      const response = await fetch(url.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Search failed');
      let incoming: ImportProduct[] = data.products ?? [];
      if (mode === 'product') {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        incoming = incoming.filter(product => {
          const haystack = `${product.name ?? ''} ${product.description ?? ''}`.toLowerCase();
          return terms.every(term => haystack.includes(term));
        });
      }
      incoming = shuffle(incoming);
      const nextProducts = append ? [...products, ...incoming] : incoming;
      const deduped = Array.from(new Map(nextProducts.map(item => [item.id, item])).values());
      const capped = deduped.slice(0, MAX_RESULTS);
      const serverHasMore = Boolean(data.hasMore);
      const reachedLimit = capped.length >= MAX_RESULTS;
      setProducts(capped);
      setTotal(append ? Math.max(total, capped.length) : Number(data.total ?? capped.length));
      setOffset(nextOffset + PAGE_SIZE);
      setHasMore(!reachedLimit && serverHasMore);
      if (!append && capped.length) void fetchRelated(capped);
      if (mode === 'product' && incoming.length === 0 && serverHasMore && nextOffset + PAGE_SIZE < MAX_RESULTS && !append) {
        loadingRef.current = false;
        setIsLoading(false);
        await fetchPage(q, mode, nextOffset + PAGE_SIZE, false);
        return;
      }
    } catch {
      if (!append) {
        setProducts([]);
        setTotal(0);
        setHasMore(false);
        setRelatedProducts([]);
      }
      setError(true);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  const runSearch = (value = query, mode: 'product' | 'category' = 'product') => {
    const next = value.trim();
    if (!next) {
      setQuery('');
      setSubmittedQuery('');
      setProducts([]);
      setRelatedProducts([]);
      setRelatedCategory('');
      setTotal(0);
      setHasMore(false);
      setOffset(0);
      const nextParams = new URLSearchParams(params);
      nextParams.delete('q');
      nextParams.delete('type');
      setParams(nextParams, { replace: true });
      return;
    }
    setQuery(value);
    setSubmittedQuery(next);
    setSearchMode(mode);
    setProducts([]);
    setRelatedProducts([]);
    setRelatedCategory('');
    setTotal(0);
    setOffset(0);
    setHasMore(false);
    const nextParams = new URLSearchParams(params);
    nextParams.set('q', next);
    nextParams.set('type', mode);
    setParams(nextParams, { replace: true });
  };

  useEffect(() => {
    const next = initialQuery.trim();
    setQuery(initialQuery);
    setSubmittedQuery(next);
    setSearchMode(initialMode);
    if (!next) {
      setProducts([]);
      setRelatedProducts([]);
      setRelatedCategory('');
      setTotal(0);
      setHasMore(false);
      setOffset(0);
      return;
    }
    setProducts([]);
    setRelatedProducts([]);
    setRelatedCategory('');
    setTotal(0);
    setOffset(0);
    fetchPage(next, initialMode, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, initialMode]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !submittedQuery || !hasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !loadingRef.current) {
        fetchPage(submittedQuery, searchMode, offset, true);
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedQuery, searchMode, offset, hasMore]);

  const clearSearch = () => runSearch('', 'product');
  const title = useMemo(() => submittedQuery ? `Search results for “${submittedQuery}”` : '', [submittedQuery]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/recommendations" className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50" aria-label="Back to recommendations"><ArrowLeft className="w-4 h-4" /></Link>
          <form onSubmit={e => { e.preventDefault(); runSearch(query, 'product'); }} className="flex-1 max-w-3xl mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products…" className="w-full h-11 pl-10 pr-12 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-100" />
              {query && <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-600" aria-label="Clear search"><X className="w-4 h-4" /></button>}
            </div>
          </form>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 pt-5 pb-16">
        {!submittedQuery ? (
          <section className="py-6">
            <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-orange-500" /><h1 className="text-sm font-bold text-gray-900">Trending searches</h1></div>
            <div className="flex flex-wrap gap-2">
              {keywordsLoading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-9 w-24 rounded-full bg-white border border-gray-100 animate-pulse" />) : keywords.length ? keywords.map(keyword => <button key={`${keyword.mode}-${keyword.value}`} type="button" onClick={() => runSearch(keyword.value, keyword.mode)} className="px-4 py-2 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors">{keyword.label}</button>) : <span className="text-xs text-gray-400">No trending searches available right now.</span>}
            </div>
          </section>
        ) : (
          <div className="mb-5"><p className="text-[11px] text-gray-400 font-medium"><span className="text-gray-700 font-bold">{total.toLocaleString()}</span> result{total === 1 ? '' : 's'}</p><h1 className="text-xl lg:text-2xl font-bold text-gray-900 mt-1"><HighlightedText text={title} query={submittedQuery} /></h1></div>
        )}
        {error && submittedQuery && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">We couldn't load the search results right now. Please try again.</div>}
        {submittedQuery && isLoading && products.length === 0 ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"><div className="aspect-square bg-gray-100" /><div className="p-3 space-y-2"><div className="h-3 bg-gray-100 rounded w-4/5" /><div className="h-3 bg-gray-100 rounded w-3/5" /><div className="h-8 bg-gray-100 rounded-lg mt-3" /></div></div>)}</div> : submittedQuery && products.length === 0 ? <div className="rounded-3xl border border-gray-100 bg-white px-6 py-16 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50"><Package className="w-6 h-6 text-gray-300" /></div><h2 className="text-base font-bold text-gray-800">No products found for “{submittedQuery}”</h2><p className="mt-2 mx-auto max-w-md text-xs leading-relaxed text-gray-400">Try a more specific product name or another keyword.</p></div> : submittedQuery ? <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">{products.map(product => <ProductTile key={product.id} product={product} query={submittedQuery} />)}</div>
          <div ref={sentinelRef} className="h-20 flex items-center justify-center text-xs text-gray-400">{isLoading && products.length ? 'Loading more…' : hasMore ? '' : ''}</div>
          {(relatedLoading || relatedProducts.length > 0) && <section className="mt-10 border-t border-gray-200 pt-7"><div className="mb-4"><h2 className="text-base font-bold text-gray-900">People also search for</h2><p className="text-xs text-gray-400 mt-1">More products from {relatedCategory}.</p></div>{relatedLoading ? <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-white border border-gray-100 animate-pulse" />)}</div> : <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">{relatedProducts.map(product => <ProductTile key={product.id} product={product} query="" />)}</div>}</section>}
        </> : null}
      </main>
    </div>
  );
}
