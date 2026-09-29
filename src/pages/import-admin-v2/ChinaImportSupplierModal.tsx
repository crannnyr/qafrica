import { useState } from 'react'
import { X } from 'lucide-react'

type Props = { open:boolean; title:string; description?:string; initialValue?:string; busy?:boolean; onClose:()=>void; onSubmit:(value:string)=>void }

export default function ChinaImportSupplierModal({open,title,description,initialValue='',busy=false,onClose,onSubmit}:Props){
  const [value,setValue]=useState(initialValue)
  if(!open)return null
  const submit=()=>{const name=value.trim();if(name)onSubmit(name)}
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)onClose()}}>
    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4"><div><h2 className="text-base font-black text-gray-900">{title}</h2>{description&&<p className="text-xs text-gray-500 mt-1">{description}</p>}</div><button type="button" onClick={onClose} disabled={busy} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4"/></button></div>
      <div className="p-5"><label className="block text-xs font-bold text-gray-700 mb-2">Supplier name</label><input autoFocus value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')submit();if(e.key==='Escape'&&!busy)onClose()}} placeholder="e.g. Guangzhou ABC Trading" className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button><button type="button" onClick={submit} disabled={busy||!value.trim()} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">{busy?'Saving…':'Continue'}</button></div></div>
    </div>
  </div>
}
