// src/pages/dashboard/Jumia/JumiaFulfillmentChoice.tsx
// Lets the user choose self drop-off (pick a location) or agent pickup (flat fee, explained).

import { Truck, MapPin } from 'lucide-react';
import type { JumiaDropOffLocation } from '@/stores/jumiaStore';

interface Props {
  method: 'self_dropoff' | 'agent_pickup' | null;
  onMethodChange: (method: 'self_dropoff' | 'agent_pickup') => void;
  locations: JumiaDropOffLocation[];
  selectedLocationId: string | null;
  onLocationChange: (id: string) => void;
  agentFee: number;
}

export default function JumiaFulfillmentChoice({
  method, onMethodChange, locations, selectedLocationId, onLocationChange, agentFee,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onMethodChange('self_dropoff')}
          className={`text-left p-4 rounded-xl border-2 transition-colors ${
            method === 'self_dropoff' ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <MapPin className="w-5 h-5 text-orange-500 mb-2" />
          <p className="font-bold text-gray-900 dark:text-white text-sm">Drop it off myself</p>
          <p className="text-xs text-gray-500 mt-1">Free. We'll tell you when and where to go in Lagos.</p>
        </button>

        <button
          type="button"
          onClick={() => onMethodChange('agent_pickup')}
          className={`text-left p-4 rounded-xl border-2 transition-colors ${
            method === 'agent_pickup' ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <Truck className="w-5 h-5 text-orange-500 mb-2" />
          <p className="font-bold text-gray-900 dark:text-white text-sm">Use our pickup agent</p>
          <p className="text-xs text-gray-500 mt-1">₦{agentFee.toLocaleString()} — covers transport to Jumia for you.</p>
        </button>
      </div>

      {method === 'self_dropoff' && (
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">Closest drop-off location</label>
          <select
            value={selectedLocationId ?? ''}
            onChange={(e) => onLocationChange(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm"
          >
            <option value="" disabled>Select a location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name} — {loc.address}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            Don't head there yet — wait for us to confirm your drop-off schedule first.
          </p>
        </div>
      )}
    </div>
  );
}
