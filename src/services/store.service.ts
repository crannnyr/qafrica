import { supabase } from './supabase';
import type { Store } from '@/types';

export const storeService = {
  async createStore(storeData: Partial<Store>) {
    const { data, error } = await supabase
      .from('stores')
      .insert(storeData)
      .select()
      .single();
    return { data, error };
  },

  async getStore(storeId: string) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    return { data, error };
  },

  async getStoreBySlug(slug: string) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .single();
    return { data, error };
  },

  async getUserStore(userId: string) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', userId)
      .single();
    return { data, error };
  },

  async updateStore(storeId: string, updates: Partial<Store>) {
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', storeId)
      .select()
      .single();
    return { data, error };
  },

  async getAllStores() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async blockStore(storeId: string, reason: string) {
    const { data, error } = await supabase
      .from('stores')
      .update({ is_blocked: true, block_reason: reason })
      .eq('id', storeId)
      .select()
      .single();
    return { data, error };
  },

  async unblockStore(storeId: string) {
    const { data, error } = await supabase
      .from('stores')
      .update({ is_blocked: false, block_reason: null })
      .eq('id', storeId)
      .select()
      .single();
    return { data, error };
  },
};