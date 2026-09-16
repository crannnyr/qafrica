// src/pages/import-admin/AdminOrderReceiptSheet.tsx
import { X, Printer } from 'lucide-react';

interface PackingSlipItem {
  name: string;
  quantity: number;
  price_ngn?: number;
  variant_options?: Record<string, string> | null;
}

interface PackingSlipOrder {
  code: string;
  created_at: string;
  customer_name: string;
  customer_whatsapp?: string;
  items: PackingSlipItem[];
  total_ngn?: number;
  delivery_type?: 'to_qafrica' | 'to_me';
  delivery_address?: {
    name: string; phone: string; address_line1: string; address_line2?: string;
    city: string; state: string; landmark?: string;
  } | null;
  shipping_method?: 'flight' | 'sea_freight' | null;
}

function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

function qrCodeUrl(text: string, size = 110) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

// One printable copy — rendered twice (customer / QAFRICA). The label is a
// large diagonal watermark behind the content (like a Remita receipt or a
// JAMB admission letter), not a visible badge.
function SlipCopy({ order, label }: { order: PackingSlipOrder; label: string }) {
  return (
    <div className="relative flex-1 px-5 py-4 flex flex-col overflow-hidden">
      {/* Watermark — bold, light gray, diagonal, sits behind everything */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
      >
        <span
          className="text-gray-100 font-black uppercase whitespace-nowrap"
          style={{ fontSize: '3.2rem', transform: 'rotate(-35deg)', letterSpacing: '0.05em' }}
        >
          {label}
        </span>
      </div>

      {/* Content sits above the watermark */}
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-black text-gray-900 text-base leading-none">QAFRICA</p>
            <p className="text-[9px] text-gray-400 mt-1">Packing slip</p>
          </div>
          <img src={qrCodeUrl(`https://qafrica.store/importations/admin?load_code=${order.code}`)} alt={`QR code for ${order.code}`} className="w-16 h-16 flex-shrink-0" />
        </div>

        <div className="text-center mb-3">
          <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-0.5">Order code</p>
          <p className="font-mono font-black text-gray-900 text-lg tracking-widest">{order.code}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 text-[10px]">
          <div>
            <p className="text-gray-400">Customer</p>
            <p className="font-semibold text-gray-800">{order.customer_name}</p>
            {order.customer_whatsapp && <p className="text-gray-500">{order.customer_whatsapp}</p>}
          </div>
          <div className="text-right">
            <p className="text-gray-400">Date</p>
            <p className="font-semibold text-gray-800">{new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            {order.shipping_method && (
              <p className="text-gray-500 capitalize">{order.shipping_method === 'flight' ? 'Air freight' : 'Sea freight'}</p>
            )}
          </div>
        </div>

        {order.delivery_address && (
          <div className="bg-white/70 rounded-lg p-2 mb-3 text-[10px] border border-gray-100">
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Deliver to</p>
            <p className="font-semibold text-gray-800">{order.delivery_address.name} · {order.delivery_address.phone}</p>
            <p className="text-gray-600">
              {order.delivery_address.address_line1}
              {order.delivery_address.address_line2 ? `, ${order.delivery_address.address_line2}` : ''}
            </p>
            <p className="text-gray-600">{order.delivery_address.city}, {order.delivery_address.state}</p>
          </div>
        )}

        <table className="w-full text-[10px] border-collapse mb-2">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left font-bold text-gray-500 uppercase tracking-wide text-[8px] py-1 pr-1">Item</th>
              <th className="text-center font-bold text-gray-500 uppercase tracking-wide text-[8px] py-1 px-1 w-8">Qty</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1 pr-1 align-top">
                  <p className="text-gray-800">{item.name}</p>
                  {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                    <p className="text-[8px] text-gray-400">{Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                  )}
                </td>
                <td className="py-1 px-1 text-center align-top font-semibold text-gray-800">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {typeof order.total_ngn === 'number' && (
          <p className="text-right text-xs font-bold text-gray-900 mb-1">Total: <span className="text-orange-500">{fmt(order.total_ngn)}</span></p>
        )}

        <p className="text-center text-[8px] text-gray-300 mt-1">Scan to verify at dispatch.</p>
      </div>
    </div>
  );
}

export default function AdminOrderReceiptSheet({ order, onClose }: { order: PackingSlipOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center sm:p-4 print:bg-white print:p-0 print:block">
      {/* On-screen chrome — hidden entirely when printing */}
      <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col print:hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Packing slip</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Prints as two copies side by side — cut down the middle after printing.</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => window.print()} className="p-1.5 hover:bg-gray-100 rounded-lg flex items-center gap-1 text-xs font-semibold text-gray-600">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          <div className="border border-gray-200 rounded-xl flex divide-x divide-dashed divide-gray-300">
            <SlipCopy order={order} label="Customer copy" />
            <SlipCopy order={order} label="QAFRICA copy" />
          </div>
        </div>
      </div>

      {/* Print-only layout — two copies filling an A4 landscape page with a
          dashed cut guide down the middle. Hidden on screen. */}
      <div className="hidden print:flex print:w-full print:h-full">
        <div className="flex-1 flex flex-col justify-center border-r-2 border-dashed border-gray-400">
          <SlipCopy order={order} label="Customer copy" />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <SlipCopy order={order} label="QAFRICA copy" />
        </div>
      </div>

      {/* Forces landscape A4 for this print job specifically. */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}
