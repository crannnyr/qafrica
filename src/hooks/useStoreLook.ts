import { useEffect } from 'react';
import type { Store } from '@/types';
import { getLook, loadLookFonts, type LookDefinition } from '@/lib/storefrontLooks';

/** The look for a store (undefined for classic), with its fonts loaded. */
export function useStoreLook(store: Pick<Store, 'storefront_look'> | null | undefined): LookDefinition | undefined {
  const look = getLook(store?.storefront_look);
  useEffect(() => {
    if (look) loadLookFonts(look);
  }, [look]);
  return look;
}
