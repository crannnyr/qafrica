import { Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DeliveryWindow({ window: deliveryWindow, setWindow, isSaving, currentDays, onSave }: {
  window: number;
  setWindow: (days: number) => void;
  isSaving: boolean;
  currentDays: number;
  onSave: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-semibold text-gray-900">Delivery Window</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Funds held in escrow for{' '}
        <span className="font-semibold text-orange-600">{deliveryWindow} days</span>{' '}
        after purchase before auto-release.
      </p>

      <div className="flex items-end gap-3">
        <div className="flex-1 sm:max-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Window (days)
          </label>
          <input
            type="number"
            min={7}
            max={90}
            value={deliveryWindow}
            onChange={e => setWindow(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
          <p className="text-[10px] text-gray-400 mt-1">Min: 7 · Max: 90 days</p>
        </div>
        <Button
          onClick={onSave}
          disabled={isSaving || deliveryWindow === currentDays}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 h-9 text-sm"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
}