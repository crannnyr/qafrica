import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ShoppingCart, ArrowLeft, Heart, Store as StoreIcon, ChevronRight,
  Minus, Plus, Check, AlertCircle, Clock, ChevronDown, ChevronUp,
  Truck, Shield, Package, BadgeCheck,
} from 'lucide-react';
import { supabase } from '@/services';
import { toast } from 'sonner';
import { useCartStore, useCustomerAuthStore } from '@/stores';
import { useImportCartStore, type ImportProduct } from '@/stores/importCartStore';
import { useSavedItems } from '@/pages/recommendations/useSavedItems';
import type { Product, Store } from '@/types';
import Reviews from '@/components/Reviews';
import ImportReviews from '@/components/ImportReviews';
import ImageCarousel from '@/components/ImageCarousel';
import type { UnifiedMarketplaceProduct } from './types';
import { naira } from './useUnifiedMarketplace';

type StoreMeta = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  delivery_window_days: number | null;
  is_verified: boolean;
};

function getVariantNames(variants: unknown): string[] {
  if (!Array.isArray(variants)) return [];
  const first = variants[0] as any;
  if (first?.name && Array.isArray(first?.options)) {
    return (variants as any[]).map(v => String(v.name)).filter(Boolean);
  }
  if (first?.options && typeof first.options === 'object') {
    return Object.keys(first.options);
  }
  return [];
}

function getVariantOptions(variants: unknown, name: string): string[] {
  if (!Array.isArray(variants)) return [];
  const first = variants[0] as any;
  if (first?.name && Array.isArray(first?.options)) {
    const row = (variants as any[]).find(v => v.name === name);
    return Array.isArray(row?.options) ? row.options.map(String) : [];
  }
  const values = new Set<string>();
  (variants as any[]).forEach(v => {
    if (v?.options?.[name] != null) values.add(String(v.options[name]));
  });
  return [...values];
}

function CollapsibleDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 150;
  const truncate = text.length > maxLength;
  if (!text) return null;

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-500">
        {truncate && !expanded ? text.slice(0, maxLength) + '…' : text}
      </p>
      {truncate && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs font-medium text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Read more</>}
        </button>
      )}
    </div>
  );
}

function QAfricaVerifiedBadge({ label = 'Verified by QAfrica' }: { label?: string }) {
  return (
    <span title={label} className="inline-flex items-center">
      <BadgeCheck className="w-4 h-4 fill-[#E8590C] text-[#E8590C]" aria-label={label} />
    </span>
  );
}

