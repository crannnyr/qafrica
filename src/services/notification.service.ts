import { supabase } from './supabase';
import type { Notification } from '@/types';

export const notificationService = {
  async createNotification(notificationData: Partial<Notification>) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();
    return { data, error };
  },

  async getUserNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select()
      .single();
    return { data, error };
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return { error };
  },
};

export const stockAlertService = {
  async getAlerts(ownerId: string) {
    const { data, error } = await supabase
      .rpc('get_stock_alerts', { p_owner_id: ownerId });
    return { data, error };
  },

  async getUnreadAlerts(ownerId: string) {
    const { data, error } = await supabase
      .from('stock_alerts')
      .select('*, product:products(*)')
      .eq('owner_id', ownerId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async markAsRead(alertId: string) {
    const { data, error } = await supabase
      .from('stock_alerts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', alertId)
      .select()
      .single();
    return { data, error };
  },

  async markAllAsRead(ownerId: string) {
    const { error } = await supabase
      .from('stock_alerts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .eq('is_read', false);
    return { error };
  },

  async getAlertCount(ownerId: string) {
    const { count, error } = await supabase
      .from('stock_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('is_read', false);
    return { count, error };
  },
};