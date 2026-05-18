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
import { supabase } from '@/services/supabase';
import StorePage from '@/pages/store/StorePage';
import ProductDetailPage from '@/pages/store/ProductDetailPage';
import CheckoutPage from '@/pages/store/CheckoutPage';
import StoreNotFoundPage from '@/pages/store/StoreNotFoundPage';
import StoreClosedPage from '@/pages/store/StoreClosedPage';

// Domains that belong to the platform itself — never treated as custom store domains
const PLATFORM_DOMAINS = [
  'qafrica.store',
  'www.qafrica.store',
  'localhost',
  '127.0.0.1',
  'qqafr.bolt.host',
];

// Also treat preview hosting domains as platform domains
const isPlatformDomain = (hostname: string) => {
  if (PLATFORM_DOMAINS.includes(hostname)) return true;
  if (hostname.endsWith('.bolt.host')) return true;
  if (hostname.endsWith('.netlify.app')) return true;
  if (hostname.endsWith('.vercel.app')) return true;
  if (hostname.endsWith('.pages.dev')) return true; // Cloudflare Pages
  if (hostname.endsWith('.web.app')) return true; // Firebase
  if (hostname.endsWith('.firebaseapp.com')) return true;
  return false;
};

interface Props {
  children: React.ReactNode;
}

export default function CustomDomainRouter({ children }: Props) {
  const hostname = window.location.hostname;
  const isCustomDomain = !isPlatformDomain(hostname);

  const [status, setStatus] = useState<'loading' | 'found' | 'not_found'>(
    'loading'
  );
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!isCustomDomain) {
      setStatus('found'); // not needed but keeps state clean
      return;
    }

    // Look up which store owns this custom domain
    supabase
      .from('stores')
      .select('slug, is_active, is_blocked')
      .eq('custom_domain', hostname)
      .eq('domain_status', 'connected')
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setStatus('not_found');
          return;
        }
        if (!data.is_active || data.is_blocked) {
          setStatus('not_found');
          return;
        }
        setStoreSlug(data.slug);
        setStatus('found');
      });
  }, [hostname, isCustomDomain]);

  // On the primary domain — render the full app normally
  if (!isCustomDomain) {
    return <>{children}</>;
  }

  // While resolving the custom domain
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Custom domain not matched to any store
  if (status === 'not_found' || !storeSlug) {
    return <StoreNotFoundPage />;
  }

  // Custom domain matched — render store-only routes
  return (
    <CustomDomainSlugProvider slug={storeSlug}>
      <Routes>
        <Route path="/" element={<StorePage />} />
        <Route path="/product/:productId" element={<ProductDetailPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/store-closed" element={<StoreClosedPage />} />
        <Route path="*" element={<StorePage />} />
      </Routes>
    </CustomDomainSlugProvider>
  );
}

// ── Context so StorePage can read the slug even without a :slug URL param ─────
import { createContext, useContext } from 'react';

const CustomDomainSlugContext = createContext<string | null>(null);

export function CustomDomainSlugProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <CustomDomainSlugContext.Provider value={slug}>
      {children}
    </CustomDomainSlugContext.Provider>
  );
}

export function useCustomDomainSlug(): string | null {
  return useContext(CustomDomainSlugContext);
}
