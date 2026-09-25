// "Rate your items" on a delivered order. One review per item; submitting again edits it.
import { useEffect, useState } from 'react';
import { Star, Camera, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';

const TAGS = ['True to size', 'Runs small', 'Runs large', 'Good quality', 'Looks like the photos', 'Fast delivery', 'Great value', 'Well packaged', 'Would buy again'];
type Item = { product_id: string; name: string; review: { rating: number; content: string; tags: string[] } | null };

export default function ReviewWriter({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.rpc('my_reviewable_items', { p_order_id: orderId }).then(({ data }) => alive && setItems((data as Item[]) ?? []));
    return () => {
      alive = false;
    };
  }, [orderId]);
  if (!items || items.length === 0) return null;
  return (
    <section className="bg-white px-4 py-4">
      <p className="text-[14px] font-semibold">Rate your items</p>
      <p className="text-[12px] text-gray-500">Your review helps other shoppers. It shows your first name and last initial only.</p>
      <ul className="mt-3 space-y-4">
        {items.map((it) => <li key={it.product_id}><OneReview orderId={orderId} item={it} /></li>)}
      </ul>
    </section>
  );
}

function OneReview({ orderId, item }: { orderId: string; item: Item }) {
  const { customer } = useCustomerAuthStore();
  const [rating, setRating] = useState(item.review?.rating ?? 0);
  const [tags, setTags] = useState<string[]>(item.review?.tags ?? []);
  const [text, setText] = useState(item.review?.content ?? '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(!!item.review);
  const [open, setOpen] = useState(!item.review);

  const upload = async (files: FileList | null) => {
    if (!files || !customer) return;
    for (const f of Array.from(files).slice(0, 3 - photos.length)) {
      if (f.size > 5 * 1024 * 1024) { toast.error('Photos must be under 5 MB'); continue; }
      const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${customer.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('review-images').upload(path, f, { contentType: f.type });
      if (error) { toast.error('Photo upload failed'); continue; }
      const { data } = supabase.storage.from('review-images').getPublicUrl(path);
      setPhotos((p) => [...p, data.publicUrl]);
    }
  };

  const submit = async () => {
    if (!rating) return toast.error('Tap the stars to rate');
    setBusy(true);
    const { error } = await supabase.rpc('submit_review', { p_order_id: orderId, p_product_id: item.product_id, p_rating: rating, p_content: text, p_tags: tags, p_images: photos });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Thanks for your review!');
    setSaved(true);
    setOpen(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium line-clamp-1">{item.name}</p>
        {saved && !open && <button type="button" onClick={() => setOpen(true)} className="text-[12px] underline shrink-0">Edit</button>}
      </div>
      {saved && !open ? (
        <p className="mt-1 flex items-center gap-1 text-[12px] text-[#1A7F37]"><Check className="w-3.5 h-3.5" aria-hidden />Reviewed · {rating}★</p>
      ) : (
        <>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" role="radio" aria-checked={rating === s} aria-label={`${s} star${s > 1 ? 's' : ''}`} onClick={() => setRating(s)} className="p-0.5">
                <Star className={`w-7 h-7 ${s <= rating ? 'fill-[#FFB400] text-[#FFB400]' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
                  className={`h-7 px-2.5 rounded-full text-[11px] ${on ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700'}`}>{t}</button>
              );
            })}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={3} placeholder="What did you like or not like?" aria-label="Your review"
            className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-300 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <div className="mt-2 flex items-center gap-2">
            {photos.map((p) => (
              <span key={p} className="relative w-14 h-14 rounded-md overflow-hidden bg-gray-100">
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhotos((x) => x.filter((y) => y !== p))} aria-label="Remove photo" className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {photos.length < 3 && (
              <label className="w-14 h-14 rounded-md border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 cursor-pointer">
                <Camera className="w-4 h-4" aria-hidden /><span className="text-[9px]">Add photo</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
              </label>
            )}
            <button type="button" onClick={submit} disabled={busy} className="ml-auto h-9 px-4 rounded-lg bg-gray-900 text-white text-[12px] font-semibold disabled:opacity-50">{busy ? 'Posting…' : 'Post review'}</button>
          </div>
        </>
      )}
    </div>
  );
}
