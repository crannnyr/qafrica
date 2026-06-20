import { supabase } from './supabase';
import type { WithdrawalRequest } from '@/types';

export const walletService = {
  async getWallet(userId: string) {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  async createWallet(userId: string) {
    const { data, error } = await supabase
      .from('wallets')
      .insert({ user_id: userId, balance: 0, total_earned: 0, total_withdrawn: 0, pending_balance: 0 })
      .select()
      .single();
    return { data, error };
  },

  async creditWallet(userId: string, amount: number, description: string, reference?: string) {
    const { data: wallet, error: walletError } = await this.getWallet(userId);
    if (walletError) return { error: walletError };

    const newBalance = wallet.balance + amount;
    const newTotalEarned = wallet.total_earned + amount;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        balance: newBalance,
        total_earned: newTotalEarned,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) return { error: updateError };

    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        user_id: userId,
        type: 'credit',
        amount,
        balance_after: newBalance,
        description,
        reference,
        status: 'completed',
      })
      .select()
      .single();
    return { data: transaction, error: transactionError };
  },

  async getTransactions(userId: string) {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },
};

export const withdrawalService = {
  async createRequest(requestData: Partial<WithdrawalRequest>) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert(requestData)
      .select()
      .single();
    return { data, error };
  },

  async getUserRequests(userId: string) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getPendingRequests() {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*, user:profiles(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async approveRequest(requestId: string) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'approved' })
      .eq('id', requestId)
      .select()
      .single();
    return { data, error };
  },

  async markAsPaid(requestId: string, adminId: string) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: adminId,
      })
      .eq('id', requestId)
      .select()
      .single();
    return { data, error };
  },
};