import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, ImageOff, Loader, Package, RefreshCw, ShoppingBag, Users } from 'lucide-react'
import CONFIG from '@/lib/config'

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-sourcing-share`
type Status = 'uncommitted' | 'committed' | 'purchased'
type Line = { allocation_id:string; customer_id:string; customer_name:string; order_id:string; order_code:string; product_id:string; product_name:string; product_image:string|null; source_url:string|null; variant_options:Record<string,string>|null; quantity:number; status:Status; created_at:string; updated_at:string }
type ProductGroup = { key:string; name:string; image:string|null; productId:string; sourceUrl:string|null; quantity:number; lines:Line[] }

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
      const res=await fetch(`${EDGE_URL}?token=${encodeURIComponent(token)}`)
      const data=await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(data?.error||'Could not load sourcing workflow.')
      setLines(Array.isArray(data.rows)?data.rows:[])
      setBatchDate(data.batch_key||'')
    }catch(e){setError(e instanceof Error?e.message:'Could not load sourcing workflow.')}finally{setLoading(false)}
  },[token])

  useEffect(()=>{void load()},[load])

  const changeStatus=async(line:Line,next:Status)=>{
    setBusyId(line.allocation_id);setError('')
    try{
      await post(next==='committed'?'commit-sourcing':'mark-sourcing-bought',{allocation_id:line.allocation_id})
      setLines(current=>current.map(x=>x.allocation_id===line.allocation_id?{...x,status:next}:x))
    }catch(e){setError(e instanceof Error?e.message:'Could not update this sourcing line.')}finally{setBusyId(null)}
  }

  const counts=useMemo(()=>({uncommitted:lines.filter(x=>x.status==='uncommitted').length,committed:lines.filter(x=>x.status==='committed').length,purchased:lines.filter(x=>x.status==='purchased').length}),[lines])
  const visible=useMemo(()=>lines.filter(x=>x.status===activeTab),[lines,activeTab])
  const groups=useMemo<ProductGroup[]>(()=>{
    const map=new Map<string,ProductGroup>()
    for(const line of visible){
      const key=line.product_name.trim().toLocaleLowerCase()
      const existing=map.get(key)
      if(existing){existing.quantity+=Number(line.quantity||0);existing.lines.push(line)}
      else map.set(key,{key,name:line.product_name,image:line.product_image,productId:line.product_id,sourceUrl:line.product_id?`/recommendations/${line.product_id}`:line.source_url,quantity:Number(line.quantity||0),lines:[line]})
    }
    return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name))
  },[visible])
  const qty=visible.reduce((n,x)=>n+Number(x.quantity||0),0)

  return <div className="min-h-screen bg-gray-50 text-gray-900">
    <header className="sticky top-0 z-50 bg-gray-900 text-white shadow-md"><div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center"><Package className="w-5 h-5"/></div><div><h1 className="text-lg font-black">QAfrica Sourcing</h1><p className="text-xs text-gray-300">Commit products before buying them in China</p></div></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>Refresh</button></div></header>
    <main className="max-w-5xl mx-auto px-4 py-6 pb-12">{loading?<div className="py-20 flex justify-center"><Loader className="w-6 h-6 animate-spin text-gray-400"/></div>:error?<div className="bg-white rounded-2xl border border-red-100 p-8 text-center"><p className="font-bold">Sourcing workflow unavailable</p><p className="text-sm text-gray-500 mt-2">{error}</p><button onClick={()=>void load()} className="mt-4 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold">Try again</button></div>:<><div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Batch</p><p className="text-sm font-bold">{batchDate?new Date(batchDate).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Closed batch'}</p></div><div className="text-right"><p className="text-xs text-gray-500">{groups.length} product groups · {visible.length} sourcing lines</p><p className="text-sm font-black text-orange-600">{qty.toLocaleString()} units</p></div></div>
    <div className="grid grid-cols-3 gap-2 mb-5"><button onClick={()=>setActiveTab('uncommitted')} className={`rounded-2xl border p-3 text-left ${activeTab==='uncommitted'?'border-orange-300 bg-orange-50':'border-gray-100 bg-white'}`}><p className="text-xs font-bold text-gray-500">Uncommitted</p><p className="text-xl font-black mt-1">{counts.uncommitted}</p><p className="text-[10px] text-gray-400">Awaiting release</p></button><button onClick={()=>setActiveTab('committed')} className={`rounded-2xl border p-3 text-left ${activeTab==='committed'?'border-blue-300 bg-blue-50':'border-gray-100 bg-white'}`}><p className="text-xs font-bold text-gray-500">Committed</p><p className="text-xl font-black mt-1">{counts.committed}</p><p className="text-[10px] text-gray-400">Released to source</p></button><button onClick={()=>setActiveTab('purchased')} className={`rounded-2xl border p-3 text-left ${activeTab==='purchased'?'border-green-300 bg-green-50':'border-gray-100 bg-white'}`}><p className="text-xs font-bold text-gray-500">Bought</p><p className="text-xl font-black mt-1">{counts.purchased}</p><p className="text-[10px] text-gray-400">Purchased in China</p></button></div>
    {groups.length===0?<div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><ShoppingBag className="w-8 h-8 text-gray-300 mx-auto"/><p className="font-bold mt-3">No {activeTab==='purchased'?'bought':activeTab} products</p><p className="text-sm text-gray-500 mt-1">{activeTab==='uncommitted'?'Paid products will appear here until someone commits them to sourcing.':activeTab==='committed'?'Committed products will stay here until they are marked bought.':'Products marked bought are kept here as a permanent record.'}</p></div>:<div className="space-y-4">{groups.map(group=><div key={group.key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="p-4 flex gap-4 bg-gray-50/70 border-b border-gray-100"><div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">{group.image?<img src={group.image} alt="" className="w-full h-full object-cover"/>:<ImageOff className="w-6 h-6 text-gray-300"/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-sm">{group.name}</h2><p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Users className="w-3 h-3"/>{group.lines.length} customer order{group.lines.length===1?'':'s'}</p></div><div className="text-right"><p className="text-xl font-black">{group.quantity.toLocaleString()}</p><p className="text-[10px] text-gray-400">total units</p></div></div>{group.sourceUrl&&<a href={group.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100"><ExternalLink className="w-3 h-3"/>Open product</a>}</div></div><div className="divide-y divide-gray-100">{group.lines.map(line=><div key={line.allocation_id} className="p-4 flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold text-gray-800">{line.customer_name}</p><p className="text-[11px] text-gray-500 mt-1">Order {line.order_code} · <span className="font-bold text-gray-700">{Number(line.quantity).toLocaleString()} units</span></p>{line.variant_options&&Object.keys(line.variant_options).length>0&&<p className="text-[11px] text-gray-500 mt-1">{Object.entries(line.variant_options).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>}</div>{activeTab==='uncommitted'&&<button disabled={busyId===line.allocation_id} onClick={()=>void changeStatus(line,'committed')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">{busyId===line.allocation_id?<Loader className="w-3 h-3 animate-spin"/>:<Check className="w-3 h-3"/>}Commit</button>}{activeTab==='committed'&&<button disabled={busyId===line.allocation_id} onClick={()=>void changeStatus(line,'purchased')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold disabled:opacity-50">{busyId===line.allocation_id?<Loader className="w-3 h-3 animate-spin"/>:<ShoppingBag className="w-3 h-3"/>}Mark bought</button>}{activeTab==='purchased'&&<span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-bold"><Check className="w-3 h-3"/>Bought</span>}</div>)}</div></div>)}</div>}
    <p className="text-center text-[10px] text-gray-400 mt-6">Products with the same name are grouped together. Customer quantities remain separate so nothing is lost.</p></>}</main></div>
}
