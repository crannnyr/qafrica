import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Package, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { toast } from 'sonner';
import { useStoreStore, useAuthStore } from '@/stores';

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
  category_id: string | null;
  niche_name?: string | null;
};

type FilterType = 'my_niches' | 'other' | 'all';

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
  const { user } = useAuthStore();
  const [products, setProducts] = useState<ChinaProduct[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('my_niches');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [myCategoryIds, setMyCategoryIds] = useState<Set<string>>(new Set());
  const isUnlimited = (user as any)?.subscription_tier === 'unlimited';

  const load = async () => {
    if (!currentStore?.id) return;
    setLoading(true);

    const storeNiches = currentStore.niches || [];

    const [{ data: categoryRows, error: categoryError }, { data: catalogRows, error: catalogError }] =
      await Promise.all([
        supabase
          .from('niche_categories')
          .select('id,niche_id'),
        supabase
          .from('china_import_dropship_catalog')
          .select('id,china_import_product_id,seller_price_ngn,supplier_cost_ngn,shipping_cost_ngn,landed_cost_ngn,status')
          .eq('seller_store_id', currentStore.id)
          .order('created_at', { ascending: false }),
      ]);

    if (categoryError) toast.error(categoryError.message);
    if (catalogError) toast.error(catalogError.message);

    const categories = categoryRows || [];
    const nicheIds = [...new Set(categories.map(row => row.niche_id).filter(Boolean))];
    const { data: nicheRows, error: nicheError } = nicheIds.length
      ? await supabase.from('niches').select('id,name').in('id', nicheIds)
      : { data: [], error: null };
    if (nicheError) toast.error(nicheError.message);
    const nicheNameById = new Map((nicheRows || []).map(row => [row.id, row.name]));
    const nicheNameByCategoryId = new Map(categories.map(row => [row.id, nicheNameById.get(row.niche_id) || null]));
    const myCategorySet = new Set(categories.filter(row => storeNiches.includes(row.niche_id)).map(row => row.id));
    setMyCategoryIds(myCategorySet);
    const categoryIds = categories
      .filter(row => {
        if (filterType === 'all') return true;
        const isMyNiche = storeNiches.includes(row.niche_id);
        return filterType === 'my_niches' ? isMyNiche : !isMyNiche;
      })
      .map(row => row.id);

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

    setProducts((productRows || []).map(product => ({
      ...(product as ChinaProduct),
      niche_name: nicheNameByCategoryId.get(product.category_id) || null,
    })));
    setCatalog((catalogRows || []) as CatalogRow[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [currentStore?.id, currentStore?.niches?.join(','), filterType]);

  const catalogByProduct = useMemo(
    () => new Map(catalog.map(row => [row.china_import_product_id, row])),
    [catalog]
  );

  const availableProducts = products.filter(product => {
    const row = catalogByProduct.get(product.id);
    return !row || row.status === 'removed';
  });

  const filtered = availableProducts.filter(product => {
    const q = search.trim().toLowerCase();
    return !q ||
      product.name.toLowerCase().includes(q) ||
      product.category?.toLowerCase().includes(q) ||
      product.description?.toLowerCase().includes(q);
  });

  const addToStore = async (product: ChinaProduct) => {
    if (!currentStore?.id || !currentStore.owner_id) return;

    if (!isUnlimited && !myCategoryIds.has(product.category_id || '')) {
      toast.error('This product is outside your store niches. Select My Niche to add eligible products.');
      return;
    }

    const existing = catalogByProduct.get(product.id);
    const landed = Math.max(Number(product.price_ngn ?? 0), 0);
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
      // Supplier cost and shipping are authoritative database snapshots.
      // Shipping is added separately at checkout.
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search China Import products..."
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {([
            ['my_niches', 'My Niche'],
            ['other', 'Other Niche'],
            ['all', 'All Products'],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                filterType === type
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-orange-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!loading && filterType === 'other' && (
        <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-500/10 p-4 text-sm text-yellow-800 dark:text-yellow-300">
          You can browse China Import products from other niches, but your store can only add products from its selected niches.
        </div>
      )}

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
            const landed = row?.landed_cost_ngn ?? Math.max(Number(product.price_ngn ?? 0), 0);
            const suggested = Math.ceil(landed * 1.2);
            const margin = Math.max((row?.seller_price_ngn ?? suggested) - landed, 0);
            const canImport = isUnlimited || myCategoryIds.has(product.category_id || '');

            return (
              <div key={product.id} className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden transition-shadow hover:shadow-lg ${canImport ? 'border-gray-100 dark:border-gray-700' : 'border-gray-200 dark:border-gray-600 opacity-75'}`}>
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                  {((product.image_urls?.[0]) || product.image_url) ? (
                    <img src={(product.image_urls?.[0]) || product.image_url || ''} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 bg-gray-900/70 text-white text-xs rounded backdrop-blur-sm">
                      {product.niche_name || product.category || 'China Import'}
                    </span>
                  </div>
                  {!canImport && (
                    <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                      <span className="px-3 py-1 bg-gray-900 text-white text-xs rounded-full">
                        Upgrade to Import
                      </span>
                    </div>
                  )}
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
                      disabled={busyId === product.id || !canImport}
                      className={`flex-1 ${canImport ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                      size="sm"
                    >
                      {busyId === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        canImport
                          ? <><Plus className="w-4 h-4 mr-1" />Add to Store</>
                          : 'Upgrade to Import'
                      )}
                    </Button>
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
