// src/pages/dashboard/JumiaDropOffLocationsPage.tsx
// Lists admin-managed Jumia drop-off points in Lagos. Each location links straight to Google Maps.
// Locations are fully admin-editable from Supabase — nothing here is hardcoded.

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, ExternalLink, ArrowLeft } from 'lucide-react';
import { useJumiaStore } from '@/stores/jumiaStore';

const mapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export default function JumiaDropOffLocationsPage() {
  const { dropOffLocations, fetchDropOffLocations } = useJumiaStore();

  useEffect(() => {
    fetchDropOffLocations();
  }, [fetchDropOffLocations]);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard/jumia" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Jumia
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jumia Drop-off Locations</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
          All Jumia drop-offs happen in Lagos. Pick the location closest to you if you'd
          rather take your item there yourself instead of using our pickup agent.
        </p>
      </div>

      {dropOffLocations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No drop-off locations available right now</p>
          <p className="text-gray-400 text-sm mt-1">Use our pickup agent instead, or check back shortly.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {dropOffLocations.map((loc) => (
            <div
              key={loc.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{loc.name}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{loc.address}</p>
                </div>
              </div>

              {loc.phone && (
                <a href={`tel:${loc.phone}`} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                  <Phone className="w-3.5 h-3.5" /> {loc.phone}
                </a>
              )}

              <a
                href={mapsLink(loc.latitude, loc.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm font-bold text-orange-600 bg-orange-50 dark:bg-orange-500/10 px-3 py-2 rounded-lg hover:bg-orange-100 transition-colors"
              >
                Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Don't drop off on your own until we confirm a schedule with you. We'll tell you
          exactly when and where to go once your item is ready.
        </p>
      </div>
    </div>
  );
}
