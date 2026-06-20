// src/pages/customer/StoreDiscovery/StoreGrid.tsx

import { Store as StoreIcon } from 'lucide-react';
import StoreCard from './StoreCard';
import type { StoreDisplay } from './constants';

interface Props {
  stores: StoreDisplay[];
  isLoading: boolean;
}

export default function StoreGrid({ stores, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="text-center py-16">
        <StoreIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No stores found
        </h3>
        <p className="text-gray-500">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stores.map((store, index) => (
        <StoreCard
          key={store.id}
          store={store}
          index={index}
        />
      ))}
    </div>
  );
}