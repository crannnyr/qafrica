import { X, Printer } from 'lucide-react';

export type ShipmentReceiptData = {
  shipment_code: string;
  status: string;
  created_at: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  carrier_name?: string | null;
  tracking_number?: string | null;
  delivery_mode?: string | null;
  notes?: string | null;
  order_code: string;
  customer_name: string;
  customer_whatsapp?: string | null;
  delivery_address?: Record<string, unknown> | null;
  items: Array<{ product_name: string; quantity: number; variant_options?: Record<string, unknown> | null }>;
};

const variants=(v:Record<string,unknown>|null|undefined)=>v?Object.entries(v).filter(([,x])=>x!==null&&x!==undefined&&String(x).trim()).map(([k,x])=>k+': '+String(x)).join(', '):'';
const qr=(code:string)=>'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data='+encodeURIComponent('https://qafrica.store/track?code='+code);

function Copy({data,label}:{data:ShipmentReceiptData;label:string}) {
  return <div className="relative flex-1 px-5 py-4 overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"><span className="text-gray-100 font-black uppercase whitespace-nowrap" style={{fontSize:'3rem',transform:'rotate(-35deg)',letterSpacing:'0.05em'}}>{label}</span></div>
    <div className="relative">
      <div className="flex items-start justify-between mb-3"><div><p className="font-black text-gray-900 text-base leading-none">QAFRICA</p><p className="text-[9px] text-gray-400 mt-1">Shipment receipt</p></div><img src={qr(data.order_code)} alt="Shipment verification QR" className="w-16 h-16"/></div>
      <div className="text-center mb-3"><p className="text-[8px] text-gray-400 uppercase tracking-widest">Shipment code</p><p className="font-mono font-black text-gray-900 text-lg tracking-widest">{data.shipment_code}</p><p className="text-[9px] text-gray-400 mt-1">Order {data.order_code}</p></div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-[10px]"><div><p className="text-gray-400">Customer</p><p className="font-semibold text-gray-800">{data.customer_name}</p>{data.customer_whatsapp&&<p className="text-gray-500">{data.customer_whatsapp}</p>}</div><div className="text-right"><p className="text-gray-400">Status</p><p className="font-semibold text-gray-800 capitalize">{data.status.replaceAll('_',' ')}</p><p className="text-gray-500">{new Date(data.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</p></div></div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-[10px]"><div><p className="text-gray-400">Carrier</p><p className="font-semibold text-gray-800">{data.carrier_name||'QAfrica'}</p>{data.tracking_number&&<p className="text-gray-500">Tracking: {data.tracking_number}</p>}</div><div className="text-right"><p className="text-gray-400">Delivery</p><p className="font-semibold text-gray-800 capitalize">{(data.delivery_mode||'—').replaceAll('_',' ')}</p>{data.shipped_at&&<p className="text-gray-500">Shipped {new Date(data.shipped_at).toLocaleDateString('en-NG')}</p>}</div></div>
      {data.delivery_address&&<div className="bg-white/70 rounded-lg p-2 mb-3 text-[10px] border border-gray-100"><p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Delivery address</p><p className="text-gray-700">{Object.values(data.delivery_address).filter(x=>typeof x==='string'&&x.trim()).join(', ')}</p></div>}
      <table className="w-full text-[10px] border-collapse mb-2"><thead><tr className="border-b-2 border-gray-200"><th className="text-left font-bold text-gray-500 uppercase tracking-wide text-[8px] py-1">Item</th><th className="text-center font-bold text-gray-500 uppercase tracking-wide text-[8px] py-1 w-8">Qty</th></tr></thead><tbody>{data.items.map((item,i)=><tr key={i} className="border-b border-gray-100"><td className="py-1 pr-1"><p className="text-gray-800">{item.product_name}</p>{variants(item.variant_options)&&<p className="text-[8px] text-gray-400">{variants(item.variant_options)}</p>}</td><td className="py-1 text-center font-semibold text-gray-800">{item.quantity}</td></tr>)}</tbody></table>
      {data.notes&&<p className="text-[9px] text-gray-500 mt-2">Note: {data.notes}</p>}{data.delivered_at&&<p className="text-[9px] text-emerald-600 font-semibold mt-2">Delivered {new Date(data.delivered_at).toLocaleString('en-NG')}</p>}<p className="text-center text-[8px] text-gray-300 mt-2">Scan the QR code to track the order.</p>
    </div>
  </div>;
}

export default function ShipmentReceiptSheet({data,onClose}:{data:ShipmentReceiptData;onClose:()=>void}) {
  return <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center sm:p-4 print:bg-white print:p-0 print:block">
    <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col print:hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"><div><h2 className="font-bold text-gray-900 text-sm">Shipment receipt</h2><p className="text-[11px] text-gray-400 mt-0.5">Customer and QAFRICA copies.</p></div><div className="flex items-center gap-1"><button onClick={()=>window.print()} className="p-1.5 hover:bg-gray-100 rounded-lg flex items-center gap-1 text-xs font-semibold text-gray-600"><Printer className="w-4 h-4"/> Print</button><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500"/></button></div></div>
      <div className="overflow-y-auto p-4"><div className="border border-gray-200 rounded-xl flex divide-x divide-dashed divide-gray-300"><Copy data={data} label="Customer copy"/><Copy data={data} label="QAFRICA copy"/></div></div>
    </div>
    <div className="hidden print:flex print:w-full print:h-full"><div className="flex-1 flex flex-col justify-center border-r-2 border-dashed border-gray-400"><Copy data={data} label="Customer copy"/></div><div className="flex-1 flex flex-col justify-center"><Copy data={data} label="QAFRICA copy"/></div></div>
    <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>
  </div>;
}
