import { LayoutGrid } from 'lucide-react';
import type { CategoryEntry } from '@/lib/storefrontCategories';

type Props = {
  categories: CategoryEntry[];
  selected: string;
  onSelect: (name: string) => void;
  primary: string;
  size?: 'md' | 'lg';
  allLabel?: string;
  labelClassName?: string;
};

export default function CategoryCircles({
  categories,
  selected,
  onSelect,
  primary,
  size = 'md',
  allLabel = 'All',
  labelClassName = '',
}: Props) {
  if (categories.length === 0) return null;
  const dim = size === 'lg' ? 'w-[76px] h-[76px]' : 'w-16 h-16';
  const items: CategoryEntry[] = [{ name: 'All', count: 0 }, ...categories];

  return (
    <nav aria-label="Shop by category" className="-mx-4 px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-4 overflow-x-auto pb-2 snap-x scrollbar-hide">
        {items.map((c) => {
          const active = selected === c.name;
          return (
            <li key={c.name} className="snap-start shrink-0">
              <button
                type="button"
                onClick={() => onSelect(c.name)}
                aria-pressed={active}
                className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
              >
                <span
                  className="rounded-full p-[2.5px] transition-[background] group-focus-visible:ring-2 group-focus-visible:ring-offset-2"
                  style={{
                    background: active ? primary : '#e5e7eb',
                    ['--tw-ring-color' as string]: primary,
                  }}
                >
                  <span className={`${dim} block rounded-full overflow-hidden bg-white p-[2px]`}>
                    {c.name === 'All' ? (
                      <span className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                        <LayoutGrid className="w-5 h-5 text-gray-600" aria-hidden />
                      </span>
                    ) : c.image ? (
                      <img
                        src={c.image}
                        alt=""
                        loading="lazy"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-lg font-semibold text-gray-500">
                        {c.name.charAt(0)}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={`max-w-[80px] truncate text-xs capitalize ${active ? 'font-semibold text-gray-900' : 'text-gray-600'} ${labelClassName}`}
                >
                  {c.name === 'All' ? allLabel : c.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
