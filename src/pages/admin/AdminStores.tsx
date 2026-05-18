import { useEffect, useState } from 'react';
import { Store, Search, CheckCircle, XCircle, Eye, Ban, Check } from 'lucide-react';
import { useAdminStore } from '@/stores';
import { toast } from 'sonner';

export default function AdminStores() {
  const { stores, fetchAllStores, verifyStore, blockStore } = useAdminStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAllStores();
  }, [fetchAllStores]);

  const handleVerify = async (storeId: string) => {
    const result = await verifyStore(storeId);
    if (result.success) {
      toast.success('Store verified successfully');
    } else {
      toast.error('Failed to verify store');
    }
  };

  const handleBlock = async (storeId: string) => {
    const result = await blockStore(storeId, 'Violation of terms');
    if (result.success) {
      toast.success('Store blocked');
    } else {
      toast.error('Failed to block store');
    }
  };

  const filteredStores = stores.filter((store) =>
    store.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
          <p className="text-gray-500 mt-1">Manage platform stores</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search stores..."
          className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
        />
      </div>

      {/* Stores Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStores.map((store) => (
                <tr key={store.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Store className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{store.name}</p>
                        <p className="text-sm text-gray-500">{store.slug}.qafrica.store</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {store.owner_id?.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      store.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {store.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {store.is_verified ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!store.is_verified && (
                        <button
                          onClick={() => handleVerify(store.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Verify Store"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}
                      <a
                        href={`https://${store.slug}.qafrica.store`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="View Store"
                      >
                        <Eye className="w-5 h-5" />
                      </a>
                      <button
                        onClick={() => handleBlock(store.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Block Store"
                      >
                        <Ban className="w-5 h-5" />
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
