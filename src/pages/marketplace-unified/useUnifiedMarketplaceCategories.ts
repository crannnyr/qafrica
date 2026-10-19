import { useEffect, useState } from 'react';
import { supabase } from '@/services';
import type { MarketCategory, MarketNiche } from '@/pages/marketplace/useMarketplace';

type Data = { niches: MarketNiche[]; categories: MarketCategory[] };

let cache: Data | null = null;
let request: Promise<Data | null> | null = null;

export function useUnifiedMarketplaceCategories() {
  const [data, setData] = useState<Data | null>(() => cache);

  useEffect(() => {
    let alive = true;
    if (cache) {
      setData(cache);
      return;
    }

    // Share the in-flight request across mounts and React StrictMode remounts.
    if (!request) {
      const pending: Promise<Data | null> = Promise.resolve(
        supabase.rpc('marketplace_v2_categories'),
      ).then(({ data: d, error }) => {
        if (error || !d) {
          request = null;
          return null;
        }
        cache = { niches: d.niches ?? [], categories: d.categories ?? [] };
        return cache;
      }).catch((error: unknown) => {
        request = null;
        console.error('marketplace_v2_categories failed', error);
        return null;
      });
      request = pending;
    }

    const pendingRequest = request;
    if (pendingRequest) {
      void pendingRequest.then((result) => {
        if (alive && result) setData(result);
      });
    }

    return () => {
      alive = false;
    };
  }, []);

  return data;
}
