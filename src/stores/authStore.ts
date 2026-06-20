import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, userService } from '@/services';
import { sendWelcomeEmail } from '@/services/email';
import type { User, StoreOwner } from '@/types';
import { useStoreStore } from './storeStore';
import { useOrderStore } from './orderStore';
import { useWalletStore } from './walletStore';
import { useImportStore } from './importStore';

interface AuthState {
  user: StoreOwner | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: StoreOwner | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; onboardingIncomplete?: boolean; currentStep?: number }>;
  signup: (email: string, password: string, userData: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<StoreOwner>) => Promise<{ success: boolean; error?: string }>;
  updateOnboardingStep: (step: number, completed?: boolean) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await authService.signIn(email, password);

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          if (data.user) {
            const { data: profile, error: profileError } = await userService.getProfile(data.user.id);

            if (profileError || !profile) {
              // No profile row = this is a customer account, not a store owner
              await authService.signOut();
              set({ isLoading: false });
              return {
                success: false,
                error: 'No store owner account found for this email. If you are a customer, please use the store login page.',
              };
            }

            // ROLE GUARD: reject non-store-owner accounts
            if (profile.role !== 'store_owner' && profile.role !== 'admin') {
              await authService.signOut();
              set({ isLoading: false });
              return {
                success: false,
                error: 'This email is registered as a customer account. Please use the store login page to shop, or sign up with a different email to open a store.',
              };
            }

            const isOnboardingComplete = profile.onboarding_completed === true;
            const currentStep = profile.onboarding_step || 0;

            set({
              user: profile as StoreOwner,
              isAuthenticated: isOnboardingComplete,
              isLoading: false,
            });

            if (!isOnboardingComplete) {
              sessionStorage.setItem('signup_email', email);
              sessionStorage.setItem('onboarding_step', currentStep.toString());
              return { success: true, onboardingIncomplete: true, currentStep };
            }

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

      signup: async (email, password, userData) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await authService.signUp(email, password, userData);

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          if (data?.user) {
            // Small delay to allow DB trigger to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            const { data: profile, error: profileError } = await userService.getProfile(data.user.id);

            if (profile && !profileError) {
              // Verify the profile was created as a store owner
              if (profile.role !== 'store_owner') {
                await authService.signOut();
                set({ isLoading: false });
                return { success: false, error: 'Account creation failed. Please try again.' };
              }

              const isOnboardingComplete = profile.onboarding_completed === true;

              set({
                user: profile as StoreOwner,
                isAuthenticated: isOnboardingComplete,
                isLoading: false,
              });

              if (!isOnboardingComplete) {
                sessionStorage.setItem('signup_email', email);
                sessionStorage.setItem('onboarding_step', (profile.onboarding_step || 0).toString());
              }

              sendWelcomeEmail(email, userData.full_name || 'there');
            } else {
              // Profile not ready yet — don't authenticate
              set({ isAuthenticated: false, isLoading: false });
              sessionStorage.setItem('signup_email', email);
              sendWelcomeEmail(email, userData.full_name || 'there');
            }
          } else {
            set({ isLoading: false });
          }

          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Signup failed';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      logout: async () => {
        try {
          await authService.signOut();
        } catch (err) {
          console.error('Logout error:', err);
        } finally {
          useStoreStore.getState().reset();
          useOrderStore.getState().reset();
          useWalletStore.getState().reset();
          if (useImportStore.getState().reset) {
            useImportStore.getState().reset();
          }

          set({ user: null, isAuthenticated: false, error: null });
          localStorage.removeItem('qafrica-store');
          localStorage.removeItem('qafrica-auth');
          sessionStorage.removeItem('signup_email');
          sessionStorage.removeItem('onboarding_step');
        }
      },

      fetchProfile: async () => {
        try {
          const { user: authUser, error: authError } = await authService.getCurrentUser();

          if (authError || !authUser) {
            set({ user: null, isAuthenticated: false });
            return;
          }

          const { data, error } = await userService.getProfile(authUser.id);

          if (data && !error) {
            // ROLE GUARD: if a customer session reaches here, clear authStore
            // state only — do NOT call signOut, as that would destroy the
            // customer's active Supabase session (both stores share one client)
            if (data.role !== 'store_owner' && data.role !== 'admin') {
              set({ user: null, isAuthenticated: false });
              return;
            }

            const isOnboardingComplete = data.onboarding_completed === true;

            set({
              user: data as StoreOwner,
              isAuthenticated: isOnboardingComplete,
            });

            if (!isOnboardingComplete && data.email) {
              sessionStorage.setItem('signup_email', data.email);
              sessionStorage.setItem('onboarding_step', (data.onboarding_step || 0).toString());
            }
          } else {
            // No profiles row — this is a customer session. Clear authStore
            // state only, do NOT sign out.
            set({ user: null, isAuthenticated: false });
          }
        } catch (err) {
          console.error('Failed to fetch profile:', err);
          set({ user: null, isAuthenticated: false });
        }
      },

      updateProfile: async (updates) => {
        const { user } = get();
        if (!user) return { success: false, error: 'Not authenticated' };

        try {
          const { data, error } = await userService.updateProfile(user.id, updates);

          if (error) return { success: false, error: error.message };

          set({ user: data as StoreOwner });
          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Update failed';
          return { success: false, error: message };
        }
      },

      updateOnboardingStep: async (step: number, completed: boolean = false) => {
        const { user } = get();
        if (!user) return { success: false, error: 'Not authenticated' };

        try {
          const updates: Partial<StoreOwner> = { onboarding_step: step };
          if (completed) updates.onboarding_completed = true;

          const { data, error } = await userService.updateProfile(user.id, updates);

          if (error) return { success: false, error: error.message };

          set({
            user: { ...user, ...updates } as StoreOwner,
            isAuthenticated: completed,
          });

          sessionStorage.setItem('onboarding_step', step.toString());
          if (completed) sessionStorage.removeItem('signup_email');

          return { success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Update failed';
          return { success: false, error: message };
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'qafrica-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;