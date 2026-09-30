// Premium storefront looks: Atelier and Noir (Growth plan and above).
// Shared structure, two personalities:
//   Atelier — warm white, serif display type, soft layered cards that lift on hover.
//   Noir    — deep charcoal hero with glass navigation, crisp sans type, bright product area.
// Both carry curated collections: every live collection is a hero slide, and tapping it opens
// that collection's own list (?c=<id>) with only its hand-picked products.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Search, X, Heart, User, Home, LayoutGrid, ChevronLeft, ChevronRight,
  ShieldCheck, Truck, BadgeCheck, ArrowRight, Instagram, Facebook, MessageCircle,
} from 'lucide-react';
import type { Product, Store, StoreCollection } from '@/types';
import { getLook, loadLookFonts, lookSetting, liveCollections, previewSearch, getContrastColor } from '@/lib/storefrontLooks';
import { buildCategories } from '@/lib/storefrontCategories';
import { StoreMark } from './StoreBrand';

type Customer = { full_name: string; avatar_url?: string | null } | null | undefined;

type Props = {
  store: Store;
  slug: string;
  products: Product[];
  primary: string;
  cartCount: number;
  customer: Customer;
  isAuthenticated: boolean;
  onAddToCart: (p: Product) => void;
  isInWishlist: (id: string) => boolean;
  onWishlistToggle: (e: React.MouseEvent, p: Product) => void;
  locationBanner?: ReactNode;
};

type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc';
const naira = (n: number) => `₦${Number(n || 0).toLocaleString('en-NG')}`;

