import { Truck, MapPin, Store, ToggleRight } from 'lucide-react';
import type { KPIData } from '../index';

const cards = [
  { key: 'total',      label: 'Total Stores',       icon: Store,       color: 'text-gray-600',   bg: 'bg-gray-50'    },
  { key: 'shipbubble', label: 'On Shipbubble',       icon: Truck,       color: 'text-orange-600', bg: 'bg-orange-50'  },
  { key: 'manual',     label: 'On Manual Delivery',  icon: MapPin,      color: 'text-blue-600',   bg: 'bg-blue-50'    },
  { key: 'enabled',    label: 'Shipbubble Enabled',  icon: ToggleRight, color: 'text-green-600',  bg: 'bg-green-50'   },
];

export function KPICards({ kpi, isLoading }: { kpi: KPIData; isLoading: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ key, label, icon: Icon, color, bg }) => (
        <div key={key} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-3`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          {isLoading ? (
            <div className="h-7 w-12 bg-gray-100 rounded animate-pulse mb-1" />
          ) : (
            <p className={`text-2xl font-bold ${color}`}>
              {kpi[key as keyof KPIData]}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          {!isLoading && key === 'shipbubble' && kpi.total > 0 && (
            <p className="text-[10px] text-orange-400 mt-1">
              {Math.round((kpi.shipbubble / kpi.total) * 100)}% of stores
            </p>
          )}
        </div>
      ))}
    </div>
  );
}