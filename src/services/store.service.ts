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

  // FIX: Uses get_user_active_store RPC instead of .single() so users
  // with multiple stores (e.g. vibecityyyy) never get a crash.
  // Returns the user's active_store_id preference → primary store → oldest store.
  // For all regular users with one store, behaviour is identical to before.
  async getUserStore(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_active_store', { p_user_id: userId });
    return { data, error };
  },

  // Switch which store is "active" for a multi-store user.
  // For single-store users this is never called.
  async switchActiveStore(userId: string, storeId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ active_store_id: storeId })
      .eq('id', userId);
    return { error };
  },

  // Get all stores owned by a user — used to render the store switcher.
  // Only ever returns >1 row for vibecityyyy (or any future multi-store admin).
  async getUserStores(userId: string) {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name, slug, logo_url, niches, is_primary, is_active')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('created_at',  { ascending: true });
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
