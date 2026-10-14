import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Star, PackageCheck, AlertCircle, ImagePlus, X } from 'lucide-react';
import CONFIG from '@/lib/config';

type Item = { product_id: string; product_name: string; image_url: string | null; variant_options: Record<string,string>; ordered_quantity: number; delivered_quantity: number; reviewed: boolean };
type OrderData = { order_code: string; items: Item[]; customer_name: string };
type ReviewImage = { name: string; type: string; data: string; preview: string };
const API = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-product-reviews`;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function readImage(file: File): Promise<ReviewImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      if (comma < 0) return reject(new Error(`Invalid image file: ${file.name}.`));
      resolve({ name: file.name, type: file.type, data: dataUrl.slice(comma + 1), preview: dataUrl });
    };
    reader.readAsDataURL(file);
  });
}

export default function ChinaImportProductReviewPage() {
  const { token = '' } = useParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const [data,setData] = useState<OrderData|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [selected,setSelected] = useState<Item|null>(null);
  const [rating,setRating] = useState(5);
  const [title,setTitle] = useState('');
  const [content,setContent] = useState('');
  const [images,setImages] = useState<ReviewImage[]>([]);
  const [saving,setSaving] = useState(false);
  const [success,setSuccess] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}?token=${encodeURIComponent(token)}`);
      const body = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(body.error || 'This review link is invalid or has expired.');
      setData(body);
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not load this order.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ void load(); },[token]);

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const incoming = Array.from(files);
    if (images.length + incoming.length > MAX_IMAGES) { setError(`You can attach up to ${MAX_IMAGES} images per review.`); return; }
    for (const file of incoming) {
      if (!ALLOWED_TYPES.includes(file.type)) { setError('Use JPG, PNG, or WEBP images only.'); return; }
      if (file.size > MAX_IMAGE_BYTES) { setError(`Each image must be 5 MB or smaller (${file.name}).`); return; }
    }
    try {
      const loaded = await Promise.all(incoming.map(readImage));
      setImages(prev => [...prev, ...loaded]);
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not read selected images.'); }
    if (fileInput.current) fileInput.current.value = '';
  };

  const resetForm = () => { setSelected(null); setRating(5); setTitle(''); setContent(''); setImages([]); };

  const submit = async () => {
    if (!selected || !content.trim()) { setError('Please add a few words about your experience.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,product_id:selected.product_id,rating,title,content,images:images.map(({name,type,data})=>({name,type,data}))})});
      const body = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error || 'Could not submit your review.');
      setSuccess('Thank you! Your product review has been submitted for moderation.');
      resetForm();
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not submit your review.'); }
    finally { setSaving(false); }
  };

  if(loading) return <main className="min-h-screen flex items-center justify-center text-gray-500"><Loader2 className="animate-spin mr-2"/> Loading your order…</main>;
  if(error && !data) return <main className="min-h-screen bg-gray-50 p-5 flex items-center justify-center"><section className="bg-white rounded-2xl p-7 max-w-md w-full text-center shadow-sm"><AlertCircle className="mx-auto text-orange-500 mb-3" size={36}/><h1 className="font-bold text-xl mb-2">Review link unavailable</h1><p className="text-sm text-gray-600">{error}</p></section></main>;

  return <main className="min-h-screen bg-gray-50 px-4 py-8">
    <div className="max-w-2xl mx-auto">
      <header className="mb-6"><p className="text-orange-600 font-extrabold tracking-wide">QAFRICA IMPORT</p><h1 className="text-2xl font-bold text-gray-900 mt-2">Review your products</h1><p className="text-sm text-gray-600 mt-2">Order <strong>{data?.order_code}</strong> · Hi {data?.customer_name || 'there'}, tell us how your products worked for you.</p></header>
      {success && <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-4 flex gap-2 text-green-800 text-sm"><CheckCircle2 size={20}/>{success}</div>}
      {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}
      <div className="space-y-3">
        {(data?.items ?? []).map(item=><article key={item.product_id} className="bg-white border border-gray-200 rounded-2xl p-4 flex gap-3 items-center">
          {item.image_url ? <img src={item.image_url} alt="" className="w-20 h-20 rounded-xl object-cover bg-gray-100"/> : <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center"><PackageCheck className="text-gray-400"/></div>}
          <div className="flex-1 min-w-0"><h2 className="font-semibold text-gray-900">{item.product_name}</h2>{Object.keys(item.variant_options ?? {}).length>0 && <p className="text-xs text-gray-500 mt-1">{Object.entries(item.variant_options).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>}<p className="text-xs text-gray-500 mt-1">Delivered: {item.delivered_quantity} of {item.ordered_quantity}</p>{item.reviewed ? <span className="inline-block mt-2 text-xs text-green-700 font-semibold">✓ Review submitted</span> : <button onClick={()=>{resetForm();setSelected(item);setError('');setSuccess('');}} className="mt-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2">Write a review</button>}</div>
        </article>)}
      </div>
      {data?.items.length===0 && <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-600">There are no eligible products to review for this order.</div>}
      {selected && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-end sm:items-center justify-center" onClick={()=>{if(!saving)resetForm();}}><section className="bg-white w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
        <h2 className="font-bold text-lg">Review {selected.product_name}</h2><p className="text-sm text-gray-500 mt-1">Your review will be checked before appearing publicly.</p>
        <div className="flex gap-2 my-5">{[1,2,3,4,5].map(n=><button aria-label={`${n} stars`} type="button" key={n} onClick={()=>setRating(n)}><Star size={30} className={n<=rating?'fill-amber-400 text-amber-400':'text-gray-300'}/></button>)}</div>
        <label className="block text-sm font-medium mb-1">Title (optional)</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} className="w-full border rounded-xl p-3 mb-4" placeholder="Summarize your experience"/>
        <label className="block text-sm font-medium mb-1">Your review</label><textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={3000} rows={5} className="w-full border rounded-xl p-3" placeholder="What did you like or dislike about this product?"/>
        <div className="mt-4"><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e=>void addImages(e.target.files)}/><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Photos (optional)</span><button type="button" disabled={saving||images.length>=MAX_IMAGES} onClick={()=>fileInput.current?.click()} className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"><ImagePlus size={16}/> Add images</button></div><p className="text-xs text-gray-500 mt-1">Up to {MAX_IMAGES} JPG, PNG, or WEBP images · 5 MB each.</p>
          {images.length>0 && <div className="grid grid-cols-4 gap-2 mt-3">{images.map((image,index)=><div key={image.name+index} className="relative"><img src={image.preview} alt={image.name} className="w-full aspect-square rounded-lg object-cover border"/><button type="button" aria-label="Remove image" disabled={saving} onClick={()=>setImages(prev=>prev.filter((_,i)=>i!==index))} className="absolute -top-2 -right-2 rounded-full bg-gray-900 text-white p-1"><X size={14}/></button></div>)}</div>}
        </div>
        <div className="flex gap-3 mt-5"><button disabled={saving} onClick={()=>resetForm()} className="flex-1 border rounded-xl p-3 font-semibold disabled:opacity-50">Cancel</button><button disabled={saving||!content.trim()} onClick={()=>void submit()} className="flex-1 rounded-xl p-3 bg-orange-500 text-white font-semibold disabled:opacity-50">{saving?'Submitting…':'Submit review'}</button></div>
      </section></div>}
    </div>
  </main>;
}
