// src/hooks/useJumiaBasePath.ts
import { useLocation } from 'react-router-dom';

/**
 * Resolves the correct base path for all Jumia links/redirects depending on which
 * shell the current user is in:
 *  - Standalone Jumia-only sellers live under /jumia-dashboard/*
 *  - Regular store owners see Jumia nested under /dashboard/jumia/*
 *
 * Every Jumia page/component should build its internal links off this instead of
 * hardcoding '/dashboard/jumia', so the same components work correctly when mounted
 * under either route tree.
 */
export function useJumiaBasePath(): string {
  const location = useLocation();
  return location.pathname.startsWith('/jumia-dashboard')
    ? '/jumia-dashboard'
    : '/dashboard/jumia';
}

export default useJumiaBasePath;
