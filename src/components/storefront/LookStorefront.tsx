// Renders the five new storefront looks (clean, boutique, catalog, social, bento).
// The 'classic' look is still rendered by StorePage itself, unchanged.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Search, X, Heart, Menu, Home, LayoutGrid, User, Plus,
  Instagram, Facebook, Twitter, MessageCircle, ChevronRight,
} from 'lucide-react';
import type { Product, Store } from '@/types';
import {
  getLook, loadLookFonts, lookSetting, resolveNavStyle, getContrastColor, previewSearch,
  type LookDefinition,
} from '@/lib/storefrontLooks';
import CategoryCircles from './CategoryCircles';
import { StoreMark, Wordmark } from './StoreBrand';
import { buildCategories } from '@/lib/storefrontCategories';

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

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

export default function LookStorefront(props: Props) {
  const { store, slug, products, primary, cartCount, customer, isAuthenticated, locationBanner } = props;
  const look = getLook(store.storefront_look)!;
  const navigate = useNavigate();
  const nav = resolveNavStyle(store);
  const side: 'left' | 'right' = store.sidebar_side === 'right' ? 'right' : 'left';

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortKey>('featured');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => loadLookFonts(look), [look]);

  // Close drawer on Escape; lock scroll while open
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const categories = useMemo(() => buildCategories(products, store), [products, store]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)),
    );
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.selling_price - b.selling_price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.selling_price - a.selling_price);
    if (sort === 'newest')
      list = [...list].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
    return list;
  }, [products, category, query, sort]);

  const accountHref = isAuthenticated
    ? '/customer/dashboard'
    : `/customer/login?return=${encodeURIComponent(`/${slug}`)}`;
  const openProduct = (p: Product) => navigate(`/${slug}/product/${p.id}${previewSearch()}`);
  const pickCategory = (c: string) => {
    setCategory(c);
    setDrawerOpen(false);
    document.getElementById('sf-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const rootStyle = {
    fontFamily: look.fonts.body,
    '--sf-primary': primary,
    '--sf-display': look.fonts.display,
  } as CSSProperties;

  const persistentSidebar = nav === 'sidebar';
  const contentPad = persistentSidebar ? (side === 'left' ? 'lg:pl-72' : 'lg:pr-72') : '';

  const shared = { store, slug, look, primary, cartCount, customer, isAuthenticated, accountHref };

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={rootStyle}>
      {/* Persistent sidebar (desktop) */}
      {persistentSidebar && (
        <aside
          className={`hidden lg:flex fixed top-0 bottom-0 ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} w-72 border-gray-100 bg-white z-30`}
          aria-label="Store navigation"
        >
          <NavPanel {...shared} categories={categories} selected={category} onPick={pickCategory} />
        </aside>
      )}

      <div className={`${contentPad} ${nav === 'bottom' ? 'pb-16 md:pb-0' : ''}`}>
        <Header
          {...shared}
          nav={nav}
          query={query}
          setQuery={setQuery}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          onMenu={() => setDrawerOpen(true)}
        />
        {locationBanner}

        <main className={`mx-auto ${look.id === 'catalog' ? 'max-w-7xl' : 'max-w-6xl'} px-4 sm:px-6 pb-12`}>
          <Intro {...shared} products={products} onOpen={openProduct} onAdd={props.onAddToCart} />

          {categories.length > 0 && (
            <div className={look.id === 'social' ? 'mt-5' : 'mt-8'}>
              {look.id !== 'social' && (
                <h2 className="sr-only">Categories</h2>
              )}
              <CategoryCircles
                categories={categories}
                selected={category}
                onSelect={pickCategory}
                primary={primary}
                size={look.id === 'social' || look.id === 'boutique' ? 'lg' : 'md'}
                labelClassName={look.id === 'boutique' ? 'tracking-wide' : ''}
              />
            </div>
          )}

          <section id="sf-products" className="mt-8 scroll-mt-24" aria-label="Products">
            <div className="flex items-end justify-between gap-3 mb-4">
              <h2
                className={headingClass(look)}
                style={{ fontFamily: look.fonts.display }}
              >
                {query ? `Results for “${query}”` : category === 'All' ? sectionTitle(look) : <span className="capitalize">{category}</span>}
              </h2>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-500">{visible.length} items</span>
                {look.id === 'catalog' && (
                  <label className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="sr-only sm:not-sr-only">Sort</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus-visible:ring-2"
                      style={{ ['--tw-ring-color' as string]: primary }}
                    >
                      <option value="featured">Featured</option>
                      <option value="newest">Newest</option>
                      <option value="price-asc">Price: low to high</option>
                      <option value="price-desc">Price: high to low</option>
                    </select>
                  </label>
                )}
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm text-gray-600">
                  {products.length === 0 ? 'This store has no products yet.' : 'Nothing matches that search.'}
                </p>
                {products.length > 0 && (
                  <button
                    onClick={() => { setQuery(''); setCategory('All'); }}
                    className="mt-3 text-sm font-medium underline underline-offset-4"
                    style={{ color: primary }}
                  >
                    Show all products
                  </button>
                )}
              </div>
            ) : (
              <ul className={gridClass(look, persistentSidebar)}>
                {visible.map((p) => (
                  <li key={p.id}>
                    <ProductCard
                      product={p}
                      look={look}
                      store={store}
                      primary={primary}
                      wished={props.isInWishlist(p.id)}
                      onOpen={() => openProduct(p)}
                      onAdd={() => props.onAddToCart(p)}
                      onWish={(e) => props.onWishlistToggle(e, p)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <Footer store={store} />
      </div>

      {nav === 'bottom' && (
        <BottomBar
          slug={slug}
          primary={primary}
          cartCount={cartCount}
          accountHref={accountHref}
          onSearch={() => {
            setSearchOpen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onCategories={() => setDrawerOpen(true)}
        />
      )}

      {/* Drawer: the sidebar on phones, and the menu for every look */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className={`fixed top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} w-[84%] max-w-xs bg-white z-50 shadow-2xl`}
              initial={{ x: side === 'left' ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: side === 'left' ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              style={{ fontFamily: look.fonts.body }}
            >
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
              <NavPanel {...shared} categories={categories} selected={category} onPick={pickCategory} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────── pieces ────────────────────────────── */

type Shared = {
  store: Store;
  slug: string;
  look: LookDefinition;
  primary: string;
  cartCount: number;
  customer: Customer;
  isAuthenticated: boolean;
  accountHref: string;
};

function sectionTitle(look: LookDefinition) {
  switch (look.id) {
    case 'boutique': return 'The collection';
    case 'catalog': return 'All products';
    case 'social': return 'Fresh in the shop';
    case 'bento': return 'Everything';
    default: return 'Shop all';
  }
}

function headingClass(look: LookDefinition) {
  switch (look.id) {
    case 'boutique': return 'text-2xl sm:text-3xl font-medium italic';
    case 'social': return 'text-3xl font-bold';
    case 'bento': return 'text-xl sm:text-2xl font-bold tracking-tight';
    case 'catalog': return 'text-base font-semibold';
    default: return 'text-lg font-semibold tracking-tight';
  }
}

function gridClass(look: LookDefinition, withSidebar: boolean) {
  switch (look.id) {
    case 'boutique': return 'grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-10';
    case 'catalog': return `grid grid-cols-2 sm:grid-cols-3 ${withSidebar ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-2.5`;
    case 'social': return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
    case 'bento': return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';
    default: return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8';
  }
}

function IconBtn(props: { label: string; onClick?: () => void; to?: string; children: ReactNode; className?: string }) {
  const cls = `relative p-2 rounded-full hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${props.className ?? ''}`;
  return props.to ? (
    <Link to={props.to} aria-label={props.label} className={cls}>{props.children}</Link>
  ) : (
    <button type="button" aria-label={props.label} onClick={props.onClick} className={cls}>{props.children}</button>
  );
}

function CartBadge({ count, primary }: { count: number; primary: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center"
      style={{ backgroundColor: primary, color: getContrastColor(primary) }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function Header(
  p: Shared & {
    nav: 'bottom' | 'sidebar';
    query: string;
    setQuery: (v: string) => void;
    searchOpen: boolean;
    setSearchOpen: (v: boolean) => void;
    onMenu: () => void;
  },
) {
  const { store, slug, look, primary, cartCount, accountHref, isAuthenticated, customer, nav } = p;
  // Menu button: always on phones for sidebar nav; Clean keeps it everywhere (reference design)
  const menuCls = nav === 'sidebar' ? 'lg:hidden' : look.id === 'clean' ? '' : 'hidden';
  const cart = (
    <IconBtn label={`Cart, ${cartCount} items`} to="/cart">
      <ShoppingBag className="w-5 h-5" strokeWidth={1.75} />
      <CartBadge count={cartCount} primary={primary} />
    </IconBtn>
  );
  const searchToggle = (
    <IconBtn label={p.searchOpen ? 'Close search' : 'Search'} onClick={() => p.setSearchOpen(!p.searchOpen)}>
      {p.searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" strokeWidth={1.75} />}
    </IconBtn>
  );
  const searchInput = (autoFocus: boolean) => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
      <input
        type="search"
        autoFocus={autoFocus}
        value={p.query}
        onChange={(e) => p.setQuery(e.target.value)}
        placeholder={`Search ${store.name}`}
        aria-label="Search products"
        className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:bg-white"
        style={{ ['--tw-ring-color' as string]: primary }}
      />
    </div>
  );

  if (look.id === 'catalog') {
    return (
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <IconBtn label="Open menu" onClick={p.onMenu} className={`-ml-2 ${menuCls === 'hidden' ? 'hidden' : 'lg:hidden'}`}>
            <Menu className="w-5 h-5" />
          </IconBtn>
          <Link to={`/${slug}`} className={`flex items-center gap-2 shrink-0 ${nav === 'sidebar' ? 'lg:hidden' : ''}`}>
            <StoreMark store={store} primary={primary} className="w-8 h-8 rounded-md text-sm" />
            <span className="font-semibold tracking-tight text-[15px]">{store.name}</span>
          </Link>
          <div className="hidden md:block flex-1 max-w-xl mx-auto">{searchInput(false)}</div>
          <div className="ml-auto flex items-center">
            <IconBtn label={isAuthenticated ? 'My account' : 'Sign in'} to={accountHref}>
              <User className="w-5 h-5" strokeWidth={1.75} />
            </IconBtn>
            {cart}
          </div>
        </div>
        <div className="md:hidden px-4 pb-3">{searchInput(p.searchOpen)}</div>
      </header>
    );
  }

  const searchRow = (
    <AnimatePresence>
      {p.searchOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-3">{searchInput(true)}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (look.id === 'boutique') {
    return (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center -ml-2">
            <IconBtn label="Open menu" onClick={p.onMenu} className={menuCls === 'hidden' ? 'hidden' : menuCls}>
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            </IconBtn>
            {searchToggle}
          </div>
          <Link
            to={`/${slug}`}
            className="text-2xl sm:text-[28px] font-semibold tracking-wide text-center truncate max-w-[52vw]"
            style={{ fontFamily: look.fonts.display }}
          >
            {store.name}
          </Link>
          <div className="flex items-center justify-end -mr-2">
            <IconBtn label={isAuthenticated ? 'My account' : 'Sign in'} to={accountHref} className="hidden sm:inline-flex">
              <User className="w-5 h-5" strokeWidth={1.5} />
            </IconBtn>
            {cart}
          </div>
        </div>
        {searchRow}
      </header>
    );
  }

  if (look.id === 'clean') {
    return (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to={`/${slug}`} aria-label={`${store.name} home`}>
            <Wordmark store={store} primary={primary} />
          </Link>
          <div className="flex items-center gap-1 -mr-2">
            {searchToggle}
            {cart}
            <Link
              to={accountHref}
              className="px-2 py-2 text-sm font-medium text-gray-900 hover:underline underline-offset-4 whitespace-nowrap"
            >
              {isAuthenticated && customer ? customer.full_name.split(' ')[0] : 'Sign In'}
            </Link>
            <IconBtn label="Open menu" onClick={p.onMenu} className={menuCls}>
              <Menu className="w-6 h-6" strokeWidth={1.75} />
            </IconBtn>
          </div>
        </div>
        {searchRow}
      </header>
    );
  }

  // social + bento: compact header, identity lives in the intro block
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 -ml-2 min-w-0">
          <IconBtn label="Open menu" onClick={p.onMenu} className={menuCls === 'hidden' ? 'hidden' : menuCls}>
            <Menu className="w-5 h-5" />
          </IconBtn>
          <Link to={`/${slug}`} className="flex items-center gap-2 min-w-0 pl-2">
            <StoreMark store={store} primary={primary} className="w-7 h-7 rounded-full text-xs shrink-0" />
            <span
              className={look.id === 'social' ? 'text-2xl font-bold truncate' : 'text-sm font-bold tracking-tight truncate'}
              style={{ fontFamily: look.fonts.display }}
            >
              {store.name}
            </span>
          </Link>
        </div>
        <div className="flex items-center -mr-2">
          {searchToggle}
          <IconBtn label={isAuthenticated ? 'My account' : 'Sign in'} to={accountHref} className="hidden md:inline-flex">
            <User className="w-5 h-5" strokeWidth={1.75} />
          </IconBtn>
          {cart}
        </div>
      </div>
      {searchRow}
    </header>
  );
}

function Intro(p: Shared & { products: Product[]; onOpen: (p: Product) => void; onAdd: (p: Product) => void }) {
  const { store, look, primary } = p;

  if (look.id === 'clean') {
    return store.banner_url ? (
      <div className="mt-2 rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[21/8] bg-gray-100">
        <img src={store.banner_url} alt={store.name} className="w-full h-full object-cover" />
      </div>
    ) : store.description ? (
      <p className="mt-4 text-[15px] leading-relaxed text-gray-600 max-w-prose">{store.description}</p>
    ) : null;
  }

  if (look.id === 'boutique') {
    const tagline = lookSetting(store, 'tagline');
    return (
      <div className="-mx-4 sm:-mx-6 relative aspect-[4/5] sm:aspect-[21/9] bg-stone-100 overflow-hidden">
        {store.banner_url && <img src={store.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 text-white">
          <p className="text-4xl sm:text-6xl font-medium leading-[1.02] max-w-xl" style={{ fontFamily: look.fonts.display }}>
            {tagline || store.name}
          </p>
          <a
            href="#sf-products"
            className="mt-5 inline-flex items-center gap-1 border-b border-white/80 pb-0.5 text-sm tracking-wide"
          >
            Shop the collection <ChevronRight className="w-4 h-4" aria-hidden />
          </a>
        </div>
      </div>
    );
  }

  if (look.id === 'catalog') {
    return store.banner_url ? (
      <div className="mt-4 rounded-lg overflow-hidden aspect-[3/1] sm:aspect-[6/1] bg-gray-100">
        <img src={store.banner_url} alt={store.name} className="w-full h-full object-cover" />
      </div>
    ) : null;
  }

  if (look.id === 'social') {
    const bio = lookSetting(store, 'bio') || store.description;
    const wa = store.social_links?.whatsapp;
    const waHref = wa ? (wa.startsWith('http') ? wa : `https://wa.me/${wa.replace(/\D/g, '')}`) : null;
    return (
      <div className="pt-6 flex items-center gap-4">
        <span className="rounded-full p-[3px] shrink-0" style={{ background: primary }}>
          <span className="block rounded-full p-[3px] bg-white">
            <StoreMark store={store} primary={primary} className="w-20 h-20 rounded-full text-2xl" />
          </span>
        </span>
        <div className="min-w-0">
          <h1 className="text-4xl font-bold leading-none" style={{ fontFamily: look.fonts.display }}>{store.name}</h1>
          {bio && <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">{bio}</p>}
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold"
              style={{ backgroundColor: primary, color: getContrastColor(primary) }}
            >
              <MessageCircle className="w-3.5 h-3.5" aria-hidden /> Chat on WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  // bento
  const headline = lookSetting(store, 'headline') || store.name;
  const tiles = p.products.filter((x) => x.images?.[0]).slice(0, 5);
  return (
    <div className="pt-6">
      <h1
        className="font-bold tracking-[-0.045em] leading-[0.9] break-words"
        style={{ fontFamily: look.fonts.display, fontSize: 'clamp(2.75rem, 11vw, 7.5rem)' }}
      >
        {headline}
      </h1>
      {tiles.length >= 3 && (
        <ul className="mt-6 grid grid-cols-2 sm:grid-cols-4 auto-rows-[150px] sm:auto-rows-[190px] gap-3">
          {tiles.map((t, i) => (
            <li
              key={t.id}
              className={`relative rounded-3xl overflow-hidden bg-gray-100 ${i === 0 ? 'col-span-2 row-span-2' : ''} ${i === 3 ? 'sm:col-span-2' : ''}`}
            >
              <button type="button" onClick={() => p.onOpen(t)} className="absolute inset-0 w-full h-full text-left group">
                <img src={t.images[0]} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                <span className="absolute left-3 bottom-3 right-3 flex items-end justify-between gap-2">
                  <span
                    className={`bg-white rounded-full px-3 py-1 text-xs font-semibold truncate max-w-[70%] ${i === 0 ? '' : 'hidden sm:inline'}`}
                  >
                    {t.name}
                  </span>
                  <span
                    className="ml-auto rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: primary, color: getContrastColor(primary) }}
                  >
                    {naira(t.selling_price)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductCard(p: {
  product: Product;
  look: LookDefinition;
  store: Store;
  primary: string;
  wished: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onWish: (e: React.MouseEvent) => void;
}) {
  const { product, look, primary, store } = p;
  const img = product.images?.[0];
  const was = product.compare_at_price && product.compare_at_price > product.selling_price ? product.compare_at_price : null;
  const soldOut = !product.has_variants && product.stock_quantity !== undefined && product.stock_quantity <= 0;

  const aspect =
    look.id === 'boutique' ? 'aspect-[3/4]' : look.id === 'social' ? 'aspect-[4/5]' : 'aspect-square';
  const radius =
    look.id === 'boutique' ? 'rounded-none' : look.id === 'catalog' ? 'rounded-md' : look.id === 'bento' || look.id === 'social' ? 'rounded-3xl' : 'rounded-2xl';

  const image = (
    <div className={`relative ${aspect} ${radius} overflow-hidden ${look.id === 'catalog' ? 'bg-white' : 'bg-gray-100'}`}>
      {img ? (
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          className={`w-full h-full ${look.id === 'catalog' ? 'object-contain p-2' : 'object-cover'} transition-transform duration-500 group-hover:scale-[1.03]`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-300">{product.name.charAt(0)}</div>
      )}
      {/* Store watermark, same as classic look */}
      <span className="absolute bottom-0 right-0 px-1.5 py-0.5 bg-white/90 text-[7px] font-bold tracking-widest uppercase text-black pointer-events-none">
        {store.name}
      </span>
      {soldOut && (
        <span className="absolute top-2 left-2 bg-white text-gray-900 text-[11px] font-semibold px-2 py-0.5 rounded-full">Sold out</span>
      )}
    </div>
  );

  const wishBtn = (
    <button
      type="button"
      onClick={p.onWish}
      aria-label={p.wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      aria-pressed={p.wished}
      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm focus-visible:outline-none focus-visible:ring-2"
      style={{ ['--tw-ring-color' as string]: primary }}
    >
      <Heart className={`w-4 h-4 ${p.wished ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
    </button>
  );

  const addBtn = (compact: boolean) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); p.onAdd(); }}
      disabled={soldOut}
      aria-label={`Add ${product.name} to cart`}
      className={`${compact ? 'w-9 h-9 rounded-full' : 'w-full py-2 rounded-md text-xs font-semibold'} flex items-center justify-center gap-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
      style={{ backgroundColor: primary, color: getContrastColor(primary), ['--tw-ring-color' as string]: primary }}
    >
      <Plus className="w-4 h-4" aria-hidden />
      {!compact && 'Add to cart'}
    </button>
  );

  const price = (
    <span className="flex items-baseline gap-1.5">
      <span
        className={look.id === 'boutique' ? 'text-sm' : 'text-[15px] font-bold'}
        style={look.id === 'social' || look.id === 'bento' ? { color: primary } : undefined}
      >
        {naira(product.selling_price)}
      </span>
      {was && <s className="text-xs text-gray-400">{naira(was)}</s>}
    </span>
  );

  if (look.id === 'catalog') {
    return (
      <article className="group h-full flex flex-col border border-gray-200 rounded-lg p-2 hover:border-gray-300 bg-white">
        <div className="relative cursor-pointer" onClick={p.onOpen}>
          {image}
          {wishBtn}
        </div>
        <button type="button" onClick={p.onOpen} className="mt-2 text-left flex-1">
          <h3 className="text-[13px] leading-snug line-clamp-2 text-gray-800">{product.name}</h3>
          <div className="mt-1">{price}</div>
          {was && (
            <span className="text-[11px] font-semibold text-green-700">
              Save {Math.round(((was - product.selling_price) / was) * 100)}%
            </span>
          )}
        </button>
        <div className="mt-2">{addBtn(false)}</div>
      </article>
    );
  }

  return (
    <article className="group">
      <div className="relative cursor-pointer" onClick={p.onOpen}>
        {image}
        {wishBtn}
      </div>
      <div className={`mt-3 flex ${look.id === 'boutique' ? 'flex-col items-center text-center' : 'items-start justify-between'} gap-2`}>
        <button type="button" onClick={p.onOpen} className={`min-w-0 ${look.id === 'boutique' ? '' : 'text-left'}`}>
          <h3
            className={
              look.id === 'boutique'
                ? 'text-lg leading-tight'
                : look.id === 'social'
                  ? 'text-[15px] font-semibold leading-snug line-clamp-2'
                  : 'text-sm font-medium leading-snug line-clamp-2'
            }
            style={look.id === 'boutique' ? { fontFamily: look.fonts.display } : undefined}
          >
            {product.name}
          </h3>
          <div className={`mt-1 ${look.id === 'boutique' ? 'flex justify-center text-gray-600' : ''}`}>{price}</div>
        </button>
        {look.id !== 'boutique' && <div className="shrink-0">{addBtn(true)}</div>}
      </div>
    </article>
  );
}

function NavPanel(p: Shared & { categories: { name: string; count: number }[]; selected: string; onPick: (c: string) => void }) {
  const { store, slug, look, primary, accountHref, isAuthenticated } = p;
  const socials = [
    { key: 'instagram', icon: Instagram, href: store.social_links?.instagram },
    { key: 'facebook', icon: Facebook, href: store.social_links?.facebook },
    { key: 'twitter', icon: Twitter, href: store.social_links?.twitter },
  ].filter((s) => !!s.href);

  const row = (label: string, active: boolean, onClick: () => void, count?: number, isCategory = false) => (
    <li key={label}>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[15px] text-left hover:bg-gray-50"
        style={active ? { backgroundColor: `${primary}14`, color: primary, fontWeight: 600 } : undefined}
      >
        <span className={`truncate ${isCategory ? 'capitalize' : ''}`}>{label}</span>
        {count !== undefined && <span className="text-xs text-gray-400">{count}</span>}
      </button>
    </li>
  );

  return (
    <div className="h-full w-full flex flex-col overflow-y-auto">
      <Link to={`/${slug}`} className="flex items-center gap-3 pl-5 pr-14 pt-6 pb-5">
        <StoreMark store={store} primary={primary} className="w-10 h-10 rounded-xl text-base" />
        <span className="text-lg font-semibold leading-tight line-clamp-2" style={{ fontFamily: look.fonts.display }}>
          {store.name}
        </span>
      </Link>
      <nav className="px-2" aria-label="Categories">
        <ul className="space-y-0.5">
          {row('All products', p.selected === 'All', () => p.onPick('All'))}
          {p.categories.map((c) => row(c.name, p.selected === c.name, () => p.onPick(c.name), c.count, true))}
        </ul>
      </nav>
      <div className="mt-auto border-t border-gray-100 px-2 py-3">
        <Link to="/cart" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] hover:bg-gray-50">
          <ShoppingBag className="w-5 h-5" strokeWidth={1.75} /> Cart
        </Link>
        <Link to={accountHref} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] hover:bg-gray-50">
          <User className="w-5 h-5" strokeWidth={1.75} /> {isAuthenticated ? 'My orders & account' : 'Sign in'}
        </Link>
        {socials.length > 0 && (
          <div className="flex gap-1 px-2 pt-2">
            {socials.map(({ key, icon: Icon, href }) => (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={key} className="p-2 rounded-full text-gray-500 hover:bg-gray-100">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BottomBar(p: {
  slug: string;
  primary: string;
  cartCount: number;
  accountHref: string;
  onSearch: () => void;
  onCategories: () => void;
}) {
  const item = 'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[11px] font-medium text-gray-600 focus-visible:outline-none focus-visible:bg-gray-50';
  return (
    <nav
      aria-label="Store"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        <Link to={`/${p.slug}`} className={item} style={{ color: p.primary }} aria-current="page">
          <Home className="w-5 h-5" /> Home
        </Link>
        <button type="button" onClick={p.onCategories} className={item}>
          <LayoutGrid className="w-5 h-5" /> Categories
        </button>
        <button type="button" onClick={p.onSearch} className={item}>
          <Search className="w-5 h-5" /> Search
        </button>
        <Link to="/cart" className={item}>
          <span className="relative">
            <ShoppingBag className="w-5 h-5" />
            <CartBadge count={p.cartCount} primary={p.primary} />
          </span>
          Cart
        </Link>
        <Link to={p.accountHref} className={item}>
          <User className="w-5 h-5" /> Account
        </Link>
      </div>
    </nav>
  );
}

function Footer({ store }: { store: Store }) {
  return (
    <footer className="border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-xs text-gray-500">
        © {new Date().getFullYear()} {store.name}. Powered by QAFRICA
      </div>
    </footer>
  );
}