// ── Palettes ──────────────────────────────────────────────────────────────────
type Palette = {
  page: string; surface: string; ink: string; muted: string; line: string;
  heroInk: string; heroScrim: string; heroFallback: string; card: string;
};
const PALETTES: Record<'atelier' | 'noir', Palette> = {
  atelier: {
    page: '#FAF8F5', surface: '#FFFFFF', ink: '#1C1917', muted: '#78716C', line: '#E9E4DE',
    heroInk: '#FFFFFF', heroScrim: 'linear-gradient(90deg, rgba(28,25,23,.62) 0%, rgba(28,25,23,.25) 55%, rgba(28,25,23,0) 100%)',
    heroFallback: 'linear-gradient(135deg, #EDE6DD 0%, #D9CBBB 100%)', card: '#FFFFFF',
  },
  noir: {
    page: '#FFFFFF', surface: '#F6F6F7', ink: '#0A0A0B', muted: '#6B6B73', line: '#E6E6EA',
    heroInk: '#FFFFFF', heroScrim: 'linear-gradient(180deg, rgba(10,10,11,.15) 0%, rgba(10,10,11,.55) 60%, rgba(10,10,11,.85) 100%)',
    heroFallback: 'radial-gradient(120% 90% at 80% 10%, #2A2A31 0%, #0B0B0C 60%)', card: '#F6F6F7',
  },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function PremiumStorefront(props: Props) {
  const { store, slug, products, primary, cartCount, isAuthenticated, locationBanner } = props;
  const look = getLook(store.storefront_look)!;
  const kind: 'atelier' | 'noir' = look.id === 'noir' ? 'noir' : 'atelier';
  const pal = PALETTES[kind];
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => loadLookFonts(look), [look]);

  const collections = useMemo(() => liveCollections(store), [store]);
  const params = new URLSearchParams(location.search);
  const activeId = params.get('c');
  const active = activeId ? collections.find((c) => c.id === activeId) ?? null : null;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortKey>('featured');
  const [searchOpen, setSearchOpen] = useState(false);

  // Reset filters when switching between the store and a collection
  const [shownId, setShownId] = useState(activeId);
  if (shownId !== activeId) {
    setShownId(activeId);
    setCategory('All');
    setQuery('');
  }

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const scope = useMemo(
    () => (active ? active.product_ids.map((id) => byId.get(id)).filter((p): p is Product => !!p) : products),
    [active, byId, products],
  );
  const categories = useMemo(() => buildCategories(scope, store), [scope, store]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = scope.filter(
      (p) => (category === 'All' || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)),
    );
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.selling_price - b.selling_price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.selling_price - a.selling_price);
    if (sort === 'newest') list = [...list].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
    return list;
  }, [scope, category, query, sort]);

  // Links keep the owner's preview params, if any
  const storeHref = (collectionId?: string) => {
    const q = new URLSearchParams(previewSearch());
    if (collectionId) q.set('c', collectionId);
    else q.delete('c');
    const s = q.toString();
    return `/${slug}${s ? `?${s}` : ''}`;
  };
  const openProduct = (p: Product) => navigate(`/${slug}/product/${p.id}${previewSearch()}`);
  const openCollection = (c: StoreCollection) => navigate(storeHref(c.id));
  const accountHref = isAuthenticated ? '/customer/dashboard' : `/customer/login?return=${encodeURIComponent(`/${slug}`)}`;
  const scrollToProducts = () => document.getElementById('pf-products')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });

  const rootStyle = {
    fontFamily: look.fonts.body,
    backgroundColor: pal.page,
    color: pal.ink,
    '--pf-primary': primary,
    '--pf-on-primary': getContrastColor(primary),
    '--pf-display': look.fonts.display,
  } as CSSProperties;

  const heroOverlaysHeader = kind === 'noir' && !active;

  return (
    <div className="min-h-screen antialiased pb-16 md:pb-0" style={rootStyle}>
      <Header
        kind={kind} pal={pal} store={store} primary={primary} cartCount={cartCount} accountHref={accountHref}
        overlay={heroOverlaysHeader} homeHref={storeHref()} hasCollections={collections.length > 0}
        onSearch={() => setSearchOpen(true)} onCollections={() => document.getElementById('pf-collections')?.scrollIntoView({ behavior: 'smooth' })}
        displayFont={look.fonts.display}
      />
      {locationBanner}

      {searchOpen && <SearchSheet pal={pal} query={query} setQuery={setQuery} onClose={() => setSearchOpen(false)} onSubmit={() => { setSearchOpen(false); scrollToProducts(); }} />}

      {active ? (
        <CollectionHeader kind={kind} pal={pal} collection={active} count={scope.length} backHref={storeHref()} displayFont={look.fonts.display} />
      ) : (
        <>
          <HeroSlider
            kind={kind} pal={pal} store={store} collections={collections} primary={primary}
            displayFont={look.fonts.display} onOpen={openCollection} onShopAll={scrollToProducts}
          />
          <TrustStrip pal={pal} kind={kind} />
          {collections.length > 0 && (
            <CollectionTiles kind={kind} pal={pal} collections={collections} byId={byId} onOpen={openCollection} displayFont={look.fonts.display} />
          )}
        </>
      )}

      {activeId && !active && (
        <p className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 text-sm" style={{ color: pal.muted }}>
          That collection has ended. Here is everything in the store.
        </p>
      )}

      <main id="pf-products" className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl sm:text-3xl tracking-tight" style={{ fontFamily: look.fonts.display, fontWeight: kind === 'atelier' ? 500 : 600 }}>
            {active ? 'In this collection' : query ? `Results for “${query}”` : 'Shop all'}
            <span className="ml-2 align-middle text-sm font-normal" style={{ color: pal.muted, fontFamily: look.fonts.body }}>{visible.length}</span>
          </h2>
          <label className="inline-flex items-center gap-2 text-sm self-start sm:self-auto" style={{ color: pal.muted }}>
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-full border px-3 py-1.5 text-sm bg-transparent focus:outline-none focus-visible:ring-2"
              style={{ borderColor: pal.line, color: pal.ink }}
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
        </div>

        {categories.length > 1 && (
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-8 flex gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Categories">
            {[{ name: 'All' }, ...categories].map((c) => {
              const on = category === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setCategory(c.name)}
                  className="shrink-0 rounded-full px-4 h-9 text-sm transition-colors focus:outline-none focus-visible:ring-2"
                  style={on ? { backgroundColor: pal.ink, color: pal.page } : { backgroundColor: 'transparent', color: pal.ink, boxShadow: `inset 0 0 0 1px ${pal.line}` }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg" style={{ fontFamily: look.fonts.display }}>Nothing here yet</p>
            <p className="mt-1 text-sm" style={{ color: pal.muted }}>
              {query ? 'Try another word.' : active ? 'Products in this collection are unavailable right now.' : 'New pieces are on the way.'}
            </p>
            {(query || category !== 'All') && (
              <button type="button" onClick={() => { setQuery(''); setCategory('All'); }} className="mt-4 text-sm underline underline-offset-4">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className={`grid grid-cols-2 lg:grid-cols-4 ${kind === 'atelier' ? 'gap-x-4 gap-y-10 sm:gap-x-6' : 'gap-x-3 gap-y-8 sm:gap-x-5'}`}>
            {visible.map((p, i) => (
              <ProductCard
                key={p.id} p={p} kind={kind} pal={pal} priority={i < 4} displayFont={look.fonts.display}
                onOpen={() => openProduct(p)} onAdd={() => props.onAddToCart(p)}
                wished={props.isInWishlist(p.id)} onWish={(e) => props.onWishlistToggle(e, p)}
              />
            ))}
          </div>
        )}
      </main>

      <Footer store={store} pal={pal} kind={kind} displayFont={look.fonts.display} />

      <BottomBar pal={pal} homeHref={storeHref()} cartCount={cartCount} primary={primary} onSearch={() => setSearchOpen(true)}
        onCollections={collections.length ? () => { if (active) navigate(storeHref()); setTimeout(() => document.getElementById('pf-collections')?.scrollIntoView({ behavior: 'smooth' }), 50); } : undefined} />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header(p: {
  kind: 'atelier' | 'noir'; pal: Palette; store: Store; primary: string; cartCount: number; accountHref: string;
  overlay: boolean; homeHref: string; hasCollections: boolean; displayFont: string;
  onSearch: () => void; onCollections: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const clear = p.overlay && !scrolled;
  const ink = clear ? '#FFFFFF' : p.pal.ink;
  const bg = clear ? 'transparent' : p.kind === 'noir' ? 'rgba(255,255,255,.82)' : 'rgba(250,248,245,.86)';
  const iconBtn = 'relative p-2 rounded-full transition-colors hover:bg-black/5 focus:outline-none focus-visible:ring-2';

  return (
    <header
      className={`${p.overlay ? 'fixed' : 'sticky'} top-0 inset-x-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300`}
      style={{ backgroundColor: bg, backdropFilter: clear ? 'none' : 'saturate(160%) blur(14px)', WebkitBackdropFilter: clear ? 'none' : 'saturate(160%) blur(14px)', boxShadow: clear ? 'none' : `0 1px 0 ${p.pal.line}` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4" style={{ color: ink }}>
        <Link to={p.homeHref} className="flex items-center gap-2.5 min-w-0 focus:outline-none focus-visible:ring-2 rounded-md">
          <StoreMark store={p.store} primary={p.primary} className={`w-8 h-8 text-xs shrink-0 ${p.kind === 'noir' ? 'rounded-lg' : 'rounded-full'}`} />
          <span className="truncate text-[17px] tracking-tight" style={{ fontFamily: p.displayFont, fontWeight: p.kind === 'atelier' ? 500 : 600 }}>
            {p.store.name}
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 ml-6 text-sm" aria-label="Store">
          <Link to={p.homeHref} className="opacity-80 hover:opacity-100">Shop</Link>
          {p.hasCollections && <button type="button" onClick={p.onCollections} className="opacity-80 hover:opacity-100">Collections</button>}
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={p.onSearch} className={iconBtn} aria-label="Search"><Search className="w-5 h-5" strokeWidth={1.75} /></button>
          <Link to={p.accountHref} className={`${iconBtn} hidden sm:inline-flex`} aria-label="Account"><User className="w-5 h-5" strokeWidth={1.75} /></Link>
          <Link to="/cart" className={iconBtn} aria-label={`Cart, ${p.cartCount} items`}>
            <ShoppingBag className="w-5 h-5" strokeWidth={1.75} />
            {p.cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: 'var(--pf-primary)', color: 'var(--pf-on-primary)' }}>
                {p.cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero slider ───────────────────────────────────────────────────────────────
function HeroSlider(p: {
  kind: 'atelier' | 'noir'; pal: Palette; store: Store; collections: StoreCollection[]; primary: string; displayFont: string;
  onOpen: (c: StoreCollection) => void; onShopAll: () => void;
}) {
  const fallbackTitle = p.kind === 'noir' ? lookSetting(p.store, 'headline') || p.store.name : p.store.name;
  const fallbackLine = p.kind === 'atelier' ? lookSetting(p.store, 'tagline') || p.store.description : p.store.description;
  type Slide = { key: string; title: string; subtitle?: string; image?: string; cta: string; onClick: () => void };
  const slides: Slide[] = p.collections.length
    ? p.collections.map((c) => ({ key: c.id, title: c.title, subtitle: c.subtitle, image: c.image || p.store.banner_url, cta: c.cta || 'Shop now', onClick: () => p.onOpen(c) }))
    : [{ key: 'store', title: fallbackTitle, subtitle: fallbackLine, image: p.store.banner_url, cta: 'Shop all', onClick: p.onShopAll }];

  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const next = (i + count) % count;
    el.scrollTo({ left: next * el.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [count]);

  // Keep the dots in sync with swipes
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const on = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);

  // Autoplay every 6s; pauses on hover, focus, hidden tab and reduced motion
  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion()) return;
    const t = setInterval(() => { if (!document.hidden) go(index + 1); }, 6000);
    return () => clearInterval(t);
  }, [count, paused, index, go]);

  const noir = p.kind === 'noir';
  const height = noir ? 'h-[78vh] min-h-[460px] max-h-[760px]' : 'h-[62vh] min-h-[400px] max-h-[640px]';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className={noir ? '' : 'max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6'}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    >
      <div className={`relative overflow-hidden ${noir ? '' : 'rounded-[28px] shadow-[0_30px_60px_-30px_rgba(28,25,23,.35)]'}`}>
        <div ref={track} className={`flex ${height} overflow-x-auto snap-x snap-mandatory scrollbar-hide`}>
          {slides.map((s, i) => (
            <div key={s.key} className="relative shrink-0 w-full h-full snap-start" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}: ${s.title}`}>
              {s.image ? (
                <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
              ) : (
                <div className="absolute inset-0" style={{ background: p.pal.heroFallback }} />
              )}
              <div className="absolute inset-0" style={{ background: p.pal.heroScrim }} />
              <div className={`absolute inset-0 flex ${noir ? 'items-end' : 'items-center'}`}>
                <div className={`w-full max-w-6xl mx-auto ${noir ? 'px-4 sm:px-6 pb-16 sm:pb-20' : 'px-6 sm:px-12'}`}>
                  <div className="max-w-xl" style={{ color: p.pal.heroInk }}>
                    {count > 1 && <p className="mb-3 text-[11px] uppercase tracking-[.22em] opacity-80">Collection</p>}
                    <h1
                      className={`${noir ? 'text-4xl sm:text-6xl font-semibold tracking-[-0.03em]' : 'text-4xl sm:text-6xl font-normal tracking-[-0.02em]'} leading-[1.02]`}
                      style={{ fontFamily: p.displayFont }}
                    >
                      {s.title}
                    </h1>
                    {s.subtitle && <p className="mt-4 text-base sm:text-lg opacity-90 max-w-md line-clamp-3">{s.subtitle}</p>}
                    <button
                      type="button"
                      onClick={s.onClick}
                      className="mt-7 inline-flex items-center gap-2 h-12 px-6 rounded-full text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      style={noir ? { backgroundColor: '#FFFFFF', color: '#0A0A0B' } : { backgroundColor: 'var(--pf-primary)', color: 'var(--pf-on-primary)' }}
                    >
                      {s.cta} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <div className={`absolute ${noir ? 'bottom-6' : 'bottom-5'} left-1/2 -translate-x-1/2 flex items-center gap-2`}>
              {slides.map((s, i) => (
                <button
                  key={s.key} type="button" onClick={() => go(i)} aria-label={`Show ${s.title}`} aria-current={i === index}
                  className="h-1.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{ width: i === index ? 28 : 8, backgroundColor: i === index ? '#FFFFFF' : 'rgba(255,255,255,.5)' }}
                />
              ))}
            </div>
            <div className="hidden sm:flex absolute right-5 bottom-4 gap-2">
              <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/15 backdrop-blur hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/15 backdrop-blur hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── Trust strip ───────────────────────────────────────────────────────────────
function TrustStrip({ pal, kind }: { pal: Palette; kind: 'atelier' | 'noir' }) {
  const items = [
    { icon: ShieldCheck, title: 'Buyer protection', body: 'Your payment is held until you receive your order' },
    { icon: Truck, title: 'Delivered to you', body: 'Delivery fee and time shown at checkout' },
    { icon: BadgeCheck, title: 'Secure checkout', body: 'Pay safely through QAFRICA' },
  ];
  return (
    <section className={`max-w-6xl mx-auto px-4 sm:px-6 ${kind === 'noir' ? 'pt-8' : 'pt-6'}`} aria-label="Why shop here">
      <ul className="grid grid-cols-3 gap-2 sm:gap-4">
        {items.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left rounded-2xl px-2 py-3 sm:p-4" style={{ backgroundColor: kind === 'noir' ? pal.surface : 'transparent' }}>
            <Icon className="w-5 h-5 shrink-0" style={{ color: 'var(--pf-primary)' }} strokeWidth={1.75} />
            <div>
              <p className="text-[12px] sm:text-sm font-semibold leading-tight">{title}</p>
              <p className="hidden sm:block mt-0.5 text-[13px]" style={{ color: pal.muted }}>{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Collection tiles ──────────────────────────────────────────────────────────
function CollectionTiles(p: {
  kind: 'atelier' | 'noir'; pal: Palette; collections: StoreCollection[]; byId: Map<string, Product>;
  onOpen: (c: StoreCollection) => void; displayFont: string;
}) {
  return (
    <section id="pf-collections" className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 scroll-mt-20" aria-label="Collections">
      <div className="flex items-end justify-between mb-5">
        <h2 className="text-2xl sm:text-3xl tracking-tight" style={{ fontFamily: p.displayFont, fontWeight: p.kind === 'atelier' ? 500 : 600 }}>
          Curated for you
        </h2>
      </div>
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex sm:grid sm:grid-cols-3 gap-4 overflow-x-auto snap-x scrollbar-hide">
        {p.collections.map((c) => {
          const cover = c.image || c.product_ids.map((id) => p.byId.get(id)?.images?.[0]).find(Boolean);
          const n = c.product_ids.filter((id) => p.byId.has(id)).length;
          return (
            <button
              key={c.id} type="button" onClick={() => p.onOpen(c)}
              className={`group relative shrink-0 w-[72%] sm:w-auto snap-start text-left overflow-hidden focus:outline-none focus-visible:ring-2 ${p.kind === 'atelier' ? 'rounded-3xl shadow-[0_12px_32px_-18px_rgba(28,25,23,.45)]' : 'rounded-2xl'}`}
            >
              <div className="aspect-[4/5] sm:aspect-[5/6]" style={{ background: p.pal.heroFallback }}>
                {cover && <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />}
              </div>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.65) 100%)' }} />
              <div className="absolute left-4 right-4 bottom-4 text-white">
                <p className="text-xl leading-tight" style={{ fontFamily: p.displayFont, fontWeight: p.kind === 'atelier' ? 500 : 600 }}>{c.title}</p>
                <p className="mt-1 text-[13px] opacity-85 inline-flex items-center gap-1">{n} {n === 1 ? 'item' : 'items'} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" /></p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Collection page header ────────────────────────────────────────────────────
function CollectionHeader(p: { kind: 'atelier' | 'noir'; pal: Palette; collection: StoreCollection; count: number; backHref: string; displayFont: string }) {
  const c = p.collection;
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
      <div className={`relative overflow-hidden ${p.kind === 'atelier' ? 'rounded-[28px]' : 'rounded-2xl'}`}>
        <div className="h-56 sm:h-72" style={{ background: p.pal.heroFallback }}>
          {c.image && <img src={c.image} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="absolute inset-0" style={{ background: p.pal.heroScrim }} />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 text-white">
          <Link to={p.backHref} className="mb-auto inline-flex items-center gap-1 self-start text-sm rounded-full px-3 h-8 bg-white/15 backdrop-blur hover:bg-white/25">
            <ChevronLeft className="w-4 h-4" /> All products
          </Link>
          <h1 className="text-3xl sm:text-5xl tracking-tight leading-tight" style={{ fontFamily: p.displayFont, fontWeight: p.kind === 'atelier' ? 400 : 600 }}>{c.title}</h1>
          {c.subtitle && <p className="mt-2 max-w-lg opacity-90">{c.subtitle}</p>}
        </div>
      </div>
    </section>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard(p: {
  p: Product; kind: 'atelier' | 'noir'; pal: Palette; priority: boolean; displayFont: string;
  onOpen: () => void; onAdd: () => void; wished: boolean; onWish: (e: React.MouseEvent) => void;
}) {
  const prod = p.p;
  const img = prod.images?.[0];
  const alt = prod.images?.[1];
  const compare = Number(prod.compare_at_price) || 0;
  const onSale = compare > prod.selling_price;
  const off = onSale ? Math.round((1 - prod.selling_price / compare) * 100) : 0;
  const soldOut = prod.is_out_of_stock || (typeof prod.stock_quantity === 'number' && prod.stock_quantity <= 0 && !prod.has_variants);
  const atelier = p.kind === 'atelier';

  return (
    <article className="group">
      <div
        className={`relative overflow-hidden transition-[transform,box-shadow] duration-500 ${atelier
          ? 'rounded-2xl bg-white shadow-[0_1px_2px_rgba(28,25,23,.06),0_8px_24px_-12px_rgba(28,25,23,.18)] group-hover:-translate-y-1 group-hover:shadow-[0_2px_4px_rgba(28,25,23,.06),0_24px_48px_-20px_rgba(28,25,23,.35)]'
          : 'rounded-xl'}`}
        style={{ backgroundColor: p.pal.card }}
      >
        <button type="button" onClick={p.onOpen} className="block w-full focus:outline-none focus-visible:ring-2" aria-label={prod.name}>
          <div className={atelier ? 'aspect-[4/5]' : 'aspect-square'}>
            {img ? (
              <>
                <img src={img} alt="" loading={p.priority ? 'eager' : 'lazy'} decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover transition-[opacity,transform] duration-700 ${alt ? 'group-hover:opacity-0' : 'group-hover:scale-[1.04]'}`} />
                {alt && <img src={alt} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ color: p.pal.line, fontFamily: p.displayFont }}>{prod.name.charAt(0)}</div>
            )}
          </div>
        </button>

        {(onSale || soldOut) && (
          <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={soldOut ? { backgroundColor: 'rgba(255,255,255,.9)', color: p.pal.ink } : { backgroundColor: p.pal.ink, color: '#FFFFFF' }}>
            {soldOut ? 'Sold out' : `−${off}%`}
          </span>
        )}
        <button type="button" onClick={p.onWish} aria-label={p.wished ? 'Remove from wishlist' : 'Save to wishlist'} aria-pressed={p.wished}
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-white/85 backdrop-blur shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2">
          <Heart className="w-4 h-4" style={p.wished ? { fill: 'var(--pf-primary)', color: 'var(--pf-primary)' } : { color: p.pal.ink }} />
        </button>
        {!soldOut && (
          <button type="button" onClick={p.onAdd}
            className="hidden sm:flex absolute left-3 right-3 bottom-3 h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100 focus:outline-none"
            style={atelier ? { backgroundColor: 'rgba(255,255,255,.92)', color: p.pal.ink, backdropFilter: 'blur(8px)' } : { backgroundColor: p.pal.ink, color: '#FFFFFF' }}>
            <ShoppingBag className="w-4 h-4" /> {prod.has_variants ? 'Choose options' : 'Add to bag'}
          </button>
        )}
      </div>

      <div className={`mt-3 ${atelier ? 'px-1' : ''}`}>
        <button type="button" onClick={p.onOpen} className="block w-full text-left focus:outline-none focus-visible:underline">
          <h3 className={`line-clamp-2 ${atelier ? 'text-[15px] leading-snug' : 'text-sm font-medium leading-snug'}`} style={atelier ? { fontFamily: p.displayFont } : undefined}>
            {prod.name}
          </h3>
        </button>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold">{naira(prod.selling_price)}</span>
            {onSale && <span className="ml-2 line-through text-[13px]" style={{ color: p.pal.muted }}>{naira(compare)}</span>}
          </p>
          {!soldOut && (
            <button type="button" onClick={p.onAdd} aria-label={`Add ${prod.name} to bag`}
              className="sm:hidden w-8 h-8 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2"
              style={{ backgroundColor: p.pal.ink, color: '#FFFFFF' }}>
              <ShoppingBag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Search sheet ──────────────────────────────────────────────────────────────
function SearchSheet(p: { pal: Palette; query: string; setQuery: (q: string) => void; onClose: () => void; onSubmit: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const close = useRef(p.onClose);
  useEffect(() => { close.current = p.onClose; });
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search the store">
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={p.onClose} />
      <form
        onSubmit={(e) => { e.preventDefault(); p.onSubmit(); }}
        className="relative mx-auto mt-3 sm:mt-20 w-[calc(100%-24px)] max-w-xl rounded-2xl shadow-2xl flex items-center gap-2 px-4 h-14"
        style={{ backgroundColor: '#FFFFFF', color: p.pal.ink }}
      >
        <Search className="w-5 h-5 shrink-0" style={{ color: p.pal.muted }} />
        <input ref={input} value={p.query} onChange={(e) => p.setQuery(e.target.value)} placeholder="Search products" className="flex-1 bg-transparent outline-none text-base" enterKeyHint="search" />
        {p.query && <button type="button" onClick={() => p.setQuery('')} aria-label="Clear" className="p-1"><X className="w-4 h-4" /></button>}
      </form>
    </div>
  );
}

// ── Footer & bottom bar ───────────────────────────────────────────────────────
function Footer({ store, pal, kind, displayFont }: { store: Store; pal: Palette; kind: 'atelier' | 'noir'; displayFont: string }) {
  const social = (store.social_links ?? {}) as Record<string, string | undefined>;
  const links = [
    social.instagram && { href: social.instagram, label: 'Instagram', icon: Instagram },
    social.facebook && { href: social.facebook, label: 'Facebook', icon: Facebook },
    social.whatsapp && { href: social.whatsapp.startsWith('http') ? social.whatsapp : `https://wa.me/${social.whatsapp.replace(/\D/g, '')}`, label: 'WhatsApp', icon: MessageCircle },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Instagram }[];
  const dark = kind === 'noir';
  return (
    <footer style={{ backgroundColor: dark ? '#0B0B0C' : pal.surface, color: dark ? '#FFFFFF' : pal.ink }} className={dark ? '' : 'border-t'}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end" style={dark ? undefined : { borderColor: pal.line }}>
        <div>
          <p className="text-2xl tracking-tight" style={{ fontFamily: displayFont, fontWeight: kind === 'atelier' ? 500 : 600 }}>{store.name}</p>
          {store.description && <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: dark ? 'rgba(255,255,255,.65)' : pal.muted }}>{store.description}</p>}
        </div>
        {links.length > 0 && (
          <ul className="flex gap-2">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                  style={{ boxShadow: `inset 0 0 0 1px ${dark ? 'rgba(255,255,255,.2)' : pal.line}` }}>
                  <Icon className="w-4 h-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 text-xs" style={{ color: dark ? 'rgba(255,255,255,.45)' : pal.muted }}>
        © {new Date().getFullYear()} {store.name} · Powered by QAFRICA
      </p>
    </footer>
  );
}

function BottomBar(p: { pal: Palette; homeHref: string; cartCount: number; primary: string; onSearch: () => void; onCollections?: () => void }) {
  const item = 'flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] focus:outline-none focus-visible:ring-2';
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 flex border-t" aria-label="Store"
      style={{ backgroundColor: 'rgba(255,255,255,.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderColor: p.pal.line, color: p.pal.ink }}>
      <Link to={p.homeHref} className={item}><Home className="w-5 h-5" strokeWidth={1.75} />Home</Link>
      {p.onCollections && <button type="button" onClick={p.onCollections} className={item}><LayoutGrid className="w-5 h-5" strokeWidth={1.75} />Collections</button>}
      <button type="button" onClick={p.onSearch} className={item}><Search className="w-5 h-5" strokeWidth={1.75} />Search</button>
      <Link to="/cart" className={`${item} relative`}>
        <ShoppingBag className="w-5 h-5" strokeWidth={1.75} />Bag
        {p.cartCount > 0 && (
          <span className="absolute top-2 left-1/2 ml-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: p.primary, color: getContrastColor(p.primary) }}>{p.cartCount}</span>
        )}
      </Link>
    </nav>
  );
}
