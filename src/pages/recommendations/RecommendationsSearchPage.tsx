import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Package, Search, SlidersHorizontal, X } from 'lucide-react';
import CONFIG from '@/lib/config';
import type { ImportProduct } from './RecommendationsPage';
import { fmt } from './RecommendationsPage';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';

const BROWSE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-browse`;
const PAGE_SIZE = 24;

function ProductTile({ product }: { product: ImportProduct }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(`/recommendations/${product.id}`, { state: { product } })} className="group text-left bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all">
      <div className="aspect-square bg-gray-50 overflow-hidden">
        <img src={product.image_url} alt={product.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="p-3">
        <p className="text-xs lg:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[2.25rem]">{product.name}</p>
        <p className="mt-2 text-sm lg:text-base font-bold text-orange-500">{fmt(product.price_ngn)}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-400">
          <span className="truncate">{product.category}</span>
          {product.moq > 1 && <span>Min. {product.moq}</span>}
        </div>
      </div>
    </button>
  );
}

export default function RecommendationsSearchPage() {
  useImportPwaManifest();
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [categories, setCategories] = useState<{ parent: string; subcategories: string[] }[]>([]);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    fetch(`${BROWSE_URL}?action=categories`)
      .then(r => r.json())
      .then(d => setCategories(d.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  const search = (q: string, nextOffset = 0, append = false) => {
    const url = new URL(BROWSE_URL);
    url.searchParams.set('action', 'browse-products');
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(nextOffset));
    const trimmed = q.trim();
    if (trimmed) url.searchParams.set('search', trimmed);
    if (category !== 'All') url.searchParams.set('parent', category);

    setIsLoading(true);
    setError(false);
    fetch(url.toString())
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Search failed');
        return data;
      })
      .then(data => {
        setProducts(prev => append ? [...prev, ...(data.products ?? [])] : (data.products ?? []));
        setTotal(Number(data.total ?? 0));
        setOffset(nextOffset);
      })
      .catch(() => {
        if (!append) {
          setProducts([]);
          setTotal(0);
        }
        setError(true);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    const next = initialQuery.trim();
    setQuery(initialQuery);
    setSubmittedQuery(next);
    setOffset(0);
    search(next, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, category]);

  const runSearch = () => {
    const next = query.trim();
    const nextParams = new URLSearchParams(params);
    if (next) nextParams.set('q', next);
    else nextParams.delete('q');
    setParams(nextParams, { replace: true });
  };

  const clearSearch = () => {
    setQuery('');
    const nextParams = new URLSearchParams(params);
    nextParams.delete('q');
    setParams(nextParams, { replace: true });
  };

  const canLoadMore = products.length < total;
  const title = useMemo(
    () => submittedQuery ? `Results for “${submittedQuery}”` : 'Search the import catalogue',
    [submittedQuery]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/recommendations" className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50" aria-label="Back to recommendations">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <form onSubmit={e => { e.preventDefault(); runSearch(); }} className="flex-1 max-w-3xl mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products, categories and more…" className="w-full h-11 pl-10 pr-20 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-100" />
              {query && <button type="button" onClick={clearSearch} className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-600" aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>}
              <button type="submit" className="absolute right-1.5 top-1.5 h-8 px-3 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-800">Search</button>
            </div>
          </form>
          <Link to="/recommendations" className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900">
            Back <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-5 pb-16">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-500 mb-1">QAFRICA Import</p>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-1 text-xs lg:text-sm text-gray-400">
              {submittedQuery
                ? `${total.toLocaleString()} matching item${total === 1 ? '' : 's'}`
                : 'Find products from the same catalogue used on Recommendations.'}
            </p>
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
              </div>
              {['All', ...categories.map(c => c.parent)].map(parent => (
                <button key={parent} type="button" onClick={() => setCategory(parent)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-colors ${category === parent
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {parent}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">We couldn't load the search results right now. Please try again.</div>}

        {isLoading && products.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-4/5" />
                  <div className="h-3 bg-gray-100 rounded w-3/5" />
                  <div className="h-8 bg-gray-100 rounded-lg mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
              <Package className="w-6 h-6 text-gray-300" />
            </div>
            <h2 className="text-base font-bold text-gray-800">
              {submittedQuery ? `No products found for “${submittedQuery}”` : 'Start with a product search'}
            </h2>
            <p className="mt-2 mx-auto max-w-md text-xs leading-relaxed text-gray-400">
              {submittedQuery
                ? 'Try a broader word such as phone, shoe, bag or charger. You can also request a custom order from Recommendations.'
                : 'Search by product name, category or a common keyword to explore the import catalogue.'}
            </p>
            {submittedQuery && (
              <Link to="/custom-order" className="inline-flex items-center gap-2 mt-5 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800">
                Request a custom order <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">
              {products.map(product => <ProductTile key={product.id} product={product} />)}
            </div>
            {canLoadMore && (
              <div className="flex justify-center pt-8">
                <button type="button" disabled={isLoading} onClick={() => search(submittedQuery, offset + PAGE_SIZE, true)}
                  className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:border-gray-300 disabled:opacity-50">
                  {isLoading ? 'Loading…' : `Load more (${Math.max(total - products.length, 0).toLocaleString()} left)`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
