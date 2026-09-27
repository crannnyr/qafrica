// <store>.qafrica.store aliases. The subdomain forwards to qafrica.store/<slug>, so cart,
// sign-in and checkout stay on one domain (browsers keep carts separate per domain).

export const PLATFORM_HOST = 'qafrica.store';

// Subdomains that are never stores
const RESERVED = new Set(['www', 'api', 'admin', 'app', 'mail', 'email', 'cdn', 'static', 'staging', 'dev', 'status', 'help', 'support', 'blog', 'docs']);

/** Store label for "<label>.qafrica.store", else null. */
export function storeSubdomainLabel(hostname: string): string | null {
  const host = hostname.toLowerCase();
  const suffix = `.${PLATFORM_HOST}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  if (!label || label.includes('.') || RESERVED.has(label)) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return null;
  return label;
}

/** Path on qafrica.store for a path requested on the store's subdomain. */
export function aliasTargetPath(slug: string, pathname: string, search = '', hash = ''): string {
  const base = `/${slug}`;
  const product = pathname.match(/^\/product\/([^/]+)\/?$/);
  let path = base;
  if (product) path = `${base}/product/${product[1]}`;
  else if (/^\/checkout\/?$/.test(pathname)) path = `${base}/checkout`;
  return `${path}${search}${hash}`;
}

/** The short address to show and share for a store. */
export function storeSubdomainUrl(slug: string): string {
  return `https://${slug.replace(/^-+|-+$/g, '')}.${PLATFORM_HOST}`;
}
