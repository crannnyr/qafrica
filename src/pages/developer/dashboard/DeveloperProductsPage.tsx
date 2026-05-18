// src/pages/developer/dashboard/DeveloperProductsPage.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, Search, Package, Edit2, Trash2,
  AlertTriangle, Loader2, X, Check, ChevronLeft,
  ChevronRight, RefreshCw, BarChart2, ToggleLeft,
  ToggleRight, ArrowUpDown,
} from 'lucide-react';
import { useDeveloperCatalogStore } from '@/stores/developerCatalogStore';
import { useDeveloperPlan }         from '@/hooks/useDeveloperPlan';
import type { CatalogProduct }      from '@/types/developer';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';

// ── Plan gate ─────────────────────────────────────────────────
function PushProductsGate() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <ShoppingBag className="w-8 h-8 text-blue-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Growth plan required</h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        Pushing your own products into QAFRICA is available on the Growth plan and above.
        Your products will appear in the catalog and can be imported by other QAFRICA sellers.
      </p>
      <a
        href="/developer/dashboard/subscription"
        className="h-11 px-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold
          rounded-xl transition-colors text-sm inline-flex items-center gap-2"
      >
        Upgrade to Growth
      </a>
    </div>
  );
}

// ── Stock update inline ───────────────────────────────────────
function StockEditor({
  current,
  onSave,
  onCancel,
}: {
  current: number;
  onSave:  (qty: number) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(String(current));

  function handleSave() {
    const qty = parseInt(val);
    if (isNaN(qty) || qty < 0) {
      toast.error('Enter a valid stock quantity (0 or more).');
      return;
    }
    onSave(qty);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        min="0"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onCancel();
        }}
        className="w-20 h-8 px-2 rounded-lg border border-orange-400 text-sm text-gray-900
          focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white text-center"
      />
      <button onClick={handleSave} className="p-1 rounded-md bg-green-100 text-green-600 hover:bg-green-200 transition-colors">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCancel} className="p-1 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Deactivate confirm ────────────────────────────────────────
