import { supabase } from './supabase';

export const productEarningsService = {
  async getEarningsSummary(storeId: string, startDate?: string, endDate?: string) {
    const { data, error } = await supabase
      .rpc('get_product_earnings_summary', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
    return { data, error };
  },

  async getProductEarnings(productId: string) {
    const { data, error } = await supabase
      .from('product_earnings')
      .select('*')
      .eq('product_id', productId)
      .order('earned_at', { ascending: false });
    return { data, error };
  },

  async getStoreEarnings(storeId: string, limit: number = 100) {
    const { data, error } = await supabase
      .from('product_earnings')
      .select('*, product:products(name, images)')
      .eq('store_id', storeId)
      .order('earned_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  async getTotalEarnings(storeId: string) {
    const { data, error } = await supabase
      .from('product_earnings')
      .select('total_revenue, total_cost, profit, net_profit')
      .eq('store_id', storeId);

    if (error) return { data: null, error };

    const totals = (data || []).reduce(
      (acc, curr) => ({
        total_revenue:    acc.total_revenue    + (curr.total_revenue || 0),
        total_cost:       acc.total_cost       + (curr.total_cost || 0),
        total_profit:     acc.total_profit     + (curr.profit || 0),
        total_net_profit: acc.total_net_profit + (curr.net_profit || 0),
      }),
      { total_revenue: 0, total_cost: 0, total_profit: 0, total_net_profit: 0 }
    );
    return { data: totals, error: null };
  },
};