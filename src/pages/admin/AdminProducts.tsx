import { useEffect, useState } from 'react';
import { Package, Search, Store, Eye, Trash2, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { productService } from '@/services';
import { toast } from 'sonner';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await productService.getAllProducts();
    if (data) setProducts(data);
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
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                      <span className="font-medium text-gray-900">{product.name}</span>
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
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye className="w-5 h-5" />
                      </button>
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
    </div>
  );
}
