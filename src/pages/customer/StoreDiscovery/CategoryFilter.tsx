// src/pages/customer/StoreDiscovery/CategoryFilter.tsx

import { categories } from './constants';

interface Props {
  selectedCategory: string;
  onSelect: (id: string) => void;
}

export default function CategoryFilter({ selectedCategory, onSelect }: Props) {
  return (
    <div className="relative mb-8 -mx-4 sm:-mx-6 lg:-mx-8">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 scroll-smooth snap-x">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap snap-start transition-colors ${
                active
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}