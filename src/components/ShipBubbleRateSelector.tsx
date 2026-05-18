import React from 'react';
import { Truck, Package, Clock, CheckCircle2, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface ShipBubbleCourier {
  courier_id: string | number;
  courier_name: string;
  courier_image?: string;
  service_code: string;
  total: number;
  rate_card_amount: number;
  currency: string;
  delivery_eta: string;
  pickup_eta: string;
  is_cod_available: boolean;
  cod_fee?: number;
  service_type: 'pickup' | 'dropoff';
  tracking: { bars: number; label: string };
}

interface ShipBubbleRateSelectorProps {
  couriers: ShipBubbleCourier[];
  loading: boolean;
  error?: string | null;
  onSelect: (courier: ShipBubbleCourier) => void;
  selectedCourier?: ShipBubbleCourier | null;
  paymentMethod: 'paystack' | 'cod';
  onPaymentMethodChange?: (method: 'paystack' | 'cod') => void;
  allowCod?: boolean;
  subtotal?: number;
  platformFee?: number;
}

export const ShipBubbleRateSelector: React.FC<ShipBubbleRateSelectorProps> = ({
  couriers,
  loading,
  error,
  onSelect,
  selectedCourier,
  paymentMethod,
  onPaymentMethodChange,
  allowCod = true,
  subtotal = 0,
  platformFee = 0,
}) => {
  const handleCourierSelect = (courier: ShipBubbleCourier) => {
    // Check if COD is available
    if (paymentMethod === 'cod' && !courier.is_cod_available) {
      toast.error(`${courier.courier_name} does not support Cash on Delivery`);
      return;
    }

    onSelect(courier);
  };

  const handlePaymentMethodChange = (method: 'paystack' | 'cod') => {
    if (method === 'cod' && selectedCourier && !selectedCourier.is_cod_available) {
      toast.error(`${selectedCourier.courier_name} does not support Cash on Delivery. Please select another courier.`);
      return;
    }
    onPaymentMethodChange?.(method);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-gray-600 text-sm">Fetching shipping options…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-red-900">{error}</p>
          <p className="text-sm text-red-700 mt-1">Please check your delivery address and try again.</p>
        </div>
      </div>
    );
  }

  if (!couriers || couriers.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-yellow-900">No shipping options available</p>
          <p className="text-sm text-yellow-700 mt-1">Please check your delivery address.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Courier Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Truck className="w-5 h-5 text-orange-500" />
          Select Shipping Option
        </h3>

        <div className="grid gap-3">
          {couriers.map((courier) => {
            const isSelected = selectedCourier?.courier_id === courier.courier_id;
            const isCodAvailable = courier.is_cod_available;

            return (
              <div
                key={`${courier.courier_id}-${courier.service_code}`}
                onClick={() => handleCourierSelect(courier)}
                className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-200'
                }`}
              >
                {/* Selection indicator */}
                <div className="absolute top-3 right-3">
                  {isSelected && (
                    <CheckCircle2 className="w-6 h-6 text-orange-500" />
                  )}
                </div>

                {/* Courier info */}
                <div className="flex items-start gap-3 pr-10">
                  {courier.courier_image ? (
                    <img
                      src={courier.courier_image}
                      alt={courier.courier_name}
                      className="w-10 h-10 rounded-lg object-cover border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="font-semibold text-gray-900">{courier.courier_name}</p>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          isCodAvailable
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {isCodAvailable ? 'Cash on Delivery Available' : 'Card Payment Only'}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mt-1">
                      {courier.service_code} • {courier.service_type === 'pickup' ? 'Pickup' : 'Dropoff'}
                    </p>

                    {/* Delivery timeline */}
                    <div className="flex gap-4 mt-3 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Pickup: {courier.pickup_eta}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Package className="w-4 h-4" />
                        <span>Delivery: {courier.delivery_eta}</span>
                      </div>
                    </div>

                    {/* Tracking info */}
                    {courier.tracking && (
                      <p className="text-xs text-gray-500 mt-2">
                        {courier.tracking.label}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-orange-600">
                      ₦{courier.total.toLocaleString()}
                    </p>
                    {courier.is_cod_available && courier.cod_fee ? (
                      <p className="text-xs text-gray-600 mt-1">
                        +₦{courier.cod_fee.toLocaleString()} COD fee
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info text */}
        <p className="text-xs text-gray-600 mt-3 flex items-start gap-2">
          <span>ℹ️</span>
          <span>Prices include shipping. Rates are valid for 30 minutes.</span>
        </p>
      </div>

      {/* Payment Method Selection (only if courier selected) */}
      {selectedCourier && allowCod && selectedCourier.is_cod_available && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-500" />
            Courier Payment Options
          </h3>

          <div className="space-y-3">
            {/* Paystack option */}
            <div
              onClick={() => handlePaymentMethodChange('paystack')}
              className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                paymentMethod === 'paystack'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-blue-200'
              }`}
            >
              <div className="absolute top-4 right-4">
                {paymentMethod === 'paystack' && (
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                )}
              </div>

              <div className="flex items-start gap-4 pr-10">
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>

                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Pay Now</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Secure instant payment with card
                  </p>

                  <div className="mt-3 text-xs space-y-1 text-gray-500">
                    <div className="flex justify-between">
                      <span>Items</span>
                      <span>₦{subtotal.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span>₦{selectedCourier.total.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Platform Fee</span>
                      <span>₦{platformFee.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex justify-between font-semibold text-gray-900">
                    <span>Total</span>
                    <span>
                      ₦{(subtotal + platformFee + selectedCourier.total).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* COD option */}
            <div
              onClick={() => handlePaymentMethodChange('cod')}
              className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                paymentMethod === 'cod'
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-green-200'
              }`}
            >
              <div className="absolute top-4 right-4">
                {paymentMethod === 'cod' && (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                )}
              </div>

              <div className="flex items-start gap-4 pr-10">
                <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>

                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Cash on Delivery</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Pay when package arrives
                  </p>

                  <div className="mt-3 text-xs space-y-1 text-gray-500">
                    <div className="flex justify-between">
                      <span>Items</span>
                      <span>₦{subtotal.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span>₦{selectedCourier.total.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Platform Fee</span>
                      <span>₦{platformFee.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>COD Fee</span>
                      <span>₦{(selectedCourier.cod_fee || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex justify-between font-semibold text-gray-900">
                    <span>Total</span>
                    <span>
                      ₦{(
                        subtotal +
                        platformFee +
                        selectedCourier.total +
                        (selectedCourier.cod_fee || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COD info */}
          <p className="text-xs text-gray-600 mt-3 flex items-start gap-2">
            <span>ℹ️</span>
            <span>With Cash on Delivery, you pay the courier when your package arrives at your doorstep.</span>
          </p>
        </div>
      )}

      {/* Warning if courier selected but doesn't support COD and COD is selected */}
      {selectedCourier && paymentMethod === 'cod' && !selectedCourier.is_cod_available && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-900">COD not available with selected courier</p>
            <p className="text-sm text-red-700 mt-1">Please switch to card payment or select another courier.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShipBubbleRateSelector;