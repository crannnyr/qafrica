import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/services';
import type { Customer, CustomerAddress } from '@/types';

interface CustomerAuthState {
  customer: Customer | null;
  addresses: CustomerAddress[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCustomer: (customer: Customer | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Customer>) => Promise<{ success: boolean; error?: string }>;

  // Address management
  fetchAddresses: () => Promise<void>;
  addAddress: (address: Omit<CustomerAddress, 'id' | 'customer_id' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  updateAddress: (addressId: string, updates: Partial<CustomerAddress>) => Promise<{ success: boolean; error?: string }>;
  deleteAddress: (addressId: string) => Promise<{ success: boolean; error?: string }>;
  setDefaultAddress: (addressId: string) => Promise<{ success: boolean; error?: string }>;
  getDefaultAddress: () => CustomerAddress | null;

  clearError: () => void;
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set, get) => ({
      customer: null,
      addresses: [],
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setCustomer: (customer) => set({ customer, isAuthenticated: !!customer }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          if (data.user) {
            // Customers live in the customers table, not profiles.
            // Query customers table first.
            const { data: customerData, error: customerError } = await supabase
              .from('customers')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (customerError || !customerData) {
              // No customers row — check if this is a store owner account
              const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

              await supabase.auth.signOut();
              set({ isLoading: false });

              if (profileData?.role === 'store_owner' || profileData?.role === 'admin') {
                return {
                  success: false,
                  error: 'This email belongs to a store owner account. Please use the main login page.',
                };
              }

              return { success: false, error: 'Account not found. Please sign up first.' };
            }

            set({
              customer: customerData as Customer,
              isAuthenticated: true,
              isLoading: false,
            });

            get().fetchAddresses();
            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: 'Login failed' };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      signup: async (email, password, fullName, phone) => {
        set({ isLoading: true, error: null });
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                phone: phone || '',
                user_type: 'customer',
              },
            },
          });

          if (authError) {
            set({ isLoading: false, error: authError.message });
            return { success: false, error: authError.message };
          }

          if (authData.user) {
            set({ isLoading: false });
            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: 'Signup failed' };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Signup failed';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ customer: null, addresses: [], isAuthenticated: false, error: null });
      },

      fetchProfile: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // ROLE GUARD: if this is a store owner session, clear customer state
          // only — do NOT call signOut, as that would destroy their active
          // Supabase session (both stores share one client)
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profileData?.role === 'store_owner' || profileData?.role === 'admin') {
            set({ customer: null, isAuthenticated: false });
            return;
          }

          const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', user.id)
            .single();

          if (data && !error) {
            set({ customer: data as Customer, isAuthenticated: true });
            get().fetchAddresses();
          } else {
            set({ customer: null, isAuthenticated: false });
          }
        } catch (err) {
          console.error('Failed to fetch customer profile:', err);
        }
      },

      updateProfile: async (updates) => {
        const { customer } = get();
        if (!customer) return { success: false, error: 'Not authenticated' };

        try {
          const { data, error } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', customer.id)
            .select()
            .single();

          if (error) return { success: false, error: error.message };

          set({ customer: data as Customer });
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Update failed';
          return { success: false, error: message };
        }
      },

      fetchAddresses: async () => {
        const { customer } = get();
        if (!customer) return;

        try {
          const { data, error } = await supabase
            .from('customer_addresses')
            .select('*')
            .eq('customer_id', customer.id)
            .order('is_default', { ascending: false });

          if (data && !error) {
            set({ addresses: data as CustomerAddress[] });
          }
        } catch (err) {
          console.error('Failed to fetch addresses:', err);
        }
      },

      addAddress: async (address) => {
        const { customer } = get();
        if (!customer) return { success: false, error: 'Not authenticated' };

        try {
          const isFirstAddress = get().addresses.length === 0;

          const { data, error } = await supabase
            .from('customer_addresses')
            .insert({
              customer_id: customer.id,
              ...address,
              is_default: isFirstAddress ? true : address.is_default,
            })
            .select()
            .single();

          if (error) return { success: false, error: error.message };

          if (address.is_default && !isFirstAddress) {
            await supabase
              .from('customer_addresses')
              .update({ is_default: false })
              .eq('customer_id', customer.id)
              .neq('id', data.id);
          }

          await get().fetchAddresses();
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to add address';
          return { success: false, error: message };
        }
      },

      updateAddress: async (addressId, updates) => {
        const { customer } = get();
        if (!customer) return { success: false, error: 'Not authenticated' };

        try {
          const { error } = await supabase
            .from('customer_addresses')
            .update(updates)
            .eq('id', addressId)
            .eq('customer_id', customer.id);

          if (error) return { success: false, error: error.message };

          if (updates.is_default) {
            await supabase
              .from('customer_addresses')
              .update({ is_default: false })
              .eq('customer_id', customer.id)
              .neq('id', addressId);
          }

          await get().fetchAddresses();
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to update address';
          return { success: false, error: message };
        }
      },

      deleteAddress: async (addressId) => {
        const { customer } = get();
        if (!customer) return { success: false, error: 'Not authenticated' };

        try {
          const { error } = await supabase
            .from('customer_addresses')
            .delete()
            .eq('id', addressId)
            .eq('customer_id', customer.id);

          if (error) return { success: false, error: error.message };

          await get().fetchAddresses();
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to delete address';
          return { success: false, error: message };
        }
      },

      setDefaultAddress: async (addressId) => {
        const { customer } = get();
        if (!customer) return { success: false, error: 'Not authenticated' };

        try {
          await supabase
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('customer_id', customer.id);

          const { error } = await supabase
            .from('customer_addresses')
            .update({ is_default: true })
            .eq('id', addressId)
            .eq('customer_id', customer.id);

          if (error) return { success: false, error: error.message };

          await get().fetchAddresses();
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to set default address';
          return { success: false, error: message };
        }
      },

      getDefaultAddress: () => {
        const { addresses } = get();
        return addresses.find(a => a.is_default) || addresses[0] || null;
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'qafrica-customer-auth',
      partialize: (state) => ({
        customer: state.customer,
        addresses: state.addresses,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useCustomerAuthStore;