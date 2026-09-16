// src/pages/import-admin/AdminOrderReceiptSheet.tsx
// Warehouse packing slip — printed and dropped inside the package. No
// product photos (staff don't need them here); carries a scannable QR
// code encoding the order code, same idea as a Jumia shipping label, so
// the order can be scanned/verified against a manifest at dispatch.
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

// Public QR image endpoint — no key required, just a GET request that
// returns a PNG. Encodes the order code only (not customer data), so
// there's nothing sensitive riding on this being a third-party call.
function qrCodeUrl(text: string, size = 140) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

export default function AdminOrderReceiptSheet({ order, onClose }: { order: PackingSlipOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 print:hidden">
          <h2 className="font-bold text-gray-900 text-sm">Packing slip</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => window.print()} className="p-1.5 hover:bg-gray-100 rounded-lg flex items-center gap-1 text-xs font-semibold text-gray-600">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-6" id="admin-packing-slip-printable">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="font-black text-gray-900 text-lg">QAFRICA</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Packing slip</p>
            </div>
            <img src={qrCodeUrl(`https://qafrica.store/importations/admin?load_code=${order.code}`)} alt={`QR code for ${order.code}`} className="w-[90px] h-[90px] flex-shrink-0" />
            {/* <img src={qrCodeUrl(order.code)} alt={`QR code for ${order.code}`} className="w-[90px] h-[90px] flex-shrink-0" /> */}
          </div>

          <div className="text-center mb-5">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Order code</p>
            <p className="font-mono font-black text-gray-900 text-2xl tracking-widest">{order.code}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
            <div>
              <p className="text-gray-400">Customer</p>
              <p className="font-semibold text-gray-800">{order.customer_name}</p>
              {order.customer_whatsapp && <p className="text-gray-500 mt-0.5">{order.customer_whatsapp}</p>}
            </div>
            <div className="text-right">
              <p className="text-gray-400">Date</p>
              <p className="font-semibold text-gray-800">{new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              {order.shipping_method && (
                <p className="text-gray-500 mt-0.5 capitalize">{order.shipping_method === 'flight' ? 'Air freight' : order.shipping_method === 'sea_freight' ? 'Sea freight' : order.shipping_method}</p>
              )}
            </div>
          </div>

          {order.delivery_address && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Deliver to</p>
              <p className="font-semibold text-gray-800">{order.delivery_address.name} · {order.delivery_address.phone}</p>
              <p className="text-gray-600">
                {order.delivery_address.address_line1}
                {order.delivery_address.address_line2 ? `, ${order.delivery_address.address_line2}` : ''}
              </p>
              <p className="text-gray-600">{order.delivery_address.city}, {order.delivery_address.state}</p>
              {order.delivery_address.landmark && <p className="text-gray-400">Near: {order.delivery_address.landmark}</p>}
            </div>
          )}

          <table className="w-full text-xs border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left font-bold text-gray-500 uppercase tracking-wide text-[10px] py-2 pr-2">Item</th>
                <th className="text-center font-bold text-gray-500 uppercase tracking-wide text-[10px] py-2 px-2 w-10">Qty</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-2 align-top">
                    <p className="text-gray-800">{item.name}</p>
                    {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                      <p className="text-[10px] text-gray-400">{Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center align-top font-semibold text-gray-800">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {typeof order.total_ngn === 'number' && (
            <p className="text-right text-sm font-bold text-gray-900 mb-2">Total: <span className="text-orange-500">{fmt(order.total_ngn)}</span></p>
          )}

          <p className="text-center text-[10px] text-gray-300 mt-6">Scan the code above to verify this order at dispatch.</p>
        </div>
      </div>
    </div>
  );
}
