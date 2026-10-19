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

    // Share an in-flight request across mounts (including React StrictMode's
    // development remount) so navigation doesn't duplicate the same RPC.
    if (!request) {
      request = supabase.rpc('marketplace_v2_categories').then(({ data: d, error }) => {
        if (error || !d) {
          request = null;
          return null;
        }
        cache = { niches: d.niches ?? [], categories: d.categories ?? [] };
        return cache;
      }).catch((error) => {
        request = null;
        console.error('marketplace_v2_categories failed', error);
        return null;
      });
    }

    void request.then((result) => {
      if (alive && result) setData(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  return data;
}
