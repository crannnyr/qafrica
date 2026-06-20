import { useDeliverySettings } from './hooks/useDeliverySettings';
import { DeliveryModeToggle } from './components/DeliveryModeToggle';
import { DeliveryWindow } from './components/DeliveryWindow';
import { ShipbubbleSetup } from './components/ShipbubbleSetup';
import { ManualZoneAdd } from './components/ManualZoneAdd';
import { ManualZonesTable } from './components/ManualZonesTable';

export default function DeliveryZonesPage() {
  const s = useDeliverySettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Delivery Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">Configure how you deliver products to customers</p>
      </div>

      <DeliveryModeToggle
        mode={s.deliveryMode}
        isSaving={s.isSavingMode}
        shipbubbleEnabled={s.currentStore?.shipbubble_enabled ?? false}
        onSwitch={s.handleSaveDeliveryMode}
      />

      <DeliveryWindow
        window={s.deliveryWindow}
        setWindow={s.setDeliveryWindow}
        isSaving={s.isSavingWindow}
        currentDays={s.currentStore?.delivery_window_days || 7}
        onSave={s.handleSaveDeliveryWindow}
      />

      {s.deliveryMode === 'shipbubble' && (
        <ShipbubbleSetup
          pickupAddress={s.pickupAddress}
          setPickupAddress={s.setPickupAddress}
          addressValidated={s.addressValidated}
          hasPickupAddress={s.hasPickupAddress}
          isSavingAddress={s.isSavingAddress}
          isValidatingAddress={s.isValidatingAddress}
          onSaveAddress={s.handleSavePickupAddress}
          onValidateAddress={s.handleValidateAddress}
          packaging={s.packaging}
          setPackaging={s.setPackaging}
          isSavingPackaging={s.isSavingPackaging}
          onSavePackaging={s.handleSavePackaging}
          categoryId={s.categoryId}
          setCategoryId={s.setCategoryId}
          isSavingCategory={s.isSavingCategory}
          currentCategoryId={s.currentStore?.shipbubble_category_id || 8}
          onSaveCategory={s.handleSaveCategory}
        />
      )}

      {s.deliveryMode === 'manual' && (
        <>
          <ManualZoneAdd
            newZone={s.newZone}
            setNewZone={s.setNewZone}
            isAdding={s.isAdding}
            onAdd={s.handleAddZone}
          />
          <ManualZonesTable
            zones={s.deliveryZones}
            editingZoneId={s.editingZoneId}
            editingZonePrice={s.editingZonePrice}
            isSavingZone={s.isSavingZone}
            isDeleting={s.isDeleting}
            setEditingZoneId={s.setEditingZoneId}
            setEditingZonePrice={s.setEditingZonePrice}
            onSavePrice={s.handleSaveZonePrice}
            onDelete={s.handleDeleteZone}
          />
        </>
      )}
    </div>
  );
}