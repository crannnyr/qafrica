// src/pages/recommendations/PriceBandRow.tsx
// "Slide to view items under ₦X" promotional rows (spec Section 7).
// Self-contained: fetches its own small slice via the price_max filter,
// lightweight tap-to-detail cards (not full add-to-cart controls, to keep
// these rows visually distinct from the main grid).
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CONFIG from '@/lib/config';
import { fmt } from './RecommendationsPage';
import type { ImportProduct } from './RecommendationsPage';

const BROWSE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-browse`;

export const PRICE_BANDS = [
  { max: 3000, label: 'Check out these items under ₦3,000' },
  { max: 5000, label: 'Slide to view items under ₦5,000' },
  { max: 10000, label: 'Slide to view items under ₦10,000' },
];

export default function PriceBandRow({ bandIndex }: { bandIndex: number }) {
  const navigate = useNavigate();
  const band = PRICE_BANDS[bandIndex % PRICE_BANDS.length];
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${BROWSE_URL}?action=browse-products&price_max=${band.max}&limit=12&sort=new`)
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setIsLoading(false));
  }, [band.max]);

  if (!isLoading && products.length === 0) return null;

  return (
    <div className="mb-5 -mx-4 px-4">
      <h3 className="font-bold text-gray-800 text-sm mb-2.5">{band.label}</h3>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-28 snap-start">
                <div className="aspect-square rounded-xl bg-gray-100 animate-pulse mb-1.5" />
                <div className="h-2.5 bg-gray-100 rounded w-3/4 animate-pulse" />
              </div>
            ))
          : products.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/recommendations/${p.id}`, { state: { product: p } })}
                className="flex-shrink-0 w-28 text-left snap-start"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 mb-1.5">
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <p className="text-[11px] font-medium text-gray-700 line-clamp-2 leading-snug mb-0.5">{p.name}</p>
                <p className="text-[11px] font-bold text-orange-500">{fmt(p.price_ngn)}</p>
              </button>
            ))}
      </div>
    </div>
  );
}
