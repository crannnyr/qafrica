// src/pages/developer/dashboard/DeveloperImportsPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Search, Package, Trash2, Edit2,
  Check, X, Loader2, ChevronLeft, ChevronRight,
  AlertTriangle, RefreshCw, ToggleLeft, ToggleRight,
  ExternalLink,
} from 'lucide-react';
import { useDeveloperCatalogStore } from '@/stores/developerCatalogStore';
import type { DeveloperImport } from '@/types/developer';
import { toast } from 'sonner';

// ── Status badge ──────────────────────────────────────────────
function SyncBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    synced:      { label: 'Synced',      cls: 'bg-green-100 text-green-700' },
    out_of_sync: { label: 'Out of sync', cls: 'bg-amber-100 text-amber-700' },
    removed:     { label: 'Removed',     cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] ?? map.synced;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Edit price modal ──────────────────────────────────────────
function EditPriceModal({
  imp,
  onSave,
  onClose,
  isSaving,
}: {
  imp: DeveloperImport;
  onSave: (id: string, price: number) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [price, setPrice] = useState(
    String(imp.custom_selling_price ?? imp.selling_price),
  );
  const [error, setError] = useState('');

  function handleSave() {
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid price.');
      return;
    }
    if (parsed <= imp.dropship_price) {
      setError(`Price must be above your cost (₦${imp.dropship_price.toLocaleString()}).`);
      return;
    }
    onSave(imp.id, parsed);
  }

  const margin = parseFloat(price) > 0 ? parseFloat(price) - imp.dropship_price : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Set Custom Price</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{imp.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Price info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Your cost</p>
              <p className="text-sm font-bold text-gray-900">
                ₦{imp.dropship_price.toLocaleString()}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-xs text-orange-500">QAFRICA price</p>
              <p className="text-sm font-bold text-orange-700">
                ₦{imp.selling_price.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Your selling price (₦) <span className="text-orange-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setError(''); }}
              min={imp.dropship_price + 1}
              step="100"
              autoFocus
              className={`w-full h-11 px-4 rounded-xl border text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                transition-colors
                ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
            />
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            {!error && parseFloat(price) > imp.dropship_price && (
              <p className="text-xs text-green-600 mt-1.5">
                Your margin: ₦{margin.toLocaleString()}
                {' '}(+{Math.round((margin / imp.dropship_price) * 100)}%)
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-11 border border-gray-200 text-gray-600 font-medium
                rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-11 bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                text-white font-semibold rounded-xl transition-colors text-sm
                flex items-center justify-center gap-2"
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                : <><Check className="w-4 h-4" /> Save price</>
              }
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Remove confirm ────────────────────────────────────────────
function RemoveConfirm({
  impName,
  onConfirm,
  onCancel,
  isRemoving,
}: {
  impName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isRemoving: boolean;
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
        <h2 className="font-bold text-gray-900 mb-2">Remove import?</h2>
        <p className="text-sm text-gray-500 mb-6">
          <strong className="text-gray-700">{impName}</strong> will be removed from your
          catalog. Active orders are not affected.
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
            disabled={isRemoving}
            className="flex-1 h-11 bg-red-500 hover:bg-red-600 disabled:opacity-50
              text-white font-semibold rounded-xl transition-colors text-sm
              flex items-center justify-center gap-2"
          >
            {isRemoving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing...</>
              : 'Remove'
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Import row ────────────────────────────────────────────────
function ImportRow({
  imp,
  onEdit,
  onRemove,
  onToggle,
  isUpdating,
  isRemoving,
}: {
  imp: DeveloperImport;
  onEdit: (imp: DeveloperImport) => void;
  onRemove: (imp: DeveloperImport) => void;
  onToggle: (imp: DeveloperImport) => void;
  isUpdating: boolean;
  isRemoving: boolean;
}) {
  const effectivePrice = imp.custom_selling_price ?? imp.selling_price;
  const margin         = effectivePrice - imp.dropship_price;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-all
        ${!imp.is_active ? 'opacity-60 border-gray-100' : 'border-gray-100 shadow-sm hover:shadow-md'}`}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0 border border-gray-100">
        {imp.images?.[0] ? (
          <img
            src={imp.images[0]}
            alt={imp.name}
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
        <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{imp.name}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <SyncBadge status={imp.sync_status} />
            {imp.custom_selling_price && (
              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Custom price
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-2">
          {imp.original_store?.name ?? 'QAFRICA Store'} · {imp.niche}
        </p>

        {/* Pricing row */}
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className="text-gray-500">
            Cost: <span className="font-semibold text-gray-800">₦{imp.dropship_price.toLocaleString()}</span>
          </span>
          <span className="text-gray-500">
            Your price: <span className="font-semibold text-orange-700">₦{effectivePrice.toLocaleString()}</span>
          </span>
          <span className={`font-semibold ${margin > 0 ? 'text-green-600' : 'text-red-500'}`}>
            Margin: ₦{margin.toLocaleString()}
          </span>
          <span className="text-gray-400">
            Stock: {imp.original_product?.stock_quantity?.toLocaleString() ?? imp.stock_quantity}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Toggle active */}
        <button
          onClick={() => onToggle(imp)}
          disabled={isUpdating}
          title={imp.is_active ? 'Pause import' : 'Activate import'}
          className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {isUpdating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : imp.is_active
            ? <ToggleRight className="w-4 h-4 text-green-500" />
            : <ToggleLeft className="w-4 h-4" />
          }
        </button>

        {/* Edit price */}
        <button
          onClick={() => onEdit(imp)}
          title="Set custom price"
          className="p-2 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>

        {/* Remove */}
        <button
          onClick={() => onRemove(imp)}
          disabled={isRemoving}
          title="Remove import"
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {isRemoving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Trash2 className="w-4 h-4" />
          }
        </button>
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperImportsPage() {
  const navigate = useNavigate();
  const {
    imports, importsPage, importsTotal, importsPages,
    importsLoading, importsError,
    updatingId, removingId,
    fetchImports, updateImport, removeImport,
  } = useDeveloperCatalogStore();

  const [search,       setSearch]       = useState('');
  const [editTarget,   setEditTarget]   = useState<DeveloperImport | null>(null);
  const [removeTarget, setRemoveTarget] = useState<DeveloperImport | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isRemoving,   setIsRemoving]   = useState(false);

  useEffect(() => {
    fetchImports(1);
  }, []);

  // ── Filter locally by search ──────────────────────────────────
  const filtered = search
    ? imports.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.niche.toLowerCase().includes(search.toLowerCase()),
      )
    : imports;

  // ── Edit price ────────────────────────────────────────────────
  async function handleSavePrice(importId: string, price: number) {
    setIsSaving(true);
    const result = await updateImport(importId, { custom_selling_price: price });
    setIsSaving(false);
    if (result.success) {
      toast.success('Price updated.');
      setEditTarget(null);
    } else {
      toast.error(result.error ?? 'Failed to update price.');
    }
  }

  // ── Toggle active ─────────────────────────────────────────────
  async function handleToggle(imp: DeveloperImport) {
    const result = await updateImport(imp.id, { is_active: !imp.is_active });
    if (result.success) {
      toast.success(imp.is_active ? 'Import paused.' : 'Import activated.');
    } else {
      toast.error(result.error ?? 'Failed to update import.');
    }
  }

  // ── Remove ────────────────────────────────────────────────────
  async function handleRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);
    const result = await removeImport(removeTarget.id);
    setIsRemoving(false);
    if (result.success) {
      toast.success(`"${removeTarget.name}" removed from your catalog.`);
      setRemoveTarget(null);
    } else {
      toast.error(result.error ?? 'Failed to remove import.');
    }
  }

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Imports</h1>
            <p className="text-sm text-gray-500 mt-1">
              {importsTotal.toLocaleString()} product{importsTotal !== 1 ? 's' : ''} in your developer catalog.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchImports(importsPage)}
              disabled={importsLoading}
              className="h-9 px-4 border border-gray-200 text-gray-600 font-medium
                rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${importsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/developer/dashboard/catalog')}
              className="h-9 px-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold
                rounded-xl transition-colors text-sm flex items-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Browse catalog
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your imports..."
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
        {importsError && (
          <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{importsError}</p>
          </div>
        )}

        {/* Loading */}
        {importsLoading && imports.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
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
        {!importsLoading && imports.length === 0 && !importsError && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Download className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No imports yet</h3>
            <p className="text-sm text-gray-500 mb-5">
              Browse the catalog and import products to get started.
            </p>
            <button
              onClick={() => navigate('/developer/dashboard/catalog')}
              className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold
                rounded-xl transition-colors text-sm inline-flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Browse catalog
            </button>
          </div>
        )}

        {/* List */}
        {filtered.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((imp) => (
                <ImportRow
                  key={imp.id}
                  imp={imp}
                  onEdit={setEditTarget}
                  onRemove={setRemoveTarget}
                  onToggle={handleToggle}
                  isUpdating={updatingId === imp.id}
                  isRemoving={removingId === imp.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* No search results */}
        {search && filtered.length === 0 && imports.length > 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-500">No imports match "{search}".</p>
            <button onClick={() => setSearch('')} className="text-sm text-orange-600 font-medium mt-1 hover:underline">
              Clear search
            </button>
          </div>
        )}

        {/* Pagination */}
        {importsPages > 1 && !search && (
          <div className="flex items-center justify-between mt-8">
            <p className="text-sm text-gray-500">{importsTotal} total</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchImports(importsPage - 1)}
                disabled={importsPage <= 1 || importsLoading}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
                  text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-700 px-2">
                {importsPage} / {importsPages}
              </span>
              <button
                onClick={() => fetchImports(importsPage + 1)}
                disabled={importsPage >= importsPages || importsLoading}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
                  text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {editTarget && (
          <EditPriceModal
            imp={editTarget}
            onSave={handleSavePrice}
            onClose={() => setEditTarget(null)}
            isSaving={isSaving}
          />
        )}
        {removeTarget && (
          <RemoveConfirm
            impName={removeTarget.name}
            onConfirm={handleRemove}
            onCancel={() => setRemoveTarget(null)}
            isRemoving={isRemoving}
          />
        )}
      </AnimatePresence>
    </>
  );
}