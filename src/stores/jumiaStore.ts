// src/stores/jumiaStore.ts
// Mirrors the structure of useWalletStore / useStoreStore.
// Fully isolated from the main wallet — separate balance, separate transactions.

import { create } from 'zustand';
import { supabase } from '@/services';

export interface JumiaVariant {
  label: string;
  quantity_sent: number;
  quantity_remaining: number;
}

export interface JumiaSubmission {
  id: string;
  owner_id: string;
  source_product_id: string | null;
  name: string;
  description: string | null;
  images: string[];
  category: string;
  selling_price: number;
  has_variants: boolean;
  variants: JumiaVariant[];
  quantity_sent: number;
  quantity_remaining: number;
  fulfillment_method: 'self_dropoff' | 'agent_pickup';
  drop_off_location_id: string | null;
  submission_fee_paid: boolean;
  submission_fee_amount: number;
  agent_fee_paid: boolean;
  agent_fee_amount: number;
  payment_reference: string | null;
  payment_status: 'unpaid' | 'paid';
  paid_at: string | null;
  status: 'pending_payment' | 'awaiting_schedule' | 'awaiting_dropoff' | 'dropped_off'
        | 'received_by_jumia' | 'live' | 'out_of_stock' | 'paused' | 'rejected';
  status_note: string | null;
  scheduled_for: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  live_at: string | null;
  received_by_jumia_at: string | null;
  // Present only when fetched via fetchAllSubmissions (admin join)
  owner?: { full_name: string; email: string; phone: string | null };
}

export interface JumiaDropOffLocation {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

export interface JumiaWallet {
  id: string;
  user_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  withdrawal_bank_name: string | null;
  withdrawal_account_number: string | null;
  withdrawal_account_name: string | null;
}

export interface JumiaWalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  description: string;
  status: string;
  created_at: string;
}

export interface JumiaWithdrawalRequest {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  bank_name: string;
  account_number: string;
  account_name: string;
  admin_note: string | null;
  created_at: string;
  paid_at: string | null;
}

interface JumiaStore {
  submissions: JumiaSubmission[];
  allSubmissions: JumiaSubmission[];
  dropOffLocations: JumiaDropOffLocation[];
  wallet: JumiaWallet | null;
  transactions: JumiaWalletTransaction[];
  withdrawalRequests: JumiaWithdrawalRequest[];
  allWithdrawalRequests: (JumiaWithdrawalRequest & { user?: { full_name: string; email: string } })[];
  isLoading: boolean;

  fetchSubmissions: (userId: string) => Promise<void>;
  fetchAllSubmissions: () => Promise<void>;
  fetchSubmissionById: (id: string) => Promise<JumiaSubmission | null>;
  fetchDropOffLocations: () => Promise<void>;
  fetchWallet: (userId: string) => Promise<void>;
  fetchTransactions: (userId: string) => Promise<void>;
  fetchWithdrawalRequests: (userId: string) => Promise<void>;
  fetchAllWithdrawalRequests: () => Promise<void>;
  createSubmission: (payload: Partial<JumiaSubmission>) => Promise<{ success: boolean; id?: string; error?: string }>;
  updateSubmissionStatus: (id: string, updates: Partial<JumiaSubmission>) => Promise<{ success: boolean; error?: string }>;
  recordSale: (params: {
    submission_id: string; variant_label: string | null; units_sold: number; unit_price: number; admin_id: string;
  }) => Promise<{ success: boolean; saleId?: string; error?: string }>;
  submitWithdrawal: (payload: {
    user_id: string; amount: number; bank_name: string; account_number: string; account_name: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const useJumiaStore = create<JumiaStore>((set, get) => ({
  submissions: [],
  allSubmissions: [],
  dropOffLocations: [],
  wallet: null,
  transactions: [],
  withdrawalRequests: [],
  allWithdrawalRequests: [],
  isLoading: false,

  fetchSubmissions: async (userId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('jumia_submissions')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (!error) set({ submissions: (data as JumiaSubmission[]) || [] });
    set({ isLoading: false });
  },

  fetchDropOffLocations: async () => {
    const { data, error } = await supabase
      .from('jumia_drop_off_locations')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (!error) set({ dropOffLocations: (data as JumiaDropOffLocation[]) || [] });
  },

  // Admin-scope: all submissions across all users, with owner profile joined for the admin list view.
  fetchAllSubmissions: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('jumia_submissions')
      .select('*, owner:profiles!jumia_submissions_owner_id_fkey(full_name, email, phone)')
      .order('created_at', { ascending: false });
    if (!error) set({ allSubmissions: (data as JumiaSubmission[]) || [] });
    set({ isLoading: false });
  },

  // Single submission with owner joined, used by the admin detail page (route gives only an id).
  fetchSubmissionById: async (id) => {
    const { data, error } = await supabase
      .from('jumia_submissions')
      .select('*, owner:profiles!jumia_submissions_owner_id_fkey(full_name, email, phone)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as JumiaSubmission;
  },

  // Admin-scope: all withdrawal requests across all users, with requester profile joined.
  fetchAllWithdrawalRequests: async () => {
    const { data, error } = await supabase
      .from('jumia_withdrawal_requests')
      .select('*, user:profiles!jumia_withdrawal_requests_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false });
    if (!error) set({ allWithdrawalRequests: (data as any) || [] });
  },

  fetchWallet: async (userId) => {
    const { data, error } = await supabase
      .from('jumia_wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error) set({ wallet: data as JumiaWallet | null });
  },

  fetchTransactions: async (userId) => {
    const { data, error } = await supabase
      .from('jumia_wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) set({ transactions: (data as JumiaWalletTransaction[]) || [] });
  },

  fetchWithdrawalRequests: async (userId) => {
    const { data, error } = await supabase
      .from('jumia_withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error) set({ withdrawalRequests: (data as JumiaWithdrawalRequest[]) || [] });
  },

  createSubmission: async (payload) => {
    const { data, error } = await supabase
      .from('jumia_submissions')
      .insert(payload)
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  // Generic admin status/field update — used for schedule notes, status transitions, rejection reasons.
  updateSubmissionStatus: async (id, updates) => {
    const { error } = await supabase
      .from('jumia_submissions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Calls the record_jumia_sale RPC, which atomically inserts the sale, credits the
  // wallet (80%/20% split server-side via platform_settings), and decrements stock.
  recordSale: async ({ submission_id, variant_label, units_sold, unit_price, admin_id }) => {
    const { data, error } = await supabase.rpc('record_jumia_sale', {
      p_submission_id: submission_id,
      p_variant_label: variant_label,
      p_units_sold: units_sold,
      p_unit_price: unit_price,
      p_admin_id: admin_id,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, saleId: data as string };
  },

  submitWithdrawal: async ({ user_id, amount, bank_name, account_number, account_name }) => {
    const wallet = get().wallet;
    if (!wallet) return { success: false, error: 'Jumia wallet not found' };
    if (amount < 10000) return { success: false, error: 'Minimum withdrawal is ₦10,000' };
    if (amount > wallet.balance) return { success: false, error: 'Insufficient Jumia wallet balance' };

    const { error } = await supabase.from('jumia_withdrawal_requests').insert({
      user_id, jumia_wallet_id: wallet.id, amount, bank_name, account_number, account_name,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
}));
