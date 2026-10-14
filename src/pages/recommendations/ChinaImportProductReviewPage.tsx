import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Star, PackageCheck, AlertCircle } from 'lucide-react';
import CONFIG from '@/lib/config';

type Item = { product_id: string; product_name: string; image_url: string | null; variant_options: Record<string,string>; ordered_quantity: number; delivered_quantity: number; reviewed: boolean };
type OrderData = { order_code: string; items: Item[]; customer_name: string };
const API = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-product-reviews`;

export default function ChinaImportProductReviewPage() {
  const { token = '' } = useParams();
  const [data,setData] = useState<OrderData|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [selected,setSelected] = useState<Item|null>(null);
  const [rating,setRating] = useState(5);
  const [title,setTitle] = useState('');
  const [content,setContent] = useState('');
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

  const submit = async () => {
    if (!selected || !content.trim()) { setError('Please add a few words about your experience.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,product_id:selected.product_id,rating,title,content})});
      const body = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error || 'Could not submit your review.');
      setSuccess('Thank you! Your product review has been submitted for moderation.');
      setSelected(null); setRating(5); setTitle(''); setContent('');
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
          <div className="flex-1 min-w-0"><h2 className="font-semibold text-gray-900">{item.product_name}</h2>{Object.keys(item.variant_options ?? {}).length>0 && <p className="text-xs text-gray-500 mt-1">{Object.entries(item.variant_options).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>}<p className="text-xs text-gray-500 mt-1">Delivered: {item.delivered_quantity} of {item.ordered_quantity}</p>{item.reviewed ? <span className="inline-block mt-2 text-xs text-green-700 font-semibold">✓ Review submitted</span> : <button onClick={()=>{setSelected(item);setError('');setSuccess('');}} className="mt-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2">Write a review</button>}</div>
        </article>)}
      </div>
      {data?.items.length===0 && <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-600">There are no eligible products to review for this order.</div>}
      {selected && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-end sm:items-center justify-center" onClick={()=>setSelected(null)}><section className="bg-white w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
        <h2 className="font-bold text-lg">Review {selected.product_name}</h2><p className="text-sm text-gray-500 mt-1">Your review will be checked before appearing publicly.</p>
        <div className="flex gap-2 my-5">{[1,2,3,4,5].map(n=><button aria-label={`${n} stars`} type="button" key={n} onClick={()=>setRating(n)}><Star size={30} className={n<=rating?'fill-amber-400 text-amber-400':'text-gray-300'}/></button>)}</div>
        <label className="block text-sm font-medium mb-1">Title (optional)</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} className="w-full border rounded-xl p-3 mb-4" placeholder="Summarize your experience"/>
        <label className="block text-sm font-medium mb-1">Your review</label><textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={3000} rows={5} className="w-full border rounded-xl p-3" placeholder="What did you like or dislike about this product?"/>
        <div className="flex gap-3 mt-4"><button onClick={()=>setSelected(null)} className="flex-1 border rounded-xl p-3 font-semibold">Cancel</button><button disabled={saving||!content.trim()} onClick={()=>void submit()} className="flex-1 rounded-xl p-3 bg-orange-500 text-white font-semibold disabled:opacity-50">{saving?'Submitting…':'Submit review'}</button></div>
      </section></div>}
    </div>
  </main>;
}
