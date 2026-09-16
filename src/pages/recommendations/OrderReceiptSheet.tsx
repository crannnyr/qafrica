// src/pages/recommendations/OrderReceiptSheet.tsx
import { X, Printer } from 'lucide-react';

interface ReceiptItem {
  id: string;
  name: string;
  price_ngn: number;
  quantity: number;
  image_url?: string;
  variant_options?: Record<string, string> | null;
}

interface ReceiptOrder {
  code: string;
  created_at: string;
  items: ReceiptItem[];
  subtotal_ngn: number;
  jumia_fee_ngn?: number;
  prepaid_shipping_ngn?: number | null;
  total_ngn: number;
  payment_status: string;
  payment_method?: string | null;
  customer_name: string;
}

function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

export default function OrderReceiptSheet({ order, onClose }: { order: ReceiptOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 print:hidden">
          <h2 className="font-bold text-gray-900 text-sm">Receipt</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => window.print()} className="p-1.5 hover:bg-gray-100 rounded-lg flex items-center gap-1 text-xs font-semibold text-gray-600">
              <Printer className="w-4 h-4" /> Save / Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-6" id="receipt-printable">
          <div className="text-center mb-5">
            <p className="font-black text-gray-900 text-lg">QAFRICA</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Order receipt</p>
          </div>

          <div className="flex justify-between text-xs mb-4">
            <div>
              <p className="text-gray-400">Order code</p>
              <p className="font-mono font-bold text-gray-800">{order.code}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400">Date</p>
              <p className="font-semibold text-gray-800">{new Date(order.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-4">Billed to: <span className="font-semibold text-gray-800">{order.customer_name}</span></p>

          <table className="w-full text-xs border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left font-bold text-gray-500 uppercase tracking-wide text-[10px] py-2 pr-2 w-9"></th>
                <th className="text-left font-bold text-gray-500 uppercase tracking-wide text-[10px] py-2 pr-2">Item</th>
                <th className="text-center font-bold text-gray-500 uppercase tracking-wide text-[10px] py-2 px-2 w-10">Qty</th>
                <th className="text-right font-bold text-gray-500 uppercase tracking-wide text-[10px] py-2 px-2">Unit price</th>
                <th className="text-right font-bold text-gray-500 uppercase tracking-wide text-[10px] py-2 pl-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-2 align-top">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-gray-100" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100" />
                    )}
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <p className="text-gray-800">{item.name}</p>
                    {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                      <p className="text-[10px] text-gray-400">{Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center align-top text-gray-600">{item.quantity}</td>
                  <td className="py-2 px-2 text-right align-top text-gray-600">{fmt(item.price_ngn)}</td>
                  <td className="py-2 pl-2 text-right align-top font-semibold text-gray-800">{fmt(item.price_ngn * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="w-full text-xs mb-4">
            <tbody>
              <tr>
                <td className="py-0.5 text-gray-500">Subtotal</td>
                <td className="py-0.5 text-right text-gray-700">{fmt(order.subtotal_ngn)}</td>
              </tr>
              {!!order.jumia_fee_ngn && (
                <tr>
                  <td className="py-0.5 text-gray-500">Jumia fee</td>
                  <td className="py-0.5 text-right text-gray-700">{fmt(order.jumia_fee_ngn)}</td>
                </tr>
              )}
              {!!order.prepaid_shipping_ngn && (
                <tr>
                  <td className="py-0.5 text-gray-500">Shipping</td>
                  <td className="py-0.5 text-right text-gray-700">{fmt(order.prepaid_shipping_ngn)}</td>
                </tr>
              )}
              <tr className="border-t border-gray-200">
                <td className="pt-1.5 font-bold text-gray-900">Total</td>
                <td className="pt-1.5 text-right font-bold text-orange-500">{fmt(order.total_ngn)}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-center text-[11px] text-gray-400">
            Payment: <span className="font-semibold text-gray-600 capitalize">{order.payment_status}</span>
            {order.payment_method && <> · {order.payment_method}</>}
          </div>
        </div>
      </div>
    </div>
  );
}
