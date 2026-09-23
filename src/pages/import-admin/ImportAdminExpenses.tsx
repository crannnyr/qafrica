import { useEffect, useState } from 'react'
import { Check, ExternalLink, Loader } from 'lucide-react'
import CONFIG from '@/lib/config'

const EDGE_URL=CONFIG.SUPABASE_URL+'/functions/v1/management-expenses'
type Expense={id:string;manager_id:string;title:string;description:string|null;amount:number;expense_date:string;receipt_path:string;receipt_name:string|null;receipt_mime_type:string|null;status:'pending'|'paid'|'rejected';paid_at:string|null;created_at:string;submitter?:{full_name:string|null;email:string|null}|null;payer?:{full_name:string|null;email:string|null}|null}
const money=(n:number)=>'₦'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})

export default function ImportAdminExpenses({token}:{token:string}){
 const [expenses,setExpenses]=useState<Expense[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[paying,setPaying]=useState<string|null>(null)
 const load=async()=>{setLoading(true);try{const res=await fetch(EDGE_URL+'?action=list-all',{headers:{'x-manager-token':token}});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not load expenses');setExpenses(data.expenses||[])}catch(e){setError(e instanceof Error?e.message:'Could not load expenses')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[token])
 const openReceipt=async(id:string)=>{try{const res=await fetch(EDGE_URL+'?action=receipt-url&id='+encodeURIComponent(id),{headers:{'x-manager-token':token}});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not open receipt');window.open(data.url,'_blank','noopener,noreferrer')}catch(e){setError(e instanceof Error?e.message:'Could not open receipt')}}
 const pay=async(id:string)=>{if(!window.confirm('Mark this expense as paid?'))return;setPaying(id);setError('');try{const res=await fetch(EDGE_URL+'?action=pay',{method:'POST',headers:{'Content-Type':'application/json','x-manager-token':token},body:JSON.stringify({id})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not mark expense as paid');setExpenses(v=>v.map(x=>x.id===id?data.expense:x))}catch(e){setError(e instanceof Error?e.message:'Could not mark expense as paid')}finally{setPaying(null)}}
 const pending=expenses.filter(x=>x.status==='pending'),paid=expenses.filter(x=>x.status==='paid')
 return <div className="space-y-5">
  <div><h2 className="text-xl font-bold text-gray-900">Expenses & Reimbursements</h2><p className="text-sm text-gray-500 mt-1">{pending.length} pending · {paid.length} paid</p></div>
  {error&&<div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}
  {loading?<div className="bg-white rounded-2xl border border-gray-100 py-16 flex justify-center"><Loader className="w-5 h-5 animate-spin text-gray-300"/></div>:expenses.length===0?<div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-sm text-gray-400">No expense submissions yet.</div>:<div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
   <div className="divide-y divide-gray-100">{expenses.map(x=><div key={x.id} className="p-5 space-y-3">
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
     <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h3 className="font-bold text-sm text-gray-900">{x.title}</h3><span className={x.status==='paid'?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'} className="px-2 py-1 rounded-full text-[9px] font-bold uppercase">{x.status}</span></div><p className="text-xs text-gray-500 mt-1">{x.submitter?.full_name||x.submitter?.email||'Manager'} · {x.expense_date}</p>{x.description&&<p className="text-xs text-gray-600 mt-2">{x.description}</p>}</div>
     <div className="text-lg font-black text-gray-900">{money(x.amount)}</div>
     <div className="flex items-center gap-2"><button onClick={()=>void openReceipt(x.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"><ExternalLink className="w-3.5 h-3.5"/> Receipt</button>{x.status==='pending'&&<button onClick={()=>void pay(x.id)} disabled={paying===x.id} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold disabled:opacity-50">{paying===x.id?<Loader className="w-3.5 h-3.5 animate-spin"/>:<Check className="w-3.5 h-3.5"/>} Mark paid</button>}</div>
    </div>
    {x.status==='paid'&&x.paid_at&&<p className="text-[10px] text-green-600">Paid {new Date(x.paid_at).toLocaleString()}{x.payer?.full_name?' by '+x.payer.full_name:''}</p>}
   </div>)}</div>
  </div>}
 </div>
}
