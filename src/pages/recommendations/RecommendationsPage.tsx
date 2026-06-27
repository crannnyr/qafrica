// src/pages/recommendations/RecommendationsPage.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, Minus, X, ArrowLeft,
  MessageCircle, Check, Copy, Info, Package,
  ChevronRight, Loader, ExternalLink,
} from 'lucide-react';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const WHATSAPP_NUMBER = '2348166888001';
const MIN_QTY = 20;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ImportProduct {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price_cny: number;
  price_ngn: number;
  category: string;
}

export interface CartItem extends ImportProduct {
  quantity: number;
}

export function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

// ── Cart context (simple prop-drill) ─────────────────────────────────────────
// Cart Sheet
function CartSheet({
  cart,
  onClose,
  onAdd,
  onRemove,
  onGenerate,
  isGenerating,
}: {
  cart: CartItem[];
  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onGenerate: (name: string, whatsapp: string, delivery: 'to_qafrica' | 'to_me') => void;
  isGenerating: boolean;
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
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <h2 className="font-black text-gray-900">Your Order</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Items */}
        <div className="space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-14 h-14 rounded-xl object-cover border border-gray-100 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                <p className="text-xs text-gray-400">{fmt(item.price_ngn)} · min {MIN_QTY}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => onRemove(item.id)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-black text-sm w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => onAdd(item.id)}
                  className="w-7 h-7 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Delivery */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Delivery preference
          </p>
          <div className="space-y-2">
            {[
              { key: 'to_qafrica' as const, label: 'Deliver to QAFRICA', sub: 'We receive, inspect & list on Jumia for you. +₦200/item' },
              { key: 'to_me' as const, label: 'Deliver to my address', sub: 'Shipped directly to you. Cost confirmed after.' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setDelivery(opt.key)}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-colors ${
                  delivery === opt.key ? 'border-orange-500 bg-orange-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                    delivery === opt.key ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                  }`} />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-semibold">{fmt(subtotal)}</span>
          </div>
          {delivery === 'to_qafrica' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Jumia listing fee</span>
              <span className="font-semibold">{fmt(jumiaFee)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
            <span className="font-black text-gray-900">Total</span>
            <span className="font-black text-orange-500">{fmt(total)}</span>
          </div>
          <p className="text-[10px] text-gray-400">Shipping confirmed after you send your code.</p>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your details</p>
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

      <div className="px-4 py-4 border-t border-gray-100">
        <button
          disabled={!canSubmit || isGenerating}
          onClick={() => onGenerate(name.trim(), whatsapp.trim(), delivery)}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? <Loader className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          {isGenerating ? 'Generating...' : 'Generate My Code'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Code Modal ────────────────────────────────────────────────────────────────
export function CodeModal({ code, onClose }: { code: string; onClose: () => void }) {
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
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 26 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-sm p-6"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="font-black text-gray-900 text-xl mb-1">Your Order Code</h3>
          <p className="text-gray-400 text-sm">Copy and send to us on WhatsApp</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-5 text-center mb-4">
          <p className="font-black text-4xl tracking-[0.2em] text-gray-900 mb-2">{code}</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 mx-auto text-sm text-orange-500 font-semibold"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>

        <div className="bg-orange-50 rounded-xl p-3 mb-5 flex items-start gap-2">
          <Info className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700">
            Our team will confirm your shipping cost on WhatsApp before you pay anything.
          </p>
        </div>

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-colors mb-3"
        >
          <MessageCircle className="w-5 h-5" />
          Send Code on WhatsApp
        </a>
        <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 font-medium">
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({
  product,
  cartQty,
  onAdd,
  onRemove,
  onClick,
}: {
  product: ImportProduct;
  cartQty: number;
  onAdd: () => void;
  onRemove: () => void;
  onClick: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col">
      {/* Tappable image */}
      <button onClick={onClick} className="aspect-square bg-gray-50 overflow-hidden w-full">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </button>

      <div className="p-3 flex flex-col flex-1">
        <button onClick={onClick} className="text-left flex-1 mb-2">
          <p className="font-semibold text-gray-900 text-xs leading-snug line-clamp-2">{product.name}</p>
        </button>

        <p className="font-black text-orange-500 text-sm mb-1">{fmt(product.price_ngn)}</p>
        <p className="text-[10px] text-gray-400 mb-3">Min. order: {MIN_QTY} units</p>

        {cartQty === 0 ? (
          <button
            onClick={onAdd}
            className="w-full py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        ) : (
          <div className="flex items-center justify-between bg-orange-50 rounded-xl px-2 py-1.5">
            <button
              onClick={onRemove}
              className="w-6 h-6 flex items-center justify-center text-orange-500"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-black text-orange-600 text-sm">{cartQty}</span>
            <button
              onClick={onAdd}
              className="w-6 h-6 flex items-center justify-center text-orange-500"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RecommendationsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${EDGE_URL}?action=products`)
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setIsLoading(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);

  const addToCart = (product: ImportProduct) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === product.id);
      if (exists) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: MIN_QTY }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (item.quantity <= MIN_QTY) return prev.filter(i => i.id !== id);
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
            id: i.id, name: i.name,
            price_ngn: i.price_ngn, price_cny: i.price_cny,
            quantity: i.quantity, image_url: i.image_url,
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
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link to="/importations" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-gray-900 text-sm">Catalog</span>
          </div>
          {cartCount > 0 ? (
            <button
              onClick={() => setShowCart(true)}
              className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {cartCount}
            </button>
          ) : <div className="w-16" />}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-28">
        {/* Page heading */}
        <div className="mb-5">
          <h1 className="font-black text-gray-900 text-xl">Recommended Items</h1>
          <p className="text-gray-400 text-sm mt-1 leading-relaxed">
            Products that sell best on Jumia, Konga & Jiji — all sourced from{' '}
            <a
              href="https://www.1688.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 font-semibold inline-flex items-center gap-0.5 hover:underline"
            >
              1688.com <ExternalLink className="w-3 h-3" />
            </a>
            .
          </p>
          <p className="text-xs text-gray-300 mt-2">
            These are recommendations. For the full catalog,{' '}
            <a
              href="https://www.1688.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 font-semibold hover:underline"
            >
              visit 1688.com directly →
            </a>
          </p>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Need a different colour, size, or spec? We can discuss variants for any selected item — just mention it when you send your code on WhatsApp.
          </p>
        </div>

        {/* Category filters */}
        {!isLoading && categories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeCategory === cat
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
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
          <div className="text-center py-20">
            <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">No products yet.</p>
            <p className="text-gray-300 text-xs mt-1">Check back soon.</p>
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
                onClick={() => navigate(`/recommendations/${p.id}`, { state: { product: p, products } })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating cart */}
      <AnimatePresence>
        {cartCount > 0 && !showCart && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-20 max-w-lg mx-auto"
          >
            <button
              onClick={() => setShowCart(true)}
              className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-black rounded-2xl shadow-xl flex items-center justify-between px-5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span>{cartCount} unit{cartCount !== 1 ? 's' : ''} in order</span>
              </div>
              <div className="flex items-center gap-1 text-orange-400">
                <span className="text-sm font-bold">{fmt(cartTotal)}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart sheet */}
      <AnimatePresence>
        {showCart && (
          <CartSheet
            cart={cart}
            onClose={() => setShowCart(false)}
            onAdd={id => { const p = products.find(p => p.id === id); if (p) addToCart(p); }}
            onRemove={removeFromCart}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        )}
      </AnimatePresence>

      {/* Code modal */}
      <AnimatePresence>
        {generatedCode && (
          <CodeModal code={generatedCode} onClose={() => setGeneratedCode(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
