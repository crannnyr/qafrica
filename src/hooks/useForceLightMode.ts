import { useEffect } from 'react';

// The dark-mode toggle works by adding/removing a `dark` class on <html>,
// shared globally across the whole site via localStorage. That's correct
// for the seller dashboard, but a customer browsing a storefront should
// never see it flip to dark just because the store owner (or a previous
// visitor on a shared device) had dark mode on elsewhere on the site.
// Call this in any store-facing page to force light mode for as long as
// that page is mounted, restoring whatever state was present before.
export function useForceLightMode() {
  useEffect(() => {
    const root = window.document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      if (hadDark) root.classList.add('dark');
    };
  }, []);
}

export default useForceLightMode;
