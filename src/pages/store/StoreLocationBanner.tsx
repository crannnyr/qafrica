import { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import type { Store } from '@/types';

interface Props {
  store: Store;
  primary: string;
}

export default function StoreLocationBanner({ store, primary }: Props) {
  const [dismissed, setDismissed] = useState(true); // default hidden until we check sessionStorage, avoids flash

  const dismissKey = `location-banner-dismissed:${store.id}`;

  useEffect(() => {
    setDismissed(sessionStorage.getItem(dismissKey) === '1');
  }, [dismissKey]);

  if (!store.location_enabled || store.latitude == null || store.longitude == null) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 text-xs"
      style={{ backgroundColor: `${primary}12` }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: primary }} />
        <span className="truncate text-gray-700">
          {store.location_address || 'Visit us in person'}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold whitespace-nowrap hover:underline"
          style={{ color: primary }}
        >
          Visit Our Store →
        </a>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
