// src/pages/customer/StoreDiscovery/StoreGridControls.tsx

import { Filter } from 'lucide-react';
import type { SortBy } from './constants';

interface Props {
  totalCount: number;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
}

export default function StoreGridControls({
  totalCount,
  sortBy,
  onSortChange,
}: Props) {
  return (
    <div className="flex items-center justify-between mb-6">
      <p className="text-gray-600">
        {totalCount} store{totalCount !== 1 ? 's' : ''} found
      </p>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortBy)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="popular">Most Popular</option>
          <option value="rating">Highest Rated</option>
          <option value="newest">Newest</option>
        </select>
      </div>
    </div>
  );
}