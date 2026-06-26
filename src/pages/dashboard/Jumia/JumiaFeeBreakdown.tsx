// src/pages/dashboard/Jumia/JumiaFeeBreakdown.tsx
// Shows the live per-item fee breakdown for agent pickup.
// Warehouse fee of 0 shows as "Discounted" not "₦0".
// Info button explains what each fee covers.

import { useState } from 'react';
import { Info, X } from 'lucide-react';
import type { JumiaLogisticsFees } from './useJumiaFees';

interface Props {
  logistics: JumiaLogisticsFees;
  quantity: number;
  isLoading: boolean;
}

const INFO: Record<string, string> = {
  'Logistics': 'Covers transport of your items from your location to our Lagos facility, and then to the Jumia drop-off point for each sale.',
  'Packaging': 'Each item is properly packaged, labelled, and sealed before it goes to Jumia — this ensures it passes QC and arrives in good condition.',
  'Warehouse': 'Storage of your items at our Lagos facility while they await sales.',
};

function FeeRow({ label, ratePerItem, quantity, isDiscounted }: {
  label: string; ratePerItem: number; quantity: number; isDiscounted?: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const total = ratePerItem * quantity;

  return (
    <div className="relative">
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
          <button type="button" onClick={() => setShowInfo(!showInfo)}
            className="text-gray-400 hover:text-orange-500 transition-colors">
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-right">
          {isDiscounted ? (
            <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
              Discounted — Free
            </span>
          ) : (
            <div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                ₦{total.toLocaleString()}
              </span>
              <span className="text-xs text-gray-400 ml-1">(₦{ratePerItem}/item)</span>
            </div>
          )}
        </div>
      </div>
      {showInfo && (
        <div className="mb-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3 flex justify-between gap-2">
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{INFO[label]}</p>
          <button type="button" onClick={() => setShowInfo(false)} className="text-blue-400 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function JumiaFeeBreakdown({ logistics, quantity, isLoading }: Props) {
  if (isLoading) return <div className="h-24 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />;

  const total = (logistics.logistics_per_item + logistics.packaging_per_item + logistics.warehouse_per_item) * quantity;

  return (
    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Logistics & Packaging Fee</p>
      <p className="text-xs text-gray-400 mb-3">Based on {quantity} item{quantity !== 1 ? 's' : ''} × per-item rates</p>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <FeeRow label="Logistics" ratePerItem={logistics.logistics_per_item} quantity={quantity} />
        <FeeRow label="Packaging" ratePerItem={logistics.packaging_per_item} quantity={quantity} />
        <FeeRow label="Warehouse" ratePerItem={logistics.warehouse_per_item} quantity={quantity}
          isDiscounted={logistics.warehouse_per_item === 0} />
      </div>

      <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-200 dark:border-gray-700">
        <span className="font-bold text-gray-900 dark:text-white text-sm">Total logistics fee</span>
        <span className="font-bold text-orange-600 text-base">₦{total.toLocaleString()}</span>
      </div>
    </div>
  );
}
