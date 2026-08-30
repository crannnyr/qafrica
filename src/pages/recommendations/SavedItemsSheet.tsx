// src/pages/recommendations/SavedItemsSheet.tsx
// Lists items the customer has saved (heart icon) from the import catalog.
// Clicking any item routes to its product detail page.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, Heart, Loader, ChevronRight } from 'lucide-react';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import { fmt } from './RecommendationsPage';
import type { ImportProduct } from './RecommendationsPage';

export default function SavedItemsSheet({ onClose }: { onClose: () => void }) {
  const { customer } = useCustomerAuthStore();
  const navigate = useNavigate();
  const [items, setItems] = useState<ImportProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!customer?.id) { setIsLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: saved } = await supabase
        .from('import_saved_items')
        .select('product_id')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      const ids = (saved ?? []).map((r: any) => r.product_id);
      if (ids.length === 0) { if (!cancelled) { setItems([]); setIsLoading(false); } return; }

      const { data: products } = await supabase
        .from('china_import_products')
        .select('*')
        .in('id', ids);

      if (!cancelled) {
        // Preserve saved order (most recently saved first)
        const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
        setItems(ids.map(id => byId.get(id)).filter(Boolean) as ImportProduct[]);
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customer?.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Heart className="w-4 h-4 text-orange-500" fill="currentColor" />
            Saved Items
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Heart className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No saved items yet</p>
              <p className="text-xs text-gray-400 mt-1">Tap the heart icon on any item to save it here.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onClose(); navigate(`/recommendations/${p.id}`, { state: { product: p } }); }}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-lg object-cover bg-gray-50 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{p.name}</p>
                    <p className="text-xs font-bold text-orange-500 mt-0.5">{fmt(p.price_ngn)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
