// src/hooks/useImportPwaManifest.ts
// Swaps in a PWA manifest scoped to the importation experience only, while
// the user is on an /importations, /recommendations, or import-admin page.
// The main QAFRICA storefront stays a plain web app — this deliberately does
// NOT touch index.html globally, so "Add to Home Screen" / install prompts
// only make sense (and only point at the right start_url) while browsing
// the import side of the site.
import { useEffect } from 'react';

const MANIFEST_HREF = '/manifest-import.json';
const SW_URL = '/import-sw.js';
const THEME_COLOR = '#f97316';
const APPLE_ICON_HREF = 'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.3760297850944828.webp';

let swRegistered = false;

export function useImportPwaManifest() {
  useEffect(() => {
    // <link rel="manifest">
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const hadExistingManifest = !!link;
    const previousHref = link?.getAttribute('href') ?? null;

    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.setAttribute('href', MANIFEST_HREF);

    // theme-color meta (affects the browser chrome color for the installed app)
    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute('content') ?? null;
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', THEME_COLOR);

    // iOS Safari ignores the manifest's icons/display mode — needs its own tags.
    const appleCapable = document.createElement('meta');
    appleCapable.setAttribute('name', 'apple-mobile-web-app-capable');
    appleCapable.setAttribute('content', 'yes');
    document.head.appendChild(appleCapable);

    const appleTitle = document.createElement('meta');
    appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
    appleTitle.setAttribute('content', 'QAFRICA Import');
    document.head.appendChild(appleTitle);

    const appleIcon = document.createElement('link');
    appleIcon.setAttribute('rel', 'apple-touch-icon');
    appleIcon.setAttribute('href', APPLE_ICON_HREF);
    document.head.appendChild(appleIcon);

    // Register the import-scoped service worker once per session — needed
    // for Chrome/Android install-ability criteria.
    if (!swRegistered && 'serviceWorker' in navigator) {
      swRegistered = true;
      navigator.serviceWorker.register(SW_URL).catch(() => {
        // Installability just won't trigger — not fatal, app still works.
        swRegistered = false;
      });
    }

    return () => {
      // Restore whatever was there before (or remove what we added) so the
      // rest of the site — the store builder, marketplaces, etc. — isn't
      // left pointing at the import manifest after navigating away.
      if (link) {
        if (hadExistingManifest && previousHref) link.setAttribute('href', previousHref);
        else link.remove();
      }
      if (themeMeta) {
        if (previousTheme) themeMeta.setAttribute('content', previousTheme);
        else themeMeta.remove();
      }
      appleCapable.remove();
      appleTitle.remove();
      appleIcon.remove();
    };
  }, []);
}
