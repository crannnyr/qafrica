import { useState } from 'react';
import { MapPin, Truck, Loader2 } from 'lucide-react';
import { ComingSoonModal } from '@/pages/admin/AdminShipbubble/components/ComingSoonModal';

export function DeliveryModeToggle({ mode, isSaving, shipbubbleEnabled, onSwitch }: {
  mode: 'manual' | 'shipbubble';
  isSaving: boolean;
  shipbubbleEnabled: boolean;
  onSwitch: (mode: 'manual' | 'shipbubble') => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const handleShipbubbleClick = () => {
    if (!shipbubbleEnabled) {
      setShowModal(true);
      return;
    }
    onSwitch('shipbubble');
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Delivery Mode</h2>
        <div className="flex gap-3">
          <button
            onClick={() => onSwitch('manual')}
            disabled={isSaving}
            className={`flex-1 p-3.5 rounded-xl border-2 transition-all ${
              mode === 'manual'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <MapPin className={`w-4 h-4 ${mode === 'manual' ? 'text-orange-500' : 'text-gray-400'}`} />
              <span className={`text-sm font-semibold ${mode === 'manual' ? 'text-orange-700' : 'text-gray-600'}`}>
                Manual
              </span>
            </div>
            <p className="text-xs text-gray-400 text-center">Flat rates per state</p>
          </button>

          <button
            onClick={handleShipbubbleClick}
            disabled={isSaving && shipbubbleEnabled}
            className={`flex-1 p-3.5 rounded-xl border-2 transition-all relative ${
              mode === 'shipbubble'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {!shipbubbleEnabled && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-bold rounded-full">
                SOON
              </span>
            )}
            <div className="flex items-center justify-center gap-2 mb-1">
              {isSaving && shipbubbleEnabled
                ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                : <Truck className={`w-4 h-4 ${mode === 'shipbubble' ? 'text-orange-500' : 'text-gray-400'}`} />
              }
              <span className={`text-sm font-semibold ${mode === 'shipbubble' ? 'text-orange-700' : 'text-gray-600'}`}>
                Shipbubble
              </span>
            </div>
            <p className="text-xs text-gray-400 text-center">Live carrier rates + COD</p>
          </button>
        </div>
      </div>

      {showModal && <ComingSoonModal onClose={() => setShowModal(false)} />}
    </>
  );
}