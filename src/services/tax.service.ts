import { supabase } from './supabase';
import type { TaxSettings, BusinessExpense, TaxReport } from '@/types';

export const taxService = {
  async getTaxSettings(storeId: string) {
    const { data, error } = await supabase
      .from('tax_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    return { data, error };
  },

  async createTaxSettings(settingsData: Partial<TaxSettings>) {
    const { data, error } = await supabase
      .from('tax_settings')
      .insert(settingsData)
      .select()
      .single();
    return { data, error };
  },

  async updateTaxSettings(storeId: string, updates: Partial<TaxSettings>) {
    const { data, error } = await supabase
      .from('tax_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('store_id', storeId)
      .select()
      .single();
    return { data, error };
  },

  async calculateTax(storeId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .rpc('calculate_tax_for_period', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
    return { data, error };
  },
};

export const expenseService = {
  async createExpense(expenseData: Partial<BusinessExpense>) {
    const { data, error } = await supabase
      .from('business_expenses')
      .insert(expenseData)
      .select()
      .single();
    return { data, error };
  },

  async getExpenses(storeId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('business_expenses')
      .select('*')
      .eq('store_id', storeId)
      .order('expense_date', { ascending: false });

    if (startDate) query = query.gte('expense_date', startDate);
    if (endDate)   query = query.lte('expense_date', endDate);

    const { data, error } = await query;
    return { data, error };
  },

  async updateExpense(expenseId: string, updates: Partial<BusinessExpense>) {
    const { data, error } = await supabase
      .from('business_expenses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', expenseId)
      .select()
      .single();
    return { data, error };
  },

  async deleteExpense(expenseId: string) {
    const { error } = await supabase
      .from('business_expenses')
      .delete()
      .eq('id', expenseId);
    return { error };
  },

  async getExpenseCategoriesSummary(storeId: string, startDate?: string, endDate?: string) {
    const { data, error } = await supabase
      .rpc('get_expense_categories_summary', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
    return { data, error };
  },

  async getTotalExpenses(storeId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('business_expenses')
      .select('amount')
      .eq('store_id', storeId);

    if (startDate) query = query.gte('expense_date', startDate);
    if (endDate)   query = query.lte('expense_date', endDate);

    const { data, error } = await query;
    if (error) return { total: 0, error };

    const total = (data || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    return { total, error: null };
  },
};

export const taxReportService = {
  async createReport(reportData: Partial<TaxReport>) {
    const { data, error } = await supabase
      .from('tax_reports')
      .insert(reportData)
      .select()
      .single();
    return { data, error };
  },

  async getReports(storeId: string) {
    const { data, error } = await supabase
      .from('tax_reports')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getReport(reportId: string) {
    const { data, error } = await supabase
      .from('tax_reports')
      .select('*')
      .eq('id', reportId)
      .single();
    return { data, error };
  },

  async deleteReport(reportId: string) {
    const { error } = await supabase
      .from('tax_reports')
      .delete()
      .eq('id', reportId);
    return { error };
  },
};