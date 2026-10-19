import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Loader2, Plus, RefreshCw, X, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';
import FlutterwavePayDialog from '@/components/payments/FlutterwavePayDialog';
import { checkAdCampaignPayment, startAdCampaignPayment } from '@/services/flutterwave';

type ProductOption = { id:string; name:string; category:string|null; images:string[] };
type CampaignRow = { id:string; campaign_name:string; campaign_type:string; budget:number; spent:number; clicks:number; status:string; approval_status:string; payment_status:string; created_at:string };

export default function AdsPage() {
  const { currentStore } = useStoreStore();
  const [type,setType] = useState<'placement'|'banner'>('placement');
  const [name,setName] = useState('');
  const [budget,setBudget] = useState('');
  const [productId,setProductId] = useState('');
  const [imageUrl,setImageUrl] = useState('');
  const [targetUrl,setTargetUrl] = useState('');
  const [category,setCategory] = useState('');
  const [placementCpc,setPlacementCpc] = useState<number|null>(null);
  const [bannerCpc,setBannerCpc] = useState<number|null>(null);
  const [products,setProducts] = useState<ProductOption[]>([]);
  const [campaigns,setCampaigns] = useState<CampaignRow[]>([]);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [createModalOpen,setCreateModalOpen] = useState(false);
  const [payingCampaign,setPayingCampaign] = useState<CampaignRow | null>(null);

  const load = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    const [productsResult,campaignResult,rateResult] = await Promise.all([
      supabase.from('products').select('id,name,category,images').eq('store_id',currentStore.id).eq('is_active',true).eq('marketplace_approval_status','approved').order('name'),
      supabase.from('ad_campaigns').select('id,campaign_name,campaign_type,budget,spent,clicks,status,approval_status,payment_status,created_at').eq('store_id',currentStore.id).order('created_at',{ascending:false}),
      supabase.from('placement_ad_settings').select('flat_cpc_ngn,banner_cpc_ngn').eq('id',true).maybeSingle(),
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
    if (type === 'placement' && products.length === 0) { toast.error('Add a product and get marketplace approval before creating a Placement Ad.'); return; }
    if (type === 'placement' && !productId) { toast.error('Choose a marketplace-approved product'); return; }
    if (type === 'banner' && (!currentStore?.logo_url || !currentStore?.banner_url)) { toast.error('Add both your store logo and banner in Settings → Images before continuing.'); return; }
    setSaving(true);
    const selectedProduct = products.find(p=>p.id===productId);
    const {error} = await supabase.from('ad_campaigns').insert({
      store_id:currentStore.id, product_id:type==='placement'?productId:null,
      platform:'qafrica', campaign_name:name.trim(), budget:parsedBudget, spent:0, clicks:0, impressions:0, conversions:0,
      status:'active', start_date:new Date().toISOString(), campaign_type:type,
      approval_status:'pending', category:type==='placement'?(category || selectedProduct?.category || null):null,
      image_url:type==='banner'?currentStore.banner_url:null, target_url:null,
    });
    if(error) toast.error('Campaign could not be submitted: '+error.message);
    else { toast.success('Campaign submitted for admin approval'); setName('');setBudget('');setProductId('');setImageUrl('');setTargetUrl('');setCategory('');setCreateModalOpen(false);await load(); }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header>
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><Megaphone className="h-5 w-5" /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ads Campaign</h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">Create and manage your Banner Ads and Placement Ads on the QAFRICA marketplace.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setCreateModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"><Plus className="h-4 w-4"/>Create Campaign</button>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/>Refresh</button>
      </div>

      {createModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setCreateModalOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="create-campaign-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="create-campaign-title" className="text-lg font-bold">Create a QAFRICA campaign</h2><p className="mt-1 text-sm text-gray-500">Every campaign requires admin approval before it appears on the marketplace.</p></div><button type="button" onClick={() => setCreateModalOpen(false)} disabled={saving} aria-label="Close campaign form" className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5"/></button></div>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">Ad format<select value={type} onChange={e=>setType(e.target.value as 'placement'|'banner')} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="placement">Placement Ad — product at top of results</option><option value="banner">Banner Ad — image in homepage banner area</option></select></label>
          <label className="block text-sm font-medium">Campaign name<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} required className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g. October product promotion"/></label>
          <label className="block text-sm font-medium">Campaign budget (₦)<input type="number" min="1" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)} required className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Maximum spend"/></label>
          {type==='placement' ? <>
            <label className="block text-sm font-medium">Marketplace-approved product<select value={productId} onChange={e=>{setProductId(e.target.value);const p=products.find(x=>x.id===e.target.value);setCategory(p?.category||'');}} required className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Choose approved product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="block text-sm font-medium">Category targeting (optional)<input value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Default: product category"/></label>
            <div className="md:col-span-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">{placementCpc !== null && placementCpc > 0 ? <>Current rate: <strong>₦{placementCpc.toLocaleString('en-NG',{maximumFractionDigits:2})} per eligible click.</strong> </> : 'The Placement Ads click rate has not been configured yet. '}Your campaign stops serving when its budget is exhausted.</div>
          </> : <>
            <div className="md:col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-start gap-3 border-b border-gray-100 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-800/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"><ImageIcon className="h-5 w-5"/></div>
                <div><h3 className="font-semibold text-gray-900 dark:text-white">Store banner</h3><p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">Your ad will feature the banner saved in your store settings and take shoppers directly to your storefront. You don’t need to provide a separate image or destination link.</p></div>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-700"><span className="text-sm text-gray-700 dark:text-gray-200">Store logo</span><span className={'inline-flex items-center gap-1.5 text-xs font-semibold '+(currentStore?.logo_url?'text-emerald-700 dark:text-emerald-400':'text-amber-700 dark:text-amber-400')}><span className={'h-2 w-2 rounded-full '+(currentStore?.logo_url?'bg-emerald-500':'bg-amber-500')}/>{currentStore?.logo_url?'Uploaded':'Required · Missing'}</span></div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-700"><span className="text-sm text-gray-700 dark:text-gray-200">Store banner</span><span className={'inline-flex items-center gap-1.5 text-xs font-semibold '+(currentStore?.banner_url?'text-emerald-700 dark:text-emerald-400':'text-amber-700 dark:text-amber-400')}><span className={'h-2 w-2 rounded-full '+(currentStore?.banner_url?'bg-emerald-500':'bg-amber-500')}/>{currentStore?.banner_url?'Uploaded':'Required · Missing'}</span></div>
                </div>
                {currentStore?.banner_url && <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Banner preview</p><img src={currentStore.banner_url} alt="Current store banner preview" className="max-h-44 w-full rounded-lg border border-gray-200 bg-gray-50 object-contain dark:border-gray-700 dark:bg-gray-800"/></div>}
                {(!currentStore?.logo_url || !currentStore?.banner_url) && <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30"><p className="text-sm leading-5 text-amber-900 dark:text-amber-200">Upload your store logo and banner to continue. Both are required for a Banner Ad.</p><Link to="/dashboard/settings?tab=images" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700">Open Image Settings <ExternalLink className="h-3.5 w-3.5"/></Link></div>}
              </div>
            </div><div className="md:col-span-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">{bannerCpc !== null && bannerCpc > 0 ? <>Current rate: <strong>₦{bannerCpc.toLocaleString('en-NG',{maximumFractionDigits:2})} per eligible click.</strong> </> : 'The Banner Ads click rate has not been configured yet. '}Your campaign stops serving when its budget is exhausted.</div>
          </>}
          <div className="md:col-span-2"><button type="submit" disabled={saving || !currentStore?.id || (type==='placement' && products.length===0) || (type==='banner' && (!currentStore?.logo_url || !currentStore?.banner_url))} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>}Submit for approval</button></div>
        </form>
        </section>
      </div>}

      <section className="space-y-4 bg-transparent">
        {loading?<p className="text-sm text-gray-500">Loading campaigns…</p>:campaigns.length===0?<p className="text-sm text-gray-500">You haven’t submitted any QAFRICA campaigns yet.</p>:<>
        <div className="space-y-3 md:hidden">{campaigns.map(c=><article key={c.id} className="rounded-xl border border-gray-200 bg-transparent p-4 shadow-sm dark:border-gray-700">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold text-gray-900">{c.campaign_name}</h3><p className="mt-1 text-xs capitalize text-gray-500">{c.campaign_type} ad</p></div><span className={'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold capitalize '+(c.approval_status==='approved'?'bg-emerald-100 text-emerald-700':c.approval_status==='rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-800')}>{c.approval_status}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-gray-100/70 p-3 dark:bg-gray-800/70"><p className="text-xs text-gray-500">Budget</p><p className="mt-1 font-bold">₦{Number(c.budget).toLocaleString('en-NG')}</p></div><div className="rounded-lg bg-gray-100/70 p-3 dark:bg-gray-800/70"><p className="text-xs text-gray-500">Spent</p><p className="mt-1 font-bold">₦{Number(c.spent).toLocaleString('en-NG')}</p></div><div className="rounded-lg bg-gray-100/70 p-3 dark:bg-gray-800/70"><p className="text-xs text-gray-500">Clicks</p><p className="mt-1 font-bold">{c.clicks}</p></div><div className="rounded-lg bg-gray-100/70 p-3 dark:bg-gray-800/70"><p className="text-xs text-gray-500">Payment</p><p className="mt-1 font-bold capitalize">{c.payment_status || 'unpaid'}</p></div></div>
          <div className="mt-4 border-t pt-3">{c.approval_status==='approved' && c.payment_status!=='paid' ? <button type="button" onClick={()=>setPayingCampaign(c)} className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white">Pay now · ₦{Number(c.budget).toLocaleString('en-NG')}</button> : c.approval_status==='pending' ? <p className="text-sm text-amber-700">Awaiting admin approval before payment.</p> : c.approval_status==='rejected' ? <p className="text-sm text-red-700">Rejected by admin. Contact support if you need clarification.</p> : c.payment_status==='paid' ? <p className="text-sm font-semibold text-emerald-700">Payment confirmed</p> : <p className="text-sm text-gray-500">No action required.</p>}</div>
        </article>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs uppercase text-gray-500"><tr><th className="p-3">Campaign</th><th className="p-3">Format</th><th className="p-3">Budget / spent</th><th className="p-3">Clicks</th><th className="p-3">Review</th><th className="p-3">Payment</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y">{campaigns.map(c=><tr key={c.id}><td className="p-3 font-semibold">{c.campaign_name}</td><td className="p-3 capitalize">{c.campaign_type}</td><td className="p-3 whitespace-nowrap">₦{Number(c.budget).toLocaleString('en-NG')} / ₦{Number(c.spent).toLocaleString('en-NG')}</td><td className="p-3">{c.clicks}</td><td className="p-3"><span className={'rounded-full px-2.5 py-1 text-xs font-bold capitalize '+(c.approval_status==='approved'?'bg-emerald-100 text-emerald-700':c.approval_status==='rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-800')}>{c.approval_status}</span></td><td className="p-3"><span className="capitalize">{c.payment_status || 'unpaid'}</span></td><td className="p-3">{c.approval_status==='approved' && c.payment_status!=='paid' ? <button type="button" onClick={()=>setPayingCampaign(c)} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white">Pay now</button> : c.approval_status==='pending' ? <span>Awaiting approval</span> : c.payment_status==='paid' ? <span>Paid</span> : <span>—</span>}</td></tr>)}</tbody></table></div>
        </>}
      </section>

      {payingCampaign && <FlutterwavePayDialog start={() => startAdCampaignPayment(payingCampaign.id)} check={checkAdCampaignPayment} itemNoun="campaign budget" planLabel={payingCampaign.campaign_name} paidMessage="Your campaign budget is paid. The campaign can now serve on the marketplace." onClose={() => setPayingCampaign(null)} onPaid={async () => { setPayingCampaign(null); await load(); toast.success('Campaign budget payment confirmed'); }} />}

    </div>
  );
}
