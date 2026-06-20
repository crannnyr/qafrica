import { create } from 'zustand';
import { walletService, withdrawalService } from '@/services';
import { supabase } from '@/services';
import type { Wallet, WalletTransaction, WithdrawalRequest } from '@/types';

interface WalletState {
  wallet: Wallet | null;
  transactions: WalletTransaction[];
  withdrawalRequests: WithdrawalRequest[];
  pendingWithdrawals: WithdrawalRequest[];
  availableBalance: number;
  escrowBalance: number;
  isLoading: boolean;
  error: string | null;

  fetchWallet: (userId: string) => Promise<void>;
  fetchTransactions: (userId: string) => Promise<void>;
  fetchWithdrawalRequests: (userId: string) => Promise<void>;
  fetchPendingWithdrawals: () => Promise<void>;
  submitWithdrawal: (params: {
    user_id: string;
    amount: number;
    bank_name: string;
    account_number: string;
    account_name: string;
  }) => Promise<{ success: boolean; error?: string; request_id?: string }>;
  markWithdrawalPaid: (
    requestId: string,
    adminId: string,
    adminNote?: string
  ) => Promise<{ success: boolean; error?: string; user_id?: string; amount?: number }>;
  rejectWithdrawal: (
    requestId: string,
    adminId: string,
    reason: string
  ) => Promise<{ success: boolean; error?: string; user_id?: string; amount?: number }>;
  creditWallet: (userId: string, amount: number, description: string, reference?: string) => Promise<{ success: boolean; error?: string }>;
  calculateBalances: () => void;
  clearError: () => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  transactions: [],
  withdrawalRequests: [],
  pendingWithdrawals: [],
  availableBalance: 0,
  escrowBalance: 0,
  isLoading: false,
  error: null,

  calculateBalances: () => {
    const { wallet } = get();
    if (!wallet) return;
    const escrow = Number((wallet as any).escrow_balance) || 0;
    const available = Math.max(0, Number(wallet.balance) || 0);
    set({ escrowBalance: escrow, availableBalance: available });
  },

  fetchWallet: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await walletService.getWallet(userId);
      if (error) {
        if (error.code === 'PGRST116') {
          const { data: newWallet, error: createError } = await walletService.createWallet(userId);
          if (!createError) {
            set({ wallet: newWallet as Wallet, isLoading: false });
            get().calculateBalances();
            return;
          }
        }
        set({ isLoading: false, error: error.message });
        return;
      }
      set({ wallet: data as Wallet, isLoading: false });
      get().calculateBalances();
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch wallet' });
    }
  },

  fetchTransactions: async (userId) => {
    try {
      const { data, error } = await walletService.getTransactions(userId);
      if (error) { console.error('Failed to fetch transactions:', error); return; }
      set({ transactions: data as WalletTransaction[] });
      get().calculateBalances();
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  },

  fetchWithdrawalRequests: async (userId) => {
    try {
      const { data, error } = await withdrawalService.getUserRequests(userId);
      if (error) { console.error('Failed to fetch withdrawal requests:', error); return; }
      set({ withdrawalRequests: data as WithdrawalRequest[] });
    } catch (err) {
      console.error('Failed to fetch withdrawal requests:', err);
    }
  },

  fetchPendingWithdrawals: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await withdrawalService.getPendingRequests();
      if (error) { set({ isLoading: false, error: error.message }); return; }
      set({ pendingWithdrawals: data as WithdrawalRequest[], isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch pending withdrawals' });
    }
  },

  // Calls the secure DB RPC which enforces:
  // - Wed/Sun only
  // - Min ₦20,000
  // - Balance check
  // - No duplicate pending
  // - Atomic balance deduction
  submitWithdrawal: async ({ user_id, amount, bank_name, account_number, account_name }) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('submit_withdrawal_request', {
        p_user_id: user_id,
        p_amount: amount,
        p_bank_name: bank_name,
        p_account_number: account_number,
        p_account_name: account_name,
      });

      set({ isLoading: false });

      if (error) {
        set({ error: error.message });
        return { success: false, error: error.message };
      }

      const result = data as { success: boolean; error?: string; request_id?: string };
      if (!result.success) {
        set({ error: result.error });
        return { success: false, error: result.error };
      }

      // Refresh wallet to reflect new balance
      await get().fetchWallet(user_id);
      await get().fetchTransactions(user_id);
      await get().fetchWithdrawalRequests(user_id);

      return { success: true, request_id: result.request_id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit withdrawal';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  markWithdrawalPaid: async (requestId, adminId, adminNote) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('mark_withdrawal_paid', {
        p_request_id: requestId,
        p_admin_id: adminId,
        p_admin_note: adminNote ?? null,
      });

      set({ isLoading: false });

      if (error) {
        set({ error: error.message });
        return { success: false, error: error.message };
      }

      const result = data as { success: boolean; error?: string; user_id?: string; amount?: number };
      if (!result.success) {
        set({ error: result.error });
        return result;
      }

      set((state) => ({
        pendingWithdrawals: state.pendingWithdrawals.filter((r) => r.id !== requestId),
      }));

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark as paid';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  rejectWithdrawal: async (requestId, adminId, reason) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('reject_withdrawal', {
        p_request_id: requestId,
        p_admin_id: adminId,
        p_reason: reason,
      });

      set({ isLoading: false });

      if (error) {
        set({ error: error.message });
        return { success: false, error: error.message };
      }

      const result = data as { success: boolean; error?: string; user_id?: string; amount?: number };
      if (!result.success) {
        set({ error: result.error });
        return result;
      }

      set((state) => ({
        pendingWithdrawals: state.pendingWithdrawals.filter((r) => r.id !== requestId),
      }));

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject withdrawal';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  creditWallet: async (userId, amount, description, reference) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await walletService.creditWallet(userId, amount, description, reference);
      if (error) { set({ isLoading: false, error: error.message }); return { success: false, error: error.message }; }
      await get().fetchWallet(userId);
      await get().fetchTransactions(userId);
      set({ isLoading: false });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to credit wallet';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({
    wallet: null, transactions: [], withdrawalRequests: [],
    pendingWithdrawals: [], availableBalance: 0, escrowBalance: 0, error: null,
  }),
}));

export default useWalletStore;