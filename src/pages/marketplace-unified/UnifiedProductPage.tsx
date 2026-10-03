import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, ChevronDown, ChevronUp, Clock, Heart,
  Minus, Plus, Shield, ShoppingCart, Truck
} from 'lucide-react';
import ImageCarousel from '@/components/ImageCarousel';
import { supabase } from '@/services';
import type { UnifiedMarketplaceProduct } from './types';
import { naira } from './useUnifiedMarketplace';

function getVariantNames(variants: unknown): string[] {
  if (!Array.isArray(variants)) return [];
  const first = variants[0] as any;
  if (first?.name && Array.isArray(first?.options)) return (variants as any[]).map(v => String(v.name)).filter(Boolean);
  if (first?.options && typeof first.options === 'object') return Object.keys(first.options);
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
  const long = text.length > 180;
  return (
    <div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
        {long && !expanded ? `${text.slice(0, 180)}…` : text}
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded(v => !v)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

export default function UnifiedProductPage() {
  const { sourceType, sourceId } = useParams<{ sourceType: string; sourceId: string }>();
  const [product, setProduct] = useState<UnifiedMarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

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
      } else {
        // Supabase RPCs that return TABLE(...) always return an array of rows.
        // The detail endpoint returns at most one row, so resolve the first row
        // before rendering it as a product object.
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setError('Product not found');
          setProduct(null);
        } else {
          setProduct(row as UnifiedMarketplaceProduct);
          setError(null);
        }
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [sourceType, sourceId]);

  const variantNames = useMemo(() => getVariantNames(product?.variants), [product?.variants]);
  const selectedAll = variantNames.every(name => Boolean(selectedVariants[name]));
  const stock = product?.stock_quantity;
  const available = product?.is_available !== false && (stock == null || stock > 0);

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gray-500">Loading product…</div>;
  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-gray-700">{error || 'Product not found'}</p>
        <Link to="/stores-v2" className="text-sm font-semibold underline">Back to marketplace</Link>
      </div>
    );
  }

  const price = Number(product.price_ngn || 0);
  const compareAt = Number(product.compare_at_price_ngn || 0);
  const discountPct = compareAt > price && price > 0 ? Math.round((1 - price / compareAt) * 100) : 0;
  const china = product.is_china_import;

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between">
          <Link to="/stores-v2" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" /> Marketplace
          </Link>
          <span className="text-sm font-semibold text-gray-900">Product details</span>
          <Link to="/cart" className="p-2 rounded-full hover:bg-gray-100" aria-label="Cart">
            <ShoppingCart className="w-4 h-4 text-gray-700" />
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
          <section>
            <ImageCarousel images={product.images || []} aspectRatio="square" showThumbnails enableZoom className="w-full" />
          </section>

          <section className="flex flex-col gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {china && <span className="inline-flex rounded-full bg-gray-900 text-white px-2.5 py-1 text-[11px] font-bold">China Import</span>}
                {discountPct > 0 && !china && <span className="inline-flex rounded-full bg-[#FA6338] text-white px-2.5 py-1 text-[11px] font-bold">-{discountPct}%</span>}
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold leading-tight text-gray-900">{product.name}</h1>
              <div className="mt-3 flex items-end gap-2 flex-wrap">
                <span className="text-3xl font-bold text-gray-900">{naira(price)}</span>
                {discountPct > 0 && <s className="text-sm text-gray-400 mb-1">{naira(compareAt)}</s>}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Sold by <strong className="text-gray-900">{product.seller_name}</strong></span>
              {product.seller_verified && <span title={china ? 'Verified by QAfrica' : 'Verified marketplace seller'}><BadgeCheck className="w-4 h-4 fill-[#E8590C] text-[#E8590C]" aria-label="Verified" /></span>}
            </div>

            {product.rating != null && product.review_count > 0 && (
              <div className="text-sm text-gray-600">★ {Number(product.rating).toFixed(1)} <span className="text-gray-400">({product.review_count} reviews)</span></div>
            )}

            {variantNames.length > 0 && (
              <div className="space-y-4 border-y border-gray-100 py-5">
                {variantNames.map(name => (
                  <div key={name}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{name.toLowerCase() === 'type' ? 'Size' : name}</p>
                    <div className="flex flex-wrap gap-2">
                      {getVariantOptions(product.variants, name).map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSelectedVariants(v => ({ ...v, [name]: option }))}
                          className="px-3.5 py-2 rounded-lg border text-sm font-medium transition"
                          style={selectedVariants[name] === option ? { borderColor: '#E8590C', color: '#E8590C', backgroundColor: '#E8590C12' } : { borderColor: '#E5E7EB', color: '#4B5563' }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {china && product.flight_shipping_cost_ngn != null && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex gap-3">
                <Truck className="w-5 h-5 text-gray-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Flight shipping</p>
                  <p className="mt-0.5 text-sm text-gray-600">{naira(Number(product.flight_shipping_cost_ngn))}</p>
                  <p className="mt-1 text-xs text-gray-400">Shipping is handled through the China-import fulfillment flow.</p>
                </div>
              </div>
            )}

            {product.description && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                <CollapsibleDescription text={product.description} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</p>
              <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"><Minus className="w-3.5 h-3.5" /></button>
                <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                <button type="button" onClick={() => setQuantity(q => Math.min(stock ?? 99, q + 1))} disabled={stock != null && quantity >= stock} className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <span className={`text-xs ${available ? 'text-green-600' : 'text-red-500'}`}>{available ? 'In stock' : 'Out of stock'}</span>
            </div>

            <div className="flex gap-2.5">
              <button type="button" disabled={!available || (variantNames.length > 0 && !selectedAll)} className="flex-1 h-12 rounded-xl bg-[#E8590C] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40" title="Cart integration is completed in Step 6">
                <ShoppingCart className="w-4 h-4" />
                Add to cart
              </button>
              <button type="button" disabled className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center opacity-50" aria-label="Wishlist coming later">
                <Heart className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-gray-50 p-3">
                <Shield className="w-4 h-4 text-gray-600 mb-2" />
                <p className="text-xs font-semibold text-gray-800">Secure payment</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <Clock className="w-4 h-4 text-gray-600 mb-2" />
                <p className="text-xs font-semibold text-gray-800">{china ? 'China import delivery' : 'Marketplace delivery'}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
