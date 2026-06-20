import { supabase } from './supabase';
import type { DeliveryZone } from '@/types';

export const deliveryZoneService = {
  async createZone(zoneData: Partial<DeliveryZone>) {
    const { data, error } = await supabase
      .from('delivery_zones')
      .insert(zoneData)
      .select()
      .single();
    return { data, error };
  },

  async getStoreZones(storeId: string) {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('store_id', storeId)
      .order('state');
    return { data, error };
  },

  async updateZone(zoneId: string, updates: Partial<DeliveryZone>) {
    const { data, error } = await supabase
      .from('delivery_zones')
      .update(updates)
      .eq('id', zoneId)
      .select()
      .single();
    return { data, error };
  },

  async deleteZone(zoneId: string) {
    const { error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', zoneId);
    return { error };
  },
};