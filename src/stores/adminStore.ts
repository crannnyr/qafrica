import { create } from 'zustand';
import { adminService, storeService, userService } from '@/services/supabase';
import type { AdminDashboardStats, User, Store } from '@/types';

interface AdminState {
  stats: AdminDashboardStats | null;
  users: User[];
  stores: Store[];
  pendingVerifications: Store[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchDashboardStats: () => Promise<void>;
  fetchAllUsers: () => Promise<void>;
  fetchAllStores: () => Promise<void>;
  fetchPendingVerifications: () => Promise<void>;
  verifyStore: (storeId: string) => Promise<{ success: boolean; error?: string }>;
  blockStore: (storeId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  unblockStore: (storeId: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  reset: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  stats: null,
  users: [],
  stores: [],
  pendingVerifications: [],
  isLoading: false,
  error: null,

  fetchDashboardStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await adminService.getDashboardStats();
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ stats: data as AdminDashboardStats, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stats';
      set({ isLoading: false, error: message });
    }
  },

  fetchAllUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await userService.getAllUsers();
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ users: data as User[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users';
      set({ isLoading: false, error: message });
    }
  },

  fetchAllStores: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await storeService.getAllStores();
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ stores: data as Store[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stores';
      set({ isLoading: false, error: message });
    }
  },

  fetchPendingVerifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await adminService.getPendingVerifications();
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return;
      }

      set({ pendingVerifications: data as Store[], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pending verifications';
      set({ isLoading: false, error: message });
    }
  },

  verifyStore: async (storeId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await adminService.verifyStore(storeId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set((state) => ({
        pendingVerifications: state.pendingVerifications.filter((s) => s.id !== storeId),
        stores: state.stores.map((s) => 
          s.id === storeId ? { ...s, ...data } as Store : s
        ),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify store';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  blockStore: async (storeId, reason) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await storeService.blockStore(storeId, reason);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set((state) => ({
        stores: state.stores.map((s) => 
          s.id === storeId ? { ...s, ...data } as Store : s
        ),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to block store';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  unblockStore: async (storeId) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await storeService.unblockStore(storeId);
      
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set((state) => ({
        stores: state.stores.map((s) => 
          s.id === storeId ? { ...s, ...data } as Store : s
        ),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unblock store';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({ stats: null, users: [], stores: [], pendingVerifications: [], error: null }),
}));

export default useAdminStore;
