// /stores-v2/categories: category browser with real category -> subcategory hierarchy.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketplaceLayout from '@/pages/marketplace/MarketplaceLayout';
import { NICHE_CATEGORIES } from '@/lib/nicheCategories';
import { useUnifiedMarketplaceCategories } from './useUnifiedMarketplaceCategories';

type CategoryEntry = {
  key: string;
  nicheId: string;
  nicheName: string;
  id: string;
  name: string;
  subcategories: string[];
};

const categoryEntries: CategoryEntry[] = Object.values(NICHE_CATEGORIES).flatMap((niche) =>
  niche.categories.map((category) => ({
    key: `${niche.id}:${category.id}`,
    nicheId: niche.id,
    nicheName: niche.name,
    id: category.id,
    name: category.name,
    subcategories: category.subcategories,
  })),
);

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

export default function UnifiedMarketplaceCategories() {
  const cats = useUnifiedMarketplaceCategories();
  const [activeKey, setActiveKey] = useState<string>(categoryEntries[0]?.key ?? '');
  const active = categoryEntries.find((category) => category.key === activeKey) ?? categoryEntries[0];

  const imageByName = useMemo(() => {
    const images = new Map<string, string>();
    for (const category of cats?.categories ?? []) {
      if (category.image) images.set(normalize(category.name), category.image);
    }
    return images;
  }, [cats]);

  const categoryImage = (name: string) => imageByName.get(normalize(name)) ?? null;

  return (
    <MarketplaceLayout basePath="/stores-v2">
      <div className="flex h-[calc(100dvh-56px-64px-env(safe-area-inset-top))] min-h-0 overflow-hidden bg-white">
        <nav aria-label="Categories" className="w-[34%] max-w-[180px] shrink-0 h-full min-h-0 overflow-y-auto overscroll-contain bg-[#F6F6F6]">
          <ul className="h-fit">
            {categoryEntries.map((category) => {
              const on = activeKey === category.key;
              return (
                <li key={category.key}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(category.key)}
                    aria-current={on ? 'true' : undefined}
                    className={`relative w-full text-left px-3 py-4 text-[14px] leading-snug ${on ? 'bg-white font-bold text-gray-900' : 'text-gray-700'}`}
                  >
                    {on && <span className="absolute left-0 top-3 bottom-3 w-[3px] bg-gray-900" aria-hidden />}
                    {category.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="flex-1 min-w-0 h-full min-h-0 overflow-y-auto overscroll-contain px-3 py-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{active?.nicheName}</p>
              <h1 className="text-base font-bold">Subcategories</h1>
            </div>
            {active && (
              <Link
                to={`/stores-v2?niche=${encodeURIComponent(active.nicheId)}&category=${encodeURIComponent(active.name)}`}
                className="text-[13px] text-gray-600 underline underline-offset-2 shrink-0"
              >
                Shop all
              </Link>
            )}
          </div>

          {!cats ? (
            <ul className="grid grid-cols-3 gap-x-2 gap-y-4" aria-busy="true">
              {Array.from({ length: 9 }).map((_, i) => (
                <li key={i} className="flex flex-col items-center gap-2">
                  <span className="w-full aspect-square rounded-full bg-gray-200 animate-pulse" />
                  <span className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                </li>
              ))}
            </ul>
          ) : !active?.subcategories.length ? (
            <p className="text-sm text-gray-600">No subcategories configured yet.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-x-2 gap-y-4">
              {active.subcategories.map((subcategory) => {
                const image = categoryImage(subcategory) ?? categoryImage(active.name);
                return (
                  <li key={subcategory}>
                    <Link
                      to={`/stores-v2?niche=${encodeURIComponent(active.nicheId)}&category=${encodeURIComponent(subcategory)}`}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <span className="w-full aspect-square rounded-full bg-gray-100 overflow-hidden">
                        {image && <img src={image} alt="" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />}
                      </span>
                      <span className="text-[12px] leading-tight text-center text-gray-800 font-medium line-clamp-2">{subcategory}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </MarketplaceLayout>
  );
}
