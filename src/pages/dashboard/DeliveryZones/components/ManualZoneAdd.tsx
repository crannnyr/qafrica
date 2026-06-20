import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CONFIG from '@/lib/config';

export function ManualZoneAdd({ newZone, setNewZone, isAdding, onAdd }: {
  newZone: { state: string; price: string };
  setNewZone: (zone: { state: string; price: string }) => void;
  isAdding: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Add New Zone</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        <select
          value={newZone.state}
          onChange={e => setNewZone({ ...newZone, state: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none bg-white"
        >
          <option value="">Select State</option>
          {CONFIG.NIGERIAN_STATES.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>

        <input
          type="number"
          value={newZone.price}
          onChange={e => setNewZone({ ...newZone, price: e.target.value })}
          placeholder="Delivery Price (₦)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
        />

        <Button
          onClick={onAdd}
          disabled={isAdding}
          className="bg-orange-500 hover:bg-orange-600 text-white h-10 text-sm"
        >
          {isAdding
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <><Plus className="w-4 h-4 mr-1.5" /> Add Zone</>
          }
        </Button>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">
        A ₦{CONFIG.PLATFORM_MARKUP} platform fee will be added to each delivery
      </p>
    </div>
  );
}