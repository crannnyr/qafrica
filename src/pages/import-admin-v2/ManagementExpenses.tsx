import { useEffect, useRef, useState } from 'react'
import { FileText, Loader, Upload, X, Plus, List } from 'lucide-react'
import CONFIG from '@/lib/config'
import { getManagementToken } from './ManagementAuth'

const EDGE_URL = CONFIG.SUPABASE_URL + '/functions/v1/import-admin-v2-expenses'
type Expense={id:string;title:string;description:string|null;amount:number;expense_date:string;receipt_name:string|null;status:'pending'|'paid'|'rejected';paid_at:string|null;created_at:string}
const money=(n:number)=>'₦'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})

export default function ManagementExpenses(){
 const [expenses,setExpenses]=useState<Expense[]>([]),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[amount,setAmount]=useState(''),[expenseDate,setExpenseDate]=useState(new Date().toISOString().slice(0,10)),[file,setFile]=useState<File|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('')
 const inputRef=useRef<HTMLInputElement>(null)
 const load=async()=>{const token=getManagementToken();if(!token){setError('Management session expired.');setLoading(false);return}try{const res=await fetch(EDGE_URL+'?action=list-mine',{headers:{'x-manager-token':token}});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not load expenses');setExpenses(data.expenses||[])}catch(e){setError(e instanceof Error?e.message:'Could not load expenses')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');const token=getManagementToken();if(!token){setError('Management session expired.');return}if(!title.trim()||!amount||!file){setError('Please enter what the expense was for, the amount, and attach the receipt.');return}setSaving(true);try{const form=new FormData();form.set('title',title.trim());form.set('description',description.trim());form.set('amount',amount);form.set('expense_date',expenseDate);form.set('receipt',file);const res=await fetch(EDGE_URL+'?action=create',{method:'POST',headers:{'x-manager-token':token},body:form});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not submit expense');setTitle('');setDescription('');setAmount('');setFile(null);setExpenseDate(new Date().toISOString().slice(0,10));if(inputRef.current)inputRef.current.value='';await load()}catch(e){setError(e instanceof Error?e.message:'Could not submit expense')}finally{setSaving(false)}}
 return <div className="max-w-5xl mx-auto space-y-5">
  <div><h2 className="text-xl font-bold text-gray-900">Expenses & Reimbursements</h2><p className="text-sm text-gray-500 mt-1">Submit money you personally spent for QAfrica and view your expense submissions.</p></div>
  <div className="bg-white rounded-2xl border border-gray-100 p-1.5 flex gap-1">
   <button type="button" onClick={()=>setActiveTab('add')} className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab==='add'?'bg-gray-900 text-white':'text-gray-500 hover:bg-gray-50'}`}><Plus className="w-4 h-4"/>Add Expense</button>
   <button type="button" onClick={()=>setActiveTab('view')} className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab==='view'?'bg-gray-900 text-white':'text-gray-500 hover:bg-gray-50'}`}><List className="w-4 h-4"/>View Expenses</button>
  </div>
  {activeTab==='add' && <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
   <div className="grid sm:grid-cols-2 gap-4">
    <label><span className="block text-xs font-semibold text-gray-500 mb-1.5">What was the expense for?</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Delivery to warehouse" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"/></label>
    <label><span className="block text-xs font-semibold text-gray-500 mb-1.5">Amount (NGN)</span><input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"/></label>
   </div>
   <div className="grid sm:grid-cols-2 gap-4">
    <label><span className="block text-xs font-semibold text-gray-500 mb-1.5">Expense date</span><input type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"/></label>
    <label><span className="block text-xs font-semibold text-gray-500 mb-1.5">Receipt</span><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="w-full text-xs"/></label>
   </div>
   <label><span className="block text-xs font-semibold text-gray-500 mb-1.5">Details (optional)</span><textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Add any useful details about the expense…" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none"/></label>
   {file&&<div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2"><FileText className="w-4 h-4"/><span className="truncate">{file.name}</span><button type="button" onClick={()=>{setFile(null);if(inputRef.current)inputRef.current.value=''}} className="ml-auto"><X className="w-4 h-4"/></button></div>}
   {error&&<div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
   <button disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">{saving?<Loader className="w-4 h-4 animate-spin"/>:<Upload className="w-4 h-4"/>}{saving?'Submitting…':'Submit expense'}</button>
  </form>}
  {activeTab==='view' && <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="px-5 py-4 border-b border-gray-100"><p className="font-bold text-gray-900">My submissions</p></div>
   {loading?<div className="py-12 flex justify-center"><Loader className="w-5 h-5 animate-spin text-gray-300"/></div>:expenses.length===0?<div className="py-12 text-center text-sm text-gray-400">No expenses submitted yet.</div>:<div className="divide-y divide-gray-100">{expenses.map(x=><div key={x.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1 min-w-0"><p className="font-semibold text-sm text-gray-900">{x.title}</p><p className="text-xs text-gray-400 mt-1">{x.expense_date}{x.receipt_name?' · '+x.receipt_name:''}</p></div><div className="font-bold text-sm">{money(x.amount)}</div><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${x.status==='paid'?'bg-green-50 text-green-700':x.status==='rejected'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}`}>{x.status}</span></div>)}</div>}
  </div>
 </div>
}
