import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, ImageOff, Loader, Package, RefreshCw, ShoppingBag } from 'lucide-react'
import CONFIG from '@/lib/config'

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-sourcing-share`
type Status = 'uncommitted' | 'committed' | 'purchased'
type Line = { allocation_id:string; customer_id:string; customer_name:string; order_id:string; order_code:string; product_id:string; product_name:string; product_image:string|null; source_url:string|null; variant_options:Record<string,string>|null; quantity:number; status:Status; created_at:string; updated_at:string }

export default function ImportSourcingSharePage() {
  const [batchDate,setBatchDate]=useState('')
  const [lines,setLines]=useState<Line[]>([])
  const [activeTab,setActiveTab]=useState<Status>('uncommitted')
  const [loading,setLoading]=useState(true)
  const [busyId,setBusyId]=useState<string|null>(null)
  const [error,setError]=useState('')
  const token=useMemo(()=>window.location.pathname.split('/').filter(Boolean).pop()||'',[])

  const post=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
    const res=await fetch(EDGE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,share_token:token,...extra})})
    const data=await res.json().catch(()=>({}))
    if(!res.ok) throw new Error(data?.error||'Could not update sourcing.')
    return data
  },[token])

  const load=useCallback(async()=>{
    if(!token){setError('This sourcing link is incomplete.');setLoading(false);return}
    setLoading(true);setError('')
    try{
      await post('sync-sourcing')
      const data=await post('sourcing-commitments')
      setLines(Array.isArray(data.rows)?data.rows:[])
      setBatchDate(data.batch_key||'')
    }catch(e){setError(e instanceof Error?e.message:'Could not load sourcing workflow.')}finally{setLoading(false)}
  },[post,token])

  useEffect(()=>{void load()},[load])

  const changeStatus=async(line:Line,next:Status)=>{
    setBusyId(line.allocation_id);setError('')
    try{
      await post(next==='committed'?'commit-sourcing':'mark-sourcing-bought',{allocation_id:line.allocation_id})
      setLines(current=>current.map(x=>x.allocation_id===line.allocation_id?{...x,status:next}:x))
      setActiveTab(next)
    }catch(e){setError(e instanceof Error?e.message:'Could not update this sourcing line.')}finally{setBusyId(null)}
  }

  const counts=useMemo(()=>({uncommitted:lines.filter(x=>x.status==='uncommitted').length,committed:lines.filter(x=>x.status==='committed').length,purchased:lines.filter(x=>x.status==='purchased').length}),[lines])
  const visible=lines.filter(x=>x.status===activeTab)
  const qty=visible.reduce((n,x)=>n+Number(x.quantity||0),0)

  return <div className="min-h-screen bg-gray-50 text-gray-900">
    <header className="sticky top-0 z-50 bg-gray-900 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center"><Package className="w-5 h-5"/></div><div><h1 className="text-lg font-black">QAfrica Sourcing</h1><p className="text-xs text-gray-300">Commit products before buying them in China</p></div></div>
        <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>Refresh</button>
      </div>
    </header>
    <main className="max-w-5xl mx-auto px-4 py-6 pb-12">
      {loading?<div className="py-20 flex justify-center"><Loader className="w-6 h-6 animate-spin text-gray-400"/></div>:error?<div className="bg-white rounded-2xl border border-red-100 p-8 text-center"><p className="font-bold">Sourcing workflow unavailable</p><p className="text-sm text-gray-500 mt-2">{error}</p><button onClick={()=>void load()} className="mt-4 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold">Try again</button></div>:<>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Batch</p><p className="text-sm font-bold">{batchDate?new Date(batchDate).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Closed batch'}</p></div><div className="text-right"><p className="text-xs text-gray-500">{visible.length} sourcing lines</p><p className="text-sm font-black text-orange-600">{qty.toLocaleString()} units</p></div></div>
        <div className="grid grid-cols-3 gap-2 mb-5"><button onClick={()=>setActiveTab('uncommitted')} className={`rounded-2xl border p-3 text-left ${activeTab==='uncommitted'?'border-orange-300 bg-orange-50':'border-gray-100 bg-white'}`}><p className="text-xs font-bold text-gray-500">Uncommitted</p><p className="text-xl font-black mt-1">{counts.uncommitted}</p><p className="text-[10px] text-gray-400">Awaiting release</p></button><button onClick={()=>setActiveTab('committed')} className={`rounded-2xl border p-3 text-left ${activeTab==='committed'?'border-blue-300 bg-blue-50':'border-gray-100 bg-white'}`}><p className="text-xs font-bold text-gray-500">Committed</p><p className="text-xl font-black mt-1">{counts.committed}</p><p className="text-[10px] text-gray-400">Released to source</p></button><button onClick={()=>setActiveTab('purchased')} className={`rounded-2xl border p-3 text-left ${activeTab==='purchased'?'border-green-300 bg-green-50':'border-gray-100 bg-white'}`}><p className="text-xs font-bold text-gray-500">Bought</p><p className="text-xl font-black mt-1">{counts.purchased}</p><p className="text-[10px] text-gray-400">Purchased in China</p></button></div>
        {visible.length===0?<div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><ShoppingBag className="w-8 h-8 text-gray-300 mx-auto"/><p className="font-bold mt-3">No {activeTab==='purchased'?'bought':activeTab} products</p><p className="text-sm text-gray-500 mt-1">{activeTab==='uncommitted'?'Paid products will appear here until someone commits them to sourcing.':activeTab==='committed'?'Committed products will stay here until they are marked bought.':'Products marked bought are kept here as a permanent record.'}</p></div>:<div className="space-y-3">{visible.map(line=><div key={line.allocation_id} className="bg-white rounded-2xl border border-gray-100 p-4"><div className="flex gap-4"><div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">{line.product_image?<img src={line.product_image} alt="" className="w-full h-full object-cover"/>:<ImageOff className="w-6 h-6 text-gray-300"/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-sm">{line.product_name}</h2><p className="text-xs text-gray-500 mt-1">Customer: <span className="font-semibold text-gray-700">{line.customer_name}</span> · Order {line.order_code}</p>{line.variant_options&&Object.keys(line.variant_options).length>0&&<p className="text-xs text-gray-500 mt-1">{Object.entries(line.variant_options).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>}</div><div className="text-right"><p className="text-lg font-black">{Number(line.quantity).toLocaleString()}</p><p className="text-[10px] text-gray-400">units</p></div></div><div className="mt-3 flex flex-wrap items-center gap-2">{line.source_url&&<a href={line.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200"><ExternalLink className="w-3 h-3"/>Product source</a>}{activeTab==='uncommitted'&&<button disabled={busyId===line.allocation_id} onClick={()=>void changeStatus(line,'committed')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">{busyId===line.allocation_id?<Loader className="w-3 h-3 animate-spin"/>:<Check className="w-3 h-3"/>}Commit to sourcing</button>}{activeTab==='committed'&&<button disabled={busyId===line.allocation_id} onClick={()=>void changeStatus(line,'purchased')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold disabled:opacity-50">{busyId===line.allocation_id?<Loader className="w-3 h-3 animate-spin"/>:<ShoppingBag className="w-3 h-3"/>}Mark as bought</button>}{activeTab==='purchased'&&<span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold"><Check className="w-3 h-3"/>Purchased</span>}</div></div></div></div>)}</div>}
        <p className="text-center text-[10px] text-gray-400 mt-6">Only paid customer quantities are released into this sourcing workflow.</p>
      </>}
    </main>
  </div>
}
