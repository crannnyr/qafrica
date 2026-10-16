import { useEffect, useState } from 'react';
import { supabase } from '@/services';
import { naira } from './useUnifiedMarketplace';
import type { UnifiedMarketplaceProduct } from './types';
import UnifiedProductCard from './UnifiedProductCard';

type Campaign = { id: string; product_id: string; store_id: string; campaign_name: string; clicks: number };
type Placement = { campaign: Campaign; product: UnifiedMarketplaceProduct };

function makeClickKey(campaignId: string) {
  const storageKey = 'qafrica_placement_click_keys';
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<string, string>;
    if (stored[campaignId]) return stored[campaignId];
    const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}-${Math.random()}`;
    stored[campaignId] = key;
    localStorage.setItem(storageKey, JSON.stringify(stored));
    return key;
  } catch {
    return `${Date.now()}-${Math.random()}-${Math.random()}`;
  }
}

export default function PlacementAds({ niche, category, search }: { niche: string | null; category: string | null; search: string | null }) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      let query = supabase.from('ad_campaigns').select('id,product_id,store_id,campaign_name,clicks,category')
        .eq('campaign_type','placement').eq('approval_status','approved').eq('status','active')
        .lte('start_date',new Date().toISOString()).or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`)
        .not('product_id','is',null).gt('budget',0).order('created_at',{ascending:false}).limit(12);
      if (category) query = query.ilike('category', category);
      const { data: campaigns, error } = await query;
      if (error || !campaigns?.length) { if (alive) setPlacements([]); return; }
      const ids = [...new Set(campaigns.map(c => c.product_id).filter(Boolean))] as string[];
      const [{ data: products }, { data: stores }] = await Promise.all([
        supabase.from('products').select('id,name,description,images,selling_price,compare_at_price,category,niche,has_variants,variants,is_active,is_out_of_stock,stock_quantity,created_at,store_id,tags,marketplace_approval_status').in('id',ids).eq('is_active',true).eq('marketplace_approval_status','approved'),
        supabase.from('stores').select('id,name,slug,is_verified,is_active,is_blocked,marketplace_enabled').in('id',[...new Set(campaigns.map(c => c.store_id))])
      ]);
      if (!alive) return;
      const storeMap = new Map((stores ?? []).filter(s => s.is_active && !s.is_blocked && s.marketplace_enabled).map(s => [s.id,s]));
      const productMap = new Map((products ?? []).filter(p => !p.is_out_of_stock && (p.has_variants || Number(p.stock_quantity ?? 1)>0) && p.images?.length && Number(p.selling_price)>0).map(p => [p.id,p]));
      const mapped: Placement[] = [];
      for (const campaign of campaigns as Campaign[]) {
        const p = productMap.get(campaign.product_id);
        const s = storeMap.get(campaign.store_id);
        if (!p || !s || p.store_id !== s.id) continue;
        if (niche && p.niche !== niche) continue;
        if (category && (p.category || '').trim().toLowerCase() !== category.trim().toLowerCase()) continue;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.category || '').toLowerCase().includes(search.toLowerCase()) && !(p.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))) continue;
        mapped.push({ campaign, product: {
          id: 'product:' + p.id, source_id: p.id, source_type: 'product', name: p.name, description: p.description,
          images: p.images || [], price_ngn: Number(p.selling_price), compare_at_price_ngn: p.compare_at_price,
          category: p.category, niche: p.niche, has_variants: Boolean(p.has_variants), variants: p.variants || [],
          is_available: true, stock_quantity: p.stock_quantity, sold: 0, rating: null, review_count: 0,
          created_at: p.created_at, seller_type: 'store', seller_id: s.id, seller_name: s.name, seller_slug: s.slug,
          seller_verified: Boolean(s.is_verified), tags: p.tags || [], is_china_import: false, flight_shipping_cost_ngn: null,
        }});
      }
      setPlacements(mapped.slice(0,4));
    };
    void load();
    return () => { alive = false; };
  }, [niche,category,search]);

  if (!placements.length) return null;
  return <section aria-label="Sponsored products" className="px-1.5 sm:px-4 pt-2 pb-3">
    <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-sm font-bold text-gray-800">Sponsored</h2><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">Ads</span></div>
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2.5">
      {placements.map(({campaign,product}) => <li key={campaign.id} className="relative">
        <span className="absolute left-1.5 top-1.5 z-10 rounded bg-gray-900/85 px-1.5 py-0.5 text-[10px] font-bold text-white">Ad</span>
        <div onClickCapture={() => {
          void supabase.rpc('record_placement_ad_click',{p_campaign_id:campaign.id,p_click_key:makeClickKey(campaign.id)}).then(({error}) => {
            if (error && !error.message.includes('Authentication required')) console.warn('Placement ad click was not billed:',error.message);
          });
        }}><UnifiedProductCard p={product}/></div>
      </li>)}
    </ul>
  </section>;
}
