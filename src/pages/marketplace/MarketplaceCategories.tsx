// /stores/categories: department list on the left, category shortcuts on the right (SHEIN-style).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import MarketplaceLayout from './MarketplaceLayout';
import { nicheLabel, useMarketCategories } from './useMarketplace';

export default function MarketplaceCategories() {
  const cats = useMarketCategories();
  const [active, setActive] = useState<string>(''); // '' = Just for You (all)

  const shown = (cats?.categories ?? []).filter((c) => !active || c.niches?.includes(active));
  const departments = [{ id: '', label: 'Just for You' }, ...(cats?.niches ?? []).map((n) => ({ id: n.id, label: nicheLabel(n.id) }))];

  return (
    <MarketplaceLayout>
      <div className="flex bg-white min-h-[calc(100vh-56px-64px)]">
        <nav aria-label="Departments" className="w-[34%] max-w-[180px] shrink-0 bg-[#F6F6F6]">
          <ul>
            {departments.map((d) => {
              const on = active === d.id;
              return (
                <li key={d.id || 'all'}>
                  <button
                    type="button"
                    onClick={() => setActive(d.id)}
                    aria-current={on ? 'true' : undefined}
                    className={`relative w-full text-left px-3 py-4 text-[14px] leading-snug ${on ? 'bg-white font-bold text-gray-900' : 'text-gray-700'}`}
                  >
                    {on && <span className="absolute left-0 top-3 bottom-3 w-[3px] bg-gray-900" aria-hidden />}
                    {d.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="flex-1 min-w-0 px-3 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold">{active ? nicheLabel(active) : 'Picks for You'}</h1>
            {active && (
              <Link to={`/stores?niche=${encodeURIComponent(active)}`} className="text-[13px] text-gray-600 underline underline-offset-2">
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
          ) : shown.length === 0 ? (
            <p className="text-sm text-gray-600">No categories here yet.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-x-2 gap-y-4">
              {shown.map((c) => (
                <li key={c.value}>
                  <Link to={`/stores?category=${encodeURIComponent(c.value)}`} className="flex flex-col items-center gap-1.5 group">
                    <span className="w-full aspect-square rounded-full bg-gray-100 overflow-hidden">
                      <img src={c.image} alt="" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    </span>
                    <span className="text-[12px] leading-tight text-center text-gray-800 font-medium line-clamp-2">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </MarketplaceLayout>
  );
}
