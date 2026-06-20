// src/pages/customer/StoreDiscovery/CategoryFilter.tsx

import { categories } from './constants';

interface Props {
  selectedCategory: string;
  onSelect: (id: string) => void;
}

export default function CategoryFilter({ selectedCategory, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {categories.map((cat) => {
        const Icon = cat.icon;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            <Icon className="w-4 h-4" />
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}