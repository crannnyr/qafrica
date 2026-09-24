import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import type { Store } from '@/types';
import { getContrastColor, previewSearch, splitWordmark, type LookDefinition } from '@/lib/storefrontLooks';

export function StoreMark({ store, primary, className = '' }: { store: Store; primary: string; className?: string }) {
  return store.logo_url ? (
    <img src={store.logo_url} alt="" className={`object-cover ${className}`} />
  ) : (
    <span
      className={`flex items-center justify-center font-bold ${className}`}
      style={{ backgroundColor: primary, color: getContrastColor(primary) }}
      aria-hidden
    >
      {store.name.charAt(0)}
    </span>
  );
}

export function Wordmark({ store, primary }: { store: Store; primary: string }) {
  const [dark, accent] = splitWordmark(store);
  return (
    <span className="text-[22px] font-extrabold tracking-[-0.03em] leading-none whitespace-nowrap">
      <span className="text-gray-950">{dark}</span>
      <span style={{ color: primary }}>{accent}</span>
    </span>
  );
}

/** Store identity as each look shows it: wordmark, serif name, or logo + name. */
export function StoreBrand({ store, look, primary }: { store: Store; look: LookDefinition; primary: string }) {
  if (look.id === 'clean') return <Wordmark store={store} primary={primary} />;
  if (look.id === 'boutique')
    return (
      <span className="text-2xl font-semibold tracking-wide truncate" style={{ fontFamily: look.fonts.display }}>
        {store.name}
      </span>
    );
  return (
    <span className="flex items-center gap-2 min-w-0">
      <StoreMark store={store} primary={primary} className={`w-7 h-7 text-xs shrink-0 ${look.id === 'catalog' ? 'rounded-md' : 'rounded-full'}`} />
      <span
        className={look.id === 'social' ? 'text-2xl font-bold truncate' : 'text-sm font-bold tracking-tight truncate'}
        style={{ fontFamily: look.fonts.display }}
      >
        {store.name}
      </span>
    </span>
  );
}

/** Header for product pages under a new look: back, brand, cart. */
export function LookPageHeader(p: { store: Store; look: LookDefinition; primary: string; slug: string; cartCount: number }) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Link
          to={`/${p.slug}${previewSearch()}`}
          aria-label={`Back to ${p.store.name}`}
          className="-ml-2 p-2 rounded-full hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Link to={`/${p.slug}${previewSearch()}`} className="justify-self-center min-w-0 max-w-full">
          <StoreBrand store={p.store} look={p.look} primary={p.primary} />
        </Link>
        <Link
          to="/cart"
          aria-label={`Cart, ${p.cartCount} items`}
          className="relative -mr-2 p-2 rounded-full hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          <ShoppingBag className="w-5 h-5" strokeWidth={1.75} />
          {p.cartCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center"
              style={{ backgroundColor: p.primary, color: getContrastColor(p.primary) }}
            >
              {p.cartCount > 99 ? '99+' : p.cartCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
