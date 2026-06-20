import { supabase } from './supabase';

export const adminService = {
  async getDashboardStats() {
    const { data, error } = await supabase
      .rpc('get_admin_dashboard_stats');
    return { data, error };
  },

  async getPendingVerifications() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_verified', false)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async verifyStore(storeId: string) {
    const { data, error } = await supabase
      .from('stores')
      .update({ is_verified: true })
      .eq('id', storeId)
      .select()
      .single();
    return { data, error };
  },

  async logAction(
    adminId: string,
    actionType: string,
    targetType: string,
    targetId: string,
    details: string
  ) {
    const { data, error } = await supabase
      .from('admin_actions')
      .insert({ admin_id: adminId, action_type: actionType, target_type: targetType, target_id: targetId, details })
      .select()
      .single();
    return { data, error };
  },
};