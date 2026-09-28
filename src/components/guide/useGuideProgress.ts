// Setup guide progress: which checklist items are done (read from real data), and the
// tour state saved on the owner's profile (profiles.onboarding_data.guide), so it follows
// them across devices.

import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/services';
import { useAuthStore, useStoreStore } from '@/stores';
import type { ChecklistKey } from './guideSteps';

export type GuideState = {
  tour_done_at?: string;      // finished the tour
  tour_skipped_at?: string;   // chose "skip anyway"
  seen?: string[];            // tour step ids already shown
  shared_link_at?: string;    // copied/shared the store link from the checklist
  checklist_hidden_at?: string;
};

export function useGuideProgress() {
  const { user, updateProfile } = useAuthStore();
  const { currentStore } = useStoreStore();
  const { pathname } = useLocation();
  const [counts, setCounts] = useState<{ products: number; zones: number } | null>(null);

  const saved = ((user?.onboarding_data as Record<string, unknown> | null | undefined)?.guide ?? {}) as GuideState;
  const [local, setLocal] = useState<GuideState>({});
  const guide: GuideState = { ...saved, ...local };

  // Re-count when the owner moves around, so ticks appear after they add a product etc.
  const storeId = currentStore?.id;
  useEffect(() => {
    if (!storeId) return;
    let alive = true;
    Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', storeId),
      supabase.from('delivery_zones').select('id', { count: 'exact', head: true }).eq('store_id', storeId),
    ]).then(([p, z]) => {
      if (alive) setCounts({ products: p.count ?? 0, zones: z.count ?? 0 });
    });
    return () => { alive = false; };
  }, [storeId, pathname]);

  const done: Record<ChecklistKey, boolean> = {
    email: !!user?.email_verified,
    images: !!(currentStore?.logo_url && currentStore?.banner_url),
    delivery: (counts?.zones ?? 0) > 0,
    product: (counts?.products ?? 0) > 0,
    share: !!guide.shared_link_at,
    marketplace: !!currentStore?.marketplace_enabled,
    domain: !!currentStore?.custom_domain && currentStore?.domain_status !== 'failed',
  };

  const saveGuide = useCallback(async (patch: GuideState) => {
    setLocal((l) => ({ ...l, ...patch }));
    const current = useAuthStore.getState().user;
    if (!current) return;
    const data = (current.onboarding_data ?? {}) as Record<string, unknown>;
    const prev = (data.guide ?? {}) as GuideState;
    await updateProfile({ onboarding_data: { ...data, guide: { ...prev, ...patch } } });
  }, [updateProfile]);

  return { guide, done, loaded: counts !== null, saveGuide, user, currentStore };
}
