import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, Plus, Store, Filter, X, Check, AlertCircle, DollarSign, Loader2, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore, useImportStore, useAuthStore } from '@/stores';
import { toast } from 'sonner';
import { importCatalogService } from '@/services';
import type { StoreOwner } from '@/types';
type FilterType = 'all' | 'my_niches' | 'other';

export default function ImportCatalogPage() {
  const { currentStore } = useStoreStore();
  const { user } = useAuthStore();
  const { imports, fetchStoreImports, importProduct, updateImport, deleteImport } = useImportStore();
  const [activeTab, setActiveTab] = useState<'browse' | 'imported'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('my_niches');
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // NEW: State for the Price Configuration Modal
  const [configuringProduct, setConfiguringProduct] = useState<any | null>(null);
  const [markupPrice, setMarkupPrice] = useState<string>('');
  const [editingImportId, setEditingImportId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [isDeletingImport, setIsDeletingImport] = useState<string | null>(null);

  const storeNiches = currentStore?.niches || [];
  const isUnlimited = (user as any)?.subscription_tier === 'unlimited';
  useEffect(() => {
    if (currentStore?.id) {
      fetchStoreImports(currentStore.id);
      fetchProducts();
    }
  }, [currentStore, filterType]);

  const fetchProducts = async () => {
    if (!currentStore?.id) return;
    
    setIsLoading(true);
    try {
      let query = importCatalogService.getAvailableProducts('', currentStore.id);
      
      // Apply niche filtering
      if (filterType === 'my_niches' && storeNiches.length > 0 && !isUnlimited) {
        // Only show products from user's niches (unless unlimited)
        const { data, error } = await importCatalogService.getAvailableProductsByNiches(
          storeNiches,
          currentStore.id
        );
        if (error) throw error;
        setAvailableProducts(data || []);
      } else if (filterType === 'other' && !isUnlimited) {
        // Show products from other niches (excluding user's niches)
        const { data, error } = await importCatalogService.getAvailableProductsExcludingNiches(
          storeNiches,
          currentStore.id
        );
        if (error) throw error;
        setAvailableProducts(data || []);
      } else {
        // Show all (for unlimited plans or 'all' filter)
        const { data, error } = await importCatalogService.getAllAvailableProducts(currentStore.id);
        if (error) throw error;
        setAvailableProducts(data || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error('Failed to load products');
    }
    setIsLoading(false);
  };

  // UPDATED: Opens the modal instead of instantly importing
  const startImportConfiguration = (product: any) => {
    if (!currentStore?.id || !currentStore?.owner_id) return;

    // Check if user can import from this niche
    if (!isUnlimited && !storeNiches.includes(product.niche)) {
      toast.error(`Upgrade to import products from the "${product.niche}" niche`);
      return;
    }

    setConfiguringProduct(product);
    
    // Suggest a 20% markup by default based on dropship price (or selling price if dropship price is 0)
    const basePrice = product.dropship_price || product.selling_price;
    const suggestedPrice = Math.ceil(basePrice * 1.2);
    setMarkupPrice(suggestedPrice.toString());
  };

  // NEW: Finalizes the import with the custom price
  const handleFinalizeImport = async () => {
    if (!configuringProduct || !currentStore?.id || !currentStore?.owner_id) return;

    const customPrice = parseFloat(markupPrice);
    const baseCost = configuringProduct.dropship_price || 0;

    if (isNaN(customPrice) || customPrice <= baseCost) {
      toast.error(`Your selling price must be higher than the supplier's dropship price (₦${baseCost.toLocaleString()})`);
      return;
    }

    setIsImporting(configuringProduct.id);

    const result = await importProduct({
      original_product_id: configuringProduct.id,
      original_store_id: configuringProduct.store_id,
      original_owner_id: configuringProduct.owner_id,
      importer_store_id: currentStore.id,
      importer_owner_id: currentStore.owner_id,
      name: configuringProduct.name,
      description: configuringProduct.description,
      images: configuringProduct.images,
      category: configuringProduct.category,
      niche: configuringProduct.niche,
      selling_price: configuringProduct.selling_price, 
      dropship_price: configuringProduct.dropship_price,
      custom_selling_price: customPrice, // Injecting the markup price here
      is_active: true,
      total_sales: 0,
    });

    if (result.success) {
      toast.success('Product imported successfully!');
      fetchStoreImports(currentStore.id); // Refresh imports list
      setConfiguringProduct(null); // Close modal
    } else {
      toast.error(result.error || 'Failed to import product');
    }

    setIsImporting(null);
  };

  const handleDeleteImport = async (importId: string) => {
    setIsDeletingImport(importId);
    const result = await deleteImport(importId);
    if (result.success) {
      toast.success('Product removed from your store');
      fetchStoreImports(currentStore!.id);
    } else {
      toast.error(result.error || 'Failed to remove product');
    }
    setIsDeletingImport(null);
  };

  const handleSavePrice = async (importId: string, dropshipPrice: number) => {
    const newPrice = parseFloat(editingPrice);
    if (isNaN(newPrice) || newPrice <= dropshipPrice) {
      toast.error(`Price must be higher than the dropship cost (₦${dropshipPrice.toLocaleString()})`);
      return;
    }
    const result = await updateImport(importId, { custom_selling_price: newPrice });
    if (result.success) {
      toast.success('Price updated');
      setEditingImportId(null);
    } else {
      toast.error(result.error || 'Failed to update price');
    }
  };

  const filteredProducts = availableProducts.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build a set of already-imported product IDs for O(1) lookup
  const importedProductIds = new Set(imports.map(i => i.original_product_id));

  const getFilterLabel = (type: FilterType) => {
    switch (type) {
      case 'my_niches': return 'My Niches';
      case 'other': return 'Other Niches';
      case 'all': return 'All Products';
      default: return 'Filter';
    }
  };

  return (
    <div className="space-y-6 relative">
     {/* Header */}
     <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Catalog</h1>
          <p className="text-gray-500 mt-1">Browse and import products from other sellers</p>
        </div>
        {user && (
          <div className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
            Plan: <span className="font-medium text-orange-600 capitalize">
              {((user as StoreOwner)?.subscription_tier || 'free').replace('_', ' ')}
            </span>
            {!isUnlimited && (
              <span className="ml-2 text-gray-500">
                (Showing {filterType === 'my_niches' ? 'your niches' : 'other niches'})
              </span>
            )}
          </div>
        )}
      </div>
      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'browse'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Browse Products
        </button>
        <button
          onClick={() => setActiveTab('imported')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'imported'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Imports ({imports.length})
        </button>
      </div>

      {activeTab === 'browse' ? (
        <>
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products to import..."
                className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
              />
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2">
              {(['my_niches', 'other', 'all'] as FilterType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    filterType === type
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {getFilterLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Warning for non-unlimited users */}
          {!isUnlimited && filterType === 'other' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Limited Access</p>
                <p className="text-sm text-yellow-700 mt-1">
                  You can browse products from other niches, but you need the Unlimited plan to import them. 
                  <button 
                    onClick={() => window.location.href = '/dashboard/subscription'}
                    className="text-orange-600 hover:underline font-medium ml-1"
                  >
                    Upgrade now
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500 mb-4">
                {filterType === 'my_niches' 
                  ? "No products available in your niches yet. Try browsing 'Other Niches' or check back later."
                  : "No products match your search criteria."}
              </p>
              {filterType !== 'my_niches' && (
                <button
                  onClick={() => setFilterType('my_niches')}
                  className="text-orange-500 hover:text-orange-600 font-medium"
                >
                  View products in my niches
                </button>
              )}
            </div>
          ) : (
            // Change 3 — mobile grid resize
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-6">
              {filteredProducts.map((product, index) => {
                const canImport = isUnlimited || storeNiches.includes(product.niche);
                const isOwnProduct = product.store_id === currentStore?.id;
                const alreadyImported = importedProductIds.has(product.id);
                
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-lg ${
                      canImport ? 'border-gray-100' : 'border-gray-200 opacity-75'
                    }`}
                  >
                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img 
                          src={product.images[0]} 
                          alt={product.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9IiNGM0Y0RjYiLz48cGF0aCBkPSJNMyA2QzMgNC4zNDMxNSA0LjM0MzE1IDMgNiAzSDE4QzE5LjY1NjkgMyAyMSA0LjM0MzE1IDIxIDZWMThDMjEgMTkuNjU2OSAxOS42NTY5IDIxIDE4IDIxSDZDNC4zNDMxNSAyMSAzIDE5LjY1NjkgMyAxOFY2WiIgZmlsbD0iI0UzRTRFNiIvPjxwYXRoIGQ9Ik0xMiAxNi41QzE0LjQ4NTMgMTYuNSAxNi41IDE0LjQ4NTMgMTYuNSAxMkMxNi41IDkuNTE0NzIgMTQuNDg1MyA3LjUgMTIgNy41QzkuNTE0NzIgNy41IDcuNSA5LjUxNDcyIDcuNSAxMkM3LjUgMTQuNDg1MyA5LjUxNDcyIDE2LjUgMTIgMTYuNVoiIGZpbGw9IiM5Q0EzQUYiLz48L3N2Zz4=';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-16 h-16 text-gray-300" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="px-2 py-1 bg-gray-900/70 text-white text-xs rounded backdrop-blur-sm">
                          {product.niche}
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
                    {/* Change 3 — tightened card padding on mobile */}
                    <div className="p-2 lg:p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 text-xs lg:text-sm">{product.name}</h3>
                      <p className="text-xs text-gray-500 mb-2 lg:mb-3 line-clamp-2 hidden lg:block">{product.description}</p>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {product.category}
                        </span>
                        {product.is_importable && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Available
                          </span>
                        )}
                      </div>

                      {/* Change 3 — tightened price + button row */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm lg:text-lg font-bold text-orange-600">₦{product.selling_price?.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 hidden lg:block">Dropship: ₦{(product.dropship_price || 0).toLocaleString()}</p>
                        </div>
                        <Button
                          onClick={() => !alreadyImported && startImportConfiguration(product)}
                          disabled={isImporting === product.id || !canImport || isOwnProduct || alreadyImported}
                          className={`${
                            alreadyImported
                              ? 'bg-green-100 text-green-700 cursor-not-allowed'
                              : canImport && !isOwnProduct
                                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                          size="sm"
                        >
                          {isImporting === product.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : isOwnProduct ? (
                            'Yours'
                          ) : alreadyImported ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Added
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-1" />
                              Import
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Imported Products */
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {imports.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No imported products</h3>
              <p className="text-gray-500 mb-4">Browse the catalog to import products to your store</p>
              <Button
                onClick={() => setActiveTab('browse')}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Browse Catalog
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Niche</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Your Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {imports.map((item) => {
                    const isEditing = editingImportId === item.id;
                    const dropshipCost = item.dropship_price || 0;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {/* Product */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.images?.[0] ? (
                                <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <span className="font-medium text-gray-900 line-clamp-1">{item.name}</span>
                          </div>
                        </td>

                        {/* Niche */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {item.niche}
                          </span>
                        </td>

                        {/* Price — inline edit */}
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₦</span>
                                <input
                                  type="number"
                                  value={editingPrice}
                                  onChange={e => setEditingPrice(e.target.value)}
                                  className="w-28 pl-6 pr-2 py-1.5 text-sm rounded-lg border border-orange-300 focus:ring-2 focus:ring-orange-500 outline-none"
                                  autoFocus
                                />
                              </div>
                              <button
                                onClick={() => handleSavePrice(item.id, dropshipCost)}
                                className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                title="Save price"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingImportId(null)}
                                className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingImportId(item.id);
                                setEditingPrice(String(item.custom_selling_price || item.selling_price));
                              }}
                              className="group flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-orange-600 transition-colors"
                              title="Click to edit price"
                            >
                              ₦{(item.custom_selling_price || item.selling_price).toLocaleString()}
                              <DollarSign className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange-400 transition-colors" />
                            </button>
                          )}
                        </td>

                        {/* Sales */}
                        <td className="px-6 py-4 text-sm text-gray-600">{item.total_sales || 0}</td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDeleteImport(item.id)}
                            disabled={isDeletingImport === item.id}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Remove from your store"
                          >
                            {isDeletingImport === item.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <X className="w-3.5 h-3.5" />
                            }
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* NEW: Import Configuration Modal */}
      <AnimatePresence>
        {configuringProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Configure Pricing</h2>
                <button onClick={() => setConfiguringProduct(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex gap-4 p-4 bg-gray-50 rounded-xl mb-6">
                <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                  {configuringProduct.images?.[0] ? (
                    <img src={configuringProduct.images[0]} className="w-full h-full object-cover" alt="Product" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900 line-clamp-1">{configuringProduct.name}</p>
                  <p className="text-xs text-gray-500 mt-1">Niche: {configuringProduct.niche}</p>
                  <p className="text-xs text-gray-500">Supplier Price: ₦{configuringProduct.selling_price?.toLocaleString()}</p>
                </div>
              </div>

              {/* Change 4 — Group chat banner */}
              {configuringProduct.store?.group_chat_url && (
                <a
                  href={configuringProduct.store.group_chat_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl mb-4 hover:bg-green-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800">Join the seller's group chat</p>
                    <p className="text-xs text-green-600">Get promotional content, videos & updates before importing</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-green-600 flex-shrink-0" />
                </a>
              )}

              <div className="space-y-6">
                <div className="flex justify-between text-sm items-center border-b pb-4">
                  <span className="text-gray-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Dropship Base Cost:
                  </span>
                  <span className="font-bold text-gray-900 text-lg">
                    ₦{(configuringProduct.dropship_price || 0).toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Set Your Selling Price (₦)</label>
                  {/* Change 1 — ₦ text character instead of DollarSign icon */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-base">₦</span>
                    <input 
                      type="number" 
                      value={markupPrice} 
                      onChange={(e) => setMarkupPrice(e.target.value)} 
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none font-bold text-lg text-orange-600" 
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">This is the price your customers will pay on your store.</p>
                </div>

                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 text-sm font-medium">Your Profit per Sale:</span>
                    <span className="text-green-700 font-bold text-xl">
                      ₦{Math.max(0, (parseFloat(markupPrice) || 0) - (configuringProduct.dropship_price || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 py-6 border-gray-200 text-gray-600 hover:bg-gray-50" 
                  onClick={() => setConfiguringProduct(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-6" 
                  onClick={handleFinalizeImport} 
                  disabled={isImporting === configuringProduct.id}
                >
                  {isImporting === configuringProduct.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Add to Store
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}