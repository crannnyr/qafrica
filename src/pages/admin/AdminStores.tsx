import { useEffect, useState } from 'react';
import { Search, Eye, Ban, Check, X, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  is_verified: boolean;
  is_blocked: boolean;
  block_reason: string | null;
  custom_domain: string | null;
  domain_status: string;
  delivery_mode: string;
  niches: string[];
  created_at: string;
  owner_email: string;
  owner_name: string;
}

const DOMAIN_STATUS: Record<string, { label: string; color: string }> = {
  none:    { label: 'No domain',  color: 'bg-gray-100 text-gray-500'   },
  pending: { label: 'Pending',    color: 'bg-amber-100 text-amber-700' },
  active:  { label: 'Live',       color: 'bg-green-100 text-green-700' },
  failed:  { label: 'Failed',     color: 'bg-red-100 text-red-600'     },
};

function getStoreUrl(store: StoreRow): string {
  if (store.custom_domain && store.domain_status === 'active') {
    return `https://${store.custom_domain}`;
  }
  return `${window.location.origin}/${store.slug}`;
}

export default function AdminStores() {
  const [stores, setStores]         = useState<StoreRow[]>([]);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [isLoading, setIsLoading]   = useState(true);
  const [blockModal, setBlockModal] = useState<{ storeId: string; name: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isSaving, setIsSaving]     = useState(false);

  const fetchStores = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stores')
      .select(`
        id, name, slug, is_active, is_verified, is_blocked,
        block_reason, custom_domain, domain_status,
        delivery_mode, niches, created_at,
        profiles!stores_owner_id_fkey (email, full_name)
      `)
      .eq('is_developer_shadow', false)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setStores(data.map((s: any) => ({
        ...s,
        owner_email: s.profiles?.email || '—',
        owner_name:  s.profiles?.full_name || '—',
      })));
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchStores(); }, []);

  const filtered = stores.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
                        s.slug?.toLowerCase().includes(search.toLowerCase()) ||
                        s.owner_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all'      ? true :
      statusFilter === 'active'   ? s.is_active && !s.is_blocked :
      statusFilter === 'blocked'  ? s.is_blocked :
      statusFilter === 'unverified' ? !s.is_verified :
      statusFilter === 'inactive' ? !s.is_active : true;
    return matchSearch && matchStatus;
  });

  const handleVerify = async (storeId: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('stores')
      .update({ is_verified: true })
      .eq('id', storeId);
    if (error) toast.error('Failed to verify store');
    else { toast.success('Store verified'); await fetchStores(); }
    setIsSaving(false);
  };

  const handleToggleActive = async (store: StoreRow) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('stores')
      .update({ is_active: !store.is_active })
      .eq('id', store.id);
    if (error) toast.error('Failed to update store');
    else { toast.success(store.is_active ? 'Store deactivated' : 'Store activated'); await fetchStores(); }
    setIsSaving(false);
  };

  const handleBlock = async () => {
    if (!blockModal) return;
    if (!blockReason.trim()) { toast.error('Please enter a block reason'); return; }
    setIsSaving(true);
    const { error } = await supabase
      .from('stores')
      .update({ is_blocked: true, block_reason: blockReason.trim(), is_active: false })
      .eq('id', blockModal.storeId);
    if (error) toast.error('Failed to block store');
    else { toast.success('Store blocked'); await fetchStores(); }
    setIsSaving(false);
    setBlockModal(null);
    setBlockReason('');
  };

  const handleUnblock = async (storeId: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('stores')
      .update({ is_blocked: false, block_reason: null })
      .eq('id', storeId);
    if (error) toast.error('Failed to unblock store');
    else { toast.success('Store unblocked'); await fetchStores(); }
    setIsSaving(false);
  };

  const handleApproveDomain = async (storeId: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('stores')
      .update({ domain_status: 'active' })
      .eq('id', storeId);
    if (error) toast.error('Failed to approve domain');
    else { toast.success('Domain approved'); await fetchStores(); }
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stores</h1>
          <p className="text-xs text-gray-400 mt-0.5">{stores.length} total stores</p>
        </div>
        <button onClick={fetchStores} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, slug or owner..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white">
          <option value="all">All stores</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="blocked">Blocked</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Store', 'Owner', 'Status', 'Domain', 'Actions'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No stores found</td></tr>
              ) : filtered.map(store => (
                <tr key={store.id} className={`hover:bg-gray-50 transition-colors ${store.is_blocked ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-xs">{store.name}</p>
                    <p className="text-[10px] text-gray-400">/{store.slug}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(store.niches || []).slice(0, 2).map(n => (
                        <span key={n} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[9px]">
                          {CONFIG.NICHES?.find((cn: any) => cn.id === n)?.name || n}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-700">{store.owner_name}</p>
                    <p className="text-[10px] text-gray-400">{store.owner_email}</p>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${
                        store.is_blocked  ? 'bg-red-100 text-red-700' :
                        store.is_active   ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-500'
                      }`}>
                        {store.is_blocked ? 'Blocked' : store.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {!store.is_verified && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] w-fit">
                          Unverified
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${
                        DOMAIN_STATUS[store.domain_status]?.color || 'bg-gray-100 text-gray-500'
                      }`}>
                        {DOMAIN_STATUS[store.domain_status]?.label || store.domain_status}
                      </span>
                      {store.custom_domain && (
                        <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{store.custom_domain}</p>
                      )}
                      {store.domain_status === 'pending' && (
                        <button onClick={() => handleApproveDomain(store.id)} disabled={isSaving}
                          className="text-[10px] text-orange-500 hover:underline text-left">
                          Approve →
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* View store */}
                      <a href={getStoreUrl(store)} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="View store">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {/* Verify */}
                      {!store.is_verified && (
                        <button onClick={() => handleVerify(store.id)} disabled={isSaving}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Verify store">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Activate / Deactivate */}
                      {!store.is_blocked && (
                        <button onClick={() => handleToggleActive(store)} disabled={isSaving}
                          className={`p-1.5 rounded-lg transition-colors ${
                            store.is_active
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-green-500 hover:bg-green-50'
                          }`}
                          title={store.is_active ? 'Deactivate store' : 'Activate store'}>
                          {store.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {/* Block / Unblock */}
                      {store.is_blocked ? (
                        <button onClick={() => handleUnblock(store.id)} disabled={isSaving}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Unblock store">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => setBlockModal({ storeId: store.id, name: store.name })}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Block store">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Block Modal */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Block "{blockModal.name}"</h3>
              <button onClick={() => setBlockModal(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              This will deactivate and block the store. Owner will see the block reason.
            </p>
            <textarea value={blockReason} onChange={e => setBlockReason(e.target.value)}
              placeholder="e.g. Selling counterfeit goods..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 min-h-[80px] resize-none" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setBlockModal(null)}
                className="flex-1 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleBlock} disabled={isSaving || !blockReason.trim()}
                className="flex-1 px-3 py-2 text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 transition-colors">
                {isSaving ? 'Blocking...' : 'Block Store'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}