function DeactivateConfirm({
  productName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
      >
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-red-500" />
        </div>
        <h2 className="font-bold text-gray-900 mb-2">Deactivate product?</h2>
        <p className="text-sm text-gray-500 mb-1">
          <strong className="text-gray-700">{productName}</strong> will no longer appear
          in the QAFRICA catalog.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Existing orders and imports referencing this product are not affected.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-11 border border-gray-200 text-gray-600 font-medium
              rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-11 bg-red-500 hover:bg-red-600 disabled:opacity-50
              text-white font-semibold rounded-xl transition-colors text-sm
              flex items-center justify-center gap-2"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Deactivating...</>
              : 'Deactivate'
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Product row ───────────────────────────────────────────────
function ProductRow({
  product,
  onEditStock,
  onDeactivate,
  editingStockId,
  setEditingStockId,
  savingStockId,
  onSaveStock,
}: {
  product: CatalogProduct;
  onEditStock: (id: string) => void;
  onDeactivate: (product: CatalogProduct) => void;
  editingStockId: string | null;
  setEditingStockId: (id: string | null) => void;
  savingStockId: string | null;
  onSaveStock: (productId: string, qty: number) => void;
}) {
  const isEditingStock = editingStockId === product.id;
  const isSavingStock  = savingStockId  === product.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4
        shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Image */}
      <div className="w-14 h-14 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0 border border-gray-100">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1">
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 flex-1">{product.name}</h3>
          {product.is_out_of_stock && (
            <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex-shrink-0">
              Out of stock
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400 mb-2 capitalize">
          {product.niche} · {product.category}
        </p>

        {/* Pricing + stock row */}
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className="text-gray-500">
            Price: <span className="font-semibold text-orange-700">₦{product.selling_price.toLocaleString()}</span>
          </span>
          <span className="text-gray-500">
            Dropship: <span className="font-semibold text-gray-800">₦{product.dropship_price.toLocaleString()}</span>
          </span>

          {/* Inline stock editor */}
          <span className="text-gray-500 flex items-center gap-1.5">
            Stock:{' '}
            {isEditingStock ? (
              <StockEditor
                current={product.stock_quantity}
                onSave={(qty) => onSaveStock(product.id, qty)}
                onCancel={() => setEditingStockId(null)}
              />
            ) : isSavingStock ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                Saving...
              </span>
            ) : (
              <button
                onClick={() => setEditingStockId(product.id)}
                className="font-semibold text-gray-800 hover:text-orange-600 hover:underline
                  transition-colors flex items-center gap-1"
              >
                {product.stock_quantity.toLocaleString()}
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </span>

          <span className="text-gray-400">
            {product.import_count} import{product.import_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setEditingStockId(product.id)}
          title="Update stock"
          className="p-2 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
        >
          <BarChart2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDeactivate(product)}
          title="Deactivate product"
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperProductsPage() {
  const {
    inboundProducts, inboundPage, inboundTotal,
    inboundLoading, inboundError,
    fetchInboundProducts, updateInboundStock, deactivateInboundProduct,
  } = useDeveloperCatalogStore();

  const { can } = useDeveloperPlan();

  const [search,          setSearch]          = useState('');
  const [editingStockId,  setEditingStockId]  = useState<string | null>(null);
  const [savingStockId,   setSavingStockId]   = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<CatalogProduct | null>(null);
  const [isDeactivating,  setIsDeactivating]  = useState(false);

  useEffect(() => {
    if (can.pushProducts) {
      fetchInboundProducts(1);
    }
  }, [can.pushProducts]);

  // ── Filter locally ────────────────────────────────────────────
  const filtered = search
    ? inboundProducts.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.niche.toLowerCase().includes(search.toLowerCase()),
      )
    : inboundProducts;

  // ── Save stock ────────────────────────────────────────────────
  async function handleSaveStock(productId: string, qty: number) {
    setEditingStockId(null);
    setSavingStockId(productId);
    const result = await updateInboundStock(productId, qty);
    setSavingStockId(null);
    if (result.success) {
      toast.success('Stock updated.');
    } else {
      toast.error(result.error ?? 'Failed to update stock.');
    }
  }

  // ── Deactivate ────────────────────────────────────────────────
  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    const result = await deactivateInboundProduct(deactivateTarget.id);
    setIsDeactivating(false);
    if (result.success) {
      toast.success(`"${deactivateTarget.name}" deactivated.`);
      setDeactivateTarget(null);
    } else {
      toast.error(result.error ?? 'Failed to deactivate product.');
    }
  }

  // ── Plan gate ─────────────────────────────────────────────────
  if (!can.pushProducts) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
          <p className="text-sm text-gray-500 mt-1">Products you have pushed into QAFRICA.</p>
        </div>
        <PushProductsGate />
      </div>
    );
  }

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
            <p className="text-sm text-gray-500 mt-1">
              {inboundTotal.toLocaleString()} product{inboundTotal !== 1 ? 's' : ''} you have pushed into QAFRICA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInboundProducts(inboundPage)}
              disabled={inboundLoading}
              className="h-9 px-4 border border-gray-200 text-gray-600 font-medium
                rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${inboundLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs font-semibold text-blue-800 mb-1">How inbound products work</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Products pushed here appear in the QAFRICA catalog and can be imported and sold by
            QAFRICA store owners. You set the selling price and dropship price. When a store
            owner sells your product, you receive the dropship price via your Paystack account.
          </p>
        </div>

        {/* Push via API notice */}
        <div className="mb-6 bg-gray-900 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800">
            <span className="text-xs text-gray-400 font-mono">Push a product via API</span>
          </div>
          <div className="px-4 py-3 text-xs font-mono text-gray-300 overflow-x-auto">
            <span className="text-blue-400">POST</span>{' '}
            <span className="text-green-400">/api-products</span>{' '}
            <span className="text-gray-500">{'{'} "name": "...", "niche": "...", "selling_price": 0 {'}'}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your products..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-sm
              text-gray-900 placeholder-gray-400 bg-white focus:outline-none
              focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Error */}
        {inboundError && (
          <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{inboundError}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {inboundLoading && inboundProducts.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 animate-pulse">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!inboundLoading && inboundProducts.length === 0 && !inboundError && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No products yet</h3>
            <p className="text-sm text-gray-500 mb-1">
              Use the API to push your products into QAFRICA.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              See the API reference above for the exact payload format.
            </p>
            <a
              href="/developer/dashboard/docs"
              className="text-sm font-semibold text-orange-600 hover:underline"
            >
              View API docs →
            </a>
          </div>
        )}

        {/* List */}
        {filtered.length > 0 && (
          <>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onEditStock={setEditingStockId}
                    onDeactivate={setDeactivateTarget}
                    editingStockId={editingStockId}
                    setEditingStockId={setEditingStockId}
                    savingStockId={savingStockId}
                    onSaveStock={handleSaveStock}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {inboundTotal > inboundProducts.length && !search && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => fetchInboundProducts(inboundPage - 1)}
                  disabled={inboundPage <= 1 || inboundLoading}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">Page {inboundPage}</span>
                <button
                  onClick={() => fetchInboundProducts(inboundPage + 1)}
                  disabled={inboundLoading}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* No search results */}
            {search && filtered.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-gray-500">No products match "{search}".</p>
                <button onClick={() => setSearch('')} className="text-sm text-orange-600 font-medium mt-1 hover:underline">
                  Clear search
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Deactivate modal */}
      <AnimatePresence>
        {deactivateTarget && (
          <DeactivateConfirm
            productName={deactivateTarget.name}
            onConfirm={handleDeactivate}
            onCancel={() => setDeactivateTarget(null)}
            isLoading={isDeactivating}
          />
        )}
      </AnimatePresence>
    </>
  );
}