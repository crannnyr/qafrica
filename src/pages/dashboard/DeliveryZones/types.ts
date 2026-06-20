export interface ShipbubblePickupAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
}

export interface PackagingDimensions {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  weight_kg: number;
}

export interface DeliveryZone {
  id: string;
  store_id: string;
  state: string;
  price: number;
  is_active: boolean;
}