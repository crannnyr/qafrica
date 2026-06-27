// src/pages/recommendations/ProductDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ShoppingBag, Plus, Minus,
  Package, ExternalLink, ChevronRight, Tag,
} from 'lucide-react';
import { CartItem, CodeModal, ImportProduct, fmt } from './RecommendationsPage';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const WHATSAPP_NUMBER = '2348166888001';
const MIN_QTY = 20;

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Products may come via navigation state (instant) or be fetched
  const [allProducts, setAllProducts] = useState<ImportProduct[]>(
    location.state?.products ?? []
  );
  const [product, setProduct] = useState<ImportProduct | null>(
    location.state?.product ?? null
  );
  const [isLoading, setIsLoading] = useState(!product);

  // Cart — isolated per session on this page, shared via navigate state back
  const [cart, setCart] = useState<CartItem[]>([]);
  const [qty, setQty] = useState(MIN_QTY);
  const [showCode, setShowCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
  }, [id]);

  // Reset qty when product changes
  useEffect(() => { setQty(MIN_QTY); }, [id]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);

  const itemInCart = product ? cart.find(i => i.id === product.id) : null;

  const addToCart = (p: ImportProduct, quantity: number) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === p.id);
      if (exists) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { ...p, quantity }];
    });
  };

  // "You may also like" — same category, exclude current
  const suggested = product
    ? allProducts.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4)
    : [];

  // Fallback to any products if same-category is empty
  const alsoLike = suggested.length > 0
    ? suggested
    : allProducts.filter(p => p.id !== product?.id).slice(0, 4);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Package className="w-10 h-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm">Product not found.</p>
        <Link to="/recommendations" className="mt-4 text-orange-500 text-sm font-semibold">
          ← Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <span className="font-black text-gray-900 text-sm">Product</span>

          {cartCount > 0 ? (
            <Link
              to="/recommendations"
              state={{ cartFromDetail: cart }}
              className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {cartCount}
            </Link>
          ) : <div className="w-16" />}
        </div>
      </header>

      <div className="max-w-lg mx-auto pb-32">
        {/* Product image */}
        <div className="bg-white aspect-square overflow-hidden">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product info */}
        <div className="bg-white px-4 pt-5 pb-6 border-b border-gray-100">
          {/* Category pill */}
          <div className="flex items-center gap-1.5 mb-3">
            <Tag className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400 font-medium">{product.category}</span>
          </div>

          <h1 className="font-black text-gray-900 text-lg leading-snug mb-3">
            {product.name}
          </h1>

          {product.description && (
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              {product.description}
            </p>
          )}

          {/* Price block */}
          <div className="flex items-end gap-3 mb-1">
            <span className="font-black text-orange-500 text-2xl">{fmt(product.price_ngn)}</span>
            <span className="text-gray-400 text-sm mb-0.5">per unit</span>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Sourced from{' '}
            <a
              href="https://www.1688.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 font-semibold inline-flex items-center gap-0.5 hover:underline"
            >
              1688.com <ExternalLink className="w-3 h-3" />
            </a>
          </p>

          {/* Min order notice */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
            <Package className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              <span className="font-bold">Minimum order: {MIN_QTY} units.</span>{' '}
              This is a wholesale import — pricing is per unit at bulk quantity.
            </p>
          </div>

          {/* Qty selector */}
          {!itemInCart ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700">Quantity</p>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                  <button
                    onClick={() => setQty(q => Math.max(MIN_QTY, q - 1))}
                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-black text-gray-900 w-10 text-center text-sm">{qty}</span>
                  <button
                    onClick={() => setQty(q => q + 1)}
                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-sm text-gray-500">Order total</span>
                <span className="font-black text-gray-900">{fmt(product.price_ngn * qty)}</span>
              </div>
              <button
                onClick={() => addToCart(product, qty)}
                className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add {qty} units to order
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-orange-700">In your order</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCart(prev => {
                      const item = prev.find(i => i.id === product.id);
                      if (!item) return prev;
                      if (item.quantity <= MIN_QTY) return prev.filter(i => i.id !== product.id);
                      return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity - 1 } : i);
                    })}
                    className="w-7 h-7 flex items-center justify-center text-orange-500"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-black text-orange-600 w-10 text-center">{itemInCart.quantity}</span>
                  <button
                    onClick={() => setCart(prev => prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))}
                    className="w-7 h-7 flex items-center justify-center text-orange-500"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="font-black text-gray-900">{fmt(product.price_ngn * itemInCart.quantity)}</span>
              </div>
            </div>
          )}
        </div>

        {/* You may also like */}
        {alsoLike.length > 0 && (
          <div className="px-4 pt-7 pb-4">
            <h2 className="font-black text-gray-900 text-base mb-4">You may also like</h2>
            <div className="grid grid-cols-2 gap-3">
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
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-xs leading-snug line-clamp-2 mb-1">{p.name}</p>
                    <p className="font-black text-orange-500 text-sm">{fmt(p.price_ngn)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Min. {MIN_QTY} units</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating order bar — only when cart has items */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-20 max-w-lg mx-auto"
          >
            <Link
              to="/recommendations"
              state={{ cartFromDetail: cart }}
              className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-black rounded-2xl shadow-xl flex items-center justify-between px-5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span>{cartCount} unit{cartCount !== 1 ? 's' : ''} · View order</span>
              </div>
              <div className="flex items-center gap-1 text-orange-400">
                <span className="text-sm font-bold">{fmt(cartTotal)}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
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
