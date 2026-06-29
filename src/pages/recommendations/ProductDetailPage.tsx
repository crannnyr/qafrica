// src/pages/recommendations/ProductDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ShoppingBag, Plus, Minus,
  Package, ExternalLink, ChevronRight, Tag, ChevronDown, ChevronUp,
} from 'lucide-react';
import { CodeModal, fmt } from './RecommendationsPage';
import type { CartItem, ImportProduct } from './RecommendationsPage';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const MIN_QTY  = 20;
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

// ── Image gallery ─────────────────────────────────────────────────────────────
function ImageGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const list = images.length > 0 ? images : [];

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

  // Cart state — lives here, passed back to RecommendationsPage via navigate state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [qty, setQty]   = useState(MIN_QTY);

  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Fetch if we didn't get state
  useEffect(() => {
    if (!product || allProducts.length === 0) {
      setIsLoading(true);
      fetch(`${EDGE_URL}?action=products`)
        .then(r => r.json())
        .then(d => {
          const list: ImportProduct[] = d.products ?? [];
          setAllProducts(list);
          const found = list.find(p => p.id === id);
          if (found) setProduct(found);
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }

    fetch(`${EDGE_URL}?action=rates`)
      .then(r => r.json())
      .then(d => setUsdRate(d.rates?.usdToNgn ?? 0))
      .catch(() => {});
  }, [id]);

  useEffect(() => { setQty(MIN_QTY); }, [id]);

  const cartCount   = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal   = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);
  const itemInCart  = product ? cart.find(i => i.id === product.id) : null;

  const addToCart = (p: ImportProduct, quantity: number) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === p.id);
      if (exists) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { ...p, quantity }];
    });
  };

  const removeOne = () => {
    if (!product) return;
    setCart(prev => {
      const item = prev.find(i => i.id === product.id);
      if (!item) return prev;
      if (item.quantity <= MIN_QTY) return prev.filter(i => i.id !== product.id);
      return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const addOne = () => {
    if (!product) return;
    setCart(prev => prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
  };

  // Navigate back to catalog — pass cart so it can be restored
  const goToCart = () => {
    navigate('/recommendations', { state: { cartFromDetail: cart } });
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
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <span className="font-bold text-gray-900 text-xs">Product</span>

          {cartCount > 0 ? (
            <button
              onClick={goToCart}
              className="flex items-center gap-1 bg-gray-900 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
            >
              <ShoppingBag className="w-3 h-3" />
              {cartCount}
            </button>
          ) : <div className="w-14" />}
        </div>
      </header>

      <div className="max-w-lg mx-auto pb-32">
        {/* Image gallery */}
        <ImageGallery images={images} name={product.name} />

        {/* Product info */}
        <div className="bg-white px-4 pt-4 pb-5 border-b border-gray-100">
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
              <Description text={product.description} />
            </div>
          )}

          {/* Tri-currency pricing */}
          <div className="mb-1">
            <p className="font-black text-orange-500 text-2xl leading-none">{fmt(product.price_ngn)}</p>
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
          </div>

          <p className="text-[10px] text-gray-400 mt-1 mb-5">
            Sourced from{' '}
            <a
              href="https://www.1688.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 font-semibold inline-flex items-center gap-0.5 hover:underline"
            >
              1688.com <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>

          {/* Min order notice */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3 mb-5 flex items-start gap-2">
            <Package className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              <span className="font-bold">Minimum order: {MIN_QTY} units.</span>{' '}
              Wholesale pricing — cost shown is per unit at bulk quantity.
            </p>
          </div>

          {/* Qty selector / cart control */}
          {!itemInCart ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Quantity</p>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                  <button
                    onClick={() => setQty(q => Math.max(MIN_QTY, q - 1))}
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
                  <p className="font-bold text-gray-900 text-sm">{fmt(product.price_ngn * qty)}</p>
                  {usdPrice && (
                    <p className="text-[10px] text-gray-400">
                      ≈ {fmtUsd(product.price_ngn * qty, usdRate)} USD
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => addToCart(product, qty)}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add {qty} units to order
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3">
                <span className="text-xs font-bold text-orange-700">In your order</span>
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
                  <p className="font-bold text-gray-900 text-sm">{fmt(product.price_ngn * itemInCart.quantity)}</p>
                  {usdPrice && (
                    <p className="text-[10px] text-gray-400">
                      ≈ {fmtUsd(product.price_ngn * itemInCart.quantity, usdRate)} USD
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* You may also like */}
        {alsoLike.length > 0 && (
          <div className="px-4 pt-6 pb-4">
            <h2 className="font-bold text-gray-900 text-sm mb-3">You may also like</h2>
            <div className="grid grid-cols-2 gap-2.5">
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
                    <p className="text-[9px] text-gray-300 mt-0.5">Min. {MIN_QTY} units</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating order bar — navigates back to catalog and opens the cart */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-20 max-w-lg mx-auto"
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

      <AnimatePresence>
        {generatedCode && (
          <CodeModal code={generatedCode} onClose={() => setGeneratedCode(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
