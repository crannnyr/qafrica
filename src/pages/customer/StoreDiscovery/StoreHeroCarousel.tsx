import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BadgeCheck } from 'lucide-react';
import { getLook } from '@/lib/storefrontLooks';
import { StoreBrand, StoreMark } from '@/components/storefront/StoreBrand';
import type { MarketplaceStore } from './useMarketplaceStores';

const AUTO_MS = 6000;

/**
 * Full-width, swipeable store banners. Native scroll-snap does the swiping; buttons and
 * auto-advance just scroll the track. Auto-advance pauses on hover, focus, touch, hidden
 * tabs and for people who prefer reduced motion.
 */
export default function StoreHeroCarousel({ stores }: { stores: MarketplaceStore[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = stores.length;

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const next = (i + count) % count;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  }, [count]);

  // Keep the dots in sync with manual swipes
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => {
      if (!document.hidden) goTo(index + 1);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [count, paused, index, goTo]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured stores"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div
        ref={track}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {stores.map((s, i) => (
          <Slide key={s.id} store={s} position={i + 1} total={count} />
        ))}
      </div>

      {count > 1 && (
        <>
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
            {stores.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show ${s.name}`}
                aria-current={i === index ? 'true' : undefined}
                className="h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{ width: i === index ? 22 : 6, background: i === index ? '#fff' : 'rgba(255,255,255,.55)' }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous store"
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 items-center justify-center shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next store"
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 items-center justify-center shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </section>
  );
}

function Slide({ store, position, total }: { store: MarketplaceStore; position: number; total: number }) {
  const look = getLook(store.storefront_look);
  const primary = store.primary_color || '#F97316';
  const blurb = store.look_settings?.tagline || store.look_settings?.bio || store.description;
  const thumbs = (store.preview_images ?? []).slice(0, 3);

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} of ${total}: ${store.name}`}
      className="relative shrink-0 w-full snap-start h-[440px] sm:h-[420px] lg:h-[480px] overflow-hidden bg-gray-900"
    >
      {store.banner_url && (
        <img
          src={store.banner_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading={position === 1 ? 'eager' : 'lazy'}
          fetchPriority={position === 1 ? 'high' : 'auto'}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/5" />

      <div className="relative h-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex flex-col justify-end">
        {/* Store identity in its own look */}
        <div className="inline-flex self-start items-center gap-2 rounded-full bg-white/95 pl-1.5 pr-4 py-1.5 text-gray-900 max-w-full">
          {look ? (
            <StoreBrand store={store} look={look} primary={primary} />
          ) : (
            <span className="flex items-center gap-2 min-w-0">
              <StoreMark store={store} primary={primary} className="w-7 h-7 rounded-full text-xs shrink-0" />
              <span className="text-sm font-bold truncate">{store.name}</span>
            </span>
          )}
          {store.is_verified && <BadgeCheck className="w-4 h-4 text-sky-600 shrink-0" aria-label="Verified store" />}
        </div>

        {blurb && (
          <p
            className="mt-4 text-white text-2xl sm:text-4xl font-semibold leading-tight max-w-2xl line-clamp-3"
            style={look ? { fontFamily: look.fonts.display } : undefined}
          >
            {blurb}
          </p>
        )}

        <div className="mt-5 flex items-center gap-4">
          <Link
            to={`/${store.slug}`}
            className="inline-flex items-center rounded-full bg-white text-gray-900 px-5 py-2.5 text-sm font-semibold hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white"
          >
            Visit store
          </Link>
          {thumbs.length > 0 && (
            <div className="flex -space-x-2" aria-hidden>
              {thumbs.map((src) => (
                <img key={src} src={src} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover ring-2 ring-black/40 bg-white" />
              ))}
            </div>
          )}
          <span className="text-white/80 text-sm">{store.product_count} products</span>
        </div>
      </div>
    </div>
  );
}
