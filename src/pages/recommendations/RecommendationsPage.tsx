// src/pages/recommendations/RecommendationsPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, Minus, Package,
  ChevronRight, Search, X, User, LogOut, LayoutDashboard,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { useCustomerAuthStore } from '@/stores';
import { useImportCartStore, buildImportCartKey } from '@/stores/importCartStore';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';
import DailyPromoModal from './DailyPromoModal';
import ImportAuthSheet from './ImportAuthSheet';
import ImportCheckoutSheet from './ImportCheckoutSheet';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const JUMIA_AFFILIATE_URL = 'https://jforce.jumia.com.ng/s/C6tCHzq';

// ── Jumia promo bar ──────────────────────────────────────────────────────
// Sits above the search bar (same width). The message rotates every 4 hours —
// the "slot" is derived from the current time so it's consistent across
// reloads and every visitor in the same 4h window sees the same message.
const JUMIA_PROMO_MESSAGES = [
  'Visit our shop on Jumia →',
  'Check out this new item on Jumia →',
  'Shop from our Jumia store →',
  'Buy this now from Jumia →',
  'Great deals waiting on Jumia →',
  'New arrivals just dropped on Jumia →',
];

function JumiaPromoBar() {
  const getSlotIndex = () => Math.floor(Date.now() / (4 * 60 * 60 * 1000)) % JUMIA_PROMO_MESSAGES.length;
  const [slot, setSlot] = useState(getSlotIndex());

  useEffect(() => {
    const id = setInterval(() => setSlot(getSlotIndex()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <a
      href={JUMIA_AFFILIATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 px-3 py-2.5 mb-2 shadow-sm hover:brightness-105 transition-[filter]"
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={slot}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
          className="block text-center text-white text-[11px] lg:text-xs font-bold tracking-tight"
        >
          {JUMIA_PROMO_MESSAGES[slot]}
        </motion.span>
      </AnimatePresence>
    </a>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface VariantGroup {
  id: string;
  name: string;      // e.g. "Color", "Size", or a custom name
  options: string[]; // e.g. ["Red", "Blue"]
  price_deltas?: Record<string, number>; // option value -> NGN price adjustment vs base price; missing/absent = 0
}

export interface ImportProduct {
  id: string;
  name: string;
  description: string;
  image_url: string;
  image_urls?: string[];
  price_cny: number;
  price_ngn: number;
  price_usd?: number;
  category: string;
  moq: number;
  has_variants?: boolean;
  variants?: VariantGroup[];
  units_sold?: number;
  is_trending?: boolean;
  trending_order?: number;
  created_at?: string;
}

export interface CartItem extends ImportProduct {
  quantity: number;
  variant_selection?: Record<string, string>;
  cart_key: string;
}

// Builds the cart dedupe key: same product + same variant selection = same line.
export function buildCartKey(productId: string, selection?: Record<string, string>) {
  if (!selection || Object.keys(selection).length === 0) return productId;
  const sorted = Object.keys(selection).sort().map(k => `${k}:${selection[k]}`).join('|');
  return `${productId}::${sorted}`;
}

// The final price for a specific variant selection. Purely a display
// estimate — the server always recomputes this from scratch at checkout, so
// a tampered/stale client price can never reach an actual order total.
export function computeVariantPriceNgn(product: ImportProduct, selection?: Record<string, string>): number {
  let price = product.price_ngn;
  if (!selection || !product.variants?.length) return price;
  for (const group of product.variants) {
    const selected = selection[group.name];
    if (selected == null) continue;
    const delta = group.price_deltas?.[selected];
    if (typeof delta === 'number') price += delta;
  }
  return price;
}

// Min/max price across every possible variant combination — used to show a
// "₦3,000~₦5,000" range on listing cards before a variant is chosen.
// Returns null when the product has no variants or no option carries a
// price delta (i.e. a single flat price applies, nothing to range).
export function variantPriceRange(product: ImportProduct): { min: number; max: number } | null {
  if (!product.has_variants || !product.variants?.length) return null;
  let minDelta = 0;
  let maxDelta = 0;
  let hasAnyDelta = false;
  for (const group of product.variants) {
    if (!group.price_deltas || Object.keys(group.price_deltas).length === 0) continue;
    const deltas = group.options.map(opt => group.price_deltas?.[opt] ?? 0);
    minDelta += Math.min(...deltas);
    maxDelta += Math.max(...deltas);
    hasAnyDelta = true;
  }
  if (!hasAnyDelta || minDelta === maxDelta) return null;
  return { min: product.price_ngn + minDelta, max: product.price_ngn + maxDelta };
}

export function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}
function fmtUsd(n: number, rate: number) {
  return `$${(n / rate).toFixed(0)}`;
}
function fmtCny(n: number) {
  return `¥${n.toFixed(0)}`;
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({
  product, cartQty, onAdd, onRemove, onClick, usdRate,
}: {
  product: ImportProduct; cartQty: number; onAdd: () => void; onRemove: () => void; onClick: () => void; usdRate: number;
}) {
  const moq = product.moq ?? 1;
  const hasVariants = !!product.has_variants && (product.variants?.length ?? 0) > 0;
  const priceRange = variantPriceRange(product);
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
      <button onClick={onClick} className="aspect-square bg-gray-50 overflow-hidden w-full relative">
        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
      </button>

      <div className="p-2.5 lg:p-3.5 flex flex-col flex-1">
        <button onClick={onClick} className="text-left mb-2 flex-1">
          <p className="text-[11px] lg:text-sm font-medium text-gray-700 leading-snug line-clamp-2">{product.name}</p>
        </button>

        <div className="mb-2 space-y-0.5">
          {priceRange ? (
            <p className="font-bold text-orange-500 text-sm lg:text-base leading-none">
              {fmt(priceRange.min)}~{fmt(priceRange.max)}
            </p>
          ) : (
            <p className="font-bold text-orange-500 text-sm lg:text-base leading-none">{fmt(product.price_ngn)}</p>
          )}
          <div className="flex items-center gap-1.5">
            {usdRate > 0 && <span className="text-[10px] text-gray-400 font-medium">{fmtUsd(product.price_ngn, usdRate)}</span>}
            <span className="text-gray-200 text-[10px]">·</span>
            <span className="text-[10px] text-gray-400 font-medium">{fmtCny(product.price_cny)}</span>
          </div>
          {moq > 1 && <p className="text-[9px] text-gray-300">Min. {moq} units</p>}
          {!!product.units_sold && product.units_sold > 0 && (
            <p className="text-[9px] text-gray-400">{product.units_sold.toLocaleString()} sold</p>
          )}
        </div>

        {hasVariants ? (
          // Variant products require picking options on the detail page — no quick-add here.
          <button onClick={onClick} className="w-full py-1.5 lg:py-2 bg-gray-900 hover:bg-gray-700 text-white text-[11px] lg:text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1">
            {cartQty > 0 ? `${cartQty} in order · Edit` : 'Select options'}
          </button>
        ) : cartQty === 0 ? (
          <button onClick={onAdd} className="w-full py-1.5 lg:py-2 bg-gray-900 hover:bg-gray-700 text-white text-[11px] lg:text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1">
            <Plus className="w-2.5 h-2.5" /> Add
          </button>
        ) : (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1">
            <button onClick={onRemove} className="w-5 h-5 flex items-center justify-center text-gray-500"><Minus className="w-3 h-3" /></button>
            <span className="font-bold text-gray-900 text-xs">{cartQty}</span>
            <button onClick={onAdd} className="w-5 h-5 flex items-center justify-center text-gray-500"><Plus className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RecommendationsPage() {
  useImportPwaManifest();
  const navigate = useNavigate();
  const { customer, isAuthenticated, logout } = useCustomerAuthStore();

  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const cart = useImportCartStore(s => s.cart);
  const storeAddToCart = useImportCartStore(s => s.addToCart);
  const storeAddOne = useImportCartStore(s => s.addOne);
  const storeRemoveOne = useImportCartStore(s => s.removeOne);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [usdRate, setUsdRate] = useState(0);

  // Cart is now shared via useImportCartStore, so it stays in sync with the
  // product detail page automatically — no more passing it through router
  // state on navigation.

  useEffect(() => {
    fetch(`${EDGE_URL}?action=products`)
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setIsLoading(false));

    fetch(`${EDGE_URL}?action=rates`)
      .then(r => r.json())
      .then(d => setUsdRate(d.rates?.usdToNgn ?? 0))
      .catch(() => {});
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // Trending is now admin/DB-driven (is_trending + trending_order), up to 20
  // items, instead of a client-side pseudo-random daily pick.
  const trending = useMemo(() => {
    if (searchQuery || activeCategory !== 'All') return null;
    return products
      .filter(p => p.is_trending)
      .sort((a, b) => (a.trending_order ?? 0) - (b.trending_order ?? 0))
      .slice(0, 20);
  }, [products, searchQuery, activeCategory]);

  // "New ins" — the 20 most recently added products, shown right after
  // Trending today so shoppers see what's fresh before the main grid.
  const newIns = useMemo(() => {
    if (searchQuery || activeCategory !== 'All') return null;
    return [...products]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 20);
  }, [products, searchQuery, activeCategory]);

  const filtered = products.filter(p => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
    }
    return activeCategory === 'All' ? true : p.category === activeCategory;
  });

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price_ngn * i.quantity, 0);

  // Only used for non-variant products (variant products are added from the detail page).
  const addToCart = (product: ImportProduct) => {
    storeAddToCart(product, product.moq ?? 1, product.price_ngn);
  };

  const removeFromCart = (cart_key: string) => {
    const item = cart.find(i => i.cart_key === cart_key);
    storeRemoveOne(cart_key, item?.moq ?? 1);
  };

  const handleCheckoutClick = () => {
    if (!isAuthenticated) { setShowAuth(true); return; }
    setShowCheckout(true);
  };

  const displayItems = filtered;

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated && <DailyPromoModal customerId={customer?.id} />}

      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/importations" className="flex items-center gap-1.5 text-xs lg:text-sm text-gray-500 hover:text-gray-900 font-medium">
            <div className="w-5 h-5 lg:w-6 lg:h-6 bg-orange-500 rounded-md flex items-center justify-center">
              <ShoppingBag className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-xs lg:text-sm">Q Africa.shop</span>
          </Link>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/importations/dashboard"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-gray-200 sm:border-transparent"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">My Dashboard</span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 text-xs lg:text-sm text-gray-700 hover:text-gray-900 font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <User className="w-3.5 h-3.5" /> Sign in
              </button>
            )}
            {cartCount > 0 ? (
              <button onClick={handleCheckoutClick} className="flex items-center gap-1 bg-gray-900 text-white px-2.5 py-1.5 rounded-lg text-[11px] lg:text-xs font-bold">
                <ShoppingBag className="w-3 h-3" /> {cartCount}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 pt-5 pb-28 lg:pb-16">
        {/* Heading + search */}
        <div className="mb-4 lg:flex lg:items-end lg:justify-between lg:gap-6">
          <div>
            <h1 className="font-black text-gray-900 text-lg lg:text-2xl">Recommended items</h1>
            <p className="text-gray-400 text-xs lg:text-sm mt-1 leading-relaxed max-w-lg">
              Split importation and clearance fees with hundreds of others — cutting rates by up to 90%. Join our community after your first purchase, we'd love to hear from you!
            </p>
          </div>
          <div className="mt-3 lg:mt-0 lg:w-72">
            <JumiaPromoBar />
            <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-xs lg:text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            </div>
          </div>
        </div>

        {/* Category filters */}
        {!isLoading && !searchQuery && categories.length > 2 && (
          <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-[11px] lg:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeCategory === cat ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {trending && trending.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] lg:text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">Trending today</p>
            <div className="flex gap-2.5 lg:gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scroll-smooth">
              {trending.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/recommendations/${p.id}`, { state: { product: p, products } })}
                  className="flex-shrink-0 w-28 lg:w-36 bg-white rounded-xl border border-gray-100 overflow-hidden text-left hover:shadow-sm transition-shadow snap-start"
                >
                  <div className="aspect-square bg-gray-50">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-1.5 lg:p-2">
                    <p className="text-[10px] lg:text-xs font-medium text-gray-700 line-clamp-1">{p.name}</p>
                    <p className="text-[11px] lg:text-sm font-bold text-orange-500">{fmt(p.price_ngn)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* New Ins — 20 most recently added products, right after Trending */}
        {newIns && newIns.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] lg:text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">New ins</p>
            <div className="flex gap-2.5 lg:gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scroll-smooth">
              {newIns.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/recommendations/${p.id}`, { state: { product: p, products } })}
                  className="flex-shrink-0 w-28 lg:w-36 bg-white rounded-xl border border-gray-100 overflow-hidden text-left hover:shadow-sm transition-shadow snap-start relative"
                >
                  <div className="aspect-square bg-gray-50 relative">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute top-1.5 left-1.5 bg-gray-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      New
                    </span>
                  </div>
                  <div className="p-1.5 lg:p-2">
                    <p className="text-[10px] lg:text-xs font-medium text-gray-700 line-clamp-1">{p.name}</p>
                    <p className="text-[11px] lg:text-sm font-bold text-orange-500">{fmt(p.price_ngn)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid — 2 cols on phones, up to 5 on large desktop */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 lg:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-2.5 space-y-2">
                  <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  <div className="h-7 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-700 text-sm font-bold mb-1">Nothing here yet</p>
            <p className="text-gray-400 text-xs font-medium">Check back soon — new items are added often.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 lg:gap-4">
            {displayItems.map(p => (
              <ProductCard
                key={p.id} product={p}
                cartQty={cart.filter(i => i.id === p.id).reduce((s, i) => s + i.quantity, 0)}
                onAdd={() => addToCart(p)} onRemove={() => removeFromCart(buildCartKey(p.id))}
                onClick={() => navigate(`/recommendations/${p.id}`, { state: { product: p, products } })}
                usdRate={usdRate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating cart bar (mobile) */}
      <AnimatePresence>
        {cartCount > 0 && !showCheckout && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-20 max-w-lg mx-auto lg:hidden">
            <button onClick={handleCheckoutClick}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center justify-between px-5 transition-colors">
              <div className="flex items-center gap-2"><ShoppingBag className="w-4 h-4" /><span>{cartCount} unit{cartCount !== 1 ? 's' : ''} in order</span></div>
              <div className="flex items-center gap-1 text-orange-400"><span className="text-sm font-bold">{fmt(cartTotal)}</span><ChevronRight className="w-3.5 h-3.5" /></div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
            onRemove={removeFromCart}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
