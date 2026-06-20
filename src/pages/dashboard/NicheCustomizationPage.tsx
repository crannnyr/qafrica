// src/pages/dashboard/NicheCustomizationPage.tsx

import { useState, useEffect } from 'react';
import { useAuthStore, useStoreStore } from '@/stores';
import { toast } from 'sonner';
import { supabase } from '@/services';
import {
  NICHE_CATEGORIES,
  getNicheDisplayList,
  SUBSCRIPTION_NICHE_LIMITS,
  normalizeTierId,
} from '@/lib/nicheCategories';
import { Loader2 } from 'lucide-react';

import NichePlanBanner from './NicheCustomization/NichePlanBanner';
import SelectedNicheGrid from './NicheCustomization/SelectedNicheGrid';
import AvailableNicheGrid from './NicheCustomization/AvailableNicheGrid';
import NicheInfoBox from './NicheCustomization/NicheInfoBox';
import NicheSaveBar from './NicheCustomization/NicheSaveBar';
import UpgradeModal from './NicheCustomization/UpgradeModal';

interface NicheStatus {
  id: string;
  name: string;
  canRemove: boolean;
  reason: string;
  productCount: number;
  hasSales: boolean;
}

export default function NicheCustomizationPage() {
  const { user }                        = useAuthStore();
  const { currentStore, fetchStore }    = useStoreStore();

  const [selectedNiches, setSelectedNiches]   = useState<string[]>([]);
  const [nicheStatuses, setNicheStatuses]     = useState<Record<string, NicheStatus>>({});
  const [isLoading, setIsLoading]             = useState(true);
  const [isSaving, setIsSaving]               = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');

  const normalizedTier  = normalizeTierId(subscriptionTier);
  const maxNiches       = SUBSCRIPTION_NICHE_LIMITS[normalizedTier] || 1;
  const remainingSlots  = maxNiches === Infinity
    ? 'Unlimited'
    : Math.max(0, maxNiches - selectedNiches.length);

  const hasChanges = JSON.stringify(selectedNiches.sort()) !==
    JSON.stringify((currentStore?.niches || []).sort());

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadNicheData();
  }, [currentStore?.id]);

  const loadNicheData = async () => {
    if (!currentStore?.id) return;
    setIsLoading(true);
    try {
      const currentNiches = currentStore.niches || [];
      setSelectedNiches(currentNiches);

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setSubscriptionTier(subData?.tier || 'free');

      const statuses: Record<string, NicheStatus> = {};

      for (const nicheId of currentNiches) {
        const { count: productCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', currentStore.id)
          .eq('niche', nicheId);

        const { data: salesData } = await supabase
          .from('orders')
          .select('id')
          .eq('store_id', currentStore.id)
          .limit(1);

        const hasSales   = (salesData?.length || 0) > 0;
        const canRemove  = !hasSales && (productCount || 0) === 0;

        statuses[nicheId] = {
          id:           nicheId,
          name:         NICHE_CATEGORIES[nicheId]?.name || nicheId,
          canRemove,
          reason:       hasSales
            ? 'Cannot remove: You have sales in this niche'
            : (productCount || 0) > 0
              ? `Cannot remove: You have ${productCount} product(s) in this niche`
              : 'Can be removed',
          productCount: productCount || 0,
          hasSales,
        };
      }

      setNicheStatuses(statuses);
    } catch (err) {
      console.error('Error loading niche data:', err);
    }
    setIsLoading(false);
  };

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const handleToggleNiche = (nicheId: string) => {
    if (selectedNiches.includes(nicheId)) {
      const status = nicheStatuses[nicheId];
      if (status && !status.canRemove) { toast.error(status.reason); return; }
      setSelectedNiches((prev) => prev.filter((id) => id !== nicheId));
    } else {
      if (maxNiches !== Infinity && selectedNiches.length >= maxNiches) {
        toast.error(`You can only have ${maxNiches} niche(s) on your current plan`);
        setShowUpgradeModal(true);
        return;
      }
      setSelectedNiches((prev) => [...prev, nicheId]);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!currentStore?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ niches: selectedNiches })
        .eq('id', currentStore.id);

      if (error) throw error;

      await fetchStore(currentStore.id);
      toast.success('Niches updated successfully');
      loadNicheData();
    } catch (err) {
      console.error('Error saving niches:', err);
      toast.error('Failed to update niches');
    }
    setIsSaving(false);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Niche Customization
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Select the niches for your store based on your subscription plan
        </p>
      </div>

      <NichePlanBanner
        normalizedTier={normalizedTier}
        maxNiches={maxNiches}
        selectedCount={selectedNiches.length}
        remainingSlots={remainingSlots}
      />

      <SelectedNicheGrid
        selectedNiches={selectedNiches}
        nicheStatuses={nicheStatuses}
        onToggle={handleToggleNiche}
      />

      <AvailableNicheGrid
        selectedNiches={selectedNiches}
        maxNiches={maxNiches}
        onToggle={handleToggleNiche}
        onUpgrade={() => setShowUpgradeModal(true)}
      />

      <NicheInfoBox />

      {hasChanges && (
        <NicheSaveBar
          isSaving={isSaving}
          onSave={handleSave}
          onDiscard={() => setSelectedNiches(currentStore?.niches || [])}
        />
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}