import { useEffect, useMemo, useState } from 'react';
import { Check, DollarSign, Loader2, Package, Plus, Search, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { toast } from 'sonner';
import { useStoreStore } from '@/stores';

type ChinaProduct = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  price_ngn: number | null;
  cost_ngn: number | null;
  air_shipping_customer_ngn: number | null;
  category: string | null;
  has_variants: boolean | null;
  variants: unknown;
  is_active: boolean;
};

type CatalogRow = {
  id: string;
  china_import_product_id: string;
  seller_price_ngn: number;
  supplier_cost_ngn: number;
  shipping_cost_ngn: number;
  landed_cost_ngn: number;
  status: 'active' | 'paused' | 'removed';
};

const money = (value: number) => `₦${Math.round(value).toLocaleString()}`;

export default function ChinaImportCatalogSection() {
  const { currentStore } = useStoreStore();
  const [products, setProducts] = useState<ChinaProduct[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const load = async () => {
    if (!currentStore?.id) return;
    setLoading(true);

    const storeNiches = currentStore.niches || [];
    if (storeNiches.length === 0) {
      setProducts([]);
      setCatalog([]);
      setLoading(false);
      return;
    }

    // China Import categories are linked to a parent niche through
    // niche_categories.niche_id. Only show products whose category belongs
    // to one of the niches selected for this seller's store.
    const [{ data: categoryRows, error: categoryError }, { data: catalogRows, error: catalogError }] =
      await Promise.all([
        supabase
          .from('niche_categories')
          .select('id')
          .in('niche_id', storeNiches),
        supabase
          .from('china_import_dropship_catalog')
          .select('id,china_import_product_id,seller_price_ngn,supplier_cost_ngn,shipping_cost_ngn,landed_cost_ngn,status')
          .eq('seller_store_id', currentStore.id)
          .order('created_at', { ascending: false }),
      ]);

    if (categoryError) toast.error(categoryError.message);
    if (catalogError) toast.error(catalogError.message);

    const categoryIds = (categoryRows || []).map(row => row.id);
    if (categoryIds.length === 0) {
      setProducts([]);
      setCatalog((catalogRows || []) as CatalogRow[]);
      setLoading(false);
      return;
    }

    const { data: productRows, error: productError } = await supabase
      .from('china_import_products')
      .select('id,name,description,image_url,image_urls,price_ngn,cost_ngn,air_shipping_customer_ngn,category,has_variants,variants,is_active,category_id')
      .eq('is_active', true)
      .in('category_id', categoryIds)
      .not('air_shipping_customer_ngn', 'is', null)
      .gt('air_shipping_customer_ngn', 0)
      .order('created_at', { ascending: false });

    if (productError) toast.error(productError.message);

    setProducts((productRows || []) as ChinaProduct[]);
    setCatalog((catalogRows || []) as CatalogRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [currentStore?.id, currentStore?.niches?.join(',')]);

  const catalogByProduct = useMemo(
    () => new Map(catalog.map(row => [row.china_import_product_id, row])),
    [catalog]
  );

  const filtered = products.filter(product => {
    const q = search.trim().toLowerCase();
    return !q ||
      product.name.toLowerCase().includes(q) ||
      product.category?.toLowerCase().includes(q) ||
      product.description?.toLowerCase().includes(q);
  });

  const addToStore = async (product: ChinaProduct) => {
    if (!currentStore?.id || !currentStore.owner_id) return;

    const existing = catalogByProduct.get(product.id);
    const supplierCost = Math.max(Number(product.cost_ngn ?? product.price_ngn ?? 0), 0);
    const shipping = Math.max(Number(product.air_shipping_customer_ngn ?? 0), 0);
    const landed = supplierCost + shipping;
    const entered = Number(prices[product.id]);
    const sellerPrice = Number.isFinite(entered) && entered > 0
      ? entered
      : Math.ceil(landed * 1.2);

    if (sellerPrice < landed) {
      toast.error(`Selling price must be at least ${money(landed)}`);
      return;
    }

    setBusyId(product.id);

    const payload = {
      seller_store_id: currentStore.id,
      seller_owner_id: currentStore.owner_id,
      china_import_product_id: product.id,
      seller_price_ngn: sellerPrice,
      // These are overwritten by the database trigger with authoritative snapshots.
      supplier_cost_ngn: supplierCost,
      shipping_cost_ngn: shipping,
      status: 'active',
    };

    const result = existing
      ? await supabase
          .from('china_import_dropship_catalog')
          .update({ seller_price_ngn: sellerPrice, status: 'active' })
          .eq('id', existing.id)
          .select('id,china_import_product_id,seller_price_ngn,supplier_cost_ngn,shipping_cost_ngn,landed_cost_ngn,status')
          .single()
      : await supabase
          .from('china_import_dropship_catalog')
          .insert(payload)
          .select('id,china_import_product_id,seller_price_ngn,supplier_cost_ngn,shipping_cost_ngn,landed_cost_ngn,status')
          .single();

    if (result.error) {
      toast.error(result.error.message);
    } else {
      toast.success(existing ? 'China Import product reactivated' : 'China Import product added to your store');
      await load();
    }

    setBusyId(null);
  };

  const toggleStatus = async (row: CatalogRow) => {
    setBusyId(row.id);
    const next = row.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase
      .from('china_import_dropship_catalog')
      .update({ status: next })
      .eq('id', row.id);

    if (error) toast.error(error.message);
    else {
      toast.success(next === 'active' ? 'Product is live in your store' : 'Product paused');
      await load();
    }
    setBusyId(null);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-orange-100 bg-orange-50/70 dark:border-orange-900/40 dark:bg-orange-500/5 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">China Import</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Add QAFRICA-managed China Import products to your store. Customers only see your selling price and storefront details.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search China Import products..."
          className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-orange-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700 dark:text-gray-200">No China Import products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
          {filtered.map(product => {
            const row = catalogByProduct.get(product.id);
            const supplier = Math.max(Number(product.cost_ngn ?? product.price_ngn ?? 0), 0);
            const shipping = Math.max(Number(product.air_shipping_customer_ngn ?? 0), 0);
            const landed = row?.landed_cost_ngn ?? supplier + shipping;
            const suggested = Math.ceil(landed * 1.2);
            const margin = Math.max((row?.seller_price_ngn ?? suggested) - landed, 0);

            return (
              <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="aspect-square bg-gray-100 dark:bg-gray-700">
                  {((product.image_urls?.[0]) || product.image_url) ? (
                    <img src={(product.image_urls?.[0]) || product.image_url || ''} alt={product.name} className="w-full h-full object-cover" />
                  ) : <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-gray-300" /></div>}
                </div>

                <div className="p-3 lg:p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2">{product.name}</h3>
                    {product.category && <p className="text-xs text-gray-500 mt-1">{product.category}</p>}
                  </div>

                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/60 p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Landed cost</span><strong>{money(landed)}</strong></div>
                    <div className="flex justify-between"><span className="text-gray-500">Suggested price</span><strong>{money(suggested)}</strong></div>
                    <div className="flex justify-between"><span className="text-gray-500">Your margin</span><strong className="text-green-600">{money(margin)}</strong></div>
                  </div>

                  <input
                    type="number"
                    min={Math.ceil(landed)}
                    value={prices[product.id] ?? (row ? String(row.seller_price_ngn) : String(suggested))}
                    onChange={e => setPrices(prev => ({ ...prev, [product.id]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500"
                    aria-label={`Selling price for ${product.name}`}
                  />

                  <div className="flex gap-2">
                    <Button
                      onClick={() => void addToStore(product)}
                      disabled={busyId === product.id}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                      size="sm"
                    >
                      {busyId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : row?.status === 'active' ? <><Check className="w-4 h-4 mr-1" />Update</> : <><Plus className="w-4 h-4 mr-1" />Add to Store</>}
                    </Button>

                    {row && row.status !== 'removed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleStatus(row)}
                        disabled={busyId === row.id}
                        title={row.status === 'active' ? 'Pause product' : 'Activate product'}
                      >
                        {row.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
