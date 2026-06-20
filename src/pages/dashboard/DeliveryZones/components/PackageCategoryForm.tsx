import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SHIPBUBBLE_CATEGORIES } from '../constants';

export function PackageCategoryForm({ categoryId, setCategoryId, isSaving, currentCategoryId, onSave }: {
  categoryId: number;
  setCategoryId: (id: number) => void;
  isSaving: boolean;
  currentCategoryId: number;
  onSave: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Package Category</h2>
      <p className="text-xs text-gray-400 mb-4">
        Used by Shipbubble to match appropriate couriers and insurance.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {SHIPBUBBLE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoryId(cat.id)}
            className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
              categoryId === cat.id
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <Button
        onClick={onSave}
        disabled={isSaving || categoryId === currentCategoryId}
        className="bg-orange-500 hover:bg-orange-600 text-white px-5 h-9 text-xs">
        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Category'}
      </Button>
    </div>
  );
}