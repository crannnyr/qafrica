import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, Plus, Trash2 } from 'lucide-react';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-management`;

type VariantGroup = { id: string; name: string; options: string[]; price_deltas?: Record<string, number> };

const input = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500';
const initial = {
  name:'', description:'', category:'General', parent_category:'', category_id:'', subcategory_id:'',
  image_url:'', image_urls:['','',''], price_cny:'', price_cny_original:'', price_ngn:'', price_usd:'',
  cost_ngn:'', price_input_currency:'cny', price_input_amount:'', original_price_usd:'', usd_to_ngn_rate:'',
  markup_percent:'', markup_amount_ngn:'', sea_shipping_allocation_ngn:'', sea_shipping_customer_ngn:'',
  air_shipping_customer_ngn:'', volume_cbm:'', weight_grams:'', sea_shipping_cost_ngn:'',
  flight_shipping_cost_ngn:'', moq:'1', units_sold:'0', delivery_time:'air', source_url:'',
  ship_only:false, sort_order:'0', is_active:true, is_trending:false, trending_order:'0', trending_source:'manual',
  has_variants:false,
};
export default function ManagementProductAdd({ productId: propProductId }: { productId?: string } = {}) {
  const navigate=useNavigate(); const { id: routeProductId } = useParams(); const productId = propProductId || routeProductId; const [f,setF]=useState(initial); const [variants,setVariants]=useState<VariantGroup[]>([]);
  const [saving,setSaving]=useState(false); const [loading,setLoading]=useState(Boolean(productId)); const [error,setError]=useState('');
  const set=(key:string,value:any)=>setF(v=>({...v,[key]:value}));
  useState(() => { if (!productId) return; void (async () => {
    try {
      const token=getManagementToken(); if(!token) throw new Error('Management session expired');
      const res=await fetch(`${EDGE_URL}?action=admin-product`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({manager_token:token,id:productId})});
      const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||'Could not load product');
      const p=data.product;
      setF(v=>({...v,name:p.name??'',description:p.description??'',category:p.category??'General',parent_category:p.parent_category??'',category_id:p.category_id??'',subcategory_id:p.subcategory_id??'',image_url:p.image_url??'',image_urls:[...(p.image_urls??[]), '', '', ''].slice(0,3),price_cny:String(p.price_cny??''),price_cny_original:String(p.price_cny_original??''),price_ngn:String(p.price_ngn??''),price_usd:String(p.price_usd??''),cost_ngn:String(p.cost_ngn??''),price_input_currency:p.price_input_currency??'cny',price_input_amount:String(p.price_input_amount??''),original_price_usd:String(p.original_price_usd??''),usd_to_ngn_rate:String(p.usd_to_ngn_rate??''),markup_percent:String(p.markup_percent??''),markup_amount_ngn:String(p.markup_amount_ngn??''),sea_shipping_allocation_ngn:String(p.sea_shipping_allocation_ngn??''),sea_shipping_customer_ngn:String(p.sea_shipping_customer_ngn??''),air_shipping_customer_ngn:String(p.air_shipping_customer_ngn??''),volume_cbm:String(p.volume_cbm??''),weight_grams:String(p.weight_grams??''),sea_shipping_cost_ngn:String(p.sea_shipping_cost_ngn??''),flight_shipping_cost_ngn:String(p.flight_shipping_cost_ngn??''),moq:String(p.moq??1),units_sold:String(p.units_sold??0),delivery_time:p.delivery_time??'air',source_url:p.source_url??'',ship_only:Boolean(p.ship_only),sort_order:String(p.sort_order??0),is_active:p.is_active!==false,is_trending:Boolean(p.is_trending),trending_order:String(p.trending_order??0),trending_source:p.trending_source??'manual',has_variants:Boolean(p.has_variants)}));
      setVariants(Array.isArray(p.variants)?p.variants:[]);
    } catch(e){setError(e instanceof Error?e.message:'Could not load product')} finally {setLoading(false)}
  })(); });
  const addGroup=()=>setVariants(v=>[...v,{id:crypto.randomUUID(),name:'',options:[]}]);
  const save=async()=>{ if(!f.name.trim()||!f.image_url.trim()) return setError('Product name and primary image URL are required.');
    setSaving(true);setError('');
    try{const token=getManagementToken(); if(!token) throw new Error('Management session expired');
      const body:any={manager_token:token,...f,id:productId,image_urls:f.image_urls.filter(Boolean),variants,has_variants:variants.length>0,
        price_cny:Number(f.price_cny)||0,price_cny_original:Number(f.price_cny_original)||null,price_ngn:Number(f.price_ngn)||0,
        price_usd:Number(f.price_usd)||null,cost_ngn:Number(f.cost_ngn)||null,price_input_amount:Number(f.price_input_amount)||null,
        original_price_usd:Number(f.original_price_usd)||null,usd_to_ngn_rate:Number(f.usd_to_ngn_rate)||null,
        markup_percent:Number(f.markup_percent)||null,markup_amount_ngn:Number(f.markup_amount_ngn)||null,
        sea_shipping_allocation_ngn:Number(f.sea_shipping_allocation_ngn)||null,sea_shipping_customer_ngn:Number(f.sea_shipping_customer_ngn)||null,
        air_shipping_customer_ngn:Number(f.air_shipping_customer_ngn)||null,volume_cbm:Number(f.volume_cbm)||null,weight_grams:Number(f.weight_grams)||null,
        sea_shipping_cost_ngn:Number(f.sea_shipping_cost_ngn)||null,flight_shipping_cost_ngn:Number(f.flight_shipping_cost_ngn)||null,
        moq:Math.max(1,Number(f.moq)||1),units_sold:Math.max(0,Number(f.units_sold)||0),sort_order:Number(f.sort_order)||0,trending_order:Number(f.trending_order)||0};
      const res=await fetch(`${EDGE_URL}?action=admin-product-create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||'Could not create product');
      navigate('/management/products');
    }catch(e){setError(e instanceof Error?e.message:'Could not create product')}finally{setSaving(false)}
  };
  const Field=({label,k,type='text'}:{label:string,k:string,type?:string})=><label><span className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</span><input type={type} value={(f as any)[k]} onChange={e=>set(k,e.target.value)} className={input}/></label>;
  if (loading) return <div className="min-h-[50vh] flex items-center justify-center"><Loader className="w-5 h-5 text-orange-500 animate-spin"/></div>;
  return <div className="max-w-5xl space-y-4">
    <div className="flex items-center gap-3"><button onClick={()=>navigate('/management/products')} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5"/></button><div><h1 className="font-bold text-gray-900">{productId ? 'Edit product' : 'Add product'}</h1><p className="text-xs text-gray-400">{productId ? 'Edit every product field from Management.' : 'Same product fields used by Import Admin.'}</p></div></div>
    {error&&<div className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-xs">{error}</div>}
    <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
      <h2 className="font-bold text-sm">Basic information</h2><div className="grid sm:grid-cols-2 gap-4"><Field label="Product name" k="name"/><Field label="Primary image URL" k="image_url"/><Field label="Category" k="category"/><Field label="Parent category" k="parent_category"/><Field label="Category ID" k="category_id"/><Field label="Subcategory ID" k="subcategory_id"/></div>
      <label><span className="block text-[11px] font-semibold text-gray-500 mb-1">Description</span><textarea rows={4} value={f.description} onChange={e=>set('description',e.target.value)} className={input}/></label>
      <div><span className="block text-[11px] font-semibold text-gray-500 mb-2">Additional image URLs (up to 3)</span><div className="grid sm:grid-cols-3 gap-3">{f.image_urls.map((v,i)=><input key={i} value={v} onChange={e=>set('image_urls',f.image_urls.map((x,j)=>j===i?e.target.value:x))} placeholder={`Image ${i+2} URL`} className={input}/>)}</div></div>
    </section>
    <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5"><h2 className="font-bold text-sm">Pricing</h2><div className="grid sm:grid-cols-3 gap-4"><Field label="Input currency (cny/usd/ngn)" k="price_input_currency"/><Field label="Input amount" k="price_input_amount" type="number"/><Field label="Price CNY" k="price_cny" type="number"/><Field label="Original CNY" k="price_cny_original" type="number"/><Field label="Price USD" k="price_usd" type="number"/><Field label="Price NGN" k="price_ngn" type="number"/><Field label="Cost NGN" k="cost_ngn" type="number"/><Field label="Original price USD" k="original_price_usd" type="number"/><Field label="USD → NGN rate" k="usd_to_ngn_rate" type="number"/><Field label="Markup %" k="markup_percent" type="number"/><Field label="Markup amount NGN" k="markup_amount_ngn" type="number"/></div></section>
    <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5"><h2 className="font-bold text-sm">Shipping & logistics</h2><div className="grid sm:grid-cols-3 gap-4"><Field label="Volume (CBM)" k="volume_cbm" type="number"/><Field label="Weight (grams)" k="weight_grams" type="number"/><Field label="Sea shipping cost NGN" k="sea_shipping_cost_ngn" type="number"/><Field label="Flight shipping cost NGN" k="flight_shipping_cost_ngn" type="number"/><Field label="Sea allocation NGN" k="sea_shipping_allocation_ngn" type="number"/><Field label="Sea customer NGN" k="sea_shipping_customer_ngn" type="number"/><Field label="Air customer NGN" k="air_shipping_customer_ngn" type="number"/><Field label="Delivery time" k="delivery_time"/><Field label="1688 source URL" k="source_url"/></div><label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={f.ship_only} onChange={e=>set('ship_only',e.target.checked)}/> Sea shipping only</label></section>
    <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4"><div className="flex items-center justify-between"><h2 className="font-bold text-sm">Variants</h2><button onClick={addGroup} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold"><Plus className="w-3.5 h-3.5"/> Add group</button></div>{variants.map((g,gi)=><div key={g.id} className="border border-gray-200 rounded-xl p-4 space-y-3"><div className="flex gap-2"><input value={g.name} placeholder="e.g. Color" onChange={e=>setVariants(v=>v.map((x,i)=>i===gi?{...x,name:e.target.value}:x))} className={input}/><button onClick={()=>setVariants(v=>v.filter((_,i)=>i!==gi))} className="p-2 text-red-500"><Trash2 className="w-4 h-4"/></button></div><input value={g.options.join(', ')} placeholder="Options separated by commas (Black, White, Red)" onChange={e=>setVariants(v=>v.map((x,i)=>i===gi?{...x,options:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}:x))} className={input}/></div>)}</section>
    <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5"><h2 className="font-bold text-sm">Catalogue settings</h2><div className="grid sm:grid-cols-3 gap-4"><Field label="MOQ" k="moq" type="number"/><Field label="Units sold" k="units_sold" type="number"/><Field label="Sort order" k="sort_order" type="number"/><Field label="Trending order" k="trending_order" type="number"/><Field label="Trending source" k="trending_source"/></div><div className="flex flex-wrap gap-5 text-xs"><label><input type="checkbox" checked={f.is_active} onChange={e=>set('is_active',e.target.checked)}/> Active</label><label><input type="checkbox" checked={f.is_trending} onChange={e=>set('is_trending',e.target.checked)}/> Trending</label></div></section>
    <div className="flex justify-end gap-2 pb-8"><button onClick={()=>navigate('/management/products')} className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold">Cancel</button><button onClick={()=>void save()} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold disabled:opacity-60">{saving&&<Loader className="w-4 h-4 animate-spin"/>}{productId ? 'Save changes' : 'Create product'}</button></div>
  </div>;
}