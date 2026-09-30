import { useEffect, useState } from 'react';
import { Check, Edit3, Loader2, X } from 'lucide-react';
import { getManagementToken } from './ManagementAuth';

type Example = { id:string; conversation_id:string|null; category:string|null; issue_summary:string|null; resolution_summary:string|null; transcript:any[]; approved:boolean; approved_by:string|null; approved_at:string|null; created_at:string };

async function callLearning(action:string, extra:any = {}) {
  const token = getManagementToken();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-ai-learning`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action, manager_token:token, ...extra }) });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || 'Learning request failed');
  return data;
}

export default function ImportAILearning() {
  const [tab,setTab]=useState<'pending'|'approved'|'rejected'>('pending');
  const [items,setItems]=useState<Example[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState<string|null>(null);
  const [editing,setEditing]=useState<Example|null>(null);
  const load=async()=>{setLoading(true);try{const data=await callLearning('list',{approved:tab==='pending'?false:tab==='approved'?true:null});setItems(data.examples??[])}catch(e){console.error(e)}finally{setLoading(false)}};
  useEffect(()=>{load()},[tab]);
  const update=async()=>{if(!editing)return;setSaving(editing.id);try{await callLearning('update',{id:editing.id,category:editing.category,issue_summary:editing.issue_summary,resolution_summary:editing.resolution_summary});setEditing(null);await load()}catch(e){console.error(e)}finally{setSaving(null)}};
  const setApproval=async(id:string,approve:boolean)=>{setSaving(id);try{await callLearning(approve?'approve':'reject',{id});await load()}catch(e){console.error(e)}finally{setSaving(null)}};
  return <div className="space-y-5">
    <div><h1 className="text-xl font-bold text-gray-900">AI Learning</h1><p className="text-sm text-gray-500 mt-1">Review human-resolved support conversations before they become trusted AI guidance.</p></div>
    <div className="flex gap-2 border-b border-gray-200">
      {(['pending','approved','rejected'] as const).map(x=><button key={x} onClick={()=>setTab(x)} className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab===x?'border-orange-500 text-orange-600':'border-transparent text-gray-500'}`}>{x==='pending'?'Pending Review':x==='approved'?'Approved':'Rejected'}</button>)}
    </div>
    {loading?<div className="py-20 flex justify-center"><Loader2 className="animate-spin w-5 h-5 text-orange-500"/></div>:items.length===0?<div className="rounded-2xl border bg-white p-10 text-center text-sm text-gray-500">No learning examples in this section.</div>:<div className="space-y-4">{items.map(item=><div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-wide text-orange-600">{item.category||'general'}</span><h2 className="font-bold text-gray-900 mt-1">{item.issue_summary||'No issue summary'}</h2><p className="text-xs text-gray-400 mt-1">Created {new Date(item.created_at).toLocaleString()}</p></div><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.approved?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>{item.approved?'Approved':'Pending'}</span></div>
      <div className="mt-4 grid md:grid-cols-2 gap-4"><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-bold text-gray-500 uppercase mb-2">Issue</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{item.issue_summary}</p></div><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-bold text-gray-500 uppercase mb-2">Human resolution</p><p className="text-sm text-gray-700 whitespace-pre-wrap">{item.resolution_summary}</p></div></div>
      <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-gray-500">View source conversation</summary><div className="mt-3 max-h-72 overflow-auto space-y-2">{(item.transcript||[]).map((m:any,i:number)=><div key={i} className="text-xs rounded-lg bg-gray-50 p-2"><b>{m.sender_type||m.direction}</b>: {m.body}</div>)}</div></details>
      <div className="mt-4 flex flex-wrap gap-2">{tab==='pending'&&<><button disabled={!!saving} onClick={()=>setApproval(item.id,true)} className="inline-flex items-center gap-2 rounded-xl bg-green-600 text-white px-3 py-2 text-sm font-semibold disabled:opacity-50"><Check className="w-4 h-4"/> Approve</button><button disabled={!!saving} onClick={()=>setApproval(item.id,false)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"><X className="w-4 h-4"/> Reject</button></>}<button onClick={()=>setEditing({...item})} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700"><Edit3 className="w-4 h-4"/> Edit</button></div>
    </div>)}</div>}
    {editing&&<div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"><div className="w-full max-w-2xl rounded-2xl bg-white p-6 space-y-4"><h2 className="text-lg font-bold">Edit learning example</h2><input value={editing.category||''} onChange={e=>setEditing({...editing,category:e.target.value})} className="w-full border rounded-xl px-3 py-2" placeholder="Category"/><textarea value={editing.issue_summary||''} onChange={e=>setEditing({...editing,issue_summary:e.target.value})} className="w-full border rounded-xl px-3 py-2 min-h-24" placeholder="Reusable issue summary"/><textarea value={editing.resolution_summary||''} onChange={e=>setEditing({...editing,resolution_summary:e.target.value})} className="w-full border rounded-xl px-3 py-2 min-h-32" placeholder="Reusable human resolution"/><div className="flex justify-end gap-2"><button onClick={()=>setEditing(null)} className="px-4 py-2 rounded-xl border">Cancel</button><button disabled={!!saving} onClick={update} className="px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold">Save</button></div></div></div>}
  </div>
}
