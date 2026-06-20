import { supabase } from './supabase';

export const messageService = {
  async sendMessage(messageData: {
    store_id: string;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    message: string;
    context?: string;
  }) {
    const { data, error } = await supabase
      .from('store_messages')
      .insert(messageData)
      .select()
      .single();
    return { data, error };
  },

  async getStoreMessages(storeId: string) {
    const { data, error } = await supabase
      .from('store_messages')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async markAsRead(messageId: string) {
    const { data, error } = await supabase
      .from('store_messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .select()
      .single();
    return { data, error };
  },
};