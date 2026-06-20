import { MapPin, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import CONFIG from '@/lib/config';
import type { DeliveryZone } from '../types';

export function ManualZonesTable({
  zones, editingZoneId, editingZonePrice, isSavingZone, isDeleting,
  setEditingZoneId, setEditingZonePrice, onSavePrice, onDelete,
}: {
  zones: DeliveryZone[];
  editingZoneId: string | null;
  editingZonePrice: string;
  isSavingZone: boolean;
  isDeleting: string | null;
  setEditingZoneId: (id: string | null) => void;
  setEditingZonePrice: (price: string) => void;
  onSavePrice: (zoneId: string) => void;
  onDelete: (zoneId: string) => void;
}) {
  if (zones.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
        <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No delivery zones set up yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {['State', 'Your Price', 'Customer Pays', ''].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {zones.map(zone => {
            const isEditing = editingZoneId === zone.id;
            const displayPrice = isEditing ? parseFloat(editingZonePrice) || zone.price : zone.price;

            return (
              <tr key={zone.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-900">{zone.state}</span>
                  </div>
                </td>

                <td className="px-4 py-3">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                        <input
                          type="number"
                          value={editingZonePrice}
                          onChange={e => setEditingZonePrice(e.target.value)}
                          className="w-24 pl-5 pr-2 py-1 text-xs rounded-lg border border-orange-300 focus:ring-2 focus:ring-orange-500 outline-none"
                          autoFocus
                          min={0}
                        />
                      </div>
                      <button onClick={() => onSavePrice(zone.id)} disabled={isSavingZone}
                        className="p-1 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50">
                        {isSavingZone
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Check className="w-3 h-3" />
                        }
                      </button>
                      <button onClick={() => setEditingZoneId(null)}
                        className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingZoneId(zone.id); setEditingZonePrice(String(zone.price)); }}
                      className="group flex items-center gap-1 text-xs text-gray-600 hover:text-orange-600"
                    >
                      ₦{zone.price.toLocaleString()}
                      <Pencil className="w-3 h-3 text-gray-300 group-hover:text-orange-400" />
                    </button>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-gray-900">
                    ₦{(displayPrice + CONFIG.PLATFORM_MARKUP).toLocaleString()}
                  </span>
                </td>

                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(zone.id)}
                    disabled={!!isDeleting || isEditing}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors"
                  >
                    {isDeleting === zone.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}