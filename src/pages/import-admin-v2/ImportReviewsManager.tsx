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
  const [reviewerUsername,setReviewerUsername] = useState(false);\n  const [productPage,setProductPage] = useState(1);\n  const [productPageCount,setProductPageCount] = useState(1);\n  const [productsLoading,setProductsLoading] = useState(false);

  const call = async (action:string, extra:Record<string,unknown>={}) => {
    const res = await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,manager_token:token,...extra})});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const load = async (page = 1, productSearch = '') => {\n    if(!token) return;\n    setLoading(true);\n    try {\n      const [productRes, reviewerRes] = await Promise.all([\n        fetch(PRODUCTS_FN+'?action=admin-products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({manager_token:token,page,per_page:50,search:productSearch})}),\n        call('reviewers')\n      ]);\n      const productsData = await productRes.json().catch(()=>({}));\n      if(!productRes.ok) throw new Error(productsData.error || 'Could not load products');\n      setProducts(productsData.products ?? []);\n      setProductPage(Number(productsData.pagination?.page ?? page));\n      setProductPageCount(Math.max(1,Number(productsData.pagination?.page_count ?? 1)));\n      setReviewers(reviewerRes.reviewers ?? []);\n    } catch(e) {\n      toast.error(e instanceof Error ? e.message : 'Could not load reviews manager');\n    } finally { setLoading(false); setProductsLoading(false); }\n  };  const filteredProducts = products;\n\n  const changeProductPage = (page:number) => {\n    if(page < 1 || page > productPageCount || productsLoading) return;\n    setProductsLoading(true);\n    void load(page, search.trim());\n  };
