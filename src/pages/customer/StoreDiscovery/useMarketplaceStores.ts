import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services';
import type { StorefrontLook } from '@/types';

/** One row of the public.marketplace_stores() function. */
export type MarketplaceStore = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  niches: string[];
  is_verified: boolean;
  storefront_look: StorefrontLook | null;
  look_settings: Record<string, string>;
  product_count: number;
  preview_images: string[] | null;
  rating: number | null;
  review_count: number;
  created_at: string;
};

async function fetchMarketplaceStores(): Promise<MarketplaceStore[] | null> {
  const { data, error } = await supabase.rpc('marketplace_stores');
  if (error) {
    console.error('marketplace_stores failed:', error);
    return null;
  }
  return (data ?? []) as MarketplaceStore[];
}

export function useMarketplaceStores() {
  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const apply = useCallback((rows: MarketplaceStore[] | null) => {
    if (rows) {
      setStores(rows);
      setStatus('ready');
    } else {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetchMarketplaceStores().then((rows) => alive && apply(rows));
    return () => {
      alive = false;
    };
  }, [apply]);

  const reload = useCallback(() => {
    setStatus('loading');
    fetchMarketplaceStores().then(apply);
  }, [apply]);

  return { stores, status, reload };
}
