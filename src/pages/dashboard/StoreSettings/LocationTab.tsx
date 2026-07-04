import { useState, useEffect } from 'react';
import { MapPin, Loader2, Save, Navigation, AlertTriangle, PackagePlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { supabase } from '@/services';
import { toast } from 'sonner';

export default function LocationTab() {
  const { currentStore, updateStore } = useStoreStore();

  const [productCount, setProductCount] = useState<number | null>(null);
  const [isCheckingProducts, setIsCheckingProducts] = useState(true);

  const [formData, setFormData] = useState({
    latitude:         currentStore?.latitude         ?? null,
    longitude:        currentStore?.longitude        ?? null,
    location_address:  currentStore?.location_address ?? '',
    location_enabled:  currentStore?.location_enabled ?? false,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentStore?.id) return;
    checkProductCount();
  }, [currentStore?.id]);

  useEffect(() => {
    if (!currentStore) return;
    setFormData({
      latitude:         currentStore.latitude         ?? null,
      longitude:        currentStore.longitude        ?? null,
      location_address:  currentStore.location_address ?? '',
      location_enabled:  currentStore.location_enabled ?? false,
    });
  }, [currentStore]);

  const checkProductCount = async () => {
    if (!currentStore?.id) return;
    setIsCheckingProducts(true);
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', currentStore.id);
    setProductCount(count ?? 0);
    setIsCheckingProducts(false);
  };

  const hasOriginalProduct = (productCount ?? 0) > 0;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Your browser does not support location services');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        toast.success('Location captured');
        setIsLocating(false);
      },
      () => {
        toast.error('Could not get your location. Check your device permissions.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSave = async () => {
    if (!currentStore?.id) return;
    if (formData.location_enabled && !hasOriginalProduct) {
      toast.error('Add at least one original product first');
      return;
    }
    if (formData.location_enabled && (formData.latitude == null || formData.longitude == null)) {
      toast.error('Capture your store location first');
      return;
    }

    setIsSaving(true);
    const result = await updateStore(currentStore.id, {
      ...formData,
      location_set_at: new Date().toISOString(),
    });

    if (result.success) {
      toast.success('Location settings saved');
    } else {
      // Surfaces the DB trigger's message verbatim if it fires (defense in depth)
      toast.error(result.error || 'Failed to save location settings');
    }
    setIsSaving(false);
  };

  const mapPreviewUrl =
    formData.latitude != null && formData.longitude != null
      ? `https://maps.google.com/maps?q=${formData.latitude},${formData.longitude}&z=16&output=embed`
      : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
          <MapPin className="w-5 h-5 text-rose-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Store Location</h2>
          <p className="text-sm text-gray-500">Let customers visit your physical store via Google Maps</p>
        </div>
      </div>

      {isCheckingProducts ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        </div>
      ) : !hasOriginalProduct ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <PackagePlus className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Post a product first</p>
            <p className="text-amber-700 mt-1">
              This feature is only available to stores with at least one original product (not dropshipped).
              It confirms you run a real, physical store before directing customers there.
            </p>
            <Link to="/dashboard/products/add" className="inline-block mt-3">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                Add a Product
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
            Most Nigerian shoppers prefer buying from a store they can visit. Make sure you're
            physically at your store when you capture your location below — customers will be
            directed here from your storefront via Google Maps.
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Store Address (optional label)</label>
              <input
                type="text"
                value={formData.location_address}
                onChange={e => setFormData(p => ({ ...p, location_address: e.target.value }))}
                className="input-custom"
                placeholder="e.g. Shop 14, Balogun Market, Lagos Island"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                variant="outline"
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Navigation className="w-4 h-4 mr-2" />}
                Use My Current Location
              </Button>
              {formData.latitude != null && formData.longitude != null && (
                <span className="text-xs text-gray-500">
                  {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
                </span>
              )}
            </div>

            {mapPreviewUrl && (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <iframe
                  title="Store location preview"
                  src={mapPreviewUrl}
                  width="100%"
                  height="220"
                  style={{ border: 0 }}
                  loading="lazy"
                />
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-gray-900 text-sm">Show "Visit Our Store" on storefront</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Customers see a button linking to this location on Google Maps.
              </p>
            </div>
            <button
              onClick={() => setFormData(p => ({ ...p, location_enabled: !p.location_enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${formData.location_enabled ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.location_enabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              Posting a fake location or claiming a store you don't operate is a violation of our
              terms and can lead to your store being blocked.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Location</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
