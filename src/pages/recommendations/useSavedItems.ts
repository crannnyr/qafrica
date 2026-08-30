// src/pages/recommendations/useSavedItems.ts
// Shared logic for saving/unsaving import products to a customer's
// wishlist (public.import_saved_items). Prompts login if the visitor
// isn't authenticated yet.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import { toast } from 'sonner';

export function useSavedItems() {
  const { customer, isAuthenticated } = useCustomerAuthStore();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !customer?.id) {
      setSavedIds(new Set());
      setIsLoaded(true);
      return;
    }
    let cancelled = false;
    supabase
      .from('import_saved_items')
      .select('product_id')
      .eq('customer_id', customer.id)
      .then(({ data }) => {
        if (cancelled) return;
        setSavedIds(new Set((data ?? []).map((r: any) => r.product_id)));
        setIsLoaded(true);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, customer?.id]);

  const isSaved = useCallback((productId: string) => savedIds.has(productId), [savedIds]);

  // Returns 'needs-auth' if the visitor should be prompted to sign in;
  // otherwise toggles the save and returns 'ok'.
  const toggleSave = useCallback(async (productId: string): Promise<'ok' | 'needs-auth'> => {
    if (!isAuthenticated || !customer?.id) return 'needs-auth';

    const currentlySaved = savedIds.has(productId);
    // Optimistic update
    setSavedIds(prev => {
      const next = new Set(prev);
      currentlySaved ? next.delete(productId) : next.add(productId);
      return next;
    });

    if (currentlySaved) {
      const { error } = await supabase
        .from('import_saved_items')
        .delete()
        .eq('customer_id', customer.id)
        .eq('product_id', productId);
      if (error) {
        setSavedIds(prev => new Set(prev).add(productId));
        toast.error('Could not remove from saved items');
      }
    } else {
      const { error } = await supabase
        .from('import_saved_items')
        .insert({ customer_id: customer.id, product_id: productId });
      if (error) {
        setSavedIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
        toast.error('Could not save item');
      } else {
        toast.success('Saved — find it in your dashboard');
      }
    }
    return 'ok';
  }, [isAuthenticated, customer?.id, savedIds]);

  return { isSaved, toggleSave, isLoaded };
}
