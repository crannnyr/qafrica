import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

type ProductOption = { id:string; name:string; category:string|null; images:string[] };
type CampaignRow = { id:string; campaign_name:string; campaign_type:string; budget:number; spent:number; clicks:number; status:string; approval_status:string; created_at:string };

export default function AdsPage() {
  const { currentStore } = useStoreStore();
  const [type,setType] = useState<'placement'|'banner'>('placement');
  const [name,setName] = useState('');
  const [budget,setBudget] = useState('');
  const [productId,setProductId] = useState('');
  const [imageUrl,setImageUrl] = useState('');
  const [targetUrl,setTargetUrl] = useState('');
  const [category,setCategory] = useState('');
  const [products,setProducts] = useState<ProductOption[]>([]);
  const [campaigns,setCampaigns] = useState<CampaignRow[]>([]);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [createModalOpen,setCreateModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    const [productsResult,campaignResult] = await Promise.all([
      supabase.from('products').select('id,name,category,images').eq('store_id',currentStore.id).eq('is_active',true).eq('marketplace_approval_status','approved').order('name'),
      supabase.from('ad_campaigns').select('id,campaign_name,campaign_type,budget,spent,clicks,status,approval_status,created_at').eq('store_id',currentStore.id).order('created_at',{ascending:false}),
    ]);
    if (productsResult.error) toast.error('Could not load eligible products: '+productsResult.error.message);
    else setProducts((productsResult.data ?? []) as ProductOption[]);
    if (campaignResult.error) toast.error('Could not load your campaigns: '+campaignResult.error.message);
    else setCampaigns((campaignResult.data ?? []) as CampaignRow[]);
    setLoading(false);
  },[currentStore?.id]);

  useEffect(()=>{void load();},[load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentStore?.id) { toast.error('Your store is not loaded yet'); return; }
    const parsedBudget = Number(budget);
    if (!name.trim() || !Number.isFinite(parsedBudget) || parsedBudget <= 0) { toast.error('Enter a campaign name and a budget greater than ₦0'); return; }
    if (type === 'placement' && !productId) { toast.error('Choose a marketplace-approved product'); return; }
    if (type === 'banner' && !/^https?:\/\//i.test(imageUrl.trim())) { toast.error('Enter a valid public banner image URL'); return; }
    setSaving(true);
    const selectedProduct = products.find(p=>p.id===productId);
    const {error} = await supabase.from('ad_campaigns').insert({
      store_id:currentStore.id, product_id:type==='placement'?productId:null,
      platform:'qafrica', campaign_name:name.trim(), budget:parsedBudget, spent:0, clicks:0, impressions:0, conversions:0,
      status:'active', start_date:new Date().toISOString(), campaign_type:type,
      approval_status:'pending', category:type==='placement'?(category || selectedProduct?.category || null):null,
      image_url:type==='banner'?imageUrl.trim():null, target_url:type==='banner'?(targetUrl.trim() || null):null,
    });
    if(error) toast.error('Campaign could not be submitted: '+error.message);
    else { toast.success('Campaign submitted for admin approval'); setName('');setBudget('');setProductId('');setImageUrl('');setTargetUrl('');setCategory('');setCreateModalOpen(false);await load(); }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header>
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><Megaphone className="h-5 w-5" /></div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ads Campaign</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">Create and manage your Banner Ads and Placement Ads on the QAFRICA marketplace.</p>
      </header>

      <div className="flex justify-end">
        <button type="button" onClick={() => setCreateModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"><Plus className="h-4 w-4"/>Create a QAFRICA campaign</button>
      </div>

      {createModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setCreateModalOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="create-campaign-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="create-campaign-title" className="text-lg font-bold">Create a QAFRICA campaign</h2><p className="mt-1 text-sm text-gray-500">Every campaign requires admin approval before it appears on the marketplace.</p></div><button type="button" onClick={() => setCreateModalOpen(false)} disabled={saving} aria-label="Close campaign form" className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5"/></button></div>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">Ad format<select value={type} onChange={e=>setType(e.target.value as 'placement'|'banner')} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="placement">Placement Ad — product at top of results</option><option value="banner">Banner Ad — image in homepage banner area</option></select></label>
          <label className="block text-sm font-medium">Campaign name<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} required className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g. October product promotion"/></label>
          <label className="block text-sm font-medium">Campaign budget (₦)<input type="number" min="1" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)} required className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Maximum spend"/></label>
          {type==='placement' ? <>
            <label className="block text-sm font-medium">Marketplace product<select value={productId} onChange={e=>{setProductId(e.target.value);const p=products.find(x=>x.id===e.target.value);setCategory(p?.category||'');}} required className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Choose approved product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="block text-sm font-medium">Category targeting (optional)<input value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Default: product category"/></label>
            <div className="md:col-span-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">The configured Placement Ads CPC rate is charged for eligible clicks. Your campaign stops serving when its budget is exhausted.</div>
          </> : <>
            <label className="block text-sm font-medium md:col-span-2">Public banner image URL<input type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} required className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://…"/></label>
            <label className="block text-sm font-medium md:col-span-2">Destination URL (optional)<input type="url" value={targetUrl} onChange={e=>setTargetUrl(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://your-store-or-product…"/></label>
            {imageUrl && <img src={imageUrl} alt="Banner preview" className="md:col-span-2 max-h-48 w-full rounded-lg bg-gray-100 object-contain"/>}<div className="md:col-span-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">The configured Banner Ads CPC rate is charged for eligible clicks on your approved banner. Your campaign stops serving when its budget is exhausted.</div>
          </>}
          <div className="md:col-span-2"><button type="submit" disabled={saving || !currentStore?.id} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>}Submit for approval</button></div>
        </form>
        </section>
      </div>}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Your campaigns</h2><button onClick={()=>void load()} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
        {loading?<p className="text-sm text-gray-500">Loading campaigns…</p>:campaigns.length===0?<p className="text-sm text-gray-500">You haven’t submitted any QAFRICA campaigns yet.</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-gray-500"><tr><th className="p-2">Campaign</th><th className="p-2">Format</th><th className="p-2">Budget / spent</th><th className="p-2">Clicks</th><th className="p-2">Review</th></tr></thead><tbody className="divide-y">{campaigns.map(c=><tr key={c.id}><td className="p-2 font-semibold">{c.campaign_name}</td><td className="p-2 capitalize">{c.campaign_type}</td><td className="p-2">₦{Number(c.budget).toLocaleString('en-NG')} / ₦{Number(c.spent).toLocaleString('en-NG')}</td><td className="p-2">{c.clicks}</td><td className="p-2"><span className={'rounded-full px-2 py-1 text-xs font-bold capitalize '+(c.approval_status==='approved'?'bg-emerald-100 text-emerald-700':c.approval_status==='rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-800')}>{c.approval_status}</span></td></tr>)}</tbody></table></div>}
      </section>


    </div>
  );
}
