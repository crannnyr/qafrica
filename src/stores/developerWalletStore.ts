// src/stores/developerWalletStore.ts
import { create } from 'zustand';
import { developerSupabase } from '@/services/developer';
import { toast } from 'sonner';

export interface Wallet {
  id: string;
  owner_id: string;
  balance: number;
  escrow_balance: number;
  pending_balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'api_sale' | 'escrow_release' | 'withdrawal' | 'withdrawal_rejected' | 'refund' | 'adjustment';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'escrow' | 'failed';
  method?: 'bank_transfer' | 'paystack';
  order_id?: string;
  order_number?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface WithdrawalDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
}

export interface WalletStats {
  total_earned: number;
  total_withdrawn: number;
  monthly_earnings: number;
  escrow_pending: number;
  sales_count: number;
  pending_withdrawals: number;
}

interface DeveloperWalletState {
  wallet: Wallet | null;
  transactions: Transaction[];
  stats: WalletStats | null;
  loading: boolean;
  transactionsLoading: boolean;
  
  fetchWallet: () => Promise<void>;
  fetchTransactions: (filter?: 'all' | 'sales' | 'withdrawals' | 'escrow', limit?: number) => Promise<void>;
  fetchStats: (period?: '7d' | '30d' | '90d' | 'all') => Promise<void>;
  createWithdrawal: (amount: number, details: WithdrawalDetails) => Promise<{ success: boolean; error?: string }>;
  refreshBalance: () => Promise<void>;
}

export const useDeveloperWalletStore = create<DeveloperWalletState>((set, get) => ({
  wallet: null,
  transactions: [],
  stats: null,
  loading: false,
  transactionsLoading: false,

  fetchWallet: async () => {
    set({ loading: true });
    try {
      const { data, error } = await developerSupabase.functions.invoke('developer-wallet', {
        method: 'GET',
      });

      if (error) throw error;

      if (data) {
        set({ 
          wallet: data.wallet,
          transactions: data.recent_transactions || [],
          loading: false,
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch wallet:', err);
      toast.error('Failed to load wallet data');
      set({ loading: false });
    }
  },

  fetchTransactions: async (filter = 'all', limit = 50) => {
    set({ transactionsLoading: true });
    try {
      const params = new URLSearchParams({ filter, limit: limit.toString() });
      
      const { data, error } = await developerSupabase.functions.invoke(`developer-wallet/transactions?${params}`, {
        method: 'GET',
      });

      if (error) throw error;

      if (data?.transactions) {
        set({ transactions: data.transactions, transactionsLoading: false });
      }
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      toast.error('Failed to load transaction history');
      set({ transactionsLoading: false });
    }
  },

  fetchStats: async (period = '30d') => {
    try {
      const { data, error } = await developerSupabase.functions.invoke(`developer-wallet/stats?period=${period}`, {
        method: 'GET',
      });

      if (error) throw error;

      if (data) {
        set({ stats: data });
      }
    } catch (err: any) {
      console.error('Failed to fetch wallet stats:', err);
    }
  },

  createWithdrawal: async (amount: number, details: WithdrawalDetails) => {
    try {
      const { wallet } = get();
      if (!wallet) throw new Error('Wallet not loaded');
      if (amount > wallet.balance) throw new Error('Insufficient balance');
      if (amount < 1000) throw new Error('Minimum withdrawal is ₦1,000');

      const { data, error } = await developerSupabase.functions.invoke('developer-wallet/withdrawals', {
        method: 'POST',
        body: {
          amount,
          bank_name: details.bank_name,
          account_number: details.account_number,
          account_name: details.account_name,
          currency: 'NGN'
        },
      });

      if (error) throw error;

      // Optimistic update
      set(state => ({
        wallet: state.wallet ? {
          ...state.wallet,
          balance: state.wallet.balance - amount,
          pending_balance: (state.wallet.pending_balance || 0) + amount
        } : null,
        transactions: [
          {
            id: data?.withdrawal_id || `temp-${Date.now()}`,
            wallet_id: wallet.id,
            type: 'withdrawal',
            amount: amount,
            description: `Withdrawal to ${details.bank_name} (${details.account_number})`,
            status: 'pending',
            method: 'bank_transfer',
            created_at: new Date().toISOString(),
          } as Transaction,
          ...state.transactions,
        ]
      }));

      // Refresh to get actual state
      setTimeout(() => {
        get().fetchWallet();
      }, 500);

      return { success: true };

    } catch (err: any) {
      console.error('Withdrawal failed:', err);
      return { 
        success: false, 
        error: err.message || 'Failed to process withdrawal request' 
      };
    }
  },

  refreshBalance: async () => {
    try {
      const { data, error } = await developerSupabase.functions.invoke('developer-wallet/balance', {
        method: 'GET',
      });

      if (error) throw error;
      if (data?.wallet) {
        set(state => ({
          wallet: state.wallet ? { ...state.wallet, ...data.wallet } : data.wallet
        }));
      }
    } catch (err) {
      console.error('Balance refresh failed:', err);
    }
  },
}));

export default useDeveloperWalletStore;