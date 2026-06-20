import { Truck } from 'lucide-react';
import { PickupAddressForm } from './PickupAddressForm';
import { PackagingForm } from './PackagingForm';
import { PackageCategoryForm } from './PackageCategoryForm';
import type { ShipbubblePickupAddress, PackagingDimensions } from '../types';

export function ShipbubbleSetup({
  pickupAddress, setPickupAddress, addressValidated, hasPickupAddress,
  isSavingAddress, isValidatingAddress, onSaveAddress, onValidateAddress,
  packaging, setPackaging, isSavingPackaging, onSavePackaging,
  categoryId, setCategoryId, isSavingCategory, currentCategoryId, onSaveCategory,
}: {
  pickupAddress: Partial<ShipbubblePickupAddress>;
  setPickupAddress: (addr: Partial<ShipbubblePickupAddress>) => void;
  addressValidated: boolean;
  hasPickupAddress: boolean;
  isSavingAddress: boolean;
  isValidatingAddress: boolean;
  onSaveAddress: () => void;
  onValidateAddress: () => void;
  packaging: PackagingDimensions;
  setPackaging: (p: PackagingDimensions) => void;
  isSavingPackaging: boolean;
  onSavePackaging: () => void;
  categoryId: number;
  setCategoryId: (id: number) => void;
  isSavingCategory: boolean;
  currentCategoryId: number;
  onSaveCategory: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Truck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          <p className="font-semibold mb-1">Before going live with Shipbubble</p>
          <ul className="space-y-0.5 text-blue-700 list-disc list-inside">
            <li>Log in at <strong>app.shipbubble.com</strong> and top up your shipping wallet</li>
            <li>To enable Cash on Delivery: go to the COD tab and set up your profile</li>
            <li>
              Configure your webhook URL:{' '}
              <code className="bg-blue-100 px-1 rounded text-[10px]">
                https://&lt;project&gt;.supabase.co/functions/v1/shipbubble-webhook
              </code>
            </li>
          </ul>
        </div>
      </div>

      <PickupAddressForm
        pickupAddress={pickupAddress}
        setPickupAddress={setPickupAddress}
        addressValidated={addressValidated}
        hasPickupAddress={hasPickupAddress}
        isSaving={isSavingAddress}
        isValidating={isValidatingAddress}
        onSave={onSaveAddress}
        onValidate={onValidateAddress}
      />

      <PackagingForm
        packaging={packaging}
        setPackaging={setPackaging}
        isSaving={isSavingPackaging}
        onSave={onSavePackaging}
      />

      <PackageCategoryForm
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        isSaving={isSavingCategory}
        currentCategoryId={currentCategoryId}
        onSave={onSaveCategory}
      />
    </div>
  );
}