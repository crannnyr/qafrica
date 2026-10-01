// src/hooks/useImportPwaManifest.ts
import { useEffect } from 'react';

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
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
    link.setAttribute('href', MANIFEST_HREF);

    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute('content') ?? null;
    if (!themeMeta) { themeMeta = document.createElement('meta'); themeMeta.name = 'theme-color'; document.head.appendChild(themeMeta); }
    themeMeta.setAttribute('content', THEME_COLOR);

    const appleCapable = document.createElement('meta'); appleCapable.setAttribute('name', 'apple-mobile-web-app-capable'); appleCapable.setAttribute('content', 'yes'); document.head.appendChild(appleCapable);
    const appleTitle = document.createElement('meta'); appleTitle.setAttribute('name', 'apple-mobile-web-app-title'); appleTitle.setAttribute('content', 'QAFRICA Import'); document.head.appendChild(appleTitle);
    const appleIcon = document.createElement('link'); appleIcon.setAttribute('rel', 'apple-touch-icon'); appleIcon.setAttribute('href', APPLE_ICON_HREF); document.head.appendChild(appleIcon);

    // Registration is fire-and-forget. The worker caches resources as the
    // page naturally requests them, so it never competes with startup.
    if (!swRegistered && 'serviceWorker' in navigator) {
      swRegistered = true;
      navigator.serviceWorker.register(SW_URL).catch(() => { swRegistered = false; });
    }

    return () => {
      if (link) { if (hadExistingManifest && previousHref) link.setAttribute('href', previousHref); else link.remove(); }
      if (themeMeta) { if (previousTheme) themeMeta.setAttribute('content', previousTheme); else themeMeta.remove(); }
      appleCapable.remove(); appleTitle.remove(); appleIcon.remove();
    };
  }, []);
}
