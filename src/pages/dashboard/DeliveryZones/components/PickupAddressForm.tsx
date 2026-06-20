import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PICKUP_ADDRESS_FIELDS } from '../constants';
import CONFIG from '@/lib/config';
import type { ShipbubblePickupAddress } from '../types';

export function PickupAddressForm({
  pickupAddress, setPickupAddress, addressValidated, hasPickupAddress,
  isSaving, isValidating, onSave, onValidate,
}: {
  pickupAddress: Partial<ShipbubblePickupAddress>;
  setPickupAddress: (addr: Partial<ShipbubblePickupAddress>) => void;
  addressValidated: boolean;
  hasPickupAddress: boolean;
  isSaving: boolean;
  isValidating: boolean;
  onSave: () => void;
  onValidate: () => void;
}) {
  const update = (key: string, value: string) =>
    setPickupAddress({ ...pickupAddress, [key]: value });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Pickup Address</h2>
        {hasPickupAddress && addressValidated && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
            <Check className="w-3 h-3" /> Validated
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Where Shipbubble couriers will pick up your packages.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {PICKUP_ADDRESS_FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{f.label} *</label>
            <input
              type={f.type || 'text'}
              value={(pickupAddress as any)[f.key] || ''}
              onChange={e => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
            />
          </div>
        ))}

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Street Address *</label>
          <input
            type="text"
            value={pickupAddress.line1 || ''}
            onChange={e => update('line1', e.target.value)}
            placeholder="12 Broad Street"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
          <input
            type="text"
            value={pickupAddress.city || ''}
            onChange={e => update('city', e.target.value)}
            placeholder="Lagos"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
          <select
            value={pickupAddress.state || ''}
            onChange={e => update('state', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none bg-white"
          >
            <option value="">Select state</option>
            {CONFIG.NIGERIAN_STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button onClick={onSave} disabled={isSaving || !hasPickupAddress}
          variant="outline" className="px-4 h-9 text-xs">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
        </Button>
        <Button onClick={onValidate} disabled={isValidating || !hasPickupAddress}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 h-9 text-xs">
          {isValidating
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Validating…</>
            : <><Check className="w-3.5 h-3.5 mr-1.5" /> Save & Validate</>
          }
        </Button>
      </div>
    </div>
  );
}