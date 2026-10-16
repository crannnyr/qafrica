import { useCallback, useEffect, useState } from 'react';
import { Check, X, RefreshCw, Megaphone, Image as ImageIcon, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

type BannerSubmission = { id: string; name: string; slug: string; banner_url: string | null; pending_banner_url: string | null; banner_submitted_at: string | null; banner_rejection_reason: string | null };
type Campaign = { id: string; campaign_name: string; campaign_type: 'banner' | 'placement'; store_id: string; product_id: string | null; image_url: string | null; target_url: string | null; budget: number; spent: number; clicks: number; status: string; approval_status: string; start_date: string; end_date: string | null };
const money = (value: number) => '₦' + Number(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });

export default function AdminBannerAds() {
  const [banners, setBanners] = useState<BannerSubmission[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cpc, setCpc] = useState('');
  const [bannerCpc, setBannerCpc] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [bannerResult, campaignResult, rateResult] = await Promise.all([
      supabase.from('stores').select('id,name,slug,banner_url,pending_banner_url,banner_submitted_at,banner_rejection_reason').not('pending_banner_url', 'is', null).order('banner_submitted_at', { ascending: true }),
      supabase.from('ad_campaigns').select('id,campaign_name,campaign_type,store_id,product_id,image_url,target_url,budget,spent,clicks,status,approval_status,start_date,end_date').order('created_at', { ascending: false }),
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
    const { error } = await supabase.from('ad_campaigns').update({ approval_status: decision, reviewed_at: new Date().toISOString(), reviewed_by: (await supabase.auth.getUser()).data.user?.id ?? null }).eq('id', campaign.id);
    if (error) toast.error(error.message);
    else { toast.success('Campaign ' + decision); await load(); }
    setBusy(null);
  };

  const saveRate = async () => {
    const rate = Number(cpc);
    if (!cpc.trim() || !Number.isFinite(rate) || rate <= 0) { toast.error('Enter a CPC greater than ₦0'); return; }
    setSavingRate(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from('placement_ad_settings').upsert({ id: true, flat_cpc_ngn: rate, updated_at: new Date().toISOString(), updated_by: user?.id ?? null }, { onConflict: 'id' });
    if (error) toast.error(error.message);
    else toast.success('Placement Ads CPC rate saved');
    setSavingRate(false);
  };

  const saveBannerRate = async () => {
    const rate = Number(bannerCpc);
    if (!bannerCpc.trim() || !Number.isFinite(rate) || rate <= 0) { toast.error('Enter a Banner Ads CPC greater than ₦0'); return; }
    setSavingRate(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from('placement_ad_settings').upsert({ id: true, banner_cpc_ngn: rate, updated_at: new Date().toISOString(), updated_by: user?.id ?? null }, { onConflict: 'id' });
    if (error) toast.error(error.message);
    else toast.success('Banner Ads CPC rate saved');
    setSavingRate(false);
  };

  return <div className="mx-auto max-w-6xl space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-gray-900">Banners & Advertising</h1><p className="mt-1 text-sm text-gray-500">Review store banners and ad campaigns. Configure separate CPC rates for Placement Ads and Banner Ads.</p></div>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4"/>Refresh</button>
    </header>

    <section className="rounded-xl border bg-white p-5 space-y-4">
      <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-orange-600"/><h2 className="text-lg font-bold">Placement Ads CPC</h2></div>
      <p className="text-sm text-gray-500">One flat rate across every category. Billing remains disabled until you configure a rate.</p>
      <div className="flex flex-wrap items-end gap-3"><label className="block"><span className="mb-1 block text-sm font-medium">Cost per click (NGN)</span><input type="number" min="0.01" step="0.01" value={cpc} onChange={e => setCpc(e.target.value)} placeholder="Enter flat CPC" className="w-56 rounded-lg border px-3 py-2"/></label><button onClick={() => void saveRate()} disabled={savingRate} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{savingRate ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}Save CPC</button></div>
    </section>

    <section className="rounded-xl border bg-white p-5 space-y-4">
      <div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-orange-600"/><h2 className="text-lg font-bold">Banner Ads CPC</h2></div>
      <p className="text-sm text-gray-500">This rate is charged for eligible clicks on approved, active homepage banner campaigns. It is separate from Placement Ads CPC. Billing remains disabled until you configure a rate.</p>
      <div className="flex flex-wrap items-end gap-3"><label className="block"><span className="mb-1 block text-sm font-medium">Cost per click (NGN)</span><input type="number" min="0.01" step="0.01" value={bannerCpc} onChange={e => setBannerCpc(e.target.value)} placeholder="Enter banner CPC" className="w-56 rounded-lg border px-3 py-2"/></label><button onClick={() => void saveBannerRate()} disabled={savingRate} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{savingRate ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}Save Banner CPC</button></div>
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
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : campaigns.length === 0 ? <div className="rounded-xl border bg-white p-5 text-sm text-gray-500">No ad campaigns have been submitted yet.</div> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="p-3">Campaign</th><th className="p-3">Type</th><th className="p-3">Budget / spent</th><th className="p-3">Clicks</th><th className="p-3">Approval</th><th className="p-3">Review</th></tr></thead><tbody className="divide-y">{campaigns.map(c => <tr key={c.id}><td className="p-3"><div className="font-semibold">{c.campaign_name}</div><div className="text-xs text-gray-500">{c.store_id.slice(0,8)}…</div></td><td className="p-3 capitalize">{c.campaign_type}</td><td className="p-3">{money(c.budget)} / {money(c.spent)}</td><td className="p-3">{c.clicks ?? 0}</td><td className="p-3 capitalize">{c.approval_status}</td><td className="p-3"><div className="flex gap-1"><button disabled={busy===c.id || c.approval_status==='approved'} onClick={() => void reviewCampaign(c,'approved')} className="rounded bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40">Approve</button><button disabled={busy===c.id || c.approval_status==='rejected'} onClick={() => void reviewCampaign(c,'rejected')} className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40">Reject</button></div></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
