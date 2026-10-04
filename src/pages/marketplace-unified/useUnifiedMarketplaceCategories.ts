import { useEffect, useState } from 'react';
import { supabase } from '@/services';
import type { MarketCategory, MarketNiche } from '@/pages/marketplace/useMarketplace';

type Data = { niches: MarketNiche[]; categories: MarketCategory[] };

let cache: Data | null = null;

export function useUnifiedMarketplaceCategories() {
  const [data, setData] = useState<Data>(cache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    supabase.rpc('marketplace_v2_categories').then(({ data: d, error }) => {
      if (!alive || error || !d) return;
      cache = { niches: d.niches ?? [], categories: d.categories ?? [] };
      setData(cache);
    });
    return () => {
      alive = false;
    };
  }, []);

  return data;
}
