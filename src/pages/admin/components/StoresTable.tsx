import { Loader2, Search, Truck, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
import { useState } from 'react';
import type { StoreRow } from '../index';

export function StoresTable({ stores, isLoading, globalEnabled, togglingStoreId, onToggle }: {
  stores: StoreRow[];
  isLoading: boolean;
  globalEnabled: boolean;
  togglingStoreId: string | null;
  onToggle: (storeId: string, current: boolean) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.owner_email?.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stores..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {filtered.length} of {stores.length} stores
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">No stores found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Store', 'Owner', 'Mode', 'Shipbubble Access', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(store => (
                <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-xs">{store.name}</p>
                    <p className="text-[10px] text-gray-400">/{store.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-500 truncate max-w-[160px]">{store.owner_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      store.delivery_mode === 'shipbubble'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {store.delivery_mode === 'shipbubble'
                        ? <><Truck className="w-3 h-3" /> Shipbubble</>
                        : <><MapPin className="w-3 h-3" /> Manual</>
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      store.shipbubble_enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {store.shipbubble_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onToggle(store.id, store.shipbubble_enabled)}
                      disabled={!!togglingStoreId || !globalEnabled}
                      title={!globalEnabled ? 'Enable Shipbubble globally first' : ''}
                      className="disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {togglingStoreId === store.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                      ) : store.shipbubble_enabled ? (
                        <ToggleRight className="w-6 h-6 text-orange-500 hover:text-orange-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-300 hover:text-gray-400" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}