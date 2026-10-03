import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Truck } from 'lucide-react';
import { supabase } from '@/services';
import type { UnifiedMarketplaceProduct } from './types';
import { naira } from './useUnifiedMarketplace';

export default function UnifiedProductPage() {
  const { sourceType, sourceId } = useParams<{ sourceType: string; sourceId: string }>();
  const [product, setProduct] = useState<UnifiedMarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (rpcError || !data) setError(rpcError?.message || 'Product not found');
      else setProduct(data as UnifiedMarketplaceProduct);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [sourceType, sourceId]);

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gray-500">Loading product…</div>;
  if (error || !product) return <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6"><p className="text-gray-700">{error || 'Product not found'}</p><Link to="/stores-v2" className="text-sm font-semibold underline">Back to marketplace</Link></div>;

  const image = product.images?.[0] || '/placeholder.svg';
  const price = Number(product.price_ngn || 0);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <Link to="/stores-v2" className="inline-flex items-center gap-2 text-sm text-gray-600"><ArrowLeft className="w-4 h-4" /> Back to marketplace</Link>
        <div className="mt-6 grid md:grid-cols-2 gap-8">
          <div className="rounded-xl overflow-hidden bg-gray-100 aspect-square">
            <img src={image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <section>
            {product.is_china_import && <span className="inline-flex rounded-full bg-gray-900 text-white px-3 py-1 text-xs font-bold">China Import</span>}
            <h1 className="mt-3 text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="mt-2 text-2xl font-bold">{naira(price)}</p>
            <p className="mt-2 text-sm text-gray-500">Sold by <strong className="text-gray-800">{product.seller_name}</strong></p>
            {product.is_china_import && product.flight_shipping_cost_ngn != null && (
              <div className="mt-5 rounded-xl border border-gray-200 p-4 flex gap-3">
                <Truck className="w-5 h-5 text-gray-700 shrink-0" />
                <div><p className="text-sm font-semibold">Flight shipping</p><p className="text-sm text-gray-500">{naira(Number(product.flight_shipping_cost_ngn))}</p></div>
              </div>
            )}
            <button type="button" disabled className="mt-6 w-full rounded-xl bg-gray-900 text-white py-3 font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"><ShoppingCart className="w-5 h-5" /> Cart integration coming next</button>
          </section>
        </div>
      </div>
    </main>
  );
}
