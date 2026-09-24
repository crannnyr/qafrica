import { Link } from 'react-router-dom';
import { BadgeCheck, Star } from 'lucide-react';
import { getLook, splitWordmark } from '@/lib/storefrontLooks';
import { StoreMark } from '@/components/storefront/StoreBrand';
import type { MarketplaceStore } from './useMarketplaceStores';

export default function MarketplaceStoreCard({ store }: { store: MarketplaceStore }) {
  const look = getLook(store.storefront_look);
  const primary = store.primary_color || '#F97316';
  const photos = (store.preview_images ?? []).slice(0, 4);
  const [dark, accent] = look?.id === 'clean' ? splitWordmark(store) : [store.name, ''];

  return (
    <Link
      to={`/${store.slug}`}
      className="group block rounded-2xl bg-white border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
    >
      {/* Real products first: that's what shoppers are deciding on */}
      <div className="grid grid-cols-4 gap-px bg-gray-100 aspect-[4/1.1]">
        {Array.from({ length: 4 }).map((_, i) =>
          photos[i] ? (
            <img key={i} src={photos[i]} alt="" loading="lazy" className="w-full h-full object-cover bg-white" />
          ) : (
            <div key={i} className="bg-gray-50" />
          ),
        )}
      </div>

      <div className="p-4 flex gap-3">
        <StoreMark store={store} primary={primary} className="w-12 h-12 rounded-xl text-lg shrink-0 -mt-9 ring-4 ring-white" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3
              className={`truncate text-gray-900 ${look?.id === 'social' ? 'text-2xl font-bold leading-none' : look?.id === 'boutique' ? 'text-xl font-semibold' : 'text-base font-bold tracking-tight'}`}
              style={look ? { fontFamily: look.fonts.display } : undefined}
            >
              {dark}
              {accent && <span style={{ color: primary }}>{accent}</span>}
            </h3>
            {store.is_verified && <BadgeCheck className="w-4 h-4 text-sky-600 shrink-0" aria-label="Verified store" />}
          </div>
          {store.description && <p className="mt-1 text-sm text-gray-600 line-clamp-2">{store.description}</p>}
          <p className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span>{store.product_count} products</span>
            {store.review_count > 0 && store.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden />
                <span className="font-semibold text-gray-700">{Number(store.rating).toFixed(1)}</span>
                <span>({store.review_count} review{store.review_count === 1 ? '' : 's'})</span>
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
