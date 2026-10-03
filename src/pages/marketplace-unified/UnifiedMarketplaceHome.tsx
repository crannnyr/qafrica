import { useEffect, useRef } from 'react';
import { PackageSearch, RefreshCw } from 'lucide-react';
import MarketplaceLayout from '@/pages/marketplace/MarketplaceLayout';
import UnifiedProductCard from './UnifiedProductCard';
import UnifiedProductPage from './UnifiedProductPage';
import { useUnifiedMarketplaceMixed } from './useUnifiedMarketplaceMixed';
import type { UnifiedFeedTab } from './types';

const TABS: { id: UnifiedFeedTab; label: string }[] = [
  { id: 'for_you', label: 'For You' },
  { id: 'new', label: 'New In' },
  { id: 'deals', label: 'Deals' },
  { id: 'bestsellers', label: 'Bestsellers' },
];

export default function UnifiedMarketplaceHome() {
  const params = new URLSearchParams(window.location.search);
  const sourceType = params.get('source_type');
  const sourceId = params.get('source_id');
  if (sourceType && sourceId) return <UnifiedProductPage />;
  return <UnifiedMarketplaceFeedPage />;
}

function UnifiedMarketplaceFeedPage() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q') ?? '';
  const niche = params.get('niche');
  const category = params.get('category');
  const rawTab = params.get('tab') as UnifiedFeedTab | null;
  const tab = TABS.some((t) => t.id === rawTab) ? rawTab! : 'for_you';
  const feed = useUnifiedMarketplaceMixed({ tab, niche, category, search: query || null });
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && feed.loadMore(), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [feed.loadMore]);

  return (
    <MarketplaceLayout initialQuery={query} subheader={<div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 text-xs text-gray-500">Unified marketplace · Store products + China imports</div>}>
      <div className="px-3 sm:px-4 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Sort products">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            onClick={() => {
              const next = new URLSearchParams(window.location.search);
              if (t.id === 'for_you') next.delete('tab'); else next.set('tab', t.id);
              window.history.pushState({}, '', `${window.location.pathname}?${next.toString()}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className={`shrink-0 px-4 py-1.5 rounded-md text-[14px] font-semibold ${tab === t.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {query || niche || category ? <div className="px-3 sm:px-4 pb-3"><h1 className="text-lg font-bold">{query ? `Results for “${query}”` : category ?? niche}</h1></div> : null}
      {feed.status === 'error' && feed.items.length === 0 ? (
        <div className="text-center py-16 px-6"><p className="text-gray-700">Products couldn't load.</p><button type="button" onClick={feed.retry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-5 py-2 text-sm font-semibold"><RefreshCw className="w-4 h-4" /> Try again</button></div>
      ) : feed.status === 'done' && feed.items.length === 0 ? (
        <div className="text-center py-16 px-6"><PackageSearch className="w-12 h-12 text-gray-300 mx-auto" /><p className="mt-3 text-gray-700">Nothing matches that yet.</p></div>
      ) : (
        <>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2.5 px-1.5 sm:px-4">
            {feed.items.map((p, i) => <li key={p.id}><UnifiedProductCard p={p} priority={i < 4} /></li>)}
            {feed.status === 'loading' && Array.from({ length: feed.items.length ? 4 : 8 }).map((_, i) => <li key={`sk-${i}`}><div className="bg-white rounded-md overflow-hidden"><div className="aspect-[3/4] bg-gray-200 animate-pulse" /><div className="p-2 space-y-1.5"><div className="h-3 bg-gray-200 rounded animate-pulse" /><div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" /></div></div></li>)}
          </ul>
          <div ref={sentinel} aria-hidden className="h-1" />
          {feed.status === 'done' && feed.items.length > 0 && <p className="text-center text-xs text-gray-400 py-6">You've seen everything</p>}
        </>
      )}
    </MarketplaceLayout>
  );
}
