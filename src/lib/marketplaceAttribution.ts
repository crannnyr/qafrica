// Which cart items came from the QAFRICA marketplace (7% commission) vs the seller's own
// traffic (0%). Last touch wins, per store:
//   - opening a store/product from /stores (links carry ?src=mkt) records a marketplace touch
//   - opening a store/product any other way (seller's link, WhatsApp, short link) records an own touch
// A cart item is 'marketplace' if the latest touch for its store is a marketplace touch within 30 days.
// The server re-checks this at checkout; the browser value is a hint, not a price.

export type Attribution = 'own' | 'marketplace';

const KEY = 'qafrica_attribution_v1';
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const MKT_PARAM = 'src';
export const MKT_VALUE = 'mkt';

type Touches = Record<string, { src: Attribution; at: number }>;

function read(): Touches {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(t: Touches) {
  try {
    // Keep it small: drop anything older than the window
    const now = Date.now();
    const fresh = Object.fromEntries(Object.entries(t).filter(([, v]) => now - v.at < WINDOW_MS));
    localStorage.setItem(KEY, JSON.stringify(fresh));
  } catch {
    /* storage unavailable: attribution falls back to 'own' (never overcharges sellers) */
  }
}

/**
 * Record how the shopper reached a store. Call on store and product page load.
 * Marketplace links (?src=mkt) always record. An own-traffic touch is recorded only on the first
 * store page of a browsing session, so moving store -> product -> store doesn't erase a
 * marketplace touch; arriving fresh from a seller's own link (new session) does.
 */
export function recordStoreTouch(storeId: string, search: string = window.location.search) {
  if (!storeId) return;
  const fromMarketplace = new URLSearchParams(search).get(MKT_PARAM) === MKT_VALUE;
  const sessionKey = `qafrica_touched_${storeId}`;
  let seenThisSession = false;
  try {
    seenThisSession = sessionStorage.getItem(sessionKey) === '1';
    sessionStorage.setItem(sessionKey, '1');
  } catch {
    /* ignore */
  }
  if (!fromMarketplace && seenThisSession) return;
  const t = read();
  t[storeId] = { src: fromMarketplace ? 'marketplace' : 'own', at: Date.now() };
  write(t);
}

/** Record a marketplace touch directly (e.g. adding to cart from the /stores feed). */
export function recordMarketplaceTouch(storeId: string) {
  if (!storeId) return;
  const t = read();
  t[storeId] = { src: 'marketplace', at: Date.now() };
  write(t);
}

export function attributionFor(storeId: string): Attribution {
  const touch = read()[storeId];
  if (!touch || Date.now() - touch.at > WINDOW_MS) return 'own';
  return touch.src;
}

/** Link from the marketplace into a store page, tagged so the visit counts as marketplace. */
export const marketplaceLink = (path: string) => `${path}${path.includes('?') ? '&' : '?'}${MKT_PARAM}=${MKT_VALUE}`;
