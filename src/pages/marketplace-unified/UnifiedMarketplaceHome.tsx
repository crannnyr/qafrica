import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PackageSearch, RefreshCw, ShieldCheck } from 'lucide-react';
import MarketplaceLayout from '@/pages/marketplace/MarketplaceLayout';
import { MARKETPLACE_STATE } from '@/lib/navigation';
import { marketplaceLink } from '@/lib/marketplaceAttribution';
import { nicheLabel, useMarketCategories } from '@/pages/marketplace/useMarketplace';
import { useMarketplaceStores } from '@/pages/customer/StoreDiscovery/useMarketplaceStores';
import UnifiedProductCard from './UnifiedProductCard';
import { useUnifiedMarketplaceMixed } from './useUnifiedMarketplaceMixed';
import type { UnifiedFeedTab } from './types';

const TABS: { id: UnifiedFeedTab; label: string }[] = [
  { id: 'for_you', label: 'For You' },
  { id: 'new', label: 'New In' },
  { id: 'deals', label: 'Deals' },
  { id: 'bestsellers', label: 'Bestsellers' },
];

export default function UnifiedMarketplaceHome() {
  return <UnifiedMarketplaceFeedPage />;
}

function UnifiedMarketplaceFeedPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const niche = params.get('niche');
  const category = params.get('category');
  const rawTab = params.get('tab') as UnifiedFeedTab | null;
  const tab = TABS.some((t) => t.id === rawTab) ? rawTab! : 'for_you';
  const browsing = !query && !niche && !category;
  const cats = useMarketCategories();
  const feed = useUnifiedMarketplaceMixed({ tab, niche, category, search: query || null });
  const setTab = (id: UnifiedFeedTab) => {
    const next = new URLSearchParams(params);
    if (id === 'for_you') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  };
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'niche') next.delete('category');
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  const nicheTabs = (
    <nav aria-label="Departments" className="max-w-6xl mx-auto">
      <ul className="flex gap-5 px-3 sm:px-4 overflow-x-auto scrollbar-hide text-[15px]">
        {[{ id: '', label: 'All' }, ...(cats?.niches ?? []).map((n) => ({ id: n.id, label: nicheLabel(n.id) }))].map((n) => {
          const active = (niche ?? '') === n.id && !query;
          return (
            <li key={n.id || 'all'} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams();
                  if (n.id) next.set('niche', n.id);
                  setParams(next);
                  window.scrollTo({ top: 0 });
                }}
                aria-current={active ? 'page' : undefined}
                className={`py-2.5 border-b-[3px] whitespace-nowrap ${active ? 'border-gray-900 font-bold text-gray-900' : 'border-transparent text-gray-500'}`}
              >
                {n.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <MarketplaceLayout
      initialQuery={query}
      basePath="/stores-v2"
      subheader={nicheTabs}
    >
      {browsing && <BannerCarousel />}

      {browsing && (
        <div className="mx-3 sm:mx-4 mt-3 rounded-lg bg-[#FFF6EE] border border-[#FFE3CC] px-3 py-2.5 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#E8590C] shrink-0 mt-0.5" aria-hidden />
          <p className="text-[13px] leading-snug text-gray-700">
            <span className="font-semibold text-gray-900">Buyer protection on every order.</span> Your payment is held safely and only released to the seller after delivery.
          </p>
        </div>
      )}

      {browsing && cats && cats.categories.length > 0 && (
        <section aria-label="Shop by category" className="mt-3 bg-white py-3">
          <div className="grid grid-rows-2 grid-flow-col auto-cols-[76px] gap-x-2 gap-y-3 overflow-x-auto scrollbar-hide px-3 sm:px-4">
            {cats.categories.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setParam('category', c.value)}
                className="flex flex-col items-center gap-1 focus-visible:outline-none group"
              >
                <span className="w-[66px] h-[66px] rounded-full bg-gray-100 overflow-hidden ring-offset-2 group-focus-visible:ring-2 ring-orange-500">
                  <img src={c.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                </span>
                <span className="text-[11.5px] leading-tight text-center text-gray-800 line-clamp-2">{c.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!browsing && (
        <div className="px-3 sm:px-4 pt-4 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold truncate">
            {query ? `Results for “${query}”` : category ? cats?.categories.find((c) => c.value === category)?.name ?? category : nicheLabel(niche!)}
          </h1>
          {category && (
            <button type="button" onClick={() => setParam('category', null)} className="text-sm text-gray-600 underline underline-offset-2 shrink-0">
              Clear
            </button>
          )}
        </div>
      )}

      <div className="px-3 sm:px-4 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Sort products">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-1.5 rounded-md text-[14px] font-semibold transition-colors ${tab === t.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <UnifiedFeed feed={feed} filtered={!browsing} onClear={() => setParams(new URLSearchParams())} />
    </MarketplaceLayout>
  );
}

function UnifiedFeed({
  feed,
  filtered,
  onClear,
}: {
  feed: ReturnType<typeof useUnifiedMarketplaceMixed>;
  filtered: boolean;
  onClear: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { items, status, loadMore, retry } = feed;

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  if (status === 'error' && items.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-gray-700">Products couldn't load. Check your connection and try again.</p>
        <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-5 py-2 text-sm font-semibold">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  if (status === 'done' && items.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <PackageSearch className="w-12 h-12 text-gray-300 mx-auto" aria-hidden />
        <p className="mt-3 text-gray-700">{filtered ? 'Nothing matches that yet.' : 'New products are on the way. Check back soon.'}</p>
        {filtered && (
          <button type="button" onClick={onClear} className="mt-3 text-sm font-semibold text-[#E8590C] underline underline-offset-4">
            See all products
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2.5 px-1.5 sm:px-4">
        {items.map((p, i) => (
          <li key={p.id}><UnifiedProductCard p={p} priority={i < 4} /></li>
        ))}
        {status === 'loading' && Array.from({ length: items.length ? 4 : 8 }).map((_, i) => (
          <li key={`sk-${i}`}>
            <div className="bg-white rounded-md overflow-hidden">
              <div className="aspect-[3/4] bg-gray-200 animate-pulse" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden className="h-1" />
      {status === 'error' && items.length > 0 && (
        <div className="text-center py-6">
          <button type="button" onClick={retry} className="text-sm font-semibold text-gray-700 underline">Couldn't load more. Tap to retry</button>
        </div>
      )}
      {status === 'done' && items.length > 0 && <p className="text-center text-xs text-gray-400 py-6">You've seen everything</p>}
    </>
  );
}

function BannerCarousel() {
  const { stores } = useMarketplaceStores();
  const slides = stores.filter((s) => s.banner_url).slice(0, 6);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => {
      const el = track.current;
      if (!el || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, 5000);
    return () => window.clearInterval(t);
  }, [slides.length, paused]);

  if (slides.length === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured stores"
      className="relative mt-2 mx-3 sm:mx-4"
      onPointerDown={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={track} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-xl">
        {slides.map((s, i) => (
          <Link
            key={s.id}
            to={marketplaceLink(`/${s.slug}`)}
            state={MARKETPLACE_STATE}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${s.name}`}
            className="relative shrink-0 w-full snap-start aspect-[2.2/1] sm:aspect-[3.4/1] bg-gray-200"
          >
            <img src={s.banner_url!} alt="" className="absolute inset-0 w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
            <span className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/20 to-transparent" />
            <span className="absolute left-4 bottom-4 right-1/3 text-white">
              <span className="block text-lg sm:text-2xl font-extrabold leading-tight line-clamp-2">{s.name}</span>
              <span className="mt-2 inline-block bg-white text-gray-900 text-xs font-bold px-3 py-1.5">SHOP NOW</span>
            </span>
          </Link>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1" aria-hidden>
          {slides.map((s, i) => (
            <span key={s.id} className="h-1 rounded-full transition-all" style={{ width: i === index ? 14 : 5, background: i === index ? '#fff' : 'rgba(255,255,255,.55)' }} />
          ))}
        </div>
      )}
    </section>
  );
}
