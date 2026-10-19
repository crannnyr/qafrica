// src/components/ScrollToTop.tsx
// Preserve scroll positions for the five shopper navigation destinations while
// keeping the normal scroll-to-top behaviour for detail and checkout routes.
import { useLayoutEffect, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const SHOPPER_PATHS = new Set([
  '/stores-v2',
  '/stores-v2/categories',
  '/help-pay',
  '/stores-v2/cart',
  '/cart',
  '/customer/dashboard',
]);

const STORAGE_KEY = 'qafrica-shopper-scroll-positions';

function readPositions(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, number> : {};
  } catch {
    return {};
  }
}

export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  const previousPath = useRef(pathname);

  // Capture the page being left before React commits the next route.
  useLayoutEffect(() => {
    return () => {
      const path = previousPath.current;
      if (!SHOPPER_PATHS.has(path)) return;
      const positions = readPositions();
      positions[path] = window.scrollY;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
      } catch {
        // Scroll restoration is an enhancement; storage can be unavailable.
      }
    };
  }, [pathname]);

  useEffect(() => {
    previousPath.current = pathname;
    if (SHOPPER_PATHS.has(pathname)) {
      const y = readPositions()[pathname] ?? 0;
      window.requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
      return;
    }

    // Keep existing detail-page behaviour, but don't reset scroll for changes
    // to query parameters on the same route.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, search]);

  return null;
}
