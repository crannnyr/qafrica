import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, ArrowLeft, Heart,
  Minus, Plus, Check, AlertCircle, Clock,
  ChevronDown, ChevronUp, Truck, Shield, Package,
} from 'lucide-react';
import { storeService, productService, supabase } from '@/services';
import Reviews from '@/components/Reviews';
import ImageCarousel from '@/components/ImageCarousel';
import { toast } from 'sonner';
import { getThemeById } from '@/lib/themes';
import { useCartStore, useCustomerAuthStore } from '@/stores';
import type { Store as StoreType, Product, ProductVariant } from '@/types';

// ── Collapsible description ───────────────────────────────────────────────────
function CollapsibleDescription({
  text,
  maxLength = 120,
  className = '',
}: {
  text: string;
  maxLength?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const truncate = text.length > maxLength;
  return (
    <div className={className}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-500">
        {truncate && !expanded ? text.slice(0, maxLength) + '…' : text}
      </p>
      {truncate && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs font-medium text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Read more</>}
        </button>
      )}
    </div>
  );
}

// ── Dropship modal ────────────────────────────────────────────────────────────
function DropshipModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                <Package className="w-5 h-5 text-gray-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-base">Start selling on QAFRICA</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Want an affordable online store like this and resell this item? It's possible with QAFRICA — would you like to find out more?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Not now
                </button>
                <a
                  href="https://qafrica.store"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition text-center"
                  onClick={onClose}
                >
                  Visit QAFRICA
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const navigate = useNavigate();
  const { addItem, addToWishlist, removeFromWishlist, isInWishlist } = useCartStore();
  const { customer } = useCustomerAuthStore();

  const [store, setStore] = useState<StoreType | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [selectedVariantData, setSelectedVariantData] = useState<ProductVariant | null>(null);
  const [showDropshipModal, setShowDropshipModal] = useState(false);

  const [importRecord, setImportRecord] = useState<{
    selling_price: number | null;
    custom_selling_price: number | null;
    dropship_price: number;
    original_store_id: string | null;
    original_owner_id: string | null;
  } | null>(null);

  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [buyNowVariants, setBuyNowVariants] = useState<Record<string, string>>({});
  const [buyNowQty, setBuyNowQty] = useState(1);

  const theme = store?.theme ? getThemeById(store.theme) : getThemeById('modern');
  const primary = store?.primary_color || theme?.colors.primary || '#f97316';

  useEffect(() => {
    if (slug && productId) loadData();
  }, [slug, productId]);

  useEffect(() => {
    if (product?.has_variants && product.variants && selectedVariants) {
      const match = product.variants.find(v =>
        Object.entries(selectedVariants).every(([k, val]) => v.options[k] === val)
      );
      setSelectedVariantData(match || null);
      setQuantity(1);
    }
  }, [selectedVariants, product]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: storeData } = await storeService.getStoreBySlug(slug!);
      if (!storeData) { toast.error('Store not found'); navigate('/store-not-found'); return; }
      setStore(storeData as StoreType);

      const { data: productData } = await productService.getProduct(productId!);
      if (!productData) { toast.error('Product not found'); navigate(`/${slug}`); return; }
      setProduct(productData as Product);

      const { data: importData } = await supabase
        .from('import_catalog')
        .select('selling_price, custom_selling_price, dropship_price, original_store_id, original_owner_id')
        .eq('importer_store_id', storeData.id)
        .eq('original_product_id', productId!)
        .single();

      if (importData) {
        setImportRecord({
          selling_price: importData.selling_price ?? null,
          custom_selling_price: importData.custom_selling_price ?? null,
          dropship_price: importData.dropship_price ?? 0,
          original_store_id: importData.original_store_id ?? null,
          original_owner_id: importData.original_owner_id ?? null,
        });
      }

      const { data: productsData } = await productService.getStoreProducts(storeData.id);
      if (productsData) {
        setRelatedProducts(
          (productsData as Product[]).filter(p => p.id !== productId && p.is_active).slice(0, 4)
        );
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load product');
    }
    setIsLoading(false);
  };

  const getVariantOptions = (name: string) => {
    if (!product?.variants) return [];
    const opts = new Set<string>();
    product.variants.forEach(v => { if (v.options[name]) opts.add(v.options[name]); });
    return Array.from(opts);
  };

  const getVariantNames = () => {
    if (!product?.variants?.length) return [];
    return Object.keys(product.variants[0].options);
  };

  const getCurrentPrice = (): number => {
    if (selectedVariantData) return selectedVariantData.price;
    if (importRecord?.custom_selling_price != null) return importRecord.custom_selling_price;
    if (importRecord?.selling_price != null) return importRecord.selling_price;
    return product?.selling_price || 0;
  };

  const getCurrentStock = (): number => {
    if (product?.has_variants && selectedVariantData) return selectedVariantData.stock;
    return product?.stock_quantity || 0;
  };

  const handleAddToCart = (variantOverride?: Record<string, string>, qtyOverride?: number): boolean => {
    if (!product || !store) return false;
    const qty = qtyOverride ?? quantity;
    const variants = variantOverride ?? selectedVariants;

    if (product.has_variants && product.variants?.length) {
      const variantNames = getVariantNames();
      if (variantNames.length !== Object.keys(variants).length) {
        toast.error('Please select all variant options'); return false;
      }
      const match = product.variants.find(v =>
        Object.entries(variants).every(([k, val]) => v.options[k] === val)
      );
      if (!match) { toast.error('Variant combination not available'); return false; }
      if (match.stock < qty) { toast.error(`Only ${match.stock} items available`); return false; }
      addItem(product, store, qty, variants, match.price);
    } else {
      if (product.stock_quantity < qty) { toast.error(`Only ${product.stock_quantity} available`); return false; }
      const resolvedPrice = importRecord?.custom_selling_price ?? importRecord?.selling_price ?? product.selling_price;
      addItem(product, store, qty, undefined, resolvedPrice);
    }

    toast.success(`${product.name} added to cart!`);
    return true;
  };

  const handleWishlistToggle = () => {
    if (!product || !store) return;
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id, customer?.id);
      toast.success('Removed from wishlist');
    } else {
      addToWishlist(product, store, customer?.id);
      toast.success('Added to wishlist');
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (product.has_variants && product.variants?.length) {
      const allSelected = getVariantNames().every(n => selectedVariants[n]);
      if (!allSelected) {
        setBuyNowVariants({ ...selectedVariants });
        setBuyNowQty(1);
        setShowBuyNowModal(true);
        return;
      }
    }
    const success = handleAddToCart();
    if (success) navigate(`/${slug}/checkout`);
  };

  const handleBuyNowConfirm = () => {
    if (!product) return;
    if (getVariantNames().length !== Object.keys(buyNowVariants).length) {
      toast.error('Please select all variant options'); return;
    }
    const success = handleAddToCart(buyNowVariants, buyNowQty);
    if (success) { setShowBuyNowModal(false); navigate(`/${slug}/checkout`); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div
          className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: `${primary} transparent transparent transparent` }}
        />
      </div>
    );
  }

  if (!product || !store) return null;

  const variantNames = getVariantNames();
  const currentPrice = getCurrentPrice();
  const currentStock = getCurrentStock();

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to={`/${slug}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <Link to={`/${slug}`} className="flex items-center gap-2">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-7 h-7 rounded-md object-cover" />
            ) : (
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: primary }}
              >
                {store.name.charAt(0)}
              </div>
            )}
            <span className="text-sm font-semibold text-gray-900 hidden sm:block">{store.name}</span>
          </Link>

          <Link to="/cart" className="p-2 rounded-full hover:bg-gray-100 transition" aria-label="Cart">
            <ShoppingCart className="w-4 h-4 text-gray-700" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">

          {/* ── Images ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl overflow-hidden bg-gray-50"
          >
            <ImageCarousel
              images={product.images || []}
              aspectRatio="square"
              showThumbnails
              enableZoom
              className="w-full"
            />
          </motion.div>

          {/* ── Info ── */}
          <div className="flex flex-col gap-5">

            {/* Name + category */}
            <div>
              <p className="text-xs text-gray-400 mb-1">{product.category}</p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
            </div>

            {/* Price + stock */}
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold" style={{ color: primary }}>
                ₦{currentPrice.toLocaleString()}
              </span>

              {currentStock === 0 ? (
                <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> Out of stock
                </span>
              ) : currentStock <= 5 ? (
                <span className="flex items-center gap-1.5 text-xs text-orange-500 font-medium">
                  <Clock className="w-3.5 h-3.5" /> Only {currentStock} left
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                  <Check className="w-3.5 h-3.5" /> In stock
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <CollapsibleDescription text={product.description} maxLength={150} />
            )}

            <hr className="border-gray-100" />

            {/* Variant selector */}
            {product.has_variants && variantNames.length > 0 && (
              <div className="space-y-4">
                {variantNames.map(name => (
                  <div key={name}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{name}</p>
                    <div className="flex flex-wrap gap-2">
                      {getVariantOptions(name).map(option => (
                        <button
                          key={option}
                          onClick={() => setSelectedVariants(prev => ({ ...prev, [name]: option }))}
                          className="px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-all"
                          style={
                            selectedVariants[name] === option
                              ? { borderColor: primary, backgroundColor: `${primary}15`, color: primary }
                              : { borderColor: '#e5e7eb', color: '#6b7280' }
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {selectedVariantData?.sku && (
                  <p className="text-xs text-gray-400">SKU: {selectedVariantData.sku}</p>
                )}
              </div>
            )}

            {/* Quantity */}
            {currentStock > 0 && (
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Qty</p>
                <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition"
                  >
                    <Minus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                    disabled={quantity >= currentStock}
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                onClick={() => handleAddToCart()}
                disabled={currentStock === 0}
                className="flex-1 h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: primary }}
              >
                <ShoppingCart className="w-4 h-4" />
                {currentStock === 0 ? 'Out of stock' : 'Add to cart'}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={currentStock === 0}
                className="flex-1 h-12 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition"
              >
                Buy now
              </button>

              <button
                onClick={handleWishlistToggle}
                className="w-12 h-12 flex items-center justify-center rounded-xl border border-gray-200 hover:border-gray-300 transition"
                aria-label="Wishlist"
              >
                <Heart
                  className={`w-4 h-4 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                />
              </button>
            </div>

            {/* Trust row */}
            <div className="flex items-center gap-5 pt-1">
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Truck className="w-3.5 h-3.5" />
                Fast delivery
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Shield className="w-3.5 h-3.5" />
                Secure payment
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                {(store as any).delivery_window_days || 7} day delivery
              </span>
            </div>

            {/* Dropship pill */}
            <button
              onClick={() => setShowDropshipModal(true)}
              className="self-start flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1.5 transition"
            >
              <Package className="w-3 h-3" />
              Dropship this item
            </button>
          </div>
        </div>

        {/* ── Reviews ── */}
        <div className="mt-16">
          <Reviews productId={productId!} storeId={store.id} />
        </div>

        {/* ── Related products ── */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">You may also like</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              {relatedProducts.map(related => (
                <Link
                  key={related.id}
                  to={`/${slug}/product/${related.id}`}
                  className="group"
                >
                  <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden mb-3">
                    {related.images?.[0] ? (
                      <img
                        src={related.images[0]}
                        alt={related.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-200">
                        {related.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 line-clamp-1 mb-0.5">{related.name}</p>
                  <p className="text-sm font-bold" style={{ color: primary }}>
                    ₦{related.selling_price.toLocaleString()}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} {store.name} · Powered by QAFRICA</p>
        </div>
      </footer>

      {/* ── Dropship modal ── */}
      <DropshipModal open={showDropshipModal} onClose={() => setShowDropshipModal(false)} />

      {/* ── Buy Now variant modal ── */}
      <AnimatePresence>
        {showBuyNowModal && product && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowBuyNowModal(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[85vh] overflow-y-auto"
            >
              <div className="p-5">
                <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

                <div className="flex gap-4 mb-6">
                  {product.images?.[0] && (
                    <img src={product.images[0]} alt={product.name} className="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 leading-tight mb-1">{product.name}</p>
                    <p className="text-lg font-bold" style={{ color: primary }}>₦{getCurrentPrice().toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  {getVariantNames().map(name => (
                    <div key={name}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {name}
                        {!buyNowVariants[name] && <span className="ml-2 text-orange-400 normal-case font-normal">required</span>}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getVariantOptions(name).map(option => (
                          <button
                            key={option}
                            onClick={() => setBuyNowVariants(prev => ({ ...prev, [name]: option }))}
                            className="px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-all"
                            style={
                              buyNowVariants[name] === option
                                ? { borderColor: primary, backgroundColor: `${primary}15`, color: primary }
                                : { borderColor: '#e5e7eb', color: '#6b7280' }
                            }
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quantity</p>
                  <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setBuyNowQty(q => Math.max(1, q - 1))}
                      className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition"
                    >
                      <Minus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold">{buyNowQty}</span>
                    <button
                      onClick={() => setBuyNowQty(q => q + 1)}
                      className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition"
                    >
                      <Plus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBuyNowModal(false)}
                    className="flex-1 py-3 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBuyNowConfirm}
                    className="flex-1 py-3 text-sm font-semibold text-white rounded-xl transition hover:opacity-90"
                    style={{ backgroundColor: primary }}
                  >
                    Buy now
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}