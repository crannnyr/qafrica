import { useEffect, useState } from 'react';
import { Package, Search, Store, Eye, Trash2, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { productService } from '@/services';
import { toast } from 'sonner';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await productService.getAllProducts();
    if (error) toast.error('Could not load products: ' + error.message);
    else setProducts(data ?? []);
    setLoading(false);
  };

  const productImages = (product: any): string[] => {
    const candidates = [product.image_url, product.image, ...(Array.isArray(product.image_urls) ? product.image_urls : []), ...(Array.isArray(product.images) ? product.images : [])];
    return [...new Set(candidates.filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)))];
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const { error } = await productService.deleteProduct(id);
    if (!error) {
      toast.success('Product deleted');
      loadProducts();
    }
  };

  const reviewProduct = async (id: string, decision: 'approved' | 'rejected' | 'pending') => {
    setBusyId(id);
    const { data, error } = await (await import('@/services')).supabase.rpc('admin_review_marketplace_product', { p_product_id: id, p_decision: decision });
    if (error || !data?.ok) toast.error(error?.message || 'Could not update approval status');
    else { toast.success(decision === 'approved' ? 'Product approved for marketplace' : decision === 'rejected' ? 'Product rejected' : 'Product returned to review'); await loadProducts(); }
    setBusyId(null);
  };

  const filteredProducts = products.filter((p) => p.name?.toLowerCase().includes(searchQuery.toLowerCase()) && (approvalFilter === 'all' || (p.marketplace_approval_status ?? 'approved') === approvalFilter));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-500 mt-1">Review marketplace submissions and manage platform products.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">{(['pending', 'approved', 'rejected', 'all'] as const).map(status => <button key={status} onClick={() => setApprovalFilter(status)} className={'px-4 py-2 rounded-lg text-sm font-semibold capitalize ' + (approvalFilter === status ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600')}>{status === 'all' ? 'All products' : status}</button>)}<button onClick={() => void loadProducts()} className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm"><RefreshCw className="w-4 h-4"/>Refresh</button></div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marketplace status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Review</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && filteredProducts.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">{searchQuery ? 'No products match your search.' : 'No products in this review category.'}</td></tr>}
              {loading && <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">Loading products…</td></tr>}
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setSelectedProduct(product)} className="w-14 h-14 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center" aria-label="View product images">
                        {productImages(product)[0] ? <img src={productImages(product)[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover" /> : <Package className="w-5 h-5 text-gray-400" />}
                      </button>
                      <div className="min-w-0"><button type="button" onClick={() => setSelectedProduct(product)} className="text-left font-semibold text-gray-900 hover:text-orange-600">{product.name}</button><p className="mt-1 text-xs text-gray-400">{productImages(product).length} image(s) · ID {String(product.id).slice(0,8)}</p></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      {product.store_id?.slice(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ₦{product.selling_price?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{product.stock_quantity}</td>
                  <td className="px-6 py-4"><span className={'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold capitalize ' + ((product.marketplace_approval_status ?? 'approved') === 'approved' ? 'bg-emerald-100 text-emerald-700' : (product.marketplace_approval_status ?? 'approved') === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')}>{(product.marketplace_approval_status ?? 'approved') === 'pending' ? <Clock className="w-3 h-3"/> : (product.marketplace_approval_status ?? 'approved') === 'approved' ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}{product.marketplace_approval_status ?? 'approved'}</span></td>
                  <td className="px-6 py-4 text-right"><div className="inline-flex gap-1"><button disabled={busyId === product.id} onClick={() => void reviewProduct(product.id, 'approved')} className="px-2.5 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">Approve</button><button disabled={busyId === product.id} onClick={() => void reviewProduct(product.id, 'rejected')} className="px-2.5 py-1.5 rounded-md bg-red-600 text-white text-xs font-bold disabled:opacity-50">Reject</button>{(product.marketplace_approval_status ?? 'approved') !== 'pending' && <button disabled={busyId === product.id} onClick={() => void reviewProduct(product.id, 'pending')} className="px-2.5 py-1.5 rounded-md border text-xs font-bold disabled:opacity-50">Reset</button>}</div></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setSelectedProduct(product)} aria-label="View product details" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-5 h-5" /></button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedProduct && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><div><h2 className="text-lg font-bold">Product review</h2><p className="text-xs text-gray-500">Inspect images and listing details before approval.</p></div><button type="button" onClick={() => setSelectedProduct(null)} className="rounded-lg border px-3 py-2 text-sm">Close</button></div><div className="grid gap-5 p-5 md:grid-cols-2"><div><div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-gray-50">{productImages(selectedProduct)[0] ? <img src={productImages(selectedProduct)[0]} alt={selectedProduct.name} className="h-full w-full object-contain" /> : <div className="p-8 text-center text-sm text-gray-400"><Package className="mx-auto mb-2 h-8 w-8"/>No product image uploaded</div>}</div>{productImages(selectedProduct).length > 1 && <div className="mt-3 grid grid-cols-4 gap-2">{productImages(selectedProduct).map((url:string,i:number)=><a key={url} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border"><img src={url} alt={selectedProduct.name + ' image ' + (i+1)} className="h-full w-full object-cover"/></a>)}</div>}</div><div className="space-y-4"><div><h3 className="text-xl font-bold">{selectedProduct.name}</h3><p className="mt-1 break-all text-xs text-gray-400">Product ID: {selectedProduct.id}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Selling price</p><p className="mt-1 font-bold">₦{Number(selectedProduct.selling_price ?? selectedProduct.price ?? 0).toLocaleString('en-NG')}</p></div><div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Stock</p><p className="mt-1 font-bold">{selectedProduct.stock_quantity ?? '—'}</p></div><div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Category</p><p className="mt-1 font-semibold">{selectedProduct.category || 'Uncategorized'}</p></div><div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Images</p><p className="mt-1 font-semibold">{productImages(selectedProduct).length}</p></div></div><div><p className="mb-1 text-sm font-semibold">Description</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{selectedProduct.description || 'No description provided.'}</p></div><div className="flex flex-wrap gap-2 border-t pt-4"><button disabled={busyId===selectedProduct.id} onClick={async()=>{await reviewProduct(selectedProduct.id,'approved');setSelectedProduct(null);}} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Approve product</button><button disabled={busyId===selectedProduct.id} onClick={async()=>{await reviewProduct(selectedProduct.id,'rejected');setSelectedProduct(null);}} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Reject product</button></div></div></div></div></div>}
    </div>
  );
}
