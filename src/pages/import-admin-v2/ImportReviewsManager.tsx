import { useEffect, useMemo, useState } from 'react';
import { Check, Edit3, MessageSquare, Plus, Search, Star, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

type Product = { id:string; name:string; image_url?:string|null; image_urls?:string[]; category?:string|null };
type Reviewer = { id:string; display_name:string; is_username:boolean };
type Review = {
  id:string; product_id:string; product_name:string|null; customer_name:string; is_username:boolean;
  customer_avatar_url:string|null; rating:number; title:string|null; content:string|null; images:string[];
  is_verified_purchase:boolean; helpful_count:number; created_at:string;
};

const FN = `${CONFIG.SUPABASE_URL}/functions/v1/import-review-admin`;
const PRODUCTS_FN = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

function Stars({ value, onChange, size = 16 }: { value:number; onChange?: (n:number)=>void; size?:number }) {
  return <div className="flex gap-0.5">
    {[1,2,3,4,5].map(n => <button key={n} type="button" disabled={!onChange} onClick={()=>onChange?.(n)} className={onChange ? 'hover:scale-110 transition-transform' : ''}>
      <Star style={{width:size,height:size}} className={n<=value ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
    </button>)}
  </div>;
}

const emptyForm = {
  product_id:'', product_name:'', reviewer_id:'', customer_name:'', is_username:false, customer_avatar_url:'',
  rating:5, title:'', content:'', imagesText:'', is_verified_purchase:true, helpful_count:0, created_at:''
};

export default function ImportReviewsManager() {
  const token = getManagementToken();
  const { hasPermission } = useImportAdminPermissions(token);
  const canManage = hasPermission('import.reviews.manage');
  const [products,setProducts] = useState<Product[]>([]);
  const [reviewers,setReviewers] = useState<Reviewer[]>([]);
  const [reviews,setReviews] = useState<Review[]>([]);
  const [selectedProduct,setSelectedProduct] = useState<string>('');
  const [selectedProductData,setSelectedProductData] = useState<Product|null>(null);
  const [search,setSearch] = useState('');
  const [reviewSearch,setReviewSearch] = useState('');
  const [loading,setLoading] = useState(true);
  const [reviewsLoading,setReviewsLoading] = useState(false);
  const [showForm,setShowForm] = useState(false);
  const [showReviewer,setShowReviewer] = useState(false);
  const [editing,setEditing] = useState<Review|null>(null);
  const [form,setForm] = useState({...emptyForm});
  const [saving,setSaving] = useState(false);
  const [reviewerName,setReviewerName] = useState('');
  const [reviewerUsername,setReviewerUsername] = useState(false);
  const [productPage,setProductPage] = useState(1);
  const [productPageCount,setProductPageCount] = useState(1);
  const [productsLoading,setProductsLoading] = useState(false);

  const call = async (action:string, extra:Record<string,unknown>={}) => {
    const res = await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,manager_token:token,...extra})});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const load = async (page = 1, productSearch = '', initial = false) => {
    if(!token) return;
    if (initial) setLoading(true);
    else setProductsLoading(true);
    try {
      const [productRes, reviewerRes] = await Promise.all([
        fetch(PRODUCTS_FN+'?action=admin-products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({manager_token:token,page,per_page:50,search:productSearch})}),
        call('reviewers')
      ]);
      const productsData = await productRes.json().catch(()=>({}));
      if(!productRes.ok) throw new Error(productsData.error || 'Could not load products');
      setProducts(productsData.products ?? []);
      setProductPage(Number(productsData.pagination?.page ?? page));
      setProductPageCount(Math.max(1,Number(productsData.pagination?.page_count ?? 1)));
      setReviewers(reviewerRes.reviewers ?? []);
    } catch(e) {
      toast.error(e instanceof Error ? e.message : 'Could not load reviews manager');
    } finally {
      if (initial) setLoading(false);
      setProductsLoading(false);
    }
  };

  const loadReviews = async (productId:string) => {
    setReviewsLoading(true);
    try {
      const data=await call('list',{product_id:productId});
      setReviews(data.reviews ?? []);
    } catch(e) {
      toast.error(e instanceof Error ? e.message : 'Could not load reviews');
    } finally { setReviewsLoading(false); }
  };

  useEffect(()=>{ void load(1,'',true); },[]);
  useEffect(()=>{ if(selectedProduct) void loadReviews(selectedProduct); else setReviews([]); },[selectedProduct]);

  const filteredProducts = products;

  const changeProductPage = (page:number) => {
    if(page < 1 || page > productPageCount || productsLoading) return;
    setProductsLoading(true);
    void load(page, search.trim());
  };

  const visibleReviews = useMemo(()=>{
    const q=reviewSearch.trim().toLowerCase();
    return reviews.filter(r=>!q || r.customer_name.toLowerCase().includes(q) || (r.title??'').toLowerCase().includes(q) || (r.content??'').toLowerCase().includes(q));
  },[reviews,reviewSearch]);

  const selected = products.find(p=>p.id===selectedProduct) ?? selectedProductData;

  const openCreate = () => {
    setEditing(null);
    setForm({...emptyForm,product_id:selectedProduct,product_name:selected?.name ?? ''});
    setShowForm(true);
  };

  const openEdit = (r:Review) => {
    setEditing(r);
    setForm({
      product_id:r.product_id, product_name:r.product_name ?? products.find(p=>p.id===r.product_id)?.name ?? '',
      reviewer_id:'', customer_name:r.customer_name, is_username:r.is_username, customer_avatar_url:r.customer_avatar_url ?? '',
      rating:r.rating, title:r.title ?? '', content:r.content ?? '', imagesText:(r.images ?? []).join('\n'),
      is_verified_purchase:r.is_verified_purchase, helpful_count:r.helpful_count ?? 0,
      created_at:r.created_at ? new Date(r.created_at).toISOString().slice(0,16) : ''
    });
    setShowForm(true);
  };

  const chooseReviewer = (id:string) => {
    const r=reviewers.find(x=>x.id===id);
    if(!r) return;
    setForm(f=>({...f,reviewer_id:id,customer_name:r.display_name,is_username:r.is_username}));
  };

  const saveReview = async () => {
    if(!form.product_id || !form.customer_name || !form.content.trim()) {
      toast.error('Select a product, reviewer and enter the review content.');
      return;
    }
    setSaving(true);
    try {
      const payload={
        ...form,id:editing?.id,
        images:form.imagesText.split('\n').map(x=>x.trim()).filter(Boolean),
        created_at:form.created_at || undefined
      };
      await call(editing?'update-review':'create-review',payload);
      toast.success(editing?'Review updated':'Review added');
      setShowForm(false);
      await loadReviews(form.product_id);
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Could not save review'); }
    finally { setSaving(false); }
  };

  const deleteReview = async (id:string) => {
    if(!confirm('Delete this review? This cannot be undone.')) return;
    try { await call('delete-review',{id}); toast.success('Review deleted'); await loadReviews(selectedProduct); }
    catch(e){ toast.error(e instanceof Error ? e.message : 'Could not delete review'); }
  };

  const createReviewer = async () => {
    if(!reviewerName.trim()) return;
    try {
      const data=await call('create-reviewer',{display_name:reviewerName,is_username:reviewerUsername});
      const r=data.reviewer as Reviewer;
      setReviewers(prev=>[...prev,r].sort((a,b)=>a.display_name.localeCompare(b.display_name)));
      chooseReviewer(r.id);
      setReviewerName(''); setReviewerUsername(false); setShowReviewer(false);
      toast.success('Reviewer created');
    } catch(e){ toast.error(e instanceof Error ? e.message : 'Could not create reviewer'); }
  };

  if(loading) return <div className="min-h-[50vh] flex items-center justify-center"><div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div>;

  return <div className="space-y-5">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
      <div><h1 className="text-lg font-bold text-gray-900">Product Reviews</h1><p className="text-xs text-gray-500 mt-1">Create and manage reviews shown on China-import product pages.</p></div>
      <button onClick={openCreate} disabled={!selectedProduct || !canManage} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-40"><Plus className="w-4 h-4"/> Add review</button>
    </div>

    <div className="grid lg:grid-cols-[340px_1fr] gap-5">
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-900 mb-2">Choose a product</p>
          <div className="relative"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>{setSearch(e.target.value);setProductPage(1);void load(1,e.target.value.trim());}} placeholder="Search products..." className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs outline-none focus:border-orange-300"/></div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredProducts.map(p=><button key={p.id} onClick={()=>{setSelectedProduct(p.id);setSelectedProductData(p);}} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left ${selectedProduct===p.id?'bg-orange-50 border border-orange-200':'hover:bg-gray-50'}`}>
            <img src={p.image_url || p.image_urls?.[0] || '/qafrica-bag-logo.svg'} className="w-11 h-11 rounded-lg object-cover bg-gray-100" alt=""/>
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p><p className="text-[10px] text-gray-400 mt-0.5">{p.category || 'Uncategorized'}</p></div>
          </button>)}
          {!filteredProducts.length && <p className="p-6 text-center text-xs text-gray-400">No products found.</p>}
        </div>
        {!!filteredProducts.length && <div className="flex items-center justify-between gap-2 p-2 mt-1 border-t border-gray-100">
          <button type="button" onClick={()=>changeProductPage(productPage-1)} disabled={productPage<=1||productsLoading} className="px-3 py-2 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-700 disabled:opacity-40">Previous</button>
          <span className="text-[10px] text-gray-400">Page {productPage} of {productPageCount}</span>
          <button type="button" onClick={()=>changeProductPage(productPage+1)} disabled={productPage>=productPageCount||productsLoading} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-bold disabled:opacity-40">Next</button>
        </div>}
      </section>

      <section className="min-w-0">
        {!selected ? <div className="h-full min-h-[360px] bg-white border border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-center p-8"><div><MessageSquare className="w-8 h-8 mx-auto text-gray-200"/><p className="text-sm font-semibold text-gray-600 mt-3">Select a product</p><p className="text-xs text-gray-400 mt-1">Its existing reviews will appear here.</p></div></div> :
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1"><img src={selected.image_url || selected.image_urls?.[0] || '/qafrica-bag-logo.svg'} className="w-12 h-12 rounded-xl object-cover bg-gray-100" alt=""/><div className="min-w-0"><h2 className="font-bold text-sm text-gray-900 truncate">{selected.name}</h2><p className="text-[10px] text-gray-400">{reviews.length} review{reviews.length===1?'':'s'}</p></div></div>
            <div className="relative"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400"/><input value={reviewSearch} onChange={e=>setReviewSearch(e.target.value)} placeholder="Search reviews..." className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs outline-none"/></div>
          </div>
          <div className="p-4">
            {reviewsLoading ? <div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/></div> :
            !visibleReviews.length ? <div className="py-16 text-center"><MessageSquare className="w-8 h-8 mx-auto text-gray-200"/><p className="text-xs text-gray-400 mt-2">No reviews for this product yet.</p><button onClick={openCreate} disabled={!canManage} className="mt-3 text-xs font-bold text-orange-500 disabled:opacity-40">Add the first review</button></div> :
            <div className="space-y-3">{visibleReviews.map(r=><div key={r.id} className="border border-gray-100 rounded-2xl p-4">
              <div className="flex gap-3">
                {r.customer_avatar_url ? <img src={r.customer_avatar_url} className="w-9 h-9 rounded-full object-cover bg-gray-100" alt=""/> : <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">{r.customer_name.slice(0,1).toUpperCase()}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-gray-900">{r.customer_name}</span>{r.is_username&&<span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">username</span>}{r.is_verified_purchase&&<span className="flex items-center gap-0.5 text-[9px] text-emerald-600"><Check className="w-2.5 h-2.5"/> Verified</span>}</div>
                  <div className="flex items-center gap-2 mt-1"><Stars value={r.rating}/><span className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span></div>
                  {r.title&&<p className="text-xs font-bold text-gray-800 mt-3">{r.title}</p>}<p className="text-xs text-gray-600 leading-relaxed mt-1">{r.content}</p>
                  {!!r.images?.length&&<div className="flex gap-2 mt-3 overflow-x-auto">{r.images.map((im,i)=><img key={i} src={im} className="w-16 h-16 rounded-lg object-cover" alt=""/>)}</div>}
                  <div className="flex items-center justify-between mt-3"><span className="text-[10px] text-gray-400">{r.helpful_count} found helpful</span><div className="flex gap-1"><button onClick={()=>openEdit(r)} disabled={!canManage} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Edit"><Edit3 className="w-3.5 h-3.5"/></button><button onClick={()=>void deleteReview(r.id)} disabled={!canManage} className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button></div></div>
                </div>
              </div>
            </div>)}</div>}
          </div>
        </div>}
      </section>
    </div>

    {showForm&&<div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onMouseDown={()=>setShowForm(false)}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onMouseDown={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between"><div><h3 className="font-bold text-gray-900">{editing?'Edit review':'Add review'}</h3><p className="text-[10px] text-gray-400 mt-0.5">This review will appear on the selected product page.</p></div><button onClick={()=>setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4"/></button></div>
        <div className="p-5 space-y-4">
          <div><label className="text-[11px] font-bold text-gray-700">Product</label><select value={form.product_id} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setForm(f=>({...f,product_id:e.target.value,product_name:p?.name??''}))}} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs bg-white"><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><div className="flex items-center justify-between"><label className="text-[11px] font-bold text-gray-700">Reviewer</label><button onClick={()=>setShowReviewer(true)} disabled={!canManage} type="button" className="text-[10px] font-bold text-orange-500 flex items-center gap-1"><UserPlus className="w-3 h-3"/> New reviewer</button></div><select value={form.reviewer_id} onChange={e=>chooseReviewer(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs bg-white"><option value="">Choose existing reviewer</option>{reviewers.map(r=><option key={r.id} value={r.id}>{r.display_name}{r.is_username?' · username':''}</option>)}</select><input value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} placeholder="Reviewer display name" className="mt-2 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs"/></div>
          <div className="grid sm:grid-cols-2 gap-4"><div><label className="text-[11px] font-bold text-gray-700">Rating</label><div className="mt-2"><Stars value={form.rating} onChange={n=>setForm(f=>({...f,rating:n}))} size={21}/></div></div><label className="flex items-center gap-2 text-xs text-gray-600 mt-5"><input type="checkbox" checked={form.is_username} onChange={e=>setForm(f=>({...f,is_username:e.target.checked}))}/> Display as username</label></div>
          <div><label className="text-[11px] font-bold text-gray-700">Avatar URL <span className="font-normal text-gray-400">(optional)</span></label><input value={form.customer_avatar_url} onChange={e=>setForm(f=>({...f,customer_avatar_url:e.target.value}))} placeholder="https://..." className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs"/></div>
          <div><label className="text-[11px] font-bold text-gray-700">Title <span className="font-normal text-gray-400">(optional)</span></label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Solid quality" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs"/></div>
          <div><label className="text-[11px] font-bold text-gray-700">Review content</label><textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={5} placeholder="Write the customer review..." className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs resize-none"/></div>
          <div><label className="text-[11px] font-bold text-gray-700">Review image URLs <span className="font-normal text-gray-400">(one per line)</span></label><textarea value={form.imagesText} onChange={e=>setForm(f=>({...f,imagesText:e.target.value}))} rows={3} placeholder="https://..." className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs resize-none"/></div>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={form.is_verified_purchase} onChange={e=>setForm(f=>({...f,is_verified_purchase:e.target.checked}))}/> Verified purchase</label>
            <div><label className="text-[11px] font-bold text-gray-700">Helpful count</label><input type="number" min="0" value={form.helpful_count} onChange={e=>setForm(f=>({...f,helpful_count:Number(e.target.value)}))} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"/></div>
            <div><label className="text-[11px] font-bold text-gray-700">Date</label><input type="datetime-local" value={form.created_at} onChange={e=>setForm(f=>({...f,created_at:e.target.value}))} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"/></div>
          </div>
          <div className="pt-2 flex justify-end gap-2"><button onClick={()=>setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold">Cancel</button><button onClick={()=>void saveReview()} disabled={saving} className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-50">{saving?'Saving...':editing?'Save changes':'Add review'}</button></div>
        </div>
      </div>
    </div>}

    {showReviewer&&<div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onMouseDown={()=>setShowReviewer(false)}><div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onMouseDown={e=>e.stopPropagation()}><div className="flex items-center justify-between"><h3 className="font-bold text-sm">New reviewer</h3><button onClick={()=>setShowReviewer(false)}><X className="w-4 h-4"/></button></div><input autoFocus value={reviewerName} onChange={e=>setReviewerName(e.target.value)} placeholder="Name or username" className="mt-4 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs"/><label className="mt-3 flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={reviewerUsername} onChange={e=>setReviewerUsername(e.target.checked)}/> This is a username</label><button onClick={()=>void createReviewer()} disabled={!canManage} className="mt-4 w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold">Create reviewer</button></div></div>}
  </div>;
}
