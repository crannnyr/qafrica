// src/pages/developer/dashboard/DeveloperCatalogPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, Package, Download,
  Check, Loader2, ChevronLeft, ChevronRight,
  X, AlertTriangle, ArrowUpDown, Star,
} from 'lucide-react';
import { useDeveloperCatalogStore } from '@/stores/developerCatalogStore';
import { useDeveloperPlan }         from '@/hooks/useDeveloperPlan';
import type { CatalogProduct }      from '@/types/developer';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';

// ── Debounce hook ─────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Product card ──────────────────────────────────────────────
function ProductCard({
  product,
  isImported,
  isImporting,
  canImport,
  onImport,
}: {
  product:    CatalogProduct;
  isImported: boolean;
  isImporting: boolean;
  canImport:  boolean;
  onImport:   (product: CatalogProduct) => void;
}) {
  const margin = product.selling_price - product.dropship_price;
  const marginPct = product.dropship_price > 0
    ? Math.round((margin / product.dropship_price) * 100)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
        hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col"
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iI2E3YWFiMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIGltYWdlPC90ZXh0Pjwvc3ZnPg==';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.is_out_of_stock && (
            <span className="text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full">
              Out of stock
            </span>
          )}
          {isImported && (
            <span className="text-xs font-semibold bg-green-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> Imported
            </span>
          )}
        </div>

        {/* Margin badge */}
        {marginPct > 0 && (
          <div className="absolute top-2 right-2">
            <span className="text-xs font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full">
              +{marginPct}%
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-gray-400 mb-1 capitalize">{product.niche} · {product.category}</p>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-3 line-clamp-2">
          {product.name}
        </h3>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-2 mb-3 mt-auto">
          <div className="bg-gray-50 rounded-xl p-2.5">
            <p className="text-xs text-gray-400">You pay</p>
            <p className="text-sm font-bold text-gray-900">
              ₦{product.dropship_price.toLocaleString()}
            </p>
          </div>
          <div className="bg-orange-50 rounded-xl p-2.5">
            <p className="text-xs text-orange-500">Customer pays</p>
            <p className="text-sm font-bold text-orange-700">
              ₦{product.selling_price.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
          <span>Stock: {product.stock_quantity.toLocaleString()}</span>
          <span>{product.import_count} import{product.import_count !== 1 ? 's' : ''}</span>
        </div>

        {/* Store */}
        <p className="text-xs text-gray-400 truncate mb-3">
          by <span className="font-medium text-gray-600">{product.store?.name}</span>
        </p>

        {/* Import button */}
        {isImported ? (
          <div className="h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 text-sm font-semibold gap-1.5">
            <Check className="w-3.5 h-3.5" /> Already imported
          </div>
        ) : !canImport ? (
          <div className="h-9 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 text-xs font-medium gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Starter plan required
          </div>
        ) : (
          <button
            onClick={() => onImport(product)}
            disabled={isImporting || product.is_out_of_stock}
            className="h-9 flex items-center justify-center rounded-xl bg-orange-500
              hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-semibold text-sm gap-1.5 transition-colors"
          >
            {isImporting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...</>
              : <><Download className="w-3.5 h-3.5" /> Import</>
            }
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Pagination ────────────────────────────────────────────────
function Pagination({
  page, pages, total, onPage,
}: {
  page: number; pages: number; total: number; onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-8">
      <p className="text-sm text-gray-500">{total.toLocaleString()} products</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
            text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-700 px-2">
          {page} / {pages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
            text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperCatalogPage() {
  const {
    catalogProducts, catalogPage, catalogTotal, catalogPages,
    catalogLoading, catalogError, catalogFilters,
    niches, nichesLoading,
    importedProductIds, importingId,
    fetchCatalog, fetchNiches, importProduct,
  } = useDeveloperCatalogStore();

  const { can } = useDeveloperPlan();

  // ── Local filter state ────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(catalogFilters.search ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounce(searchInput, 400);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    fetchCatalog({ page: 1 });
    fetchNiches();
    // Also load imports so importedProductIds is populated
    useDeveloperCatalogStore.getState().fetchImports(1);
  }, []);

  // ── Debounced search ──────────────────────────────────────────
  useEffect(() => {
    fetchCatalog({ search: debouncedSearch || undefined, page: 1 });
  }, [debouncedSearch]);

  // ── Filter handlers ───────────────────────────────────────────
  function applyNiche(niche: string) {
    const current = catalogFilters.niche;
    fetchCatalog({
      niche:    current === niche ? undefined : niche,
      category: undefined,
      page:     1,
    });
  }

  function applyInStock(val: boolean | undefined) {
    fetchCatalog({ in_stock: val, page: 1 });
  }

  function clearAllFilters() {
    setSearchInput('');
    fetchCatalog({ niche: undefined, category: undefined, search: undefined, in_stock: undefined, page: 1 });
  }

  // ── Import handler ────────────────────────────────────────────
  async function handleImport(product: CatalogProduct) {
    const result = await importProduct(product.id);
    if (result.success) {
      toast.success(`"${product.name}" added to your imports.`);
    } else {
      toast.error(result.error ?? 'Import failed. Please try again.');
    }
  }

  const hasActiveFilters = !!(
    catalogFilters.niche ||
    catalogFilters.category ||
    catalogFilters.search ||
    catalogFilters.in_stock !== undefined
  );

  return (
    <div className="flex h-full">
      {/* ── Filter sidebar ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-gray-100 bg-white overflow-y-auto">
        <div className="px-4 py-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Niches</p>
          {nichesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={() => applyNiche('')}
                className={`w-full text-left text-sm px-3 py-2 rounded-xl transition-colors flex items-center justify-between ${
                  !catalogFilters.niche
                    ? 'bg-orange-50 text-orange-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                All niches
                <span className="text-xs text-gray-400">{catalogTotal}</span>
              </button>
              {niches.map((n) => {
                const nicheInfo = CONFIG.NICHES.find((cn: any) => cn.id === n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => applyNiche(n.id)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-xl transition-colors flex items-center justify-between ${
                      catalogFilters.niche === n.id
                        ? 'bg-orange-50 text-orange-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{nicheInfo?.name ?? n.id}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                      {n.importable_product_count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Availability</p>
            <div className="space-y-1">
              {[
                { label: 'All products', value: undefined },
                { label: 'In stock only', value: true },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => applyInStock(opt.value)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-xl transition-colors ${
                    catalogFilters.in_stock === opt.value
                      ? 'bg-orange-50 text-orange-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {catalogTotal.toLocaleString()} importable products from QAFRICA stores.
              </p>
            </div>
          </div>

          {/* Search + filter bar */}
          <div className="flex gap-3 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products..."
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-sm
                  text-gray-900 placeholder-gray-400 bg-white focus:outline-none
                  focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile filter toggle */}
            <button
              onClick={() => setShowFilters((f) => !f)}
              className="lg:hidden h-10 px-4 border border-gray-200 rounded-xl text-sm
                font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-orange-500" />
              )}
            </button>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="h-10 px-4 border border-orange-200 text-orange-600 rounded-xl
                  text-sm font-medium hover:bg-orange-50 flex items-center gap-2 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>

          {/* Mobile filter drawer */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-5 lg:hidden"
              >
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Niches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {niches.map((n) => {
                      const nicheInfo = CONFIG.NICHES.find((cn: any) => cn.id === n.id);
                      return (
                        <button
                          key={n.id}
                          onClick={() => applyNiche(n.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            catalogFilters.niche === n.id
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'border-gray-200 text-gray-600 hover:border-orange-300'
                          }`}
                        >
                          {nicheInfo?.name ?? n.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Plan gate for imports */}
          {!can.createImports && (
            <div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Starter plan required to import</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You can browse the catalog on a Free plan. To import products and create orders,{' '}
                  <a href="/developer/dashboard/subscription" className="font-semibold underline">
                    upgrade to Starter
                  </a>.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {catalogError && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{catalogError}</p>
            </div>
          )}

          {/* Loading skeleton */}
          {catalogLoading && catalogProducts.length === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="aspect-square bg-gray-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-8 bg-gray-100 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!catalogLoading && catalogProducts.length === 0 && !catalogError && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-800 mb-1">No products found</h3>
              <p className="text-sm text-gray-500 mb-4">
                Try adjusting your filters or search term.
              </p>
              <button
                onClick={clearAllFilters}
                className="text-sm font-medium text-orange-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Grid */}
          {catalogProducts.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {catalogProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isImported={importedProductIds.has(product.id)}
                    isImporting={importingId === product.id}
                    canImport={can.createImports}
                    onImport={handleImport}
                  />
                ))}
              </div>

              <Pagination
                page={catalogPage}
                pages={catalogPages}
                total={catalogTotal}
                onPage={(p) => fetchCatalog({ page: p })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}