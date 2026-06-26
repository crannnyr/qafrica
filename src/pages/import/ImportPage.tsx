// src/pages/import/ImportPage.tsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, Minus, Trash2, Package, Truck,
  ArrowRight, ExternalLink, Copy, Check, ChevronDown,
  BookOpen, Store, X, MessageCircle, Info
} from 'lucide-react';
import { compressImage } from '@/utils/imageCompression';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/china-import`;
const WHATSAPP_NUMBER = '2348166888001';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImportProduct {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price_cny: number;
  price_ngn: number;
  category: string;
}

interface CartItem extends ImportProduct {
  quantity: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ onViewProducts }: { onViewProducts: () => void }) {
  return (
    <section className="bg-white pt-6 pb-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">QAFRICA</span>
        </div>

        {/* Hero image */}
        <div className="rounded-2xl overflow-hidden mb-7 bg-orange-50">
          <img
            src="https://bahiqhpypapvktpxrths.supabase.co/storage/v1/object/public/product-images/0.1430543505491687.webp"
            alt="QAFRICA × 1688 — Import from China, Sell on Jumia"
            className="w-full object-cover"
          />
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-black text-gray-900 leading-tight mb-3">
          Import from China.<br />
          <span className="text-orange-500">Sell on Jumia.</span>
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-7">
          We source directly from 1688 — China's largest wholesale platform —
          and handle everything. You pick, we import, you sell.
        </p>

        {/* How it works — 3 steps */}
        <div className="space-y-3 mb-8">
          {[
            { n: '1', title: 'Pick your items', sub: 'Browse our curated selection below' },
            { n: '2', title: 'Generate your code', sub: 'Share it with us on WhatsApp' },
            { n: '3', title: 'We handle the rest', sub: 'Import, quality check, deliver' },
          ].map(s => (
            <div key={s.n} className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {s.n}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
                <p className="text-gray-400 text-xs">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onViewProducts}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            View Recommended Items
            <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            to="/marketplaces"
            className="w-full py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-center hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Store className="w-4 h-4" />
            Want to sell on Jumia?
          </Link>
        </div>

        {/* Blog note */}
        <p className="text-center text-xs text-gray-400 mt-5">
          Not sure what to import?{' '}
          <Link to="/blog" className="text-orange-500 font-semibold hover:underline">
            Read our guide →
          </Link>
        </p>
      </div>
    </section>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({
  product,
  cartQty,
  onAdd,
  onRemove,
}: {
  product: ImportProduct;
  cartQty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="aspect-square bg-gray-50 overflow-hidden">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <p className="font-semibold text-gray-900 text-sm leading-snug mb-0.5 line-clamp-2">
          {product.name}
        </p>
        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{product.description}</p>
        <p className="font-bold text-orange-500 text-base mb-3">{fmt(product.price_ngn)}</p>
        {cartQty === 0 ? (
          <button
            onClick={onAdd}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add to Order
          </button>
        ) : (
          <div className="flex items-center justify-between bg-orange-50 rounded-lg px-2 py-1.5">
            <button onClick={onRemove} className="p-1 text-orange-500 hover:text-orange-700">
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-orange-600 text-sm">{cartQty}</span>
            <button onClick={onAdd} className="p-1 text-orange-500 hover:text-orange-700">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cart Drawer ───────────────────────────────────────────────────────────────
function CartDrawer({
  cart,
  onClose,
  onRemove,
  onAdd,
  onGenerate,
}: {
  cart: CartItem[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onAdd: (id: string) => void;
  onGenerate: (name: string, whatsapp: string, delivery: 'to_qafrica' | 'to_me') => void;
}) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [delivery, setDelivery] = useState<'to_qafrica' | 'to_me'>('to_qafrica');

  const subtotal = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);
  const jumiaFee = delivery === 'to_qafrica'
    ? cart.reduce((s, i) => s + 200 * i.quantity, 0)
    : 0;
  const total = subtotal + jumiaFee;

  const canSubmit = name.trim() && whatsapp.trim() && cart.length > 0;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 text-lg">Your Order</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Items */}
        {cart.map(item => (
          <div key={item.id} className="flex items-center gap-3">
            <img src={item.image_url} alt={item.name}
              className="w-14 h-14 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
              <p className="text-xs text-gray-400">{fmt(item.price_ngn)} each</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => onRemove(item.id)}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-sm w-5 text-center">{item.quantity}</span>
              <button onClick={() => onAdd(item.id)}
                className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {/* Delivery choice */}
        <div className="mt-2">
          <p className="font-semibold text-gray-900 text-sm mb-2">Delivery preference</p>
          <div className="space-y-2">
            <button
              onClick={() => setDelivery('to_qafrica')}
              className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                delivery === 'to_qafrica' ? 'border-orange-500 bg-orange-50' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                  delivery === 'to_qafrica' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                }`} />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Deliver to QAFRICA</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    We receive, inspect & list on Jumia for you. +₦200 per item.
                  </p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setDelivery('to_me')}
              className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                delivery === 'to_me' ? 'border-orange-500 bg-orange-50' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                  delivery === 'to_me' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                }`} />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Deliver to my address</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Items shipped directly to you. Shipping cost confirmed after.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Items subtotal</span>
            <span className="font-medium">{fmt(subtotal)}</span>
          </div>
          {delivery === 'to_qafrica' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Jumia listing fee (₦200/item)</span>
              <span className="font-medium">{fmt(jumiaFee)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm pt-1.5 border-t border-gray-200">
            <span className="font-bold text-gray-900">Total (excl. shipping)</span>
            <span className="font-bold text-orange-500">{fmt(total)}</span>
          </div>
          <p className="text-[10px] text-gray-400">
            Shipping cost will be confirmed by our team after you send your code.
          </p>
        </div>

        {/* User details */}
        <div className="space-y-3">
          <p className="font-semibold text-gray-900 text-sm">Your details</p>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
          />
          <input
            type="tel"
            placeholder="WhatsApp number (e.g. 08012345678)"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <button
          disabled={!canSubmit}
          onClick={() => onGenerate(name.trim(), whatsapp.trim(), delivery)}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Generate My Code
        </button>
      </div>
    </motion.div>
  );
}

// ── Code Modal ────────────────────────────────────────────────────────────────
function CodeModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const message = encodeURIComponent(
    `Hi QAFRICA! My import order code is: *${code}*\nPlease help me process this order.`
  );
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center px-4 pb-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 26 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-sm p-6"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="font-black text-gray-900 text-xl mb-1">Your Order Code</h3>
          <p className="text-gray-400 text-sm">Copy this code and send it to us on WhatsApp</p>
        </div>

        {/* Code display */}
        <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
          <p className="font-black text-4xl tracking-widest text-gray-900 mb-2">{code}</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 mx-auto text-sm text-orange-500 font-semibold"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>

        <div className="bg-orange-50 rounded-xl p-3 mb-5 text-xs text-orange-700 flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Our team will confirm your shipping cost on WhatsApp before you pay anything.</span>
        </div>

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors mb-3"
        >
          <MessageCircle className="w-5 h-5" />
          Send Code on WhatsApp
        </a>
        <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-400 font-medium">
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ImportPage() {
  const productsRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    fetch(`${EDGE_URL}?action=products`)
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setIsLoadingProducts(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const addToCart = (product: ImportProduct) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === product.id);
      if (exists) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (item.quantity === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const handleGenerate = async (
    name: string,
    whatsapp: string,
    delivery: 'to_qafrica' | 'to_me'
  ) => {
    setIsGenerating(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          customer_whatsapp: whatsapp,
          delivery_type: delivery,
          items: cart.map(i => ({
            id: i.id,
            name: i.name,
            price_ngn: i.price_ngn,
            price_cny: i.price_cny,
            quantity: i.quantity,
            image_url: i.image_url,
          })),
        }),
      });
      const data = await res.json();
      if (data.code) {
        setGeneratedCode(data.code);
        setShowCart(false);
        setCart([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky nav */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">QAFRICA Import</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/blog" className="text-xs text-gray-500 hover:text-orange-500 font-medium flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Blog
          </Link>
          {cartCount > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {cartCount} item{cartCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <Hero onViewProducts={() => productsRef.current?.scrollIntoView({ behavior: 'smooth' })} />

      {/* Products section */}
      <div ref={productsRef} className="px-4 py-8 max-w-lg mx-auto">
        {/* 1688 banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-0.5">All items sourced from 1688</p>
            <p className="text-xs text-blue-500 leading-relaxed">
              China's largest wholesale platform. Already familiar with ordering there?{' '}
              <a
                href="https://www.1688.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline inline-flex items-center gap-0.5"
              >
                Visit 1688.com <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        <h2 className="font-black text-gray-900 text-xl mb-1">Recommended Items</h2>
        <p className="text-gray-400 text-sm mb-5">
          Hand-picked trending products. Add to your order below.
        </p>

        {/* Category filters */}
        {categories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        {isLoadingProducts ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-8 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No products yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                cartQty={cart.find(i => i.id === p.id)?.quantity ?? 0}
                onAdd={() => addToCart(p)}
                onRemove={() => removeFromCart(p.id)}
              />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            className="fixed bottom-6 left-4 right-4 z-20"
          >
            <button
              onClick={() => setShowCart(true)}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              View Order ({cartCount} item{cartCount !== 1 ? 's' : ''})
            </button>
          </motion.div>
        )}
      </div>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <CartDrawer
            cart={cart}
            onClose={() => setShowCart(false)}
            onRemove={removeFromCart}
            onAdd={id => {
              const p = products.find(p => p.id === id);
              if (p) addToCart(p);
            }}
            onGenerate={handleGenerate}
          />
        )}
      </AnimatePresence>

      {/* Code modal */}
      <AnimatePresence>
        {generatedCode && (
          <CodeModal
            code={generatedCode}
            onClose={() => setGeneratedCode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
