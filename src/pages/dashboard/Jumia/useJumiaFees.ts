// src/pages/dashboard/Jumia/useJumiaFees.ts
// Fetches live fee rates from platform_settings on mount.
// Both JumiaAddItemPage and JumiaFeeBreakdown use this hook so rates
// are always current — if admin changes a rate, users see it immediately.

import { useState, useEffect } from 'react';
import { supabase } from '@/services';

export interface JumiaLogisticsFees {
  logistics_per_item: number;
  packaging_per_item: number;
  warehouse_per_item: number;
}

export interface JumiaCoreFees {
  submission_fee: number;
  platform_cut_percent: number;
  min_quantity: number;
  max_quantity: number;
}

const LOGISTICS_DEFAULTS: JumiaLogisticsFees = {
  logistics_per_item: 50,
  packaging_per_item: 50,
  warehouse_per_item: 0,
};

const CORE_DEFAULTS: JumiaCoreFees = {
  submission_fee: 1500,
  platform_cut_percent: 20,
  min_quantity: 20,
  max_quantity: 1000,
};

export function useJumiaFees() {
  const [logistics, setLogistics] = useState<JumiaLogisticsFees>(LOGISTICS_DEFAULTS);
  const [core, setCore] = useState<JumiaCoreFees>(CORE_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['jumia_fees', 'jumia_logistics_fees']);

      if (cancelled || error) { setIsLoading(false); return; }

      for (const row of data ?? []) {
        if (row.key === 'jumia_logistics_fees') setLogistics(row.value as JumiaLogisticsFees);
        if (row.key === 'jumia_fees') setCore(row.value as JumiaCoreFees);
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Total per-item logistics cost
  const logisticsPerItem = logistics.logistics_per_item + logistics.packaging_per_item + logistics.warehouse_per_item;

  // Total agent-pickup fee for a given quantity
  const agentFeeForQty = (qty: number) => qty * logisticsPerItem;

  return { logistics, core, logisticsPerItem, agentFeeForQty, isLoading };
}
