// src/pages/recommendations/ProductDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ShoppingBag, Plus, Minus,
  Package, ChevronRight, Tag, ChevronDown, ChevronUp,
  Plane, Ship, HelpCircle, MessageCircleQuestion, Truck, Heart,
} from 'lucide-react';
import { fmt, buildCartKey, computeVariantPriceNgn, variantPriceRange } from './RecommendationsPage';
import type { ImportProduct, VariantGroup } from './RecommendationsPage';
import { useImportCartStore } from '@/stores/importCartStore';
import { useCustomerAuthStore } from '@/stores';
import { useSavedItems } from './useSavedItems';
import CONFIG from '@/lib/config';
import { formatSoldCount } from '@/lib/utils';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';
import AskQuestionSheet from './AskQuestionSheet';
import ImportAuthSheet from './ImportAuthSheet';
import ImportCheckoutSheet from './ImportCheckoutSheet';
import ImportReviews from '@/components/ImportReviews';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const DESC_PREVIEW_LENGTH = 80;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUsd(ngn: number, usdRate: number) {
  if (!usdRate) return null;
  return `$${(ngn / usdRate).toFixed(0)}`;
}
function fmtCny(cny: number) {
  return `¥${cny.toFixed(2)}`;
}

// ── Collapsible description ───────────────────────────────────────────────────
function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DESC_PREVIEW_LENGTH;
  const display = !isLong || expanded ? text : text.slice(0, DESC_PREVIEW_LENGTH) + '…';

  return (
    <div>
      <p className="text-gray-500 text-xs leading-relaxed">{display}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(p => !p)}
          className="flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" /> Show less</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Read more</>
          )}
        </button>
      )}
    </div>
  );
}

const VARIANT_TRUNCATE_THRESHOLD = 10;

