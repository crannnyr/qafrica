import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, PackageCheck } from 'lucide-react';
import CONFIG from '@/lib/config';

type SharedItem = {
  order_code?: string;
  product_name: string;
  image_url: string | null;
  variant_options: Record<string, unknown> | null;
  ordered_quantity: number;
  received_quantity: number;
  remaining_quantity: number;
};

type SharedList = {
  order_code: string;
  created_at: string;
  items: SharedItem[];
};

function variantLabel(options: Record<string, unknown> | null) {
  if (!options) return '';
  return Object.entries(options)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

type ProductGroup = {
  product_name: string;
  image_url: string | null;
  variants: Array<{ label: string; remaining_quantity: number }>;
  total_remaining: number;
};

function groupItemsByProduct(items: SharedItem[]): ProductGroup[] {
  const products = new Map<string, ProductGroup>();
  for (const item of items) {
    const productKey = item.product_name.trim().toLocaleLowerCase();
    let product = products.get(productKey);
    if (!product) {
      product = { product_name: item.product_name, image_url: item.image_url, variants: [], total_remaining: 0 };
      products.set(productKey, product);
    } else if (!product.image_url && item.image_url) {
      product.image_url = item.image_url;
    }

    const label = variantLabel(item.variant_options) || 'Standard';
    const existingVariant = product.variants.find(variant => variant.label === label);
    if (existingVariant) existingVariant.remaining_quantity += Math.max(0, item.remaining_quantity);
    else product.variants.push({ label, remaining_quantity: Math.max(0, item.remaining_quantity) });
    product.total_remaining += Math.max(0, item.remaining_quantity);
  }
  return Array.from(products.values()).sort((a, b) => a.product_name.localeCompare(b.product_name));
}

export default function PartialReceivingSharePage() {
  const token = window.location.pathname.split('/').filter(Boolean).at(-1) ?? '';
  const [list, setList] = useState<SharedList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const products = useMemo(() => groupItemsByProduct(list?.items ?? []), [list]);

  useEffect(() => {
    let active = true;
    fetch(`${CONFIG.SUPABASE_URL}/functions/v1/partial-receiving-share?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? 'This shared list could not be found.');
        return data as SharedList;
      })
      .then(data => { if (active) setList(data); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load this list.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-2xl bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2 text-orange-600">
            <PackageCheck className="h-6 w-6" />
            <span className="text-sm font-bold uppercase tracking-wide">QAfrica · Fulfillment</span>
          </div>
          <h1 className="mt-3 text-2xl font-black text-gray-900 sm:text-3xl">Custom sourcing · Product requirements</h1>
          <p className="mt-2 text-sm text-gray-500">Products are grouped together with each variant and the total quantity still needed across the selected orders.</p>
          {list && <p className="mt-3 text-xs font-semibold text-gray-500">{products.length} products · {new Date(list.created_at).toLocaleDateString()}</p>}
        </header>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500">Loading shared list…</div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-white p-6 text-sm text-red-700"><AlertCircle className="h-5 w-5 flex-shrink-0" />{error}</div>
        ) : !list?.items.length ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-600">There are no outstanding items in this list.</div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
              <span className="text-sm font-semibold text-orange-900">Products needed</span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-orange-700">{products.length}</span>
            </div>
            <div className="space-y-3">
              {products.map(product => (
                <article key={product.product_name} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                  {product.image_url ? <img src={product.image_url} alt={product.product_name} loading="lazy" className="h-20 w-20 flex-shrink-0 rounded-xl bg-gray-100 object-cover sm:h-24 sm:w-24" /> : <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-gray-100 sm:h-24 sm:w-24" />}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-gray-900 sm:text-base">{product.product_name}</h2>
                    <div className="mt-3 space-y-2">
                      {product.variants.map(variant => (
                        <div key={variant.label} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Variant</p>
                            <p className="mt-0.5 text-xs font-medium text-gray-700">{variant.label}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Quantity needed</p>
                            <p className="mt-0.5 text-sm font-black text-orange-700">{variant.remaining_quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                      <span className="text-xs font-semibold text-gray-500">Total needed for this product</span>
                      <span className="text-sm font-black text-gray-900">{product.total_remaining}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-gray-400">Shared using a private link. Customer contact and delivery details are not shown.</p>
          </>
        )}
      </div>
    </main>
  );
}
