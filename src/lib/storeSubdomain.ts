// Store subdomains on the primary .ng and legacy .store domains.
// Aliases forward to the primary domain so cart, sign-in and checkout share an origin.
export const PLATFORM_HOST = 'qafrica.ng';
const PLATFORM_HOSTS = ['qafrica.ng', 'qafrica.store'] as const;

// Subdomains that are never stores
const RESERVED = new Set(['www', 'api', 'admin', 'app', 'mail', 'email', 'cdn', 'static', 'staging', 'dev', 'status', 'help', 'support', 'blog', 'docs']);

/** Store label for "<label>.qafrica.store", else null. */
export function storeSubdomainLabel(hostname: string): string | null {
  const host = hostname.toLowerCase();
  const platformHost = PLATFORM_HOSTS.find(domain => host.endsWith(`.${domain}`));
  if (!platformHost) return null;
  const label = host.slice(0, -platformHost.length - 1);
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
