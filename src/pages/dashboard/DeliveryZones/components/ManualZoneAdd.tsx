import { MapPin, CheckCircle2 } from 'lucide-react';

export function ManualZoneAdd() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-orange-100 bg-orange-50 p-4">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
      <div>
        <h2 className="text-sm font-semibold text-gray-900">All Nigerian states are available</h2>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          Every store starts with all 37 states enabled at a delivery price of ₦1,500 per state.
          Update a state’s price or switch off states you do not serve below. The ₦120 platform fee is added to enabled deliveries.
        </p>
      </div>
    </div>
  );
}
