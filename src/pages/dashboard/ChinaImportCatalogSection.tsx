import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Loader2, Package, Plus, Search, X } from 'lucide-react';
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
const imageOf = (product: ChinaProduct) => product.image_urls?.[0] || product.image_url || '';

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
  const [configuringProduct, setConfiguringProduct] = useState<ChinaProduct | null>(null);
  const [markupPrice, setMarkupPrice] = useState('');
  const [myCategoryIds, setMyCategoryIds] = useState<Set<string>>(new Set());
  const isUnlimited = (user as any)?.subscription_tier === 'unlimited';

  const load = async () => {
    if (!currentStore?.id) {
      setProducts([]);
      setCatalog([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const storeNiches = currentStore.niches || [];

    const [{ data: categoryRows, error: categoryError }, { data: catalogRows, error: catalogError }] =
      await Promise.all([
        supabase.from('niche_categories').select('id,niche_id'),
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
    setMyCategoryIds(new Set(categories.filter(row => storeNiches.includes(row.niche_id)).map(row => row.id)));

    const categoryIds = categories.filter(row => {
      if (filterType === 'all') return true;
      const matchesStoreNiche = storeNiches.includes(row.niche_id);
      return filterType === 'my_niches' ? matchesStoreNiche : !matchesStoreNiche;
    }).map(row => row.id);

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
    [catalog],
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

  const openPricing = (product: ChinaProduct) => {
    const existing = catalogByProduct.get(product.id);
    const supplierPrice = Math.max(Number(product.price_ngn ?? 0), 0);
    setConfiguringProduct(product);
    setMarkupPrice(String(existing?.seller_price_ngn ?? Math.ceil(supplierPrice * 1.2)));
  };

  const addToStore = async (product: ChinaProduct, enteredPrice?: string) => {
    if (!currentStore?.id || !currentStore.owner_id) return;

    if (!isUnlimited && !myCategoryIds.has(product.category_id || '')) {
      toast.error('This product is outside your store niches. Select My Niche to add eligible products.');
      return;
    }

    const existing = catalogByProduct.get(product.id);
    const supplierPrice = Math.max(Number(product.price_ngn ?? 0), 0);
    const entered = Number(enteredPrice ?? prices[product.id]);
    const sellerPrice = Number.isFinite(entered) && entered > 0
      ? entered
      : Math.ceil(supplierPrice * 1.2);

    if (sellerPrice < supplierPrice) {
      toast.error(`Selling price must be at least ${money(supplierPrice)}`);
      return;
    }

    setBusyId(product.id);
    const payload = {
      seller_store_id: currentStore.id,
      seller_owner_id: currentStore.owner_id,
      china_import_product_id: product.id,
      seller_price_ngn: sellerPrice,
      // Supplier cost and shipping remain authoritative DB snapshots.
      // China shipping is charged separately at checkout.
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
      setConfiguringProduct(null);
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-6">
          {filtered.map((product, index) => {
            const row = catalogByProduct.get(product.id);
            const supplierPrice = Math.max(Number(product.price_ngn ?? 0), 0);
            const suggested = Math.ceil(supplierPrice * 1.2);
            const currentPrice = row?.seller_price_ngn ?? Number(prices[product.id] ?? suggested);
            const margin = Math.max(currentPrice - supplierPrice, 0);
            const canImport = isUnlimited || myCategoryIds.has(product.category_id || '');
            const image = imageOf(product);

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.025 }}
                className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden transition-shadow hover:shadow-lg ${canImport ? 'border-gray-100 dark:border-gray-700' : 'border-gray-200 dark:border-gray-600 opacity-75'}`}
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                  {image ? (
                    <img
                      src={image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={event => { (event.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="w-16 h-16 text-gray-300" /></div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 bg-gray-900/70 text-white text-xs rounded backdrop-blur-sm">
                      {product.niche_name || product.category || 'China Import'}
                    </span>
                  </div>
                  {!canImport && (
                    <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                      <span className="px-3 py-1 bg-gray-900 text-white text-xs rounded-full">Upgrade to Import</span>
                    </div>
                  )}
                </div>

                <div className="p-2 lg:p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1 text-xs lg:text-sm">{product.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 lg:mb-3 line-clamp-2">{product.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {product.category || product.niche_name || 'China Import'}
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Available
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs lg:text-sm font-bold text-orange-600">{money(supplierPrice)}</span>
                    <Button
                      onClick={() => openPricing(product)}
                      disabled={!canImport || busyId === product.id}
                      className={`shrink-0 bg-orange-500 hover:bg-orange-600 text-white px-3 lg:px-4`}
                      size="sm"
                    >
                      {busyId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Configure Pricing</>}
                    </Button>
                  </div>


                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {configuringProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={event => {
            if (event.target === event.currentTarget) setConfiguringProduct(null);
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="china-import-pricing-title"
              className="bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-7 max-w-2xl w-full max-h-[90dvh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6 gap-4">
                <h2 id="china-import-pricing-title" className="text-2xl font-extrabold text-gray-900 dark:text-white">Configure Pricing</h2>
                <button onClick={() => setConfiguringProduct(null)} aria-label="Close pricing dialog" className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl mb-6">
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {imageOf(configuringProduct) ? (
                    <img src={imageOf(configuringProduct)} className="w-full h-full object-cover" alt={configuringProduct.name} />
                  ) : <Package className="w-8 h-8 text-gray-300" />}
                </div>
                <div className="min-w-0 flex-1 self-center">
                  <p className="font-bold text-xl text-gray-900 dark:text-white line-clamp-2">{configuringProduct.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Niche: {configuringProduct.niche_name || configuringProduct.category || 'China Import'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Supplier Price: {money(Math.max(Number(configuringProduct.price_ngn ?? 0), 0))}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex justify-between items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                  <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2"><AlertCircle className="w-5 h-5" />Dropship Base Cost:</span>
                  <span className="font-extrabold text-xl sm:text-2xl text-gray-900 dark:text-white">
                    {money(Math.max(Number(configuringProduct.price_ngn ?? 0), 0))}
                  </span>
                </div>

                <div>
                  <label htmlFor="china-import-selling-price" className="block text-base font-bold text-gray-700 dark:text-gray-300 mb-3">Set Your Selling Price (₦)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">₦</span>
                    <input
                      id="china-import-selling-price"
                      type="number"
                      min={Math.ceil(Math.max(Number(configuringProduct.price_ngn ?? 0), 0))}
                      step="1"
                      inputMode="numeric"
                      value={markupPrice}
                      onChange={event => setMarkupPrice(event.target.value)}
                      className="w-full pl-10 pr-4 py-4 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500 outline-none font-extrabold text-2xl text-orange-600"
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">This is the price customers will pay for the product on your store. China shipping is calculated separately at checkout.</p>
                </div>

                <div className="p-5 bg-green-50 dark:bg-green-500/10 rounded-2xl border border-green-100 dark:border-green-800">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-green-700 dark:text-green-400 text-base font-medium">Your Profit per Sale:</span>
                    <span className="text-green-700 dark:text-green-400 font-extrabold text-2xl">
                      {money(Math.max(0, (Number(markupPrice) || 0) - Math.max(Number(configuringProduct.price_ngn ?? 0), 0)))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="flex-1 py-6 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300" onClick={() => setConfiguringProduct(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 py-6 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => void addToStore(configuringProduct, markupPrice)}
                  disabled={busyId === configuringProduct.id || !markupPrice || Number(markupPrice) < Math.max(Number(configuringProduct.price_ngn ?? 0), 0)}
                >
                  {busyId === configuringProduct.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5 mr-2" />Add to Store</>}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