function RelatedProductCard({ item }: { item: UnifiedMarketplaceProduct }) {
  const image = item.images?.[0];
  const price = Number(item.price_ngn || 0);
  const compareAt = Number(item.compare_at_price_ngn || 0);
  const onSale = !item.is_china_import && compareAt > price && price > 0;

  return (
    <Link
      to={`/stores-v2/product/${item.source_type}/${item.source_id}`}
      className="group"
    >
      <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden mb-3">
        {image ? (
          <img
            src={image}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-200">
            {item.name.charAt(0)}
          </div>
        )}
        <div className="absolute bottom-0 right-0 px-2 py-0.5 pointer-events-none bg-white">
          <span className="text-[7px] font-bold tracking-widest uppercase text-black">
            {item.seller_name}
          </span>
        </div>
        {item.is_china_import && (
          <span className="absolute top-0 left-0 bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-md">
            China Import
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-800 line-clamp-1 mb-0.5">{item.name}</p>
      <div className="flex items-baseline gap-1.5">
        <p className={`text-sm font-bold ${onSale ? 'text-[#FA6338]' : 'text-[#E8590C]'}`}>
          {naira(price)}
        </p>
        {onSale && <s className="text-[11px] text-gray-400">{naira(compareAt)}</s>}
      </div>
    </Link>
  );
}

export default function UnifiedProductPage() {
  const { sourceType, sourceId } = useParams<{ sourceType: string; sourceId: string }>();
  const [product, setProduct] = useState<UnifiedMarketplaceProduct | null>(null);
  const [store, setStore] = useState<StoreMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [relatedProducts, setRelatedProducts] = useState<UnifiedMarketplaceProduct[]>([]);
  const addItem = useCartStore(s => s.addItem);
  const addToWishlist = useCartStore(s => s.addToWishlist);
  const removeFromWishlist = useCartStore(s => s.removeFromWishlist);
  const isInWishlist = useCartStore(s => s.isInWishlist);
  const loadWishlist = useCartStore(s => s.loadWishlist);
  const { customer, isAuthenticated } = useCustomerAuthStore();
  const addImportToCart = useImportCartStore(s => s.addToCart);
  const { isSaved, toggleSave } = useSavedItems();

  useEffect(() => {
    if (isAuthenticated && customer?.id) {
      void loadWishlist(customer.id);
    }
  }, [isAuthenticated, customer?.id, loadWishlist]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!sourceType || !sourceId || !['product', 'china_import'].includes(sourceType)) {
        setError('Product not found');
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error: rpcError } = await supabase.rpc('marketplace_unified_product', {
        p_source_type: sourceType,
        p_source_id: sourceId,
      });

      if (!active) return;

      if (rpcError) {
        console.error('marketplace_unified_product failed', rpcError);
        setError(rpcError.message || 'Could not load product');
        setProduct(null);
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError('Product not found');
        setProduct(null);
        setLoading(false);
        return;
      }

      const resolvedProduct = row as UnifiedMarketplaceProduct;
      setProduct(resolvedProduct);
      setError(null);

      // Normal marketplace products keep the original seller/store presentation.
      if (resolvedProduct.source_type === 'product' && resolvedProduct.seller_id) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('id, name, slug, logo_url, primary_color, delivery_window_days, is_verified')
          .eq('id', resolvedProduct.seller_id)
          .maybeSingle();

        if (active && storeData) setStore(storeData as StoreMeta);
      }

      const viewerSeed = typeof window !== 'undefined'
        ? window.localStorage.getItem('qafrica_unified_marketplace_seed') || ''
        : '';

      const baseParams = {
        p_tab: 'for_you',
        p_niche: resolvedProduct.niche,
        p_category: resolvedProduct.category,
        p_search: null,
        p_limit: 12,
        p_offset: 0,
        p_viewer_seed: viewerSeed,
      };

      const firstRelated = await supabase.rpc('marketplace_unified_products', baseParams);
      let candidates = Array.isArray(firstRelated.data)
        ? firstRelated.data as UnifiedMarketplaceProduct[]
        : [];

      candidates = candidates.filter(item =>
        !(item.source_type === resolvedProduct.source_type && item.source_id === resolvedProduct.source_id)
      );

      if (candidates.length < 4) {
        const broadRelated = await supabase.rpc('marketplace_unified_products', {
          ...baseParams,
          p_niche: null,
          p_category: null,
          p_limit: 16,
        });

        const broad = Array.isArray(broadRelated.data)
          ? broadRelated.data as UnifiedMarketplaceProduct[]
          : [];

        const seen = new Set(candidates.map(item => item.source_type + ':' + item.source_id));

        for (const item of broad) {
          const key = item.source_type + ':' + item.source_id;
          if (
            item.source_type === resolvedProduct.source_type &&
            item.source_id === resolvedProduct.source_id
          ) continue;
          if (seen.has(key)) continue;

          seen.add(key);
          candidates.push(item);

          if (candidates.length >= 4) break;
        }
      }

      if (active) {
        setRelatedProducts(candidates.slice(0, 4));
        setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [sourceType, sourceId]);

  const variantNames = useMemo(
    () => getVariantNames(product?.variants),
    [product?.variants]
  );

  const selectedAll = variantNames.every(name => Boolean(selectedVariants[name]));
  const stock = product?.stock_quantity;
  const available = product?.is_available !== false && (stock == null || stock > 0);
  const price = Number(product?.price_ngn || 0);
  const compareAt = Number(product?.compare_at_price_ngn || 0);
  const discountPct = compareAt > price && price > 0
    ? Math.round((1 - price / compareAt) * 100)
    : 0;
  const china = product?.is_china_import === true;
  const primary = store?.primary_color || '#f97316';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-t-transparent border-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-gray-700">{error || 'Product not found'}</p>
        <Link to="/stores-v2" className="text-sm font-semibold underline">Back to marketplace</Link>
      </div>
    );
  }

  const sellerLogo = store?.logo_url;

  const handleAddToCart = () => {
    if (!product) return;
    if (!available) {
      toast.error('This product is out of stock');
      return;
    }
    if (variantNames.length > 0 && !selectedAll) {
      toast.error('Please select all options');
      return;
    }

    if (china) {
      const importProduct: ImportProduct = {
        id: product.source_id,
        name: product.name,
        description: product.description || '',
        image_url: product.images?.[0] || '',
        image_urls: product.images || [],
        price_cny: 0,
        price_ngn: price,
        category: product.category || '',
        moq: 1,
        has_variants: variantNames.length > 0,
        variants: Array.isArray(product.variants)
          ? product.variants.map((v: any, index: number) => ({
              id: String(v?.id || product.source_id + '-' + index),
              name: String(v?.name || 'Option'),
              options: Array.isArray(v?.options) ? v.options.map(String) : [],
            }))
          : [],
        flight_shipping_cost_ngn: Number(product.flight_shipping_cost_ngn || 0),
      };
      addImportToCart(importProduct, quantity, price, Object.keys(selectedVariants).length ? selectedVariants : undefined);
      toast.success(product.name + ' added to cart');
      return;
    }

    if (!store) {
      toast.error('Store information is unavailable');
      return;
    }

    const cartProduct = {
      id: product.source_id,
      name: product.name,
      images: product.images || [],
      selling_price: price,
    } as Product;

    addItem(
      cartProduct,
      store as unknown as Store,
      quantity,
      Object.keys(selectedVariants).length ? selectedVariants : undefined,
      price,
      { sourceType: 'product', sourceId: product.source_id }
    );
    toast.success(product.name + ' added to cart');
  };

  const handleWishlistToggle = async () => {
    if (!product) return;
    if (china) {
      const result = await toggleSave(product.source_id);
      if (result === 'needs-auth') {
        window.location.assign('/customer/login?return=' + encodeURIComponent(window.location.pathname));
      }
      return;
    }

    if (!store) {
      toast.error('Store information is unavailable');
      return;
    }

    if (!isAuthenticated || !customer?.id) {
      window.location.assign('/customer/login?return=' + encodeURIComponent(window.location.pathname));
      return;
    }

    const wishlistProduct = {
      id: product.source_id,
      name: product.name,
      images: product.images || [],
      selling_price: price,
    } as Product;

    if (isInWishlist(product.source_id)) {
      await removeFromWishlist(product.source_id, customer.id);
      toast.success('Removed from wishlist');
    } else {
      await addToWishlist(wishlistProduct, store as unknown as Store, customer.id);
      toast.success('Added to wishlist');
    }
  };

  const sellerCard = (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 hover:border-gray-300 hover:bg-gray-50 transition">
      {china ? (
        <img
          src="/qafrica-bag-logo.svg"
          alt="QAFRICA"
          className="w-9 h-9 rounded-lg object-contain bg-white"
        />
      ) : sellerLogo ? (
        <img src={sellerLogo} alt="" className="w-9 h-9 rounded-lg object-cover" />
      ) : (
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ backgroundColor: primary, color: '#fff' }}
        >
          {product.seller_name.charAt(0)}
        </span>
      )}

      <span className="flex-1 min-w-0">
        <span className="block text-xs text-gray-500">Sold by</span>
        <span className="block text-sm font-semibold text-gray-900 truncate">{product.seller_name}</span>
      </span>

      {product.seller_type === 'store' && product.seller_slug ? (
        <Link
          to="/stores-v2"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-700"
        >
          <StoreIcon className="w-4 h-4" /> View store <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
          <QAfricaVerifiedBadge /> Verified
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to="/stores-v2"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Marketplace
          </Link>

          <Link
            to="/stores-v2"
            aria-label={china ? 'QAFRICA marketplace home' : `${product.seller_name} marketplace home`}
            className="flex items-center justify-center"
          >
            <img
              src={china ? '/qafrica-bag-logo.svg' : (sellerLogo || '/qafrica-bag-logo.svg')}
              alt={china ? 'QAFRICA' : product.seller_name}
              className="w-8 h-8 rounded-md object-contain"
            />
          </Link>

          <Link to="/stores-v2/cart" className="p-2 rounded-full hover:bg-gray-100 transition" aria-label="Cart">
            <ShoppingCart className="w-4 h-4 text-gray-700" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">

          <section className="relative rounded-2xl overflow-hidden bg-gray-50">
            <ImageCarousel
              images={product.images || []}
              aspectRatio="square"
              showThumbnails
              enableZoom
              className="w-full"
            />
            <div className="absolute bottom-0 right-0 px-2.5 py-1 pointer-events-none z-10 bg-white">
              <span className="text-[9px] font-bold tracking-widest uppercase text-black">
                {product.seller_name}
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-5">

            <div>
              <p className="text-xs text-gray-400 mb-1">{product.category}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {product.name}
              </h1>
            </div>

            {sellerCard}

            <div className="flex items-center justify-between">
              <div className="flex items-end gap-2 flex-wrap">
                <span className="text-3xl font-bold" style={{ color: primary }}>
                  {naira(price)}
                </span>
                {discountPct > 0 && !china && (
                  <s className="text-sm text-gray-400 mb-1">{naira(compareAt)}</s>
                )}
              </div>

              {stock === 0 ? (
                <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> Out of stock
                </span>
              ) : stock != null && stock <= 5 ? (
                <span className="flex items-center gap-1.5 text-xs text-orange-500 font-medium">
                  <Clock className="w-3.5 h-3.5" /> Only {stock} left
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                  <Check className="w-3.5 h-3.5" /> In stock
                </span>
              )}
            </div>

            {product.rating != null && product.review_count > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <span className="text-gray-800">★ {Number(product.rating).toFixed(1)}</span>
                <span>({product.review_count} reviews)</span>
              </div>
            )}

            {product.description && (
              <CollapsibleDescription text={product.description} />
            )}

            <hr className="border-gray-100" />

            {china && product.flight_shipping_cost_ngn != null && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex gap-3">
                <Truck className="w-5 h-5 text-gray-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Flight shipping</p>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {naira(Number(product.flight_shipping_cost_ngn))}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Shipping is handled through the China-import fulfillment flow.
                  </p>
                </div>
              </div>
            )}

            {variantNames.length > 0 && (
              <div className="space-y-4">
                {variantNames.map(name => (
                  <div key={name}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {name.toLowerCase() === 'type' ? 'Size' : name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {getVariantOptions(product.variants, name).map(option => (
                        <button
                          key={option}
                          type="button"
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
              </div>
            )}

            {available && (
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Qty</p>
                <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition"
                  >
                    <Minus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.min(stock ?? 99, q + 1))}
                    disabled={stock != null && quantity >= stock}
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!available || (variantNames.length > 0 && !selectedAll)}
                className="flex-1 h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: primary }}
              >
                <ShoppingCart className="w-4 h-4" />
                {available ? 'Add to cart' : 'Out of stock'}
              </button>

              <button
                type="button"
                disabled={!available || (variantNames.length > 0 && !selectedAll)}
                className="flex-1 h-12 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition"
                title="Checkout integration is completed in Step 7"
              >
                Buy now
              </button>

              <button
                type="button"
                onClick={handleWishlistToggle}
                className="w-12 h-12 flex items-center justify-center rounded-xl border border-gray-200 hover:border-gray-300 transition"
                aria-label={china
                  ? (isSaved(product.source_id) ? 'Remove from wishlist' : 'Add to wishlist')
                  : (isInWishlist(product.source_id) ? 'Remove from wishlist' : 'Add to wishlist')}
              >
                <Heart
                  className={china
                    ? (isSaved(product.source_id) ? 'w-4 h-4 fill-red-500 text-red-500' : 'w-4 h-4 text-gray-400')
                    : (isInWishlist(product.source_id) ? 'w-4 h-4 fill-red-500 text-red-500' : 'w-4 h-4 text-gray-400')}
                />
              </button>
            </div>

            <div className="flex items-center gap-5 pt-1">
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Truck className="w-3.5 h-3.5" /> Fast delivery
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Shield className="w-3.5 h-3.5" /> Secure payment
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                {store?.delivery_window_days || (china ? 'China import' : 7)}{store ? ' day delivery' : ' delivery'}
              </span>
            </div>

            {product.seller_type === 'store' && (
              <Link
                to="/stores-v2"
                className="self-start flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1.5 transition"
              >
                <Package className="w-3 h-3" />
                View more marketplace products
              </Link>
            )}
          </section>
        </div>

        <section className="mt-16" aria-label="Product reviews">
          {china ? (
            <ImportReviews productId={product.source_id} />
          ) : (
            <Reviews productId={product.source_id} storeId={product.seller_id || undefined} />
          )}
        </section>

        {relatedProducts.length > 0 && (
          <section className="mt-16" aria-labelledby="unified-related-products">
            <p
              id="unified-related-products"
              className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5"
            >
              You may also like
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              {relatedProducts.map(item => (
                <RelatedProductCard key={item.source_type + ':' + item.source_id} item={item} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {product.seller_name} · Powered by QAFRICA
          </p>
        </div>
      </footer>
    </div>
  );
}
