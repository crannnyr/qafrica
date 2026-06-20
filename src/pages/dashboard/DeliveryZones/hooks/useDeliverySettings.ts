import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { deliveryZoneService, supabase } from '@/services/supabase';
import { useStoreStore } from '@/stores';
import type { ShipbubblePickupAddress, PackagingDimensions } from '../types';

export function useDeliverySettings() {
  const { currentStore, deliveryZones, fetchDeliveryZones, addDeliveryZone, deleteDeliveryZone, updateStore } = useStoreStore();

  const [deliveryMode, setDeliveryMode]   = useState<'manual' | 'shipbubble'>('manual');
  const [deliveryWindow, setDeliveryWindow] = useState(7);
  const [pickupAddress, setPickupAddress] = useState<Partial<ShipbubblePickupAddress>>({});
  const [packaging, setPackaging]         = useState<PackagingDimensions>({ length_cm: 30, width_cm: 25, height_cm: 20, weight_kg: 0.5 });
  const [categoryId, setCategoryId]       = useState<number>(8);
  const [newZone, setNewZone]             = useState({ state: '', price: '' });
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZonePrice, setEditingZonePrice] = useState('');
  const [addressValidated, setAddressValidated] = useState(false);

  // Loading states
  const [isSavingMode, setIsSavingMode]           = useState(false);
  const [isSavingWindow, setIsSavingWindow]       = useState(false);
  const [isSavingAddress, setIsSavingAddress]     = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [isSavingPackaging, setIsSavingPackaging] = useState(false);
  const [isSavingCategory, setIsSavingCategory]   = useState(false);
  const [isAdding, setIsAdding]                   = useState(false);
  const [isDeleting, setIsDeleting]               = useState<string | null>(null);
  const [isSavingZone, setIsSavingZone]           = useState(false);

  // Sync store data on mount
  useEffect(() => {
    if (!currentStore) return;
    if (currentStore.delivery_window_days) setDeliveryWindow(currentStore.delivery_window_days);
    if (currentStore.delivery_mode)        setDeliveryMode(currentStore.delivery_mode as 'manual' | 'shipbubble');
    if (currentStore.shipbubble_pickup_address) setPickupAddress(currentStore.shipbubble_pickup_address);
    if (currentStore.shipbubble_category_id)    setCategoryId(currentStore.shipbubble_category_id);
    setPackaging({
      length_cm: currentStore.packaging_length_cm || 30,
      width_cm:  currentStore.packaging_width_cm  || 25,
      height_cm: currentStore.packaging_height_cm || 20,
      weight_kg: currentStore.packaging_weight_kg || 0.5,
    });
  }, [currentStore]);

  useEffect(() => {
    if (currentStore?.id && deliveryMode === 'manual') {
      fetchDeliveryZones(currentStore.id);
    }
  }, [currentStore, fetchDeliveryZones, deliveryMode]);

  const handleSaveDeliveryMode = async (mode: 'manual' | 'shipbubble') => {
    if (!currentStore?.id) return;
    setIsSavingMode(true);
    const result = await updateStore(currentStore.id, { delivery_mode: mode });
    if (result.success) {
      setDeliveryMode(mode);
      toast.success(`Switched to ${mode === 'shipbubble' ? 'Shipbubble' : 'Manual'} delivery`);
    } else toast.error(result.error || 'Failed to update delivery mode');
    setIsSavingMode(false);
  };

  const handleSaveDeliveryWindow = async () => {
    if (!currentStore?.id) return;
    if (deliveryWindow < 7 || deliveryWindow > 90) { toast.error('Delivery window must be between 7 and 90 days'); return; }
    setIsSavingWindow(true);
    const result = await updateStore(currentStore.id, { delivery_window_days: deliveryWindow });
    if (result.success) toast.success('Delivery window updated');
    else { toast.error(result.error || 'Failed to update'); setDeliveryWindow(currentStore?.delivery_window_days || 7); }
    setIsSavingWindow(false);
  };

  const handleSavePickupAddress = async () => {
    if (!currentStore?.id) return;
    const required: (keyof ShipbubblePickupAddress)[] = ['first_name', 'last_name', 'email', 'phone', 'line1', 'city', 'state'];
    const missing = required.filter(f => !pickupAddress[f]);
    if (missing.length) { toast.error(`Please fill in: ${missing.join(', ')}`); return; }
    const phone = pickupAddress.phone!.startsWith('+') ? pickupAddress.phone! : '+234' + pickupAddress.phone!.replace(/^0/, '');
    setIsSavingAddress(true);
    const result = await updateStore(currentStore.id, {
      shipbubble_pickup_address: { ...pickupAddress, phone } as ShipbubblePickupAddress,
      shipbubble_sender_address_code: null,
    } as any);
    if (result.success) toast.success("Address saved — validate to confirm it's deliverable");
    else toast.error(result.error || 'Failed to save address');
    setIsSavingAddress(false);
  };

  const handleValidateAddress = async () => {
    if (!currentStore?.id) return;
    const required: (keyof ShipbubblePickupAddress)[] = ['first_name', 'last_name', 'email', 'phone', 'line1', 'city', 'state'];
    const missing = required.filter(f => !pickupAddress[f]);
    if (missing.length) { toast.error(`Please fill in: ${missing.join(', ')}`); return; }
    setIsValidatingAddress(true);
    try {
      const phone = pickupAddress.phone!.startsWith('+') ? pickupAddress.phone! : '+234' + pickupAddress.phone!.replace(/^0/, '');
      const addressPayload = { ...pickupAddress, phone, country: 'Nigeria' };
      const { data, error } = await supabase.functions.invoke('shipbubble-validate-address', { body: { address: addressPayload } });
      if (error) throw new Error(error.message || 'Validation failed');
      if (!data?.success) throw new Error(data?.error || 'Address validation failed');
      const saveResult = await updateStore(currentStore.id, {
        shipbubble_pickup_address: addressPayload,
        shipbubble_sender_address_code: data?.data?.address_code || null,
      } as any);
      if (!saveResult.success) throw new Error(saveResult.error || 'Failed to save address');
      setAddressValidated(true);
      toast.success('Pickup address validated successfully');
    } catch (err: any) {
      setAddressValidated(false);
      toast.error(err.message || 'Failed to validate address');
    }
    setIsValidatingAddress(false);
  };

  const handleSavePackaging = async () => {
    if (!currentStore?.id) return;
    setIsSavingPackaging(true);
    const result = await updateStore(currentStore.id, {
      packaging_length_cm: packaging.length_cm,
      packaging_width_cm:  packaging.width_cm,
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
    const result = await updateStore(currentStore.id, { shipbubble_category_id: categoryId } as any);
    if (result.success) toast.success('Package category saved');
    else toast.error(result.error || 'Failed to save category');
    setIsSavingCategory(false);
  };

  const handleAddZone = async () => {
    if (!newZone.state || !newZone.price) { toast.error('Please fill in all fields'); return; }
    if (!currentStore?.id) return;
    setIsAdding(true);
    const result = await addDeliveryZone({ store_id: currentStore.id, state: newZone.state, price: parseFloat(newZone.price), is_active: true });
    if (result.success) { toast.success('Delivery zone added'); setNewZone({ state: '', price: '' }); }
    else toast.error(result.error || 'Failed to add zone');
    setIsAdding(false);
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Are you sure?')) return;
    setIsDeleting(zoneId);
    const result = await deleteDeliveryZone(zoneId);
    if (result.success) toast.success('Zone removed');
    else toast.error(result.error || 'Failed to remove zone');
    setIsDeleting(null);
  };

  const handleSaveZonePrice = async (zoneId: string) => {
    const newPrice = parseFloat(editingZonePrice);
    if (isNaN(newPrice) || newPrice < 0) { toast.error('Please enter a valid price'); return; }
    setIsSavingZone(true);
    const { error } = await deliveryZoneService.updateZone(zoneId, { price: newPrice });
    if (error) toast.error('Failed to update zone price');
    else {
      toast.success('Delivery price updated');
      setEditingZoneId(null);
      if (currentStore?.id) fetchDeliveryZones(currentStore.id);
    }
    setIsSavingZone(false);
  };

  const hasPickupAddress = !!(pickupAddress.first_name && pickupAddress.last_name && pickupAddress.email && pickupAddress.phone && pickupAddress.line1 && pickupAddress.city && pickupAddress.state);

  return {
    // State
    currentStore, deliveryZones, deliveryMode, deliveryWindow, setDeliveryWindow,
    pickupAddress, setPickupAddress, packaging, setPackaging,
    categoryId, setCategoryId, newZone, setNewZone,
    editingZoneId, setEditingZoneId, editingZonePrice, setEditingZonePrice,
    addressValidated, hasPickupAddress,
    // Loading
    isSavingMode, isSavingWindow, isSavingAddress, isValidatingAddress,
    isSavingPackaging, isSavingCategory, isAdding, isDeleting, isSavingZone,
    // Handlers
    handleSaveDeliveryMode, handleSaveDeliveryWindow, handleSavePickupAddress,
    handleValidateAddress, handleSavePackaging, handleSaveCategory,
    handleAddZone, handleDeleteZone, handleSaveZonePrice,
  };
}