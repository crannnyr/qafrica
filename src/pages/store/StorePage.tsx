// File: /src/pages/store/StorePage.tsx

import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, X, Heart, ArrowRight,
  User, Instagram, Facebook, Twitter, Minus, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreSEO } from '@/components/SEO';
import { storeService, productService, supabase } from '@/services';
import { toast } from 'sonner';
import { getThemeById } from '@/lib/themes';
import { useCustomerAuthStore, useCartStore } from '@/stores';
import { useCustomDomainSlug } from '@/components/CustomDomainRouter';
import type { Store, Product } from '@/types';

// ── Helper: pick black or white text based on background color ────────────────
function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  // Perceived luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#000000' : '#ffffff';
}

export default function StorePage() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const domainSlug = useCustomDomainSlug();
  const slug = paramSlug ?? domainSlug ?? '';
  const navigate = useNavigate();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Variant modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    items: cartItems,
    addItem,
    removeItem,
    getTotalItems,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  } = useCartStore();

  const { customer, isAuthenticated, logout } = useCustomerAuthStore();
  const theme = store?.theme ? getThemeById(store.theme) : getThemeById('modern');
  const cartCount = getTotalItems();
  const primary = store?.primary_color || theme?.colors.primary || '#f97316';
  const contrastText = getContrastColor(primary);
  const returnUrl = encodeURIComponent(`/${slug}`);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (slug) loadStore();
  }, [slug]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory]);

  const loadStore = async () => {
    setIsLoading(true);
    try {
      const { data: storeData, error: storeError } = await storeService.getStoreBySlug(slug!);
      if (storeError || !storeData) {
        toast.error('Store not found');
        setIsLoading(false);
        return;
      }
      setStore(storeData as Store);

      const { data: productsData } = await productService.getStoreProducts(storeData.id);
      const { data: importedData } = await supabase
        .from('import_catalog')
        .select('*')
        .eq('importer_store_id', storeData.id)
        .eq('is_active', true);

      const mappedImports = (importedData || []).map((item: any) => ({
        id: item.original_product_id,
        name: item.name,
        description: item.description,
        category: item.category,
        niche: item.niche,
        images: item.images,
        selling_price: item.custom_selling_price || item.selling_price,
        is_imported: true,
        is_active: item.is_active,
        has_variants: item.has_variants,
        variants: item.variants,
        stock_quantity: item.stock_quantity,
      })) as unknown as Product[];

      const ownProducts = (productsData as Product[]).filter(p => p.is_active);
      const allProducts = [...ownProducts, ...mappedImports];
      setProducts(allProducts);
      setFilteredProducts(allProducts);
    } catch (err) {
      console.error('Error loading store:', err);
      toast.error('Failed to load store');
    }
    setIsLoading(false);
  };

  const filterProducts = () => {
    let filtered = products;
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    setFilteredProducts(filtered);
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const handleAddToCart = (product: Product) => {
    if (!store) return;
    if (product.has_variants && (product.variants?.length ?? 0) > 0) {
      setSelectedProduct(product);
      setSelectedVariants({});
      setQuantity(1);
    } else {
      addItem(product, store, 1, undefined, product.selling_price);
      toast.success(`${product.name} added to cart!`);
    }
  };

  const handleConfirmVariantAdd = () => {
    if (!selectedProduct || !store) return;
    const requiredOptions = Object.keys(selectedProduct.variants?.[0]?.options || {});
    if (requiredOptions.length !== Object.keys(selectedVariants).length) {
      toast.error('Please select all variant options');
      return;
    }
    const matchingVariant = selectedProduct.variants?.find(v =>
      Object.entries(selectedVariants).every(([key, value]) => v.options[key] === value)
    );
    if (!matchingVariant) { toast.error('Selected combination not available'); return; }
    if (matchingVariant.stock < quantity) {
      toast.error(`Only ${matchingVariant.stock} items available`);
      return;
    }
    addItem(selectedProduct, store, quantity, selectedVariants, selectedProduct.selling_price);
    toast.success(`${selectedProduct.name} added to cart!`);
    setSelectedProduct(null);
    setSelectedVariants({});
    setQuantity(1);
  };

  const handleWishlistToggle = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    e.preventDefault();
    if (!store) return;
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id, customer?.id);
      toast.success('Removed from wishlist');
    } else {
      addToWishlist(product, store, customer?.id);
      toast.success('Added to wishlist');
    }
  };

  const getVariantOptions = (variantName: string) => {
    if (!selectedProduct?.variants) return [];
    const options = new Set<string>();
    selectedProduct.variants.forEach(v => {
      if (v.options[variantName]) options.add(v.options[variantName]);
    });
    return Array.from(options);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
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

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-2xl font-semibold text-gray-900 mb-1">Store not found</p>
          <p className="text-gray-400 mb-6 text-sm">This store doesn't exist or may have moved.</p>
          <Link to="/">
            <Button className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-6">
              Go home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Page ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <StoreSEO
        storeName={store.name}
        storeDescription={store.description}
        storeLogo={store.logo_url}
        storeUrl={`${window.location.origin}/${slug}`}
      />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to={`/${slug}`} className="flex items-center gap-2.5 shrink-0">
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
            <span className="font-semibold text-gray-900 text-sm tracking-tight">{store.name}</span>
          </Link>

          {/* Desktop search — inline */}
          <div className="hidden md:flex flex-1 max-w-xs">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-0 transition"
                style={{ '--tw-ring-color': primary } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Mobile search toggle */}
            <button
              className="md:hidden p-2 rounded-full hover:bg-gray-100 transition"
              onClick={() => setSearchOpen(v => !v)}
              aria-label="Search"
            >
              {searchOpen ? <X className="w-4 h-4 text-gray-600" /> : <Search className="w-4 h-4 text-gray-600" />}
            </button>

            {/* Profile */}
            <div ref={profileRef} className="relative">
              {isAuthenticated && customer ? (
                <>
                  <button
                    onClick={() => setProfileOpen(v => !v)}
                    className="w-7 h-7 rounded-full overflow-hidden border border-gray-200 hover:border-gray-400 transition"
                  >
                    {customer.avatar_url ? (
                      <img src={customer.avatar_url} alt={customer.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: primary }}>
                        {customer.full_name.charAt(0)}
                      </div>
                    )}
                  </button>
                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 z-50"
                      >
                        <div className="px-3 py-2 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-800 truncate">{customer.full_name}</p>
                          <p className="text-xs text-gray-400 truncate">{customer.email}</p>
                        </div>
                        <Link to="/customer/dashboard" className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50" onClick={() => setProfileOpen(false)}>Dashboard</Link>
                        <Link to="/cart" className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50" onClick={() => setProfileOpen(false)}>
                          Cart ({getTotalItems()})
                        </Link>
                        <hr className="my-1 border-gray-100" />
                        <button
                          onClick={async () => { await logout(); setProfileOpen(false); }}
                          className="block w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-gray-50"
                        >
                          Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <Link to={`/customer/login?return=${returnUrl}`}>
                  <button className="p-2 rounded-full hover:bg-gray-100 transition" aria-label="Sign in">
                    <User className="w-4 h-4 text-gray-600" />
                  </button>
                </Link>
              )}
            </div>

            {/* Cart */}
            <button
              onClick={() => navigate('/cart')}
              className="relative p-2 rounded-full hover:bg-gray-100 transition"
              aria-label="Cart"
            >
              <ShoppingCart className="w-4 h-4 text-gray-700" />
              {cartCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  style={{ backgroundColor: primary }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-gray-100"
            >
              <div className="px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search products…"
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 transition"
                    style={{ '--tw-ring-color': primary } as React.CSSProperties}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Banner ── */}
      {store.banner_url && (
        <div className="relative h-48 md:h-64 overflow-hidden">
          <img src={store.banner_url} alt={store.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end">
            <div className="px-6 pb-6 text-white">
              <h1 className="text-2xl md:text-3xl font-bold">{store.name}</h1>
              {store.description && (
                <p className="text-sm opacity-80 mt-1 max-w-md">{store.description}</p>
              )}
            </div>
          </div>

          {/* ── Banner watermark badge ── */}
          <div
            className="absolute bottom-0 right-0 px-3 py-1.5 pointer-events-none"
            style={{ backgroundColor: primary }}
          >
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: contrastText }}
            >
              {store.name}
            </span>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Category strip */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all border"
                style={
                  selectedCategory === cat
                    ? { backgroundColor: primary, color: '#fff', borderColor: primary }
                    : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
                }
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Product count */}
        {!searchQuery && selectedCategory === 'All' && (
          <p className="text-xs text-gray-400 mb-5">{filteredProducts.length} products</p>
        )}

        {/* Empty state */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-sm">No products found.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="mt-3 text-xs underline text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Product Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
                className="group relative"
              >
                {/* Image */}
                <div
                  className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 cursor-pointer mb-3"
                  onClick={() => navigate(`/${slug}/product/${product.id}`)}
                >
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-200">
                      {product.name.charAt(0)}
                    </div>
                  )}

                  {/* ── Product watermark badge ── */}
                  <div
                    className="absolute bottom-0 right-0 px-2 py-1 pointer-events-none"
                    style={{ backgroundColor: primary }}
                  >
                    <span
                      className="text-[8px] font-bold tracking-widest uppercase"
                      style={{ color: contrastText }}
                    >
                      {store.name}
                    </span>
                  </div>

                  {/* Wishlist */}
                  <button
                    onClick={e => handleWishlistToggle(e, product)}
                    className="absolute top-2.5 right-2.5 w-7 h-7 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Wishlist"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}
                    />
                  </button>

                  {/* Add to cart — slide up on hover */}
                  <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                    <button
                      onClick={e => { e.stopPropagation(); handleAddToCart(product); }}
                      className="w-full py-2.5 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: primary }}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Add to cart
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div
                  className="cursor-pointer"
                  onClick={() => navigate(`/${slug}/product/${product.id}`)}
                >
                  <p className="text-xs text-gray-400 mb-0.5">{product.category}</p>
                  <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2 mb-1">
                    {product.name}
                  </p>
                  <p className="text-sm font-bold" style={{ color: primary }}>
                    ₦{product.selling_price.toLocaleString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {store.name} · Powered by QAFRICA
          </p>
          <div className="flex items-center gap-3">
            {store.social_links?.instagram && (
              <a href={store.social_links.instagram} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-700 transition">
                <Instagram className="w-4 h-4" />
              </a>
            )}
            {store.social_links?.facebook && (
              <a href={store.social_links.facebook} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-700 transition">
                <Facebook className="w-4 h-4" />
              </a>
            )}
            {store.social_links?.twitter && (
              <a href={store.social_links.twitter} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-700 transition">
                <Twitter className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* ── Floating cart pill ── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
          >
            <button
              onClick={() => navigate('/cart')}
              className="flex items-center gap-3 px-5 py-3 rounded-full text-white text-sm font-semibold shadow-xl hover:shadow-2xl transition-shadow"
              style={{ backgroundColor: primary }}
            >
              <ShoppingCart className="w-4 h-4" />
              View cart
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
                {cartCount}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Variant Modal ── */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
              onClick={() => setSelectedProduct(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[85vh] overflow-y-auto"
            >
              <div className="p-5">
                {/* Handle */}
                <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

                {/* Product header */}
                <div className="flex gap-4 mb-6">
                  {selectedProduct.images?.[0] && (
                    <img
                      src={selectedProduct.images[0]}
                      alt={selectedProduct.name}
                      className="w-20 h-20 object-cover rounded-xl"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 mb-1 leading-tight">{selectedProduct.name}</p>
                    <p className="text-lg font-bold" style={{ color: primary }}>
                      ₦{selectedProduct.selling_price.toLocaleString()}
                    </p>
                    {selectedProduct.stock_quantity <= 5 && selectedProduct.stock_quantity > 0 && (
                      <p className="text-xs text-orange-500 mt-0.5">Only {selectedProduct.stock_quantity} left</p>
                    )}
                  </div>
                </div>

                {/* Variant options */}
                {(selectedProduct.variants?.length ?? 0) > 0 && (
                  <div className="space-y-4 mb-6">
                    {Object.keys(selectedProduct.variants![0].options).map(variantName => (
                      <div key={variantName}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{variantName}</p>
                        <div className="flex flex-wrap gap-2">
                          {getVariantOptions(variantName).map(option => (
                            <button
                              key={option}
                              onClick={() => setSelectedVariants(prev => ({ ...prev, [variantName]: option }))}
                              className="px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-all"
                              style={
                                selectedVariants[variantName] === option
                                  ? { borderColor: primary, backgroundColor: `${primary}15`, color: primary }
                                  : { borderColor: '#e5e7eb', color: '#374151' }
                              }
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quantity */}
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quantity</p>
                  <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition"
                    >
                      <Minus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition"
                    >
                      <Plus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmVariantAdd}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
                    style={{ backgroundColor: primary }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to cart
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
