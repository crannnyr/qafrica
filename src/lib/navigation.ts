// src/lib/navigation.ts
// One place that decides where "Back" goes, so every page behaves the same.
//
// Rules
//  1. A page opened from the marketplace (/stores) goes back to the marketplace,
//     at the exact spot the shopper left (same filters, same scroll position).
//  2. Anything else goes back to its natural parent (e.g. product -> its store).
//  3. Back never stacks history. If the target is already behind us in history we
//     jump back to it (history.go(-n)); otherwise we REPLACE the current entry, so
//     the next back press never lands on the page we just left.
//
// How: NavTracker (mounted once in App) records which path sits at each history
// index for this tab, in sessionStorage. useSmartBack() searches that record.

import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MKT_PARAM, MKT_VALUE } from '@/lib/marketplaceAttribution';

const STACK_KEY = 'qafrica_nav_stack_v1';
const MAX_ENTRIES = 200;

export const MARKETPLACE_HOME = '/stores';

/** Router state carried on links that start or continue a marketplace visit. */
export type NavState = { fromMarketplace?: boolean };
export const MARKETPLACE_STATE: NavState = { fromMarketplace: true };

type Stack = Record<number, string>;

function readStack(): Stack {
  try {
    const raw = sessionStorage.getItem(STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStack(stack: Stack) {
  try {
    const keys = Object.keys(stack).map(Number).sort((a, b) => a - b);
    const trimmed = keys.slice(-MAX_ENTRIES).reduce<Stack>((acc, k) => ({ ...acc, [k]: stack[k] }), {});
    sessionStorage.setItem(STACK_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage unavailable: useSmartBack falls back to replace-navigation */
  }
}

/** React Router keeps the history index in history.state.idx. */
export function currentHistoryIndex(): number {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' ? idx : 0;
}

/** Mount once inside the router. Records the path at each history index. */
export function NavTracker() {
  const location = useLocation();
  useEffect(() => {
    const idx = currentHistoryIndex();
    const stack = readStack();
    // A PUSH after going back discards the forward entries in the browser, so drop them here too.
    Object.keys(stack).map(Number).filter((k) => k > idx).forEach((k) => delete stack[k]);
    stack[idx] = location.pathname + location.search;
    writeStack(stack);
  }, [location.key, location.pathname, location.search]);
  return null;
}

/** True when this page is part of a visit that started on the marketplace. */
export function isFromMarketplace(location: { state: unknown; search: string }): boolean {
  if ((location.state as NavState | null)?.fromMarketplace) return true;
  return new URLSearchParams(location.search).get(MKT_PARAM) === MKT_VALUE;
}

const pathOnly = (p: string) => p.split('?')[0].replace(/\/+$/, '') || '/';

/**
 * Returns goBack(): navigates to `fallback`, or to the marketplace when this page was
 * reached from it. Reuses the existing history entry when possible (keeps scroll & filters).
 */
export function useSmartBack(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromMarketplace = isFromMarketplace(location);
  const target = fromMarketplace ? MARKETPLACE_HOME : fallback;

  const goBack = useCallback(() => {
    const idx = currentHistoryIndex();
    const stack = readStack();
    const wanted = pathOnly(target);
    for (let i = idx - 1; i >= 0; i--) {
      const entry = stack[i];
      if (entry && pathOnly(entry) === wanted) {
        navigate(i - idx); // e.g. -1 or -2: returns to that exact entry, filters and scroll intact
        return;
      }
    }
    navigate(target, { replace: true });
  }, [navigate, target]);

  return { goBack, fromMarketplace, target };
}
