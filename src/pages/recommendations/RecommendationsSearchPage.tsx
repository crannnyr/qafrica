import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Package, Search, X, Sparkles } from 'lucide-react';
import CONFIG from '@/lib/config';
import type { ImportProduct } from './RecommendationsPage';
import { fmt } from './RecommendationsPage';
import SEO from '@/components/SEO';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';

const BROWSE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-browse`;
const PAGE_SIZE = 24;
const MAX_RESULTS = 96;
const RECOMMENDED_LIMIT = 50;
const RELATED_LIMIT = 8;

type SearchKeyword = { label: string; value: string; mode: 'product' | 'category'; filter: 'parent' | 'subcategory' };

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig');
  return <>{text.split(pattern).map((part, index) => terms.some(term => part.toLowerCase() === term.toLowerCase()) ? <mark key={index} className="rounded px-0.5 bg-orange-100 text-orange-700">{part}</mark> : <span key={index}>{part}</span>)}</>;
}

function ProductTile({ product, query }: { product: ImportProduct; query: string }) {
  const image = product.image_url;
  return (
    <Link to={`/recommendations/${product.id}`} state={{ product }} className="group text-left bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all">
      <div className="aspect-square bg-gray-50 overflow-hidden">
        {image ? <img src={image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-200" /></div>}
      </div>
      <div className="p-3">
        <p className="text-xs lg:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[2.25rem]"><HighlightedText text={product.name} query={query} /></p>
        <p className="mt-2 text-sm lg:text-base font-bold text-orange-500">{fmt(product.price_ngn)}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-400"><span className="truncate"><HighlightedText text={product.category ?? ''} query={query} /></span>{product.moq > 1 && <span>Min. {product.moq}</span>}</div>
      </div>
    </Link>
  );
}

export default function RecommendationsSearchPage() {
  useImportPwaManifest();
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const initialMode = params.get('type') === 'category' ? 'category' : 'product';
  const initialFilter = params.get('filter') === 'parent' ? 'parent' : 'subcategory';
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [searchMode, setSearchMode] = useState<'product' | 'category'>(initialMode);
  const [categoryFilter, setCategoryFilter] = useState<'parent' | 'subcategory'>(initialFilter);
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<ImportProduct[]>([]);
  const [relatedCategory, setRelatedCategory] = useState('');
  const [keywords, setKeywords] = useState<SearchKeyword[]>([]);
  const [total, setTotal] = useState(0);
  // Set when the server fixed a typo, e.g. "sneeker" -> "sneakers".
  const [corrected, setCorrected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<ImportProduct[]>([]);
  const [recommendedOffset, setRecommendedOffset] = useState(0);
  const [recommendedHasMore, setRecommendedHasMore] = useState(true);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const recommendedLoadingRef = useRef(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadKeywords = async () => {
      setKeywordsLoading(true);
      try {
        const url = new URL(BROWSE_URL);
        url.searchParams.set('action', 'browse-products');
        url.searchParams.set('limit', '50');
        url.searchParams.set('offset', '0');
        const response = await fetch(url.toString());
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Keyword load failed');
        const source = (data.products ?? []) as (ImportProduct & { parent_category?: string | null })[];
        const candidates = new Map<string, SearchKeyword>();
        source.forEach(product => {
          const add = (raw: string | null | undefined, filter: 'parent' | 'subcategory') => {
            const value = raw?.trim();
            if (!value) return;
            const key = `${filter}:${value.toLowerCase()}`;
            if (!candidates.has(key)) candidates.set(key, { label: value, value, mode: 'category', filter });
          };
          add(product.parent_category, 'parent');
          add(product.category, 'subcategory');
        });
        setKeywords(shuffle([...candidates.values()]).slice(0, 5));
      } catch {
        setKeywords([]);
      } finally {
        setKeywordsLoading(false);
      }
    };
    if (!initialQuery.trim()) void loadKeywords();
  }, [initialQuery]);

  const fetchRelated = async (items: ImportProduct[]) => {
    const categoryCounts = new Map<string, number>();
    items.forEach(item => { if (item.category) categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1); });
    const category = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!category) return;
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
      const mainIds = new Set(items.map(item => item.id));
      const candidates = (data.products ?? []) as ImportProduct[];
      const related = shuffle(candidates.filter(item => !mainIds.has(item.id))).slice(0, RELATED_LIMIT);
      setRelatedProducts(related);
    } catch {
      setRelatedProducts([]);
    } finally {
      setRelatedLoading(false);
    }
  };

  const fetchPage = async (q: string, mode: 'product' | 'category', nextOffset: number, append: boolean, filter: 'parent' | 'subcategory' = categoryFilter) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(false);
    try {
      const url = new URL(BROWSE_URL);
      url.searchParams.set('action', 'browse-products');
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String(nextOffset));
      if (mode === 'category') url.searchParams.set(filter, q);
      else url.searchParams.set('search', q);
      const response = await fetch(url.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Search failed');
      // Search results arrive ranked by relevance — keep that order. Only plain
      // category browsing is shuffled.
      const fetched = (data.products ?? []) as ImportProduct[];
      const incoming = mode === 'category' ? shuffle(fetched) : fetched;
      if (!append) setCorrected(mode === 'product' && typeof data.corrected === 'string' ? data.corrected : null);
      const nextProducts = append ? [...products, ...incoming] : incoming;
      const deduped = Array.from(new Map(nextProducts.map(item => [item.id, item])).values());
      const capped = deduped.slice(0, MAX_RESULTS);
      const serverHasMore = Boolean(data.hasMore);
      const reachedLimit = capped.length >= MAX_RESULTS;
      setProducts(capped);
      setTotal(append ? Math.max(total, Number(data.total ?? capped.length)) : Number(data.total ?? capped.length));
      setOffset(nextOffset + PAGE_SIZE);
      setHasMore(!reachedLimit && serverHasMore);
      if (!append && capped.length) void fetchRelated(capped);
    } catch {
      if (!append) { setProducts([]); setTotal(0); setHasMore(false); setRelatedProducts([]); }
      setError(true);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  const fetchRecommended = async (nextOffset = 0, append = false) => {
    if (recommendedLoadingRef.current || nextOffset >= RECOMMENDED_LIMIT) return;
    recommendedLoadingRef.current = true;
    setRecommendedLoading(true);
    try {
      const url = new URL(BROWSE_URL);
      url.searchParams.set('action', 'browse-products');
      url.searchParams.set('limit', String(Math.min(PAGE_SIZE, RECOMMENDED_LIMIT - nextOffset)));
      url.searchParams.set('offset', String(nextOffset));
      const response = await fetch(url.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Recommendations failed');
      const incoming = shuffle((data.products ?? []) as ImportProduct[]);
      const nextProducts = append ? [...recommendedProducts, ...incoming] : incoming;
      const deduped = Array.from(new Map(nextProducts.map(item => [item.id, item])).values()).slice(0, RECOMMENDED_LIMIT);
      setRecommendedProducts(deduped);
      const next = nextOffset + incoming.length;
      setRecommendedOffset(next);
      setRecommendedHasMore(next < RECOMMENDED_LIMIT && Boolean(data.hasMore) && incoming.length > 0);
    } catch {
      if (!append) setRecommendedProducts([]);
      setRecommendedHasMore(false);
    } finally {
      recommendedLoadingRef.current = false;
      setRecommendedLoading(false);
    }
  };

  const runSearch = (value = query, mode: 'product' | 'category' = 'product', filter: 'parent' | 'subcategory' = categoryFilter) => {
    const next = value.trim();
    setQuery(value);
    setSubmittedQuery(next);
    setSearchMode(mode);
    setCategoryFilter(filter);
    const nextParams = new URLSearchParams();
    if (next) nextParams.set('q', next);
    if (mode === 'category') nextParams.set('type', 'category');
    if (mode === 'category') nextParams.set('filter', filter);
    setParams(nextParams, { replace: true });
    setOffset(0);
    setProducts([]);
    setRelatedProducts([]);
    setTotal(0);
    setHasMore(false);
    setRecommendedProducts([]);
    setRecommendedOffset(0);
    setRecommendedHasMore(true);
    void fetchPage(next, mode, 0, false, filter);
  };

  useEffect(() => {
    const next = initialQuery.trim();
    setQuery(initialQuery);
    setSubmittedQuery(next);
    setSearchMode(initialMode);
    setCategoryFilter(initialFilter);
    setOffset(0);
    setProducts([]);
    setRelatedProducts([]);
    setTotal(0);
    setHasMore(false);
    setRecommendedProducts([]);
    setRecommendedOffset(0);
    setRecommendedHasMore(true);
    if (next) void fetchPage(next, initialMode, 0, false, initialFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, initialMode, initialFilter]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !loadingRef.current) void fetchPage(submittedQuery, searchMode, offset, true, categoryFilter);
    }, { rootMargin: '500px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, offset, submittedQuery, searchMode, categoryFilter]);

  useEffect(() => {
    if (submittedQuery) return;
    setRecommendedProducts([]);
    setRecommendedOffset(0);
    setRecommendedHasMore(true);
    void fetchRecommended(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedQuery]);

  useEffect(() => {
    if (submittedQuery || !recommendedHasMore || !recommendedProducts.length || !sentinelRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !recommendedLoadingRef.current) void fetchRecommended(recommendedOffset, true);
    }, { rootMargin: '600px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedQuery, recommendedHasMore, recommendedOffset, recommendedProducts.length]);

  const clearSearch = () => {
    setQuery('');
    const nextParams = new URLSearchParams(params);
    nextParams.delete('q');
    nextParams.delete('type');
    nextParams.delete('filter');
    setParams(nextParams, { replace: true });
  };

  const title = useMemo(() => submittedQuery ? `Search results for “${submittedQuery}”` : 'What are you looking for?', [submittedQuery]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search result pages are thin/duplicate content, so they are kept out of the index. */}
      <SEO
        title={submittedQuery ? `"${submittedQuery}" — Search products from China` : 'Search products from China'}
        description={submittedQuery
          ? `Results for "${submittedQuery}" — products sourced direct from China, priced in naira and delivered to Nigeria.`
          : 'Search thousands of products sourced direct from China, priced in naira and delivered to Nigeria.'}
        url={`${window.location.origin}/recommendations`}
        keywords={['buy from China', 'China import Nigeria', 'QAFRICA']}
        noindex
      />
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/recommendations" className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50" aria-label="Back to recommendations"><ArrowLeft className="w-4 h-4" /></Link>
          <form role="search" aria-label="Search products" onSubmit={e => { e.preventDefault(); runSearch(); }} className="flex-1 max-w-3xl mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-300 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input autoFocus type="search" aria-label="Search products" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products…" className="w-full h-11 pl-10 pr-12 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-100" />
              {query && <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-600" aria-label="Clear search"><X className="w-4 h-4" /></button>}
            </div>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-5 pb-16">
        {!submittedQuery ? (
          <section className="pt-2">
            <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-orange-500" /><h1 className="text-base font-bold text-gray-900">Trending searches</h1></div>
            {keywordsLoading ? <div className="flex flex-wrap gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 w-20 rounded-full bg-white border border-gray-100 animate-pulse" />)}</div> : <div className="flex flex-wrap gap-2">{keywords.map(keyword => <button key={`${keyword.filter}:${keyword.value}`} type="button" onClick={() => runSearch(keyword.value, keyword.mode, keyword.filter)} className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-gray-300">{keyword.label}</button>)}</div>}
            <div className="mt-10">
              <div className="mb-4">
                <h2 className="text-base lg:text-lg font-bold text-gray-900">Recommended products</h2>
                <p className="text-xs text-gray-400 mt-0.5">A selection of products you might like.</p>
              </div>
              {recommendedProducts.length === 0 && recommendedLoading ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"><div className="aspect-square bg-gray-100" /><div className="p-3 space-y-2"><div className="h-3 bg-gray-100 rounded w-4/5" /><div className="h-3 bg-gray-100 rounded w-3/5" /></div></div>)}</div> : recommendedProducts.length > 0 ? <><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">{recommendedProducts.map(product => <ProductTile key={product.id} product={product} query="" />)}</div><div ref={sentinelRef} className="h-10" />{recommendedLoading && <div className="py-6 text-center text-xs text-gray-400">Loading more recommended products…</div>}{!recommendedLoading && !recommendedHasMore && <p className="py-6 text-center text-xs text-gray-400">You’ve reached the end of the recommendations.</p>}</> : <div className="rounded-2xl border border-gray-100 bg-white px-5 py-10 text-center text-xs text-gray-400">No recommendations available right now.</div>}
            </div>
          </section>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
              <div><p role="status" aria-live="polite" className="text-[11px] text-gray-400 font-medium"><span className="text-gray-700 font-bold">{total.toLocaleString()}</span> result{total === 1 ? '' : 's'}</p><h1 className="text-xl lg:text-2xl font-bold text-gray-900 mt-1"><HighlightedText text={title} query={submittedQuery} /></h1></div>
            </div>
            {corrected && !error && products.length > 0 && <p className="mb-4 text-xs text-gray-500">No exact match for “{submittedQuery}”. Showing results for <span className="font-bold text-gray-800">{corrected}</span>.</p>}
            {error && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600"><span>We couldn't load the search results. Check your connection and try again.</span><button type="button" onClick={() => void fetchPage(submittedQuery, searchMode, products.length > 0 ? offset : 0, products.length > 0, categoryFilter)} className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white hover:bg-red-700">Try again</button></div>}
            {isLoading && products.length === 0 ? <div role="status" aria-label="Loading search results" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"><div className="aspect-square bg-gray-100" /><div className="p-3 space-y-2"><div className="h-3 bg-gray-100 rounded w-4/5" /><div className="h-3 bg-gray-100 rounded w-3/5" /><div className="h-8 bg-gray-100 rounded-lg mt-3" /></div></div>)}</div> : products.length === 0 ? error ? null : <div className="rounded-3xl border border-gray-100 bg-white px-6 py-16 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50"><Package className="w-6 h-6 text-gray-300" /></div><h2 className="text-base font-bold text-gray-800">No products found for “{submittedQuery}”</h2><p className="mt-2 mx-auto max-w-md text-xs leading-relaxed text-gray-400">Try a more specific product name or another keyword.</p></div> : <><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">{products.map(product => <ProductTile key={product.id} product={product} query={submittedQuery} />)}</div>{relatedProducts.length > 0 && <section className="mt-10"><div className="mb-3"><h2 className="text-base font-bold text-gray-900">People also search for</h2><p className="text-xs text-gray-400 mt-0.5">More from {relatedCategory}</p></div><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">{relatedProducts.map(product => <ProductTile key={product.id} product={product} query="" />)}</div></section>}{relatedLoading && <div className="mt-10 text-center text-xs text-gray-400">Finding related products…</div>}<div ref={sentinelRef} className="h-10" />{isLoading && products.length > 0 && <div className="py-6 text-center text-xs text-gray-400">Loading more…</div>}</>}
          </>
        )}
      </main>
    </div>
  );
}
