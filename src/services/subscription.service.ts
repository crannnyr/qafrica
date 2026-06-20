import { supabase } from './supabase';
import type { Subscription } from '@/types';

export const subscriptionService = {
  async createSubscription(subData: Partial<Subscription>) {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subData)
      .select()
      .single();
    return { data, error };
  },

  async getActiveTrial(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_trial', true)
      .eq('is_active', true)
      .single();
    return { data, error };
  },

  async getActiveSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    return { data, error };
  },

  async deactivateExpiredTrials() {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('is_trial', true)
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .select();
    return { data, error };
  },

  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    return { data, error };
  },

  async getAllSubscriptions() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, user:profiles(*), store:stores(*)')
      .order('created_at', { ascending: false });
    return { data, error };
  },
};