// ── Variant selector ─────────────────────────────────────────────────────────
function VariantPicker({
  groups, selection, onSelect,
}: {
  groups: VariantGroup[];
  selection: Record<string, string>;
  onSelect: (groupName: string, option: string) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleExpanded = (groupId: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });

  return (
    <div className="space-y-4 mb-5">
      {groups.map(group => {
        const isLong = group.options.length > VARIANT_TRUNCATE_THRESHOLD;
        const isExpanded = expandedGroups.has(group.id);
        const visibleOptions = isLong && !isExpanded
          ? group.options.slice(0, VARIANT_TRUNCATE_THRESHOLD)
          : group.options;

        return (
          <div key={group.id}>
            <p className="text-xs font-semibold text-gray-700 mb-2">
              {group.name}
              {!selection[group.name] && <span className="text-red-400 font-normal"> · required</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleOptions.map(opt => {
                const delta = group.price_deltas?.[opt];
                return (
                  <button
                    key={opt}
                    onClick={() => onSelect(group.name, opt)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                      selection[group.name] === opt
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {opt}
                    {typeof delta === 'number' && delta !== 0 && (
                      <span className={selection[group.name] === opt ? 'text-gray-300' : 'text-gray-400'}>
                        {' '}{delta > 0 ? '+' : ''}{fmt(delta)}
                      </span>
                    )}
                  </button>
                );
              })}
              {isLong && (
                <button
                  onClick={() => toggleExpanded(group.id)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  {isExpanded ? 'Show less' : `+${group.options.length - VARIANT_TRUNCATE_THRESHOLD} more`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Image gallery ─────────────────────────────────────────────────────────────
function ImageGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const list = images.length > 0 ? images : [];

  // Reset active image whenever the gallery's underlying image set changes
  // (e.g. when navigating to a different product), otherwise `active` could
  // point past the end of a shorter image list.
  useEffect(() => {
    setActive(0);
  }, [images]);

  if (list.length === 0) return null;

  return (
    <div>
      {/* Main image */}
      <div className="bg-white aspect-square overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={active}
            src={list[active]}
            alt={name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>
      </div>

      {/* Thumbnails — only render if more than 1 image */}
      {list.length > 1 && (
        <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100 overflow-x-auto">
          {list.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                active === i ? 'border-gray-900' : 'border-transparent'
              }`}
            >
              <img src={src} alt={`${name} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  useImportPwaManifest();
  const { id }       = useParams<{ id: string }>();
  const location     = useLocation();
  const navigate     = useNavigate();

  const [allProducts, setAllProducts] = useState<ImportProduct[]>(
    location.state?.products ?? []
  );
  const [product, setProduct] = useState<ImportProduct | null>(
    location.state?.product ?? null
  );
  const [isLoading, setIsLoading] = useState(!product);
  const [usdRate, setUsdRate]     = useState(0);
  const [showAskQuestion, setShowAskQuestion] = useState(false);

  // Cart now lives in a shared store so it stays in sync with the catalog
  // page — no more passing it back and forth through router state.
  const cart = useImportCartStore(s => s.cart);
  const storeAddToCart = useImportCartStore(s => s.addToCart);
  const storeAddOne = useImportCartStore(s => s.addOne);
  const storeRemoveOne = useImportCartStore(s => s.removeOne);
  const { customer, isAuthenticated } = useCustomerAuthStore();
  const [showAuth, setShowAuth] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const { isSaved, toggleSave } = useSavedItems();

  const moq = product?.moq ?? 1;
  const [qty, setQty]   = useState(moq);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const variantGroups = (product?.has_variants && product?.variants?.length) ? product.variants : [];
  const allVariantsSelected = variantGroups.every(g => !!selectedVariants[g.name]);
  const cartKey = product ? buildCartKey(product.id, variantGroups.length ? selectedVariants : undefined) : '';

  // Live price reflecting whatever variants are currently selected. Once
  // every group has a selection, this is the exact final price; before that,
  // fall back to the product's overall min~max range (if variants affect
  // price at all) so the customer always sees an honest number.
  const priceRange = product ? variantPriceRange(product) : null;
  const displayPriceNgn = product
    ? (variantGroups.length && allVariantsSelected
        ? computeVariantPriceNgn(product, selectedVariants)
        : product.price_ngn)
    : 0;

  // Reset variant selection whenever the product changes
  useEffect(() => { setSelectedVariants({}); }, [id]);

  // Keep `product`/`allProducts` in sync with the route whenever `id` or the
  // navigation `state` changes. This is what makes "you may also like" clicks
  // (which navigate to the same component instance, just with a new id/state)
  // show the new product immediately instead of waiting on a reload or the
  // background fetch below to resolve.
  useEffect(() => {
    if (location.state?.product && location.state.product.id === id) {
      setProduct(location.state.product);
      setIsLoading(false);
    } else if (!product || product.id !== id) {
      // No matching state for this id yet — show a loading state until the
      // background fetch (below) resolves and finds it in allProducts.
      setProduct(null);
      setIsLoading(true);
    }

    if (location.state?.products?.length) {
      setAllProducts(location.state.products);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.state]);

  // Always fetch the full product list on mount/id-change so "also like" is
  // never empty, and so we can resolve the product when we navigated here
  // without usable state (e.g. direct link, browser back/forward, refresh).
  useEffect(() => {
    fetch(`${EDGE_URL}?action=products`)
      .then(r => r.json())
      .then(d => {
        const list: ImportProduct[] = d.products ?? [];
        setAllProducts(list);
        setProduct(prev => {
          if (prev && prev.id === id) return prev;
          const found = list.find(p => p.id === id);
          return found ?? prev;
        });
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    fetch(`${EDGE_URL}?action=rates`)
      .then(r => r.json())
      .then(d => setUsdRate(d.rates?.usdToNgn ?? 0))
      .catch(() => {});
  }, [id]);

  useEffect(() => { setQty(moq); }, [id, moq]);

  const cartCount   = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal   = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);
  const itemInCart  = product ? cart.find(i => i.cart_key === cartKey) : null;

  const addToCart = (p: ImportProduct, quantity: number, variant_selection?: Record<string, string>) => {
    const price_ngn = computeVariantPriceNgn(p, variant_selection);
    storeAddToCart(p, quantity, price_ngn, variant_selection);
  };

  const removeOne = () => {
    if (!product) return;
    storeRemoveOne(cartKey, moq);
  };

  const addOne = () => {
    if (!product) return;
    storeAddOne(cartKey);
  };

  // Opens the cart slide-out right here on the product page — no more
  // redirecting to the catalog first just to see the cart.
  const goToCart = () => {
    if (!isAuthenticated) { setShowAuth(true); return; }
    setShowCheckout(true);
  };

  // "You may also like"
  const suggested = product
    ? allProducts.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4)
    : [];
  const alsoLike = suggested.length > 0
    ? suggested
    : allProducts.filter(p => p.id !== product?.id).slice(0, 4);

  // Build image list from image_urls if available, fallback to image_url
  const images: string[] = product
    ? (product as any).image_urls?.length
      ? (product as any).image_urls
      : product.image_url ? [product.image_url] : []
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Package className="w-8 h-8 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm">Product not found.</p>
        <Link to="/recommendations" className="mt-4 text-orange-500 text-xs font-semibold">
          ← Back to catalog
        </Link>
      </div>
    );
  }

  const usdPrice = fmtUsd(product.price_ngn, usdRate);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg lg:max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <span className="font-bold text-gray-900 text-xs">Product</span>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const result = await toggleSave(product.id);
                if (result === 'needs-auth') setShowAuth(true);
              }}
              aria-label="Save item"
              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                isSaved(product.id)
                  ? 'bg-orange-50 border-orange-200 text-orange-500'
                  : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
            >
              <Heart className="w-3.5 h-3.5" fill={isSaved(product.id) ? 'currentColor' : 'none'} />
            </button>

            {cartCount > 0 ? (
              <button
                onClick={goToCart}
                className="flex items-center gap-1 bg-gray-900 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
              >
                <ShoppingBag className="w-3 h-3" />
                {cartCount}
              </button>
            ) : <div className="w-8" />}
          </div>
        </div>
      </header>

      <div className="max-w-lg lg:max-w-6xl mx-auto pb-32 lg:pb-16 lg:px-6 lg:pt-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
          {/* Image gallery — sticky on desktop so it stays visible while scrolling info */}
          <div className="lg:sticky lg:top-20 lg:rounded-2xl lg:overflow-hidden lg:border lg:border-gray-100">
            <ImageGallery images={images} name={product.name} />
          </div>

          {/* Product info */}
          <div className="bg-white px-4 pt-4 pb-5 border-b border-gray-100 lg:border lg:border-gray-100 lg:rounded-2xl lg:p-6 lg:mt-0">
          {/* Category */}
          <div className="flex items-center gap-1 mb-2">
            <Tag className="w-3 h-3 text-gray-300" />
            <span className="text-[10px] text-gray-400 font-medium">{product.category}</span>
          </div>

          {/* Name */}
          <h1 className="font-black text-gray-900 text-base leading-snug mb-3">
            {product.name}
          </h1>

          {/* Collapsible description */}
          {product.description && (
            <div className="mb-4">
              <Description key={product.id} text={product.description} />
            </div>
          )}

          {/* Tri-currency pricing */}
          <div className="mb-1">
            {priceRange && !allVariantsSelected ? (
              <p className="font-black text-orange-500 text-2xl leading-none">{fmt(priceRange.min)}~{fmt(priceRange.max)}</p>
            ) : (
              <p className="font-black text-orange-500 text-2xl leading-none">{fmt(displayPriceNgn)}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {usdPrice && (
                <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-lg">
                  {usdPrice} USD
                </span>
              )}
              <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-lg">
                {fmtCny(product.price_cny)} CNY
              </span>
              <span className="text-[10px] text-gray-400">per unit</span>
            </div>
            {!!product.units_sold && product.units_sold > 0 && (
              <p className="text-[11px] text-gray-400 font-medium mt-1">{formatSoldCount(product.units_sold)} sold</p>
            )}
          </div>

          <p className="text-[10px] text-gray-400 mt-1 mb-2">
            Sourced from verified manufacturers in China
          </p>

          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Plane className="w-3 h-3" /> Flight 20–30 days
            </span>
            <span className="text-gray-200">·</span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Ship className="w-3 h-3" /> Sea 60–90 days
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 mb-5">
            <motion.button
              onClick={() => setShowAskQuestion(true)}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-orange-500"
            >
              <MessageCircleQuestion className="w-3.5 h-3.5" />
              Ask about this product
            </motion.button>

            <motion.button
              onClick={() => navigate('/recommendations/logistics')}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-orange-500"
            >
              <Truck className="w-3.5 h-3.5" />
              Shipping calculation
            </motion.button>
          </div>

          {/* Variant selection */}
          {variantGroups.length > 0 && (
            <VariantPicker
              groups={variantGroups}
              selection={selectedVariants}
              onSelect={(groupName, option) =>
                setSelectedVariants(prev => ({ ...prev, [groupName]: option }))
              }
            />
          )}

          {/* Min order notice — only shown when the product actually has a MOQ above 1 */}
          {moq > 1 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3 mb-5 flex items-start gap-2">
              <Package className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                <span className="font-bold">Minimum order: {moq} units.</span>{' '}
                Wholesale pricing — cost shown is per unit at bulk quantity.
              </p>
            </div>
          )}

          {/* Qty selector / cart control */}
          {!itemInCart ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Quantity</p>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                  <button
                    onClick={() => setQty(q => Math.max(moq, q - 1))}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-900"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-gray-900 w-8 text-center text-sm">{qty}</span>
                  <button
                    onClick={() => setQty(q => q + 1)}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-900"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Order subtotal */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <span className="text-xs text-gray-500">Order total</span>
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-sm">{fmt(displayPriceNgn * qty)}</p>
                  {usdPrice && (
                    <p className="text-[10px] text-gray-400">
                      ≈ {fmtUsd(displayPriceNgn * qty, usdRate)} USD
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => addToCart(product, qty, variantGroups.length ? selectedVariants : undefined)}
                disabled={variantGroups.length > 0 && !allVariantsSelected}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                {variantGroups.length > 0 && !allVariantsSelected
                  ? 'Select options to continue'
                  : `Add ${qty} units to order`}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3">
                <div>
                  <span className="text-xs font-bold text-orange-700">In your order</span>
                  {itemInCart.variant_selection && (
                    <p className="text-[10px] text-orange-500 mt-0.5">
                      {Object.entries(itemInCart.variant_selection).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={removeOne} className="w-6 h-6 flex items-center justify-center text-orange-400">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-black text-orange-600 w-8 text-center text-sm">{itemInCart.quantity}</span>
                  <button onClick={addOne} className="w-6 h-6 flex items-center justify-center text-orange-400">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-gray-500">Subtotal</span>
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-sm">{fmt(itemInCart.price_ngn * itemInCart.quantity)}</p>
                  {usdPrice && (
                    <p className="text-[10px] text-gray-400">
                      ≈ {fmtUsd(itemInCart.price_ngn * itemInCart.quantity, usdRate)} USD
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        </div>

        {/* Reviews */}
        {product && <ImportReviews productId={product.id} />}

        {/* You may also like */}
        {alsoLike.length > 0 && (
          <div className="px-4 pt-6 pb-4 lg:px-0 lg:pt-14">
            <h2 className="font-bold text-gray-900 text-sm mb-3">You may also like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 lg:gap-4">
              {alsoLike.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/recommendations/${p.id}`, { state: { product: p, products: allProducts } })}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100 text-left"
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="font-medium text-gray-800 text-[11px] leading-snug line-clamp-2 mb-1.5">
                      {p.name}
                    </p>
                    <p className="font-bold text-orange-500 text-xs leading-none">{fmt(p.price_ngn)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {usdRate > 0 && (
                        <span className="text-[9px] text-gray-400">{fmtUsd(p.price_ngn, usdRate)}</span>
                      )}
                      <span className="text-gray-200 text-[9px]">·</span>
                      <span className="text-[9px] text-gray-400">{fmtCny(p.price_cny)}</span>
                    </div>
                    {(p.moq ?? 1) > 1 && <p className="text-[9px] text-gray-300 mt-0.5">Min. {p.moq} units</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating order bar — navigates back to catalog and opens the cart */}
      <AnimatePresence>
        {cartCount > 0 && !showCheckout && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-20 max-w-lg lg:max-w-xl mx-auto"
          >
            <button
              onClick={goToCart}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center justify-between px-5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>{cartCount} unit{cartCount !== 1 ? 's' : ''} · View order</span>
              </div>
              <div className="flex items-center gap-1 text-orange-400">
                <span className="text-sm font-bold">{fmt(cartTotal)}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showAskQuestion && product && (
        <AskQuestionSheet
          productId={product.id}
          productName={product.name}
          onClose={() => setShowAskQuestion(false)}
        />
      )}

      <AnimatePresence>
        {showAuth && (
          <ImportAuthSheet
            onClose={() => setShowAuth(false)}
            onSuccess={() => { setShowAuth(false); if (cartCount > 0) setShowCheckout(true); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCheckout && customer && (
          <ImportCheckoutSheet
            cart={cart} customer={customer}
            onClose={() => setShowCheckout(false)}
            onAdd={cart_key => storeAddOne(cart_key)}
            onRemove={(cart_key) => {
              const item = cart.find(i => i.cart_key === cart_key);
              storeRemoveOne(cart_key, item?.moq ?? 1);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
