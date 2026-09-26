// Product reviews (read-only). Only verified buyers can review, from their delivered order.
import { useCallback, useEffect, useState } from 'react';
import { Star, BadgeCheck, Camera, Store } from 'lucide-react';
import { supabase } from '@/services';

type Item = { id: string; name: string; rating: number; content: string; tags: string[]; images: string[] | null; verified: boolean; created_at: string; seller_reply: string | null };
type Data = { count: number; average: number | null; breakdown: Record<string, number>; with_photos: number; tags: { tag: string; count: number }[]; items: Item[] };

function Stars({ value, size = 'w-3.5 h-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= Math.round(value) ? 'fill-gray-900 text-gray-900' : 'text-gray-300'}`} aria-hidden />)}
    </span>
  );
}

export default function Reviews({ productId }: { productId: string; storeId?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<{ stars: number | null; photos: boolean }>({ stars: null, photos: false });
  const [more, setMore] = useState<Item[]>([]);
  const [done, setDone] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const fetchPage = useCallback((offset: number) =>
    supabase.rpc('product_reviews', { p_product_id: productId, p_stars: filter.stars, p_with_photos: filter.photos, p_limit: 10, p_offset: offset })
      .then(({ data: d }) => d as Data | null), [productId, filter]);

  useEffect(() => {
    let alive = true;
    fetchPage(0).then((d) => {
      if (!alive) return;
      setData(d);
      setMore([]);
      setDone((d?.items.length ?? 0) < 10);
    });
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  if (!data) return null;
  const items = [...data.items, ...more];
  const total = data.count;

  return (
    <section aria-labelledby="reviews-h" className="mt-10">
      <h2 id="reviews-h" className="text-[15px] font-bold">Reviews {total > 0 && <span className="text-gray-400 font-normal">({total})</span>}</h2>

      {total === 0 && !filter.stars && !filter.photos ? (
        <p className="mt-2 text-[13px] text-gray-500">No reviews yet. Only customers who received this item can review it, so every review here is from a real buyer.</p>
      ) : (
        <>
          <div className="mt-3 flex gap-5">
            <div className="text-center shrink-0">
              <p className="text-[32px] font-bold leading-none">{data.average ?? '–'}</p>
              <Stars value={data.average ?? 0} />
              <p className="mt-0.5 text-[11px] text-gray-500">{total} verified</p>
            </div>
            <ul className="flex-1 space-y-1" aria-label="Rating breakdown">
              {[5, 4, 3, 2, 1].map((s) => {
                const n = data.breakdown?.[String(s)] ?? 0;
                return (
                  <li key={s} className="flex items-center gap-2 text-[11px] text-gray-600">
                    <span className="w-3">{s}</span>
                    <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><span className="block h-full bg-gray-900" style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></span>
                    <span className="w-6 text-right">{n}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          {data.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.tags.map((t) => <span key={t.tag} className="px-2.5 py-1 rounded-full bg-gray-100 text-[11px] text-gray-700">{t.tag} ({t.count})</span>)}
            </div>
          )}
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="Filter reviews">
            {[{ k: 'all', l: 'All' }, { k: 'photos', l: `With photos (${data.with_photos})` }, ...[5, 4, 3, 2, 1].map((s) => ({ k: String(s), l: `${s}★` }))].map((f) => {
              const on = f.k === 'all' ? !filter.stars && !filter.photos : f.k === 'photos' ? filter.photos : filter.stars === Number(f.k);
              return (
                <button key={f.k} type="button" aria-pressed={on}
                  onClick={() => setFilter(f.k === 'all' ? { stars: null, photos: false } : f.k === 'photos' ? { stars: null, photos: true } : { stars: Number(f.k), photos: false })}
                  className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-semibold ${on ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700'}`}>{f.l}</button>
              );
            })}
          </div>

          <ul className="mt-2 divide-y divide-gray-100">
            {items.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="font-semibold">{r.name}</span>
                  {r.verified && <span className="inline-flex items-center gap-0.5 text-[#1A7F37]"><BadgeCheck className="w-3.5 h-3.5" aria-hidden />Verified purchase</span>}
                  <span className="ml-auto text-gray-400">{new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="mt-1"><Stars value={r.rating} /></div>
                {r.tags?.length > 0 && <p className="mt-1 text-[11px] text-gray-500">{r.tags.join(' · ')}</p>}
                {r.content && <p className="mt-1.5 text-[13px] text-gray-800 whitespace-pre-line">{r.content}</p>}
                {r.images && r.images.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {r.images.map((src) => (
                      <button key={src} type="button" onClick={() => setZoom(src)} className="w-20 h-20 rounded-md overflow-hidden bg-gray-100" aria-label="View photo">
                        <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {r.seller_reply && (
                  <div className="mt-2 rounded-md bg-gray-50 p-2.5 text-[12px] text-gray-700">
                    <p className="flex items-center gap-1 font-semibold text-gray-900"><Store className="w-3.5 h-3.5" aria-hidden />Seller reply</p>
                    <p className="mt-0.5">{r.seller_reply}</p>
                  </div>
                )}
              </li>
            ))}
            {items.length === 0 && <li className="py-6 text-center text-[12px] text-gray-500"><Camera className="w-5 h-5 mx-auto mb-1 text-gray-300" aria-hidden />No reviews match this filter.</li>}
          </ul>
          {!done && items.length > 0 && (
            <button type="button" onClick={() => fetchPage(items.length).then((d) => { setMore((m) => [...m, ...(d?.items ?? [])]); if ((d?.items.length ?? 0) < 10) setDone(true); })}
              className="mt-2 w-full h-10 rounded-lg border border-gray-300 text-[12px] font-semibold">Show more reviews</button>
          )}
        </>
      )}

      {zoom && (
        <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4" aria-label="Close photo">
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-lg" />
        </button>
      )}
    </section>
  );
}
