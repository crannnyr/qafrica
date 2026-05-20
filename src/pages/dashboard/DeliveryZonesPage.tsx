import { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Loader2,
  Clock,
  Truck,
  Check,
  Pencil,
  X,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { deliveryZoneService, supabase } from '@/services/supabase';
import { shipbubbleService } from '@/services/shipbubble';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';

// Shipbubble package category options (common ones from their API)
const SHIPBUBBLE_CATEGORIES = [
  { id: 8, label: 'General goods' },
  { id: 1, label: 'Electronics' },
  { id: 2, label: 'Clothing' },
  { id: 3, label: 'Cosmetics' },
  { id: 4, label: 'Food & beverages' },
  { id: 5, label: 'Documents' },
  { id: 6, label: 'Footwear' },
  { id: 7, label: 'Accessories' },
];

interface ShipbubblePickupAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
}

export default function DeliveryZonesPage() {
  const {
    currentStore,
    deliveryZones,
    fetchDeliveryZones,
    addDeliveryZone,
    deleteDeliveryZone,
    updateStore,
  } = useStoreStore();
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZonePrice, setEditingZonePrice] = useState<string>('');
  const [isSavingZone, setIsSavingZone] = useState(false);
  const [newZone, setNewZone] = useState({ state: '', price: '' });

  // Delivery mode
  const [deliveryMode, setDeliveryMode] = useState<'manual' | 'shipbubble'>(
    (currentStore?.delivery_mode as 'manual' | 'shipbubble') ?? 'manual'
  );
  const [isSavingMode, setIsSavingMode] = useState(false);

  // Delivery window
  const [deliveryWindow, setDeliveryWindow] = useState<number>(
    currentStore?.delivery_window_days || 7
  );
  const [isSavingWindow, setIsSavingWindow] = useState(false);

  // Shipbubble — pickup address
  const [pickupAddress, setPickupAddress] = useState<
    Partial<ShipbubblePickupAddress>
  >(currentStore?.shipbubble_pickup_address || {});
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [addressValidated, setAddressValidated] = useState(false);

  // Shipbubble — packaging
  const [packaging, setPackaging] = useState({
    length_cm: currentStore?.packaging_length_cm || 30,
    width_cm: currentStore?.packaging_width_cm || 25,
    height_cm: currentStore?.packaging_height_cm || 20,
    weight_kg: currentStore?.packaging_weight_kg || 0.5,
  });
  const [isSavingPackaging, setIsSavingPackaging] = useState(false);

  // Shipbubble — category
  const [categoryId, setCategoryId] = useState<number>(
    currentStore?.shipbubble_category_id || 8
  );
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Sync when store loads
  useEffect(() => {
    if (!currentStore) return;
    if (currentStore.delivery_window_days)
      setDeliveryWindow(currentStore.delivery_window_days);
    if (currentStore.delivery_mode)
      setDeliveryMode(currentStore.delivery_mode as 'manual' | 'shipbubble');
    if (currentStore.shipbubble_pickup_address)
      setPickupAddress(currentStore.shipbubble_pickup_address);
    if (currentStore.shipbubble_category_id)
      setCategoryId(currentStore.shipbubble_category_id);
    setPackaging({
      length_cm: currentStore.packaging_length_cm || 30,
      width_cm: currentStore.packaging_width_cm || 25,
      height_cm: currentStore.packaging_height_cm || 20,
      weight_kg: currentStore.packaging_weight_kg || 0.5,
    });
  }, [currentStore]);

  useEffect(() => {
    if (currentStore?.id && deliveryMode === 'manual') {
      fetchDeliveryZones(currentStore.id);
    }
  }, [currentStore, fetchDeliveryZones, deliveryMode]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveDeliveryMode = async (mode: 'manual' | 'shipbubble') => {
    if (!currentStore?.id) return;
    setIsSavingMode(true);
    const result = await updateStore(currentStore.id, { delivery_mode: mode });
    if (result.success) {
      setDeliveryMode(mode);
      toast.success(
        `Delivery mode switched to ${
          mode === 'shipbubble' ? 'Shipbubble' : 'Manual'
        }`
      );
    } else {
      toast.error(result.error || 'Failed to update delivery mode');
    }
    setIsSavingMode(false);
  };

  const handleSaveDeliveryWindow = async () => {
    if (!currentStore?.id) return;
    if (deliveryWindow < 7 || deliveryWindow > 90) {
      toast.error('Delivery window must be between 7 and 90 days');
      return;
    }
    setIsSavingWindow(true);
    const result = await updateStore(currentStore.id, {
      delivery_window_days: deliveryWindow,
    });
    if (result.success) toast.success('Delivery window updated');
    else {
      toast.error(result.error || 'Failed to update delivery window');
      setDeliveryWindow(currentStore?.delivery_window_days || 7);
    }
    setIsSavingWindow(false);
  };

 
  const handleValidateAddress = async () => {
    if (!currentStore?.id) return;
  
    const required: (keyof ShipbubblePickupAddress)[] = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'line1',
      'city',
      'state',
    ];
  
    const missing = required.filter((f) => !pickupAddress[f]);
  
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(', ')}`);
      return;
    }
  
    setIsValidatingAddress(true);
  
    try {
      // Format Nigerian phone number
      const formattedPhone = pickupAddress.phone!.startsWith('+')
        ? pickupAddress.phone!
        : '+234' + pickupAddress.phone!.replace(/^0/, '');
  
      const addressPayload = {
        ...pickupAddress,
        phone: formattedPhone,
        country: 'Nigeria',
      };
  
      // DIRECTLY CALL EDGE FUNCTION
      const { data, error } = await supabase.functions.invoke(
        'shipbubble-validate-address',
        {
          body: {
            address: addressPayload,
          },
        }
      );
  
      if (error) {
        console.error(error);
      
        throw new Error(
          error.context?.error ||
          error.message ||
          'Validation failed'
        );
      }
  
      if (!data?.success) {
        throw new Error(
          data?.error || 'Address validation failed'
        );
      }
  
      // Save validated address + address code
      const saveResult = await updateStore(currentStore.id, {
        shipbubble_pickup_address: addressPayload,
        shipbubble_sender_address_code:
          data?.data?.address_code || null,
      } as any);
  
      if (!saveResult.success) {
        throw new Error(
          saveResult.error || 'Failed to save address'
        );
      }
  
      setAddressValidated(true);
  
      toast.success('Pickup address validated successfully');
    } catch (err: any) {
      console.error(err);
  
      setAddressValidated(false);
  
      toast.error(
        err.message || 'Failed to validate address'
      );
    } finally {
      setIsValidatingAddress(false);
    }
  };

  const handleSavePickupAddress = async () => {
    if (!currentStore?.id) return;
    const required: (keyof ShipbubblePickupAddress)[] = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'line1',
      'city',
      'state',
    ];
    const missing = required.filter((f) => !pickupAddress[f]);
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(', ')}`);
      return;
    }
    const phone = pickupAddress.phone!.startsWith('+')
      ? pickupAddress.phone!
      : '+234' + pickupAddress.phone!.replace(/^0/, '');
    setIsSavingAddress(true);
    const result = await updateStore(currentStore!.id, {
      shipbubble_pickup_address: {
        ...pickupAddress,
        phone,
      } as ShipbubblePickupAddress,
      shipbubble_sender_address_code: null, // invalidate cache on address change
    } as any);
    if (result.success) {
      toast.success(
        "Pickup address saved — validate to confirm it's deliverable"
      );
    } else {
      toast.error(result.error || 'Failed to save pickup address');
    }
    setIsSavingAddress(false);
  };

  const handleSavePackaging = async () => {
    if (!currentStore?.id) return;
    setIsSavingPackaging(true);
    const result = await updateStore(currentStore.id, {
      packaging_length_cm: packaging.length_cm,
      packaging_width_cm: packaging.width_cm,
      packaging_height_cm: packaging.height_cm,
      packaging_weight_kg: packaging.weight_kg,
    } as any);
    if (result.success) toast.success('Packaging dimensions saved');
    else toast.error(result.error || 'Failed to save packaging');
    setIsSavingPackaging(false);
  };

  const handleSaveCategory = async () => {
    if (!currentStore?.id) return;
    setIsSavingCategory(true);
    const result = await updateStore(currentStore.id, {
      shipbubble_category_id: categoryId,
    } as any);
    if (result.success) toast.success('Package category saved');
    else toast.error(result.error || 'Failed to save category');
    setIsSavingCategory(false);
  };

  // Manual zone handlers
  const handleAdd = async () => {
    if (!newZone.state || !newZone.price) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!currentStore?.id) return;
    setIsAdding(true);
    const result = await addDeliveryZone({
      store_id: currentStore.id,
      state: newZone.state,
      price: parseFloat(newZone.price),
      is_active: true,
    });
    if (result.success) {
      toast.success('Delivery zone added');
      setNewZone({ state: '', price: '' });
    } else toast.error(result.error || 'Failed to add zone');
    setIsAdding(false);
  };

  const handleDelete = async (zoneId: string) => {
    if (!confirm('Are you sure?')) return;
    setIsDeleting(zoneId);
    const result = await deleteDeliveryZone(zoneId);
    if (result.success) toast.success('Zone removed');
    else toast.error(result.error || 'Failed to remove zone');
    setIsDeleting(null);
  };

  const handleSaveZonePrice = async (zoneId: string) => {
    const newPrice = parseFloat(editingZonePrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('Please enter a valid price');
      return;
    }
    setIsSavingZone(true);
    const { error } = await deliveryZoneService.updateZone(zoneId, {
      price: newPrice,
    });
    if (error) toast.error('Failed to update zone price');
    else {
      toast.success('Delivery price updated');
      setEditingZoneId(null);
      if (currentStore?.id) fetchDeliveryZones(currentStore.id);
    }
    setIsSavingZone(false);
  };

  const hasPickupAddress = !!(
    pickupAddress.first_name &&
    pickupAddress.last_name &&
    pickupAddress.email &&
    pickupAddress.phone &&
    pickupAddress.line1 &&
    pickupAddress.city &&
    pickupAddress.state
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Delivery Settings</h1>
        <p className="text-gray-500 mt-1">
          Configure how you deliver products to customers
        </p>
      </div>

      {/* ── Delivery Mode Toggle ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Delivery Mode
        </h2>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => handleSaveDeliveryMode('manual')}
            disabled={isSavingMode}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              deliveryMode === 'manual'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <MapPin className="w-5 h-5" />
              <span className="font-semibold">Manual Delivery</span>
            </div>
            <p className="text-sm text-gray-500">Set flat rates per state</p>
          </button>

          <button
            onClick={() => handleSaveDeliveryMode('shipbubble')}
            disabled={isSavingMode}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              deliveryMode === 'shipbubble'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Truck className="w-5 h-5" />
              <span className="font-semibold">Shipbubble</span>
            </div>
            <p className="text-sm text-gray-500">Live carrier rates + COD</p>
          </button>
        </div>
      </div>

      {/* ── Delivery Window ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Delivery Window
          </h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Funds held in escrow for{' '}
          <span className="font-semibold text-orange-600">
            {deliveryWindow} days
          </span>{' '}
          after purchase.
        </p>
        <div className="flex items-end gap-4">
          <div className="flex-1 sm:max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Window (days)
            </label>
            <input
              type="number"
              min={7}
              max={90}
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Min: 7 days, Max: 90 days
            </p>
          </div>
          <Button
            onClick={handleSaveDeliveryWindow}
            disabled={
              isSavingWindow ||
              deliveryWindow === currentStore?.delivery_window_days
            }
            className="bg-orange-500 hover:bg-orange-600 text-white px-6"
          >
            {isSavingWindow ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>

      {/* ── SHIPBUBBLE SETUP ── */}
      {deliveryMode === 'shipbubble' && (
        <div className="space-y-6">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">
                Before going live with Shipbubble
              </p>
              <ul className="space-y-1 text-blue-700 list-disc list-inside">
                <li>
                  Log in at <strong>app.shipbubble.com</strong> and top up your
                  shipping wallet
                </li>
                <li>
                  To enable Cash on Delivery: go to the COD tab and set up your
                  profile
                </li>
                <li>
                  Configure your webhook URL:{' '}
                  <code className="bg-blue-100 px-1 rounded text-xs">
                    https://&lt;project&gt;.supabase.co/functions/v1/shipbubble-webhook
                  </code>
                </li>
              </ul>
            </div>
          </div>

          {/* Pickup Address */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Pickup Address
              </h2>
              {hasPickupAddress && addressValidated && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  <Check className="w-3 h-3" /> Validated
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Where Shipbubble couriers will pick up your packages.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { key: 'first_name', label: 'First Name', placeholder: 'John' },
                { key: 'last_name', label: 'Last Name', placeholder: 'Doe' },
                {
                  key: 'email',
                  label: 'Email',
                  placeholder: 'john@store.com',
                  span: false,
                },
                {
                  key: 'phone',
                  label: 'Phone',
                  placeholder: '08012345678',
                  span: false,
                },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.label} *
                  </label>
                  <input
                    type={f.key === 'email' ? 'email' : 'text'}
                    value={(pickupAddress as any)[f.key] || ''}
                    onChange={(e) =>
                      setPickupAddress((prev) => ({
                        ...prev,
                        [f.key]: e.target.value,
                      }))
                    }
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
              ))}

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  value={pickupAddress.line1 || ''}
                  onChange={(e) =>
                    setPickupAddress((prev) => ({
                      ...prev,
                      line1: e.target.value,
                    }))
                  }
                  placeholder="12 Broad Street"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={pickupAddress.city || ''}
                  onChange={(e) =>
                    setPickupAddress((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  placeholder="Lagos"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <select
                  value={pickupAddress.state || ''}
                  onChange={(e) =>
                    setPickupAddress((prev) => ({
                      ...prev,
                      state: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white"
                >
                  <option value="">Select state</option>
                  {CONFIG.NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleSavePickupAddress}
                disabled={isSavingAddress || !hasPickupAddress}
                variant="outline"
                className="px-6"
              >
                {isSavingAddress ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
              <Button
                onClick={handleValidateAddress}
                disabled={isValidatingAddress || !hasPickupAddress}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6"
              >
                {isValidatingAddress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Validating…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save & Validate
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Package Dimensions */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Default Package Dimensions
              </h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Used for rate calculation. Be accurate — couriers may charge extra
              for incorrect dimensions.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {[
                { key: 'length_cm', label: 'Length (cm)' },
                { key: 'width_cm', label: 'Width (cm)' },
                { key: 'height_cm', label: 'Height (cm)' },
                { key: 'weight_kg', label: 'Weight (kg)', step: '0.1' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={f.step || '1'}
                    value={(packaging as any)[f.key]}
                    onChange={(e) =>
                      setPackaging((prev) => ({
                        ...prev,
                        [f.key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={handleSavePackaging}
              disabled={isSavingPackaging}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6"
            >
              {isSavingPackaging ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save Dimensions'
              )}
            </Button>
          </div>

          {/* Package Category */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Package Category
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Used by Shipbubble to match appropriate couriers and insurance.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {SHIPBUBBLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    categoryId === cat.id
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <Button
              onClick={handleSaveCategory}
              disabled={
                isSavingCategory ||
                categoryId === currentStore?.shipbubble_category_id
              }
              className="bg-orange-500 hover:bg-orange-600 text-white px-6"
            >
              {isSavingCategory ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save Category'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── MANUAL DELIVERY ZONES ── */}
      {deliveryMode === 'manual' && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Add New Zone
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <select
                value={newZone.state}
                onChange={(e) =>
                  setNewZone({ ...newZone, state: e.target.value })
                }
                className="input-custom"
              >
                <option value="">Select State</option>
                {CONFIG.NIGERIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={newZone.price}
                onChange={(e) =>
                  setNewZone({ ...newZone, price: e.target.value })
                }
                placeholder="Delivery Price (₦)"
                className="input-custom"
              />
              <Button
                onClick={handleAdd}
                disabled={isAdding}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Zone
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              A ₦{CONFIG.PLATFORM_MARKUP} platform fee will be added to each
              delivery
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {deliveryZones.length === 0 ? (
              <div className="p-12 text-center">
                <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No delivery zones set up yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      State
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Your Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Customer Pays
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deliveryZones.map((zone) => {
                    const isEditing = editingZoneId === zone.id;
                    return (
                      <tr key={zone.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {zone.state}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                  ₦
                                </span>
                                <input
                                  type="number"
                                  value={editingZonePrice}
                                  onChange={(e) =>
                                    setEditingZonePrice(e.target.value)
                                  }
                                  className="w-28 pl-6 pr-2 py-1.5 text-sm rounded-lg border border-orange-300 focus:ring-2 focus:ring-orange-500 outline-none"
                                  autoFocus
                                  min={0}
                                />
                              </div>
                              <button
                                onClick={() => handleSaveZonePrice(zone.id)}
                                disabled={isSavingZone}
                                className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50"
                              >
                                {isSavingZone ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditingZoneId(null)}
                                className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingZoneId(zone.id);
                                setEditingZonePrice(String(zone.price));
                              }}
                              className="group flex items-center gap-1.5 text-sm text-gray-600 hover:text-orange-600"
                            >
                              ₦{zone.price.toLocaleString()}
                              <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange-400" />
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          ₦
                          {(
                            (isEditing
                              ? parseFloat(editingZonePrice) || zone.price
                              : zone.price) + CONFIG.PLATFORM_MARKUP
                          ).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDelete(zone.id)}
                            disabled={isDeleting === zone.id || isEditing}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30"
                          >
                            {isDeleting === zone.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
