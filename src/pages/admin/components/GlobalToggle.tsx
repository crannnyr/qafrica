import { Loader2, Truck, AlertTriangle } from 'lucide-react';

export function GlobalToggle({ enabled, isToggling, onToggle }: {
  enabled: boolean;
  isToggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            enabled ? 'bg-orange-50' : 'bg-gray-100'
          }`}>
            <Truck className={`w-5 h-5 ${enabled ? 'text-orange-500' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Global Shipbubble Switch</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {enabled
                ? 'Shipbubble is live. Stores with it enabled can use live carrier rates.'
                : 'Shipbubble is off globally. All stores are on manual delivery.'}
            </p>
          </div>
        </div>

        <button
          onClick={onToggle}
          disabled={isToggling}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            enabled ? 'bg-orange-500' : 'bg-gray-200'
          } disabled:opacity-50`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}>
            {isToggling && (
              <Loader2 className="w-3 h-3 animate-spin text-gray-400 absolute top-1 left-1" />
            )}
          </span>
        </button>
      </div>

      {enabled && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Turning this off will immediately reset <strong>all stores</strong> using Shipbubble back to manual delivery. This cannot be undone automatically.
          </p>
        </div>
      )}

      {!enabled && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500">
            When enabled, only stores with <strong>Shipbubble Enabled</strong> toggled on (per store below) will be able to switch to Shipbubble delivery.
          </p>
        </div>
      )}
    </div>
  );
}