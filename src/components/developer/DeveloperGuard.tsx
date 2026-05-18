// src/components/developer/DeveloperGuard.tsx
// Wraps any page or component that requires an authenticated developer session.
// Handles three states:
//   1. Loading  — show spinner while session restores
//   2. Unauth   — redirect to /developer/login
//   3. Onboarding incomplete — redirect to /developer/onboarding
//
// Usage (in App.tsx or individual pages):
//   <DeveloperGuard>
//     <DeveloperApiKeysPage />
//   </DeveloperGuard>

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Zap } from 'lucide-react';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';

interface DeveloperGuardProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;  // default true — redirect incomplete accounts
}

export function DeveloperGuard({
  children,
  requireOnboarding = true,
}: DeveloperGuardProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { developer, isAuthenticated, isLoading } = useDeveloperAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('/developer/login', {
        replace: true,
        state:   { from: location.pathname },
      });
      return;
    }

    if (requireOnboarding && developer && !developer.onboarding_completed) {
      navigate('/developer/onboarding', { replace: true });
    }
  }, [isAuthenticated, isLoading, developer, requireOnboarding, navigate, location.pathname]);

  // Show a branded loading screen while session restores.
  // This prevents a flash of the login redirect on page reload.
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">QAFRICA Dev</span>
        </div>
        <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Not authenticated — return null while the useEffect redirect fires
  if (!isAuthenticated) return null;

  // Onboarding incomplete — return null while the useEffect redirect fires
  if (requireOnboarding && developer && !developer.onboarding_completed) return null;

  return <>{children}</>;
}

export default DeveloperGuard;