// src/pages/recommendations/RecommendationsPage.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, Minus, Package,
  ChevronRight, Search, X, User, LogOut, LayoutDashboard, Heart,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { formatSoldCount } from '@/lib/utils';
import { useCustomerAuthStore } from '@/stores';
import { useImportCartStore, buildImportCartKey } from '@/stores/importCartStore';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';
import { useSavedItems } from './useSavedItems';
import AnnouncementBanner from './AnnouncementBanner';
import DailyPromoModal from './DailyPromoModal';
import ImportVerificationModal from './ImportVerificationModal';
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

// ── Deterministic shuffle ────────────────────────────────────────────────
// Same seed -> same order for everyone within that time window (so a page
// reload mid-scroll doesn't reshuffle under the user), but the order
// rotates once the window elapses. Mulberry32 PRNG, seeded Fisher-Yates.
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// Main catalog reshuffles every 6h; top-20 rails (Trending/New Ins) reshuffle
// hourly, since with only 20 slots rotating faster keeps every item visible.
const shuffleSeed = (windowMs: number) => Math.floor(Date.now() / windowMs);

// ── Sliding search panel ──────────────────────────────────────────────────
// Slides in from the left at every breakpoint (mobile and desktop alike —
// previously desktop had a separate always-visible inline input instead,
// which lacked a results dropdown and had an invisible-text styling bug).
// Shows a minimal "popular" rail (older, less-seen products) before typing,
// then debounced live results from the server as the user types.
const BROWSE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-browse`;

function SearchSheet({
  isOpen, onClose, navigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [text, setText] = useState('');
  const [popular, setPopular] = useState<ImportProduct[]>([]);
  const [results, setResults] = useState<ImportProduct[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => { if (!isOpen) setText(''); }, [isOpen]);

  // Load the "popular" (oldest-listed, otherwise rarely surfaced) rail once
  // per time the panel opens.
  useEffect(() => {
    if (!isOpen) return;
    fetch(`${BROWSE_URL}?action=browse-products&sort=oldest&limit=16`)
      .then(r => r.json())
      .then(d => setPopular(d.products ?? []))
      .catch(() => setPopular([]));
  }, [isOpen]);

  // Debounced server search as the user types.
  useEffect(() => {
    const q = text.trim();
    if (!q) { setResults(null); setIsSearching(false); return; }
    setIsSearching(true);
    const timer = setTimeout(() => {
      fetch(`${BROWSE_URL}?action=browse-products&search=${encodeURIComponent(q)}&limit=40`)
        .then(r => r.json())
        .then(d => setResults(d.products ?? []))
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [text]);

  const goToProduct = (p: ImportProduct) => {
    onClose();
    navigate(`/recommendations/${p.id}`, { state: { product: p } });
  };

  const list = results ?? popular;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />
          <motion.div
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed top-0 left-0 bottom-0 w-[78%] max-w-xs bg-white z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  type="text" value={text} onChange={e => setText(e.target.value)}
                  placeholder="Search products…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none"
                />
              </div>
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 py-2">
                {isSearching ? 'Searching…' : results ? `Results (${results.length})` : 'Popular searches'}
              </p>
              {list.length === 0 ? (
                <p className="text-xs text-gray-300 px-1 py-6 text-center">No products found.</p>
              ) : (
                <div className="space-y-1">
                  {list.map(p => (
                    <button
                      key={p.id}
                      onClick={() => goToProduct(p)}
                      className="w-full flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-md object-cover flex-shrink-0 border border-gray-100" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-gray-700 truncate leading-tight">{p.name}</p>
                        <p className="text-[10px] text-orange-500 font-bold leading-tight">{fmt(p.price_ngn)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({
  product, cartQty, onAdd, onRemove, onClick, usdRate, isSaved, onToggleSave,
}: {
  product: ImportProduct; cartQty: number; onAdd: () => void; onRemove: () => void; onClick: () => void; usdRate: number;
  isSaved: boolean; onToggleSave: () => void;
}) {
  const moq = product.moq ?? 1;
  const hasVariants = !!product.has_variants && (product.variants?.length ?? 0) > 0;
  const priceRange = variantPriceRange(product);
  return (
    <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
      <button onClick={onClick} className="aspect-square bg-gray-50 overflow-hidden w-full relative">
        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
      </button>

      <button
        onClick={e => { e.stopPropagation(); onToggleSave(); }}
        aria-label="Save item"
        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur transition-colors ${
          isSaved ? 'bg-orange-500 text-white' : 'bg-white/80 text-gray-400 hover:text-gray-600'
        }`}
      >
        <Heart className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
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
            <p className="text-[9px] text-gray-400">{formatSoldCount(product.units_sold)} sold</p>
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
  const { isSaved, toggleSave } = useSavedItems();

  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;

  const [categoryTree, setCategoryTree] = useState<{ parent: string; subcategories: string[] }[]>([]);
  const [activeParent, setActiveParent] = useState('All');
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);

  const [trending, setTrending] = useState<ImportProduct[] | null>(null);
  const [newIns, setNewIns] = useState<ImportProduct[] | null>(null);

  const cart = useImportCartStore(s => s.cart);
  const storeAddToCart = useImportCartStore(s => s.addToCart);
  const storeAddOne = useImportCartStore(s => s.addOne);
  const storeRemoveOne = useImportCartStore(s => s.removeOne);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [usdRate, setUsdRate] = useState(0);

  // Cart is now shared via useImportCartStore, so it stays in sync with the
  // product detail page automatically — no more passing it through router
  // state on navigation.

  // Category taxonomy — fetched once. Parent groupings (Fashion,
  // Electronics, etc) with their leaf subcategories nested inside.
  useEffect(() => {
    fetch(`${BROWSE_URL}?action=categories`)
      .then(r => r.json())
      .then(d => setCategoryTree(d.categories ?? []))
      .catch(() => setCategoryTree([]));
  }, []);

  // Trending / New Ins — small dedicated top-20 rails, reshuffled hourly
  // client-side (same fairness reasoning as before) since 20 items is
  // cheap to shuffle in the browser but not worth a server round-trip for.
  useEffect(() => {
    fetch(`${BROWSE_URL}?action=browse-products&sort=trending&limit=20`)
      .then(r => r.json())
      .then(d => setTrending(seededShuffle(d.products ?? [], shuffleSeed(60 * 60 * 1000))))
      .catch(() => setTrending([]));
    fetch(`${BROWSE_URL}?action=browse-products&sort=new&limit=20`)
      .then(r => r.json())
      .then(d => setNewIns(seededShuffle(d.products ?? [], shuffleSeed(60 * 60 * 1000))))
      .catch(() => setNewIns([]));
  }, []);

  useEffect(() => {
    fetch(`${EDGE_URL}?action=rates`)
      .then(r => r.json())
      .then(d => setUsdRate(d.rates?.usdToNgn ?? 0))
      .catch(() => {});
  }, []);

  // Main grid — server-paginated, filtered by category/subcategory. Resets
  // and refetches page 1 whenever the selected category changes.
  const fetchPage = useCallback((pageOffset: number, replace: boolean) => {
    const params = new URLSearchParams({ action: 'browse-products', limit: String(PAGE_SIZE), offset: String(pageOffset) });
    if (activeParent !== 'All') params.set('parent', activeParent);
    if (activeSubcategory) params.set('subcategory', activeSubcategory);
    replace ? setIsLoading(true) : setIsLoadingMore(true);
    fetch(`${BROWSE_URL}?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setProducts(prev => replace ? (d.products ?? []) : [...prev, ...(d.products ?? [])]);
        setHasMore(!!d.hasMore);
      })
      .catch(() => { if (replace) setProducts([]); })
      .finally(() => { setIsLoading(false); setIsLoadingMore(false); });
  }, [activeParent, activeSubcategory]);

  useEffect(() => {
    setOffset(0);
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeParent, activeSubcategory]);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
        const next = offset + PAGE_SIZE;
        setOffset(next);
        fetchPage(next, false);
      }
    }, { rootMargin: '600px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, offset, fetchPage]);

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

  const displayItems = products;

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated && <DailyPromoModal customerId={customer?.id} />}
      {!isAuthenticated && <ImportVerificationModal />}

      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/importations" className="flex items-center gap-1.5 text-xs lg:text-sm text-gray-500 hover:text-gray-900 font-medium">
            <div className="w-5 h-5 lg:w-6 lg:h-6 bg-orange-500 rounded-md flex items-center justify-center">
              <ShoppingBag className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-xs lg:text-sm">QAFRICA×OPTICSVIEW</span>
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
        <AnnouncementBanner />
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
            {/* Tapping opens the sliding search panel — same behavior on
                mobile and desktop now, rather than a separate, more
                limited inline input on desktop with no results dropdown. */}
            <button
              onClick={() => setShowSearch(true)}
              className="w-full relative flex items-center pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-400 text-left hover:border-gray-300 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              Search products…
            </button>
          </div>
        </div>

        <SearchSheet
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          navigate={navigate}
        />

        {/* Category filters — parent groupings (Fashion, Electronics, etc). */}
        {categoryTree.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-3 mb-1 -mx-4 px-4">
            {['All', ...categoryTree.map(c => c.parent)].map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveParent(cat); setActiveSubcategory(null); }}
                className={`px-3 py-1 rounded-full text-[11px] lg:text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeParent === cat ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Subcategory filters — only within a selected parent, not "All". */}
        {activeParent !== 'All' && (() => {
          const subs = categoryTree.find(c => c.parent === activeParent)?.subcategories ?? [];
          if (subs.length < 2) return null;
          return (
            <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
              {['All', ...subs].map(sub => (
                <button
                  key={sub}
                  onClick={() => setActiveSubcategory(sub === 'All' ? null : sub)}
                  className={`px-2.5 py-1 rounded-full text-[10px] lg:text-[11px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 border ${
                    (sub === 'All' ? !activeSubcategory : activeSubcategory === sub)
                      ? 'bg-orange-50 border-orange-200 text-orange-600'
                      : 'bg-white border-gray-200 text-gray-400'
                  }`}>
                  {sub}
                </button>
              ))}
            </div>
          );
        })()}

        {activeParent === 'All' && trending && trending.length > 0 && (
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
        {activeParent === 'All' && newIns && newIns.length > 0 && (
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
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 lg:gap-4">
              {displayItems.map(p => (
                <ProductCard
                  key={p.id} product={p}
                  cartQty={cart.filter(i => i.id === p.id).reduce((s, i) => s + i.quantity, 0)}
                  onAdd={() => addToCart(p)} onRemove={() => removeFromCart(buildCartKey(p.id))}
                  onClick={() => navigate(`/recommendations/${p.id}`, { state: { product: p, products } })}
                  usdRate={usdRate}
                  isSaved={isSaved(p.id)}
                  onToggleSave={async () => {
                    const result = await toggleSave(p.id);
                    if (result === 'needs-auth') setShowAuth(true);
                  }}
                />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 lg:gap-4 mt-2.5 lg:mt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-100" />
                    <div className="p-2.5 space-y-2">
                      <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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
