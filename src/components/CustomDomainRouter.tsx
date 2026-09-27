/**
 * CustomDomainRouter
 * ------------------
 * Detects when the app is loaded on a custom domain (not qafrica.store / localhost).
 * If a matching store is found in the DB, it renders a stripped-down store-only
 * routing tree for that domain.
 * On the primary domain, it renders children unchanged.
 */
import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from '@/services';
import StorePage from '@/pages/store/StorePage';
import ProductDetailPage from '@/pages/store/ProductDetailPage';
import ShopCheckoutPage from '@/pages/shop/CheckoutPage';
import CheckoutCompletePage from '@/pages/shop/CheckoutCompletePage';
import CartPage from '@/pages/shop/CartPage';
import StoreNotFoundPage from '@/pages/store/StoreNotFoundPage';
import StoreClosedPage from '@/pages/store/StoreClosedPage';
import { PLATFORM_HOST, aliasTargetPath, storeSubdomainLabel } from '@/lib/storeSubdomain';

const PLATFORM_DOMAINS = [
  'qafrica.store', 'www.qafrica.store', 'localhost', '127.0.0.1', 'qqafr.bolt.host',
];

const isPlatformDomain = (hostname: string) => {
  if (PLATFORM_DOMAINS.includes(hostname)) return true;
  if (hostname.endsWith('.qafrica.store')) return true;
  if (hostname.endsWith('.bolt.host')) return true;
  if (hostname.endsWith('.netlify.app')) return true;
  if (hostname.endsWith('.vercel.app')) return true;
  if (hostname.endsWith('.pages.dev')) return true;
  if (hostname.endsWith('.web.app')) return true;
  if (hostname.endsWith('.firebaseapp.com')) return true;
  return false;
};

interface Props { children: React.ReactNode; }

export default function CustomDomainRouter({ children }: Props) {
  const aliasLabel = storeSubdomainLabel(window.location.hostname);
  if (aliasLabel) return <SubdomainAliasRedirect label={aliasLabel} />;
  return <CustomDomainRoutes>{children}</CustomDomainRoutes>;
}

function SubdomainAliasRedirect({ label }: { label: string }) {
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.rpc('store_slug_for_subdomain', { p_label: label }).then(({ data, error }) => {
      if (!alive) return;
      if (error || typeof data !== 'string' || !data) { setNotFound(true); return; }
      const { pathname, search, hash } = window.location;
      window.location.replace(`https://${PLATFORM_HOST}${aliasTargetPath(data, pathname, search, hash)}`);
    });
    return () => { alive = false; };
  }, [label]);
  if (notFound) return <StoreNotFoundPage />;
  return <div className="min-h-screen flex items-center justify-center" aria-busy="true" aria-label="Opening store"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
}

function CustomDomainRoutes({ children }: Props) {
  const hostname = window.location.hostname;
  const isCustomDomain = !isPlatformDomain(hostname);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found'>('loading');
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!isCustomDomain) { setStatus('found'); return; }
    supabase.from('stores').select('slug, is_active, is_blocked').eq('custom_domain', hostname).eq('domain_status', 'connected').single().then(({ data, error }) => {
      if (error || !data || !data.is_active || data.is_blocked) { setStatus('not_found'); return; }
      setStoreSlug(data.slug); setStatus('found');
    });
  }, [hostname, isCustomDomain]);

  if (!isCustomDomain) return <>{children}</>;
  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (status === 'not_found' || !storeSlug) return <StoreNotFoundPage />;

  return <CustomDomainSlugProvider slug={storeSlug}><Routes>
    <Route path="/" element={<StorePage />} />
    <Route path="/product/:productId" element={<ProductDetailPage />} />
    <Route path="/checkout" element={<ShopCheckoutPage />} />
    <Route path="/checkout/complete" element={<CheckoutCompletePage />} />
    <Route path="/cart" element={<CartPage />} />
    <Route path="/store-closed" element={<StoreClosedPage />} />
    <Route path="*" element={<StorePage />} />
  </Routes></CustomDomainSlugProvider>;
}

import { createContext, useContext } from 'react';
const CustomDomainSlugContext = createContext<string | null>(null);
export function CustomDomainSlugProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  return <CustomDomainSlugContext.Provider value={slug}>{children}</CustomDomainSlugContext.Provider>;
}
export function useCustomDomainSlug(): string | null { return useContext(CustomDomainSlugContext); }
