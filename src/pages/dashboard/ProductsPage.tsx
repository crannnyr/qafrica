import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, Package, Eye, Tag, Download, Network, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';
import ImageCarousel from '@/components/ImageCarousel';

const categories = ['All', 'Active', 'Inactive', 'Out of Stock'];
const productTypes = ['All Types', 'My Products', 'Imported'];

export default function ProductsPage() {
  const navigate = useNavigate();
  const { products, fetchProducts, deleteProduct, currentStore } = useStoreStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All Types');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    if (currentStore?.id) {
      fetchProducts(currentStore.id);
    }
  }, [currentStore, fetchProducts]);

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
    
    setIsDeleting(productId);
    const result = await deleteProduct(productId);
    
    if (result.success) {
      toast.success('Product deleted successfully');
    } else {
      toast.error(result.error || 'Failed to delete product');
    }
    
    setIsDeleting(null);
  };

  const handleQuickView = (productId: string) => {
    setSelectedProduct(selectedProduct === productId ? null : productId);
  };

  const isProductImported = (product: any) => {
    return product.original_owner_id && product.original_owner_id !== currentStore?.owner_id;
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.description?.toLowerCase().includes(searchQuery.toLowerCase());
                          
    const matchesCategory = selectedCategory === 'All' || 
      (selectedCategory === 'Active' && product.is_active) ||
      (selectedCategory === 'Inactive' && !product.is_active) ||
      (selectedCategory === 'Out of Stock' && (product.stock_quantity === 0 || product.is_out_of_stock));

    const isImported = isProductImported(product);
    const matchesType = selectedType === 'All Types' ||
      (selectedType === 'My Products' && !isImported) ||
      (selectedType === 'Imported' && isImported);

    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your store products</p>
        </div>
        <Button 
          onClick={() => navigate('/dashboard/products/add')}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{products.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">My Products</p>
          <p className="text-2xl font-bold text-blue-600">{products.filter(p => !isProductImported(p)).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Imported</p>
          <p className="text-2xl font-bold text-indigo-600">{products.filter(p => isProductImported(p)).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
          <p className="text-2xl font-bold text-green-600">{products.filter(p => p.is_active).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or description..."
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
          />
        </div>
        
        {/* Type Dropdown Filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          {productTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        {/* Status Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 items-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-orange-500 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {searchQuery || selectedType !== 'All Types' ? 'No products match your filters' : 'No products yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery || selectedType !== 'All Types' ? 'Try adjusting your search terms or filters' : 'Start adding products to your store'}
          </p>
          {!searchQuery && selectedType === 'All Types' && (
            <div className="flex justify-center gap-4">
              <Button 
                onClick={() => navigate('/dashboard/products/add')}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your Own Product
              </Button>
              <Button 
                onClick={() => navigate('/dashboard/import-catalog')}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Import from QAFRICA
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product, index) => {
            const isImported = isProductImported(product);
            const profit = isImported ? (product.selling_price || 0) - (product.dropship_price || 0) : 0;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all group flex flex-col"
              >
                {/* Product Image with Carousel */}
                <div className="relative aspect-square bg-gray-50 dark:bg-gray-900">
                  {product.images && product.images.length > 0 ? (
                    <ImageCarousel 
                      images={product.images} 
                      aspectRatio="square" 
                      showThumbnails={false}
                      className="h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-gray-300 dark:text-gray-700" />
                    </div>
                  )}
                  
                  {/* Status Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {isImported && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-indigo-500 text-white flex items-center gap-1 shadow-sm">
                        <Download className="w-3 h-3" />
                        Imported
                      </span>
                    )}
                    {!product.is_active && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500 text-white shadow-sm">
                        Inactive
                      </span>
                    )}
                    {(product.stock_quantity === 0 || product.is_out_of_stock) && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500 text-white shadow-sm">
                        Out of Stock
                      </span>
                    )}
                    {product.stock_quantity > 0 && product.stock_quantity <= (product.low_stock_threshold || 10) && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white shadow-sm">
                        Low Stock
                      </span>
                    )}
                  </div>

                  {/* Quick Actions Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => navigate(`/dashboard/products/edit/${product.id}`)}
                      className="p-3 bg-white rounded-full hover:bg-orange-50 transition-colors"
                      title="Edit Product"
                    >
                      <Edit className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => handleQuickView(product.id)}
                      className="p-3 bg-white rounded-full hover:bg-orange-50 transition-colors"
                      title="Quick View"
                    >
                      <Eye className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4 flex flex-col flex-grow">
                  {/* Niche & Category */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      <Tag className="w-3 h-3 mr-1" />
                      {product.niche || 'General'}
                    </span>
                    {product.category && (
                      <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-2 py-1 rounded">
                        {product.category}
                      </span>
                    )}
                  </div>

                  <h3 
                    className="font-semibold text-gray-900 dark:text-white mb-1 truncate cursor-pointer hover:text-orange-600 transition-colors"
                    onClick={() => navigate(`/dashboard/products/edit/${product.id}`)}
                  >
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 flex-grow">{product.description || 'No description'}</p>
                  
                  {/* Pricing & Stock (Dynamic based on Imported vs Native) */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                    {isImported ? (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Customer Pays:</span>
                          <span className="font-bold text-gray-900 dark:text-white">₦{product.selling_price?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Supplier Cost:</span>
                          <span className="font-medium text-gray-600 dark:text-gray-300">₦{product.dropship_price?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-1 border-t border-gray-200 dark:border-gray-600">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Your Profit:</span>
                          <span className="font-bold text-green-600 dark:text-green-400">₦{profit.toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-orange-600">₦{product.selling_price?.toLocaleString()}</p>
                          {product.dropship_price > 0 && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                              <Network className="w-3 h-3" /> Dropship: ₦{product.dropship_price.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            product.stock_quantity === 0 ? 'text-red-500' :
                            product.stock_quantity <= (product.low_stock_threshold || 10) ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {product.stock_quantity} in stock
                          </p>
                          {product.has_variants && (
                            <p className="text-xs text-gray-400 mt-0.5">Has variants</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-2 mt-auto">
                    <div className="flex gap-2">
                      <Link 
                        to={`/dashboard/products/edit/${product.id}`}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200 transition-colors text-sm font-medium"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={isDeleting === product.id}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                        title="Delete Product"
                      >
                        {isDeleting === product.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    
                    {/* Manual Sales Entry Button - NEW */}
                    <Link
                      to={`/dashboard/manual-sales?productId=${product.id}&productName=${encodeURIComponent(product.name)}&price=${product.selling_price}`}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-lg transition-colors text-sm font-medium"
                      title="Record a Manual Sale"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Manual Sale
                    </Link>
                  </div>
                </div>

                {/* Quick View Modal */}
                {selectedProduct === product.id && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {isImported && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                                  Imported
                                </span>
                              )}
                              <span className="text-sm text-gray-500 dark:text-gray-400">{product.niche} • {product.category}</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h2>
                          </div>
                          <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                            <span className="sr-only">Close</span>
                            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6 mt-6">
                          <ImageCarousel images={product.images || []} aspectRatio="square" />
                          <div className="space-y-6">
                            <div>
                              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Description</p>
                              <p className="text-gray-900 dark:text-gray-300">{product.description || 'No description available'}</p>
                            </div>

                            {/* Conditional Pricing Box */}
                            {isImported ? (
                              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 space-y-3 border border-indigo-100 dark:border-indigo-800/50">
                                <div className="flex justify-between items-center">
                                  <span className="text-indigo-900 dark:text-indigo-300 font-medium">Customer Pays</span>
                                  <span className="text-lg font-bold text-indigo-900 dark:text-indigo-300">₦{product.selling_price?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-indigo-900/70 dark:text-indigo-300/70">Supplier Base Cost</span>
                                  <span className="font-medium text-indigo-900/70 dark:text-indigo-300/70">- ₦{product.dropship_price?.toLocaleString()}</span>
                                </div>
                                <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800/50 flex justify-between items-center">
                                  <span className="font-bold text-green-600 dark:text-green-400 uppercase tracking-wider text-sm">Your Margin</span>
                                  <span className="text-xl font-bold text-green-600 dark:text-green-400">₦{profit.toLocaleString()}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Selling Price</p>
                                  <p className="text-xl font-bold text-orange-600">₦{product.selling_price?.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Stock</p>
                                  <p className="text-xl font-bold text-gray-900 dark:text-white">{product.stock_quantity} units</p>
                                </div>
                                {product.dropship_price > 0 && (
                                  <div className="col-span-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                      <Network className="w-4 h-4" /> Available to dropshippers for ₦{product.dropship_price.toLocaleString()}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {product.has_variants && product.variants && (
                              <div>
                                <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Variants</p>
                                <div className="flex flex-wrap gap-2">
                                  {product.variants.map((variant: any, idx: number) => (
                                    <span key={idx} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium">
                                      {Object.entries(variant.options || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                              <Button 
                                onClick={() => {
                                  setSelectedProduct(null);
                                  navigate(`/dashboard/products/edit/${product.id}`);
                                }}
                                className="flex-1 bg-orange-500 hover:bg-orange-600 py-6 text-md font-bold"
                              >
                                Edit Product
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}