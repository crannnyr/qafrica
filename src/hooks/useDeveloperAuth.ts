// src/hooks/useDeveloperAuth.ts
// Thin wrapper around developerAuthStore that handles:
//   1. Session initialization on mount
//   2. Supabase auth state change subscription
//   3. Derived helpers consumed by layout guards and page-level checks
//
// Usage:
//   const { developer, isAuthenticated, isLoading, requireAuth } = useDeveloperAuth();

import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import type { Developer } from '@/types/developer';

// ── Public interface ──────────────────────────────────────────
export interface UseDeveloperAuthReturn {
  // Raw state
  developer:       Developer | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  error:           string | null;

  // Derived booleans
  isEmailVerified:      boolean;
  isOnboardingComplete: boolean;
  isPaystackConnected:  boolean;
  isBlocked:            boolean;

  // Actions (re-exported for convenience)
  login:        (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout:       () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError:   () => void;

  // Guard — call from protected pages/components
  // Redirects to /developer/login if not authenticated.
  // Returns true if the caller should continue rendering, false if redirecting.
  requireAuth: () => boolean;
}

// ── Hook ──────────────────────────────────────────────────────
export function useDeveloperAuth(): UseDeveloperAuthReturn {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    developer,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    fetchProfile,
    onAuthStateChange,
    clearError,
  } = useDeveloperAuthStore();

  // ── Session initialisation on first mount ─────────────────────
  // fetchProfile is idempotent — it checks for a live Supabase session
  // before making any network calls, so running it on every mount is safe.
  useEffect(() => {
    fetchProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase auth state change subscription ───────────────────
  // Keeps the store in sync with TOKEN_REFRESHED, SIGNED_OUT, etc.
  // The store returns the unsubscribe function from onAuthStateChange.
  useEffect(() => {
    const unsubscribe = onAuthStateChange();
    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── requireAuth ───────────────────────────────────────────────
  const requireAuth = useCallback((): boolean => {
    if (isLoading) return false; // Still initialising — don't redirect yet

    if (!isAuthenticated) {
      navigate('/developer/login', {
        replace: true,
        state:   { from: location.pathname },
      });
      return false;
    }

    if (developer && !developer.onboarding_completed) {
      navigate('/developer/onboarding', { replace: true });
      return false;
    }

    return true;
  }, [isAuthenticated, isLoading, developer, navigate, location.pathname]);

  // ── Derived booleans ──────────────────────────────────────────
  const isEmailVerified      = developer?.email_verified      ?? false;
  const isOnboardingComplete = developer?.onboarding_completed ?? false;
  const isPaystackConnected  = developer?.paystack_connected   ?? false;
  const isBlocked            = developer?.is_blocked           ?? false;

  return {
    developer,
    isAuthenticated,
    isLoading,
    error,
    isEmailVerified,
    isOnboardingComplete,
    isPaystackConnected,
    isBlocked,
    login,
    logout,
    fetchProfile,
    clearError,
    requireAuth,
  };
}

export default useDeveloperAuth;