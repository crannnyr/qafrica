import { MapPin, Pencil, Check, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import CONFIG from '@/lib/config';
import type { DeliveryZone } from '../types';

export function ManualZonesTable({
  zones, editingZoneId, editingZonePrice, isSavingZone, isToggling,
  setEditingZoneId, setEditingZonePrice, onSavePrice, onToggleActive,
}: {
  zones: DeliveryZone[];
  editingZoneId: string | null;
  editingZonePrice: string;
  isSavingZone: boolean;
  isToggling: string | null;
  setEditingZoneId: (id: string | null) => void;
  setEditingZonePrice: (price: string) => void;
  onSavePrice: (zoneId: string) => void;
  onToggleActive: (zone: DeliveryZone) => void;
}) {
  if (zones.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
        <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Delivery states are being prepared. Refresh this page shortly.</p>
      </div>
    );
  }

  const sortedZones = [...zones].sort((a, b) => a.state.localeCompare(b.state));

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-xs text-gray-600">Enabled: <strong>{zones.filter(z => z.is_active).length} / {zones.length}</strong> states</p>
        <p className="text-[10px] text-gray-500">Platform fee: ₦{CONFIG.PLATFORM_MARKUP.toLocaleString()} per delivery</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['State', 'Your Price', 'Customer Pays', 'Delivery'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedZones.map(zone => {
              const isEditing = editingZoneId === zone.id;
              const displayPrice = isEditing ? (Number(editingZonePrice) || 0) : Number(zone.price);
              const busy = isToggling === zone.id;
              return (
                <tr key={zone.id} className={zone.is_active ? 'hover:bg-gray-50 transition-colors' : 'bg-gray-50/70 text-gray-400'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className={zone.is_active ? 'text-xs font-medium text-gray-900' : 'text-xs font-medium'}>{zone.state}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                          <input type="number" value={editingZonePrice} onChange={e => setEditingZonePrice(e.target.value)}
                            className="w-24 pl-5 pr-2 py-1 text-xs rounded-lg border border-orange-300 focus:ring-2 focus:ring-orange-500 outline-none"
                            autoFocus min={0} />
                        </div>
                        <button onClick={() => onSavePrice(zone.id)} disabled={isSavingZone}
                          className="p-1 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50">
                          {isSavingZone ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button onClick={() => setEditingZoneId(null)} className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingZoneId(zone.id); setEditingZonePrice(String(zone.price)); }}
                        className="group flex items-center gap-1 text-xs text-gray-600 hover:text-orange-600">
                        ₦{Number(zone.price).toLocaleString()}
                        <Pencil className="w-3 h-3 text-gray-300 group-hover:text-orange-400" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={zone.is_active ? 'text-xs font-medium text-gray-900' : 'text-xs'}>
                      ₦{(displayPrice + CONFIG.PLATFORM_MARKUP).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onToggleActive(zone)} disabled={!!isToggling || isEditing}
                      aria-label={zone.is_active ? `Disable delivery to ${zone.state}` : `Enable delivery to ${zone.state}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${zone.is_active ? 'text-green-700 hover:bg-green-50' : 'text-gray-500 hover:bg-gray-100'}`}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : zone.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      {zone.is_active ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
