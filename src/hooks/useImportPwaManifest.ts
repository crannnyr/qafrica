// src/hooks/useImportPwaManifest.ts
// Swaps in a PWA manifest scoped to the importation experience only, while
// the user is on an /importations, /recommendations, or import-admin page.
import { useEffect } from 'react';
import CONFIG from '@/lib/config';

const MANIFEST_HREF = '/manifest-import.json';
const SW_URL = '/import-sw.js';
const THEME_COLOR = '#f97316';
const APPLE_ICON_HREF = '/qafrica-bag-logo.svg';

let swRegistered = false;

export function useImportPwaManifest() {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const hadExistingManifest = !!link;
    const previousHref = link?.getAttribute('href') ?? null;

    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.setAttribute('href', MANIFEST_HREF);

    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute('content') ?? null;
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', THEME_COLOR);

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

    if (!swRegistered && 'serviceWorker' in navigator) {
      swRegistered = true;
      navigator.serviceWorker.register(SW_URL).then(() => {
        // Warm the exact public catalog endpoints used by the import pages.
        // The worker also extracts and caches the returned product images.
        navigator.serviceWorker.ready.then(registration => {
          registration.active?.postMessage({
            type: 'WARM_IMPORT_CACHE',
            urls: [
              `${CONFIG.SUPABASE_URL}/functions/v1/china-import-browse?action=browse-products&limit=50`,
              `${CONFIG.SUPABASE_URL}/functions/v1/china-import?action=products`,
            ],
          });
        });
      }).catch(() => {
        swRegistered = false;
      });
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage({
          type: 'WARM_IMPORT_CACHE',
          urls: [
            `${CONFIG.SUPABASE_URL}/functions/v1/china-import-browse?action=browse-products&limit=50`,
            `${CONFIG.SUPABASE_URL}/functions/v1/china-import?action=products`,
          ],
        });
      }).catch(() => {});
    }

    return () => {
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
