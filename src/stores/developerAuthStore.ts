// src/stores/developerAuthStore.ts
// Login and fetchProfile use the Supabase client directly —
// no edge functions needed, no CORS issues.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  developerSupabase,       // single shared client — defined in services/developer.ts
  developerAuthService,    // only used for signup (edge function)
} from '@/services/developer';
import type { Developer, DeveloperSignupFormData } from '@/types/developer';

// ── State shape ───────────────────────────────────────────────
interface DeveloperAuthState {
  developer:       Developer | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  error:           string | null;

  login:             (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup:            (formData: DeveloperSignupFormData) => Promise<{ success: boolean; error?: string }>;
  logout:            () => Promise<void>;
  fetchProfile:      () => Promise<void>;
  refreshSession:    () => Promise<void>;
  onAuthStateChange: () => () => void;
  setDeveloper:      (developer: Developer | null) => void;
  clearError:        () => void;
  reset:             () => void;
}

const INITIAL: Pick<DeveloperAuthState, 'developer' | 'isAuthenticated' | 'isLoading' | 'error'> = {
  developer:       null,
  isAuthenticated: false,
  isLoading:       false,
  error:           null,
};

// ── Developer profile select columns ─────────────────────────
const DEV_SELECT = `
  id, auth_user_id, account_type, full_name, email, phone,
  company_name, rc_number, company_verified,
  platform_name, platform_url, platform_type,
  shadow_store_id,
  paystack_subaccount_code, paystack_subaccount_id,
  paystack_split_code, paystack_connected, paystack_connected_at,
  plan, plan_expires_at, plan_is_active,
  wallet_balance, total_earned, total_withdrawn,
  is_active, is_blocked, block_reason,
  email_verified, onboarding_completed,
  created_at, updated_at
`.trim();

export const useDeveloperAuthStore = create<DeveloperAuthState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setDeveloper: (developer) =>
        set({ developer, isAuthenticated: !!developer }),

      // ── login ─────────────────────────────────────────────────
      // Uses Supabase signInWithPassword directly.
      // No edge function — no CORS issues.
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          // 1. Authenticate with Supabase
          const { data: authData, error: authError } =
            await developerSupabase.auth.signInWithPassword({ email, password });

          if (authError) {
            const message = authError.message.toLowerCase().includes('invalid')
              ? 'Incorrect email or password.'
              : authError.message;
            set({ isLoading: false, error: message });
            return { success: false, error: message };
          }

          const userId = authData.user.id;

          // 2. Confirm a developers record exists for this user
          const { data: dev, error: devError } = await developerSupabase
            .from('developers')
            .select(DEV_SELECT)
            .eq('auth_user_id', userId)
            .maybeSingle();

          if (devError || !dev) {
            await developerSupabase.auth.signOut();
            const message = 'This email is not registered as a developer account.';
            set({ isLoading: false, error: message });
            return { success: false, error: message };
          }

          if ((dev as any).is_blocked) {
            await developerSupabase.auth.signOut();
            const message = (dev as any).block_reason ?? 'Your account has been suspended. Contact support@qafrica.store.';
            set({ isLoading: false, error: message });
            return { success: false, error: message };
          }
          
          set({
            developer:       dev as unknown as Developer,
            isAuthenticated: true,
            isLoading:       false,
            error:           null,
          });

          return { success: true };
        } catch (err: any) {
          const message = err?.message ?? 'Login failed. Please try again.';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      // ── signup ────────────────────────────────────────────────
      // Calls the edge function to create the account.
      signup: async (formData) => {
        set({ isLoading: true, error: null });
        try {
          await developerAuthService.signup(formData);
          set({ isLoading: false });
          return { success: true };
        } catch (err: any) {
          const message = err?.message ?? 'Signup failed. Please try again.';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      // ── logout ────────────────────────────────────────────────
      logout: async () => {
        try {
          await developerSupabase.auth.signOut();
        } catch (err) {
          console.error('[DeveloperAuthStore] Logout error:', err);
        } finally {
          get().reset();
          localStorage.removeItem('qafrica-developer-auth-store');
          sessionStorage.removeItem('dev_signup_email');
          sessionStorage.removeItem('dev_onboarding_step');
          sessionStorage.removeItem('dev_paystack_from');
        }
      },

      // ── fetchProfile ──────────────────────────────────────────
      // Queries the developers table directly — no edge function.
      fetchProfile: async () => {
        set({ isLoading: true });
        try {
          const { data: { session } } = await developerSupabase.auth.getSession();

          if (!session?.user) {
            set({ developer: null, isAuthenticated: false, isLoading: false });
            return;
          }

          const { data: dev, error: devError } = await developerSupabase
            .from('developers')
            .select(DEV_SELECT)
            .eq('auth_user_id', session.user.id)
            .maybeSingle();

          if (devError || !dev) {
            set({ developer: null, isAuthenticated: false, isLoading: false });
            return;
          }

          set({
            developer:       dev as unknown as Developer,
            isAuthenticated: true,
            isLoading:       false,
            error:           null,
          });
        } catch (err: any) {
          console.error('[DeveloperAuthStore] fetchProfile error:', err);
          set({ isLoading: false });
        }
      },

      // ── refreshSession ────────────────────────────────────────
      refreshSession: async () => {
        try {
          const { data, error } = await developerSupabase.auth.refreshSession();
          if (error || !data.session) {
            set({ developer: null, isAuthenticated: false });
          }
        } catch (err) {
          console.error('[DeveloperAuthStore] refreshSession error:', err);
        }
      },

      // ── onAuthStateChange ─────────────────────────────────────
      onAuthStateChange: () => {
        const { data: { subscription } } = developerSupabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
              set({ developer: null, isAuthenticated: false });
              return;
            }
            if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
              const { developer } = get();
              if (!developer) await get().fetchProfile();
            }
          },
        );
        return () => subscription.unsubscribe();
      },

      clearError: () => set({ error: null }),
      reset:      () => set(INITIAL),
    }),
    {
      name: 'qafrica-developer-auth-store',
      partialize: (state) => ({
        developer:       state.developer,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export default useDeveloperAuthStore;