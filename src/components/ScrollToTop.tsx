// src/components/ScrollToTop.tsx
// Scroll behaviour for the whole app (mounted once in App.tsx):
//  - New page (link click, navigate()): start at the top.
//  - Back / forward: return to where the shopper was on that page. Pages that load
//    content async (e.g. the /stores feed) are retried until tall enough, up to ~4s.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const KEY = 'qafrica_scroll_v1';
const MAX_ENTRIES = 100;

function readAll(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function save(key: string, y: number) {
  try {
    const all = readAll();
    delete all[key];
    all[key] = y;
    const keys = Object.keys(all);
    keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).forEach((k) => delete all[k]);
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export default function ScrollToTop() {
  const location = useLocation();
  const navType = useNavigationType();
  const lastPath = useRef(location.pathname);

  // We manage scroll ourselves; the browser's own restore fights SPA rendering.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  // Remember the current entry's scroll position as the user scrolls. The key lives in a
  // ref that is switched before we scroll the new page, so the old entry is never overwritten.
  const keyRef = useRef(location.key);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => save(keyRef.current, window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    keyRef.current = location.key;
    const pathChanged = lastPath.current !== location.pathname;
    lastPath.current = location.pathname;
    if (navType !== 'POP') {
      // Query-string-only changes (tabs, filters) keep their position, as before.
      if (pathChanged) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    const target = readAll()[location.key];
    if (!target) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    // Content may still be loading: keep trying until the page can reach the target.
    let cancelled = false;
    const started = Date.now();
    const userScrolled = () => { cancelled = true; };
    window.addEventListener('wheel', userScrolled, { once: true, passive: true });
    window.addEventListener('touchmove', userScrolled, { once: true, passive: true });
    const tick = () => {
      if (cancelled) return;
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target - 2;
      window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior });
      if (!reachable && Date.now() - started < 4000) requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelled = true;
      window.removeEventListener('wheel', userScrolled);
      window.removeEventListener('touchmove', userScrolled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  return null;
}
