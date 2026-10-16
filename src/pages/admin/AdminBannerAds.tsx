import { useCallback, useEffect, useState } from 'react';
import { Check, X, RefreshCw, Megaphone, Image as ImageIcon, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type BannerSubmission = { id: string; name: string; slug: string; banner_url: string | null; pending_banner_url: string | null; banner_submitted_at: string | null; banner_rejection_reason: string | null };
type Campaign = { id: string; campaign_name: string; campaign_type: 'banner' | 'placement'; store_id: string; product_id: string | null; image_url: string | null; target_url: string | null; budget: number; spent: number; clicks: number; status: string; approval_status: string; payment_status: string; start_date: string; end_date: string | null };
const money = (value: number) => '₦' + Number(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });

export default function AdminBannerAds() {
  const [banners, setBanners] = useState<BannerSubmission[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cpc, setCpc] = useState('');
  const [bannerCpc, setBannerCpc] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [rateDialog, setRateDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [bannerResult, campaignResult, rateResult] = await Promise.all([
      supabase.from('stores').select('id,name,slug,banner_url,pending_banner_url,banner_submitted_at,banner_rejection_reason').not('pending_banner_url', 'is', null).order('banner_submitted_at', { ascending: true }),
      supabase.from('ad_campaigns').select('id,campaign_name,campaign_type,store_id,product_id,image_url,target_url,budget,spent,clicks,status,approval_status,payment_status,start_date,end_date').order('created_at', { ascending: false }),
      supabase.from('placement_ad_settings').select('flat_cpc_ngn,banner_cpc_ngn').eq('id', true).maybeSingle(),
    ]);
    if (bannerResult.error) toast.error('Could not load pending banners: ' + bannerResult.error.message);
    else setBanners((bannerResult.data ?? []) as BannerSubmission[]);
    if (campaignResult.error) toast.error('Could not load ad campaigns: ' + campaignResult.error.message);
    else setCampaigns((campaignResult.data ?? []) as Campaign[]);
    if (rateResult.error) toast.error('Could not load Placement Ads CPC rate: ' + rateResult.error.message);
    else {
      setCpc(rateResult.data?.flat_cpc_ngn == null ? '' : String(rateResult.data.flat_cpc_ngn));
      setBannerCpc(rateResult.data?.banner_cpc_ngn == null ? '' : String(rateResult.data.banner_cpc_ngn));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reviewBanner = async (storeId: string, decision: 'approved' | 'rejected') => {
    setBusy(storeId);
    const { error } = await supabase.rpc('admin_review_store_banner', { p_store_id: storeId, p_decision: decision, p_rejection_reason: null });
    if (error) toast.error(error.message);
    else { toast.success(decision === 'approved' ? 'Banner approved and published' : 'Banner rejected'); await load(); }
    setBusy(null);
  };

  const reviewCampaign = async (campaign: Campaign, decision: 'approved' | 'rejected') => {
    setBusy(campaign.id);
    const { error } = await supabase.rpc('admin_review_ad_campaign', { p_campaign_id: campaign.id, p_decision: decision });
    if (error) toast.error(error.message);
    else { toast.success('Campaign ' + decision); await load(); }
    setBusy(null);
  };

  const saveRates = async () => {
    const placementRate = Number(cpc);
    const bannerRate = Number(bannerCpc);
    if (!cpc.trim() || !Number.isFinite(placementRate) || placementRate <= 0) {
      toast.error('Enter a Placement Ads CPC greater than ₦0');
      return;
    }
    if (!bannerCpc.trim() || !Number.isFinite(bannerRate) || bannerRate <= 0) {
      toast.error('Enter a Banner Ads CPC greater than ₦0');
      return;
    }
    setSavingRate(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from('placement_ad_settings').upsert({
      id: true,
      flat_cpc_ngn: placementRate,
      banner_cpc_ngn: bannerRate,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }, { onConflict: 'id' });
    if (error) toast.error('Could not save CPC rates: ' + error.message);
    else {
      toast.success('Placement Ads and Banner Ads CPC rates saved');
      setRateDialog(false);
      await load();
    }
    setSavingRate(false);
  };

  return <div className="mx-auto max-w-6xl space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-gray-900">Banners & Advertising</h1><p className="mt-1 text-sm text-gray-500">Review store banners and ad campaigns. Configure separate CPC rates for Placement Ads and Banner Ads.</p></div>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4"/>Refresh</button>
    </header>

    <section className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">CPC pricing</h2>
          <p className="mt-1 text-sm text-gray-500">Set the cost per click for placement and homepage banner ads in one place.</p>
          <p className="mt-3 text-sm font-medium">Placement Ads: <span className="font-bold">{cpc ? money(Number(cpc)) + ' / click' : 'Not configured'}</span><span className="mx-2 text-gray-300">|</span>Banner Ads: <span className="font-bold">{bannerCpc ? money(Number(bannerCpc)) + ' / click' : 'Not configured'}</span></p>
        </div>
        <button type="button" onClick={() => setRateDialog(true)} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
          <Save className="h-4 w-4" /> Configure CPC rates
        </button>
      </div>
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-orange-600"/><h2 className="text-lg font-bold">Pending store banners</h2><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{banners.length}</span></div>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : banners.length === 0 ? <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">No banner submissions awaiting review.</div> : banners.map(b => <article key={b.id} className="rounded-xl border bg-white p-4 flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-64 shrink-0"><img src={b.pending_banner_url ?? ''} alt={b.name + ' pending banner'} className="aspect-[3/1] w-full rounded-lg bg-gray-100 object-cover"/><p className="mt-1 text-xs text-gray-500">Current approved banner stays live until this one is approved.</p></div>
        <div className="min-w-0 flex-1"><h3 className="font-bold">{b.name}</h3><p className="text-xs text-gray-500">/{b.slug} · Submitted {b.banner_submitted_at ? new Date(b.banner_submitted_at).toLocaleString() : 'date unavailable'}</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy === b.id} onClick={() => void reviewBanner(b.id,'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4"/>Approve</button><button disabled={busy === b.id} onClick={() => void reviewBanner(b.id,'rejected')} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><X className="h-4 w-4"/>Reject</button></div></div>
      </article>)}
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-orange-600"/><h2 className="text-lg font-bold">Ad campaigns</h2></div>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : campaigns.length === 0 ? <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">No ad campaigns have been submitted yet.</div> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="p-3">Campaign</th><th className="p-3">Type</th><th className="p-3">Where it appears</th><th className="p-3">Budget / spent</th><th className="p-3">Clicks</th><th className="p-3">Approval</th><th className="p-3">Payment</th><th className="p-3">Review</th></tr></thead><tbody className="divide-y">{campaigns.map(c => <tr key={c.id}><td className="p-3"><button type="button" onClick={() => setSelectedCampaign(c)} className="block max-w-[12rem] text-left font-semibold leading-snug hover:text-orange-700"><span className="line-clamp-2 break-words">{c.campaign_name}</span></button><div className="mt-1 text-xs text-gray-500">{c.store_id.slice(0,8)}…</div></td><td className="p-3 capitalize">{c.campaign_type}</td><td className="p-3 text-xs text-gray-600">{c.campaign_type === 'banner' ? 'Homepage banner carousel' : 'Sponsored product slots near marketplace results'}</td><td className="p-3">{money(c.budget)} / {money(c.spent)}</td><td className="p-3">{c.clicks ?? 0}</td><td className="p-3"><span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize '+(c.approval_status==='approved'?'bg-emerald-100 text-emerald-800':c.approval_status==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800')}>{c.approval_status}</span></td><td className="p-3"><span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize '+(c.payment_status==='paid'?'bg-emerald-100 text-emerald-800':c.payment_status==='review'||c.payment_status==='failed'?'bg-red-100 text-red-800':c.payment_status==='pending'?'bg-blue-100 text-blue-800':'bg-gray-100 text-gray-700')}>{c.payment_status || 'unpaid'}</span></td><td className="p-3">{c.approval_status==='pending' ? <div className="flex flex-wrap gap-1"><button disabled={busy===c.id} onClick={() => void reviewCampaign(c,'approved')} className="rounded bg-emerald-600 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy===c.id ? 'Saving…' : 'Approve'}</button><button disabled={busy===c.id} onClick={() => void reviewCampaign(c,'rejected')} className="rounded bg-red-600 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-50">Reject</button></div> : <span className={'text-xs font-semibold '+(c.approval_status==='approved'?'text-emerald-700':'text-red-700')}>{c.approval_status==='approved'?'Decision: Approved':'Decision: Rejected'}</span>}</td></tr>)}</tbody></table></div>}
    </section>
    <Dialog open={rateDialog} onOpenChange={(open) => setRateDialog(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure CPC rates</DialogTitle>
          <DialogDescription>Set both cost-per-click prices in one step. These rates apply to sponsored product placements and approved homepage banner campaigns.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm font-medium">Placement Ads CPC (NGN)
            <input type="number" min="0.01" step="0.01" value={cpc} onChange={e => setCpc(e.target.value)} placeholder="Enter Placement Ads price per click" className="mt-1 w-full rounded-lg border px-3 py-2"/>
          </label>
          <label className="block text-sm font-medium">Banner Ads CPC (NGN)
            <input type="number" min="0.01" step="0.01" value={bannerCpc} onChange={e => setBannerCpc(e.target.value)} placeholder="Enter Banner Ads price per click" className="mt-1 w-full rounded-lg border px-3 py-2"/>
          </label>
          <button type="button" onClick={() => void saveRates()} disabled={savingRate} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">
            {savingRate ? <><Loader2 className="h-4 w-4 animate-spin"/> Saving…</> : <><Save className="h-4 w-4"/> Set CPC prices</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={selectedCampaign !== null} onOpenChange={(open) => { if (!open) setSelectedCampaign(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="break-words">{selectedCampaign?.campaign_name}</DialogTitle><DialogDescription>Submitted campaign details for admin review.</DialogDescription></DialogHeader>
        {selectedCampaign && <div className="space-y-4 text-sm">
          {selectedCampaign.image_url && <img src={selectedCampaign.image_url} alt={selectedCampaign.campaign_name} className="max-h-56 w-full rounded-lg border bg-gray-50 object-contain"/>}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Campaign type</p><p className="mt-1 font-semibold capitalize">{selectedCampaign.campaign_type}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Budget</p><p className="mt-1 font-semibold">{money(selectedCampaign.budget)}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Spent</p><p className="mt-1 font-semibold">{money(selectedCampaign.spent)}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Clicks</p><p className="mt-1 font-semibold">{selectedCampaign.clicks ?? 0}</p></div>
          </div>
          <div><p className="text-xs text-gray-500">Store ID</p><p className="break-all font-medium">{selectedCampaign.store_id}</p></div>
          <div><p className="text-xs text-gray-500">Product ID</p><p className="break-all font-medium">{selectedCampaign.product_id || 'Not linked to a product'}</p></div>
          <div><p className="text-xs text-gray-500">Destination URL</p>{selectedCampaign.target_url ? <a className="break-all font-medium text-orange-700 underline" href={selectedCampaign.target_url} target="_blank" rel="noreferrer">{selectedCampaign.target_url}</a> : <p>Not provided</p>}</div>
          <div className="flex flex-wrap gap-2"><span className={'rounded-full px-2.5 py-1 text-xs font-bold capitalize '+(selectedCampaign.approval_status==='approved'?'bg-emerald-100 text-emerald-800':selectedCampaign.approval_status==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800')}>Review: {selectedCampaign.approval_status}</span><span className={'rounded-full px-2.5 py-1 text-xs font-bold capitalize '+(selectedCampaign.payment_status==='paid'?'bg-emerald-100 text-emerald-800':selectedCampaign.payment_status==='review'||selectedCampaign.payment_status==='failed'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-700')}>Payment: {selectedCampaign.payment_status || 'unpaid'}</span></div>
          {selectedCampaign.approval_status==='pending' && <div className="flex gap-2 border-t pt-4"><button disabled={busy===selectedCampaign.id} onClick={async () => { await reviewCampaign(selectedCampaign,'approved'); setSelectedCampaign(null); }} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Approve campaign</button><button disabled={busy===selectedCampaign.id} onClick={async () => { await reviewCampaign(selectedCampaign,'rejected'); setSelectedCampaign(null); }} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Reject campaign</button></div>}
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
