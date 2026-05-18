/**
 * Ship Bubble Service
 * Handles all Ship Bubble API interactions
 */

import CONFIG from '@/lib/config';

export interface ShipBubbleAddress {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country?: string;
  postal_code?: string;
}

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

export interface RateRequest {
  pickup_address_code: number;
  delivery_address_code?: number;
  delivery_address?: ShipBubbleAddress;
  parcel_weight: number;
  parcel_height: number;
  parcel_length: number;
  parcel_width: number;
  parcel_category: number;
  parcel_quantity?: number;
}

export interface RateResponse {
  request_token: string;
  receiver_address_code: number;
  couriers: ShipBubbleCourier[];
}

export interface ShipmentCreationData {
  request_token: string;
  receiver_address_code: number;
  courier_id: string | number;
  parcel_weight: number;
  parcel_category: number;
  is_cod: boolean;
  cod_amount?: number;
  parcel_description?: string;
}

export interface ShipmentResponse {
  status: number;
  success: boolean;
  data?: {
    shipment_id: string;
    tracking_url: string;
    tracking_number: string;
    courier_name: string;
    status: string;
  };
  message?: string;
}

const SHIPBUBBLE_API_URL = 'https://api.shipbubble.com/v1';

export const shipbubbleService = {
  /**
   * Validate an address with Ship Bubble
   */
  async validateAddress(
    address: ShipBubbleAddress,
    accessToken: string
  ): Promise<{
    success: boolean;
    address_code?: number;
    formatted_address?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/shipbubble-validate-address`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ address }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Address validation failed',
        };
      }

      const data = await response.json();
      return {
        success: true,
        address_code: data.address_code,
        formatted_address: data.formatted_address,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  },

  /**
   * Get shipping rates from Ship Bubble
   */
  async getRates(
    rateRequest: RateRequest,
    accessToken: string
  ): Promise<RateResponse | null> {
    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/shipbubble-get-rates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(rateRequest),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch rates');
      }

      return await response.json();
    } catch (err: any) {
      console.error('Ship Bubble rate fetch error:', err);
      return null;
    }
  },

  /**
   * Create a shipment on Ship Bubble (called via edge function)
   */
  async createShipment(
    shipmentData: ShipmentCreationData,
    accessToken: string
  ): Promise<{
    success: boolean;
    shipment_id?: string;
    tracking_url?: string;
    tracking_number?: string;
    courier_name?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/shipbubble-create-shipment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(shipmentData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Shipment creation failed',
        };
      }

      const data = await response.json();
      return {
        success: true,
        shipment_id: data.shipment_id,
        tracking_url: data.tracking_url,
        tracking_number: data.tracking_number,
        courier_name: data.courier_name,
      };
    } catch (err: any) {
      console.error('Ship Bubble shipment creation error:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  },

  /**
   * Get tracking info for a shipment
   */
  async getTracking(
    shipmentId: string,
    accessToken: string
  ): Promise<{
    success: boolean;
    status?: string;
    current_location?: string;
    estimated_delivery?: string;
    tracking_events?: any[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/shipbubble-track`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ shipment_id: shipmentId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tracking info');
      }

      const data = await response.json();
      return {
        success: true,
        status: data.status,
        current_location: data.current_location,
        estimated_delivery: data.estimated_delivery,
        tracking_events: data.tracking_events,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  },

  /**
   * Cancel a shipment
   */
  async cancelShipment(
    shipmentId: string,
    accessToken: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/shipbubble-cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ shipment_id: shipmentId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cancel shipment');
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  },
};
