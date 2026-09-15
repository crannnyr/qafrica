// src/pages/recommendations/OrderReceiptSheet.tsx
// Printable receipt for one order — used from both the customer dashboard
// and the admin order views. Pulls prices straight from the order's stored
// `items` array (the price at checkout time), never from live product data,
// so a later product price change never alters what a past receipt shows.
import { X, Printer } from 'lucide-react';

interface ReceiptItem {
  id: string;
  name: string;
  price_ngn: number;
  quantity: number;
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
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col">
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

          <div className="border-t border-b border-gray-100 py-3 mb-3 space-y-2.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-gray-800">{item.name}</p>
                  {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                    <p className="text-[10px] text-gray-400">{Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                  )}
                  <p className="text-[10px] text-gray-400">{fmt(item.price_ngn)} × {item.quantity}</p>
                </div>
                <p className="font-semibold text-gray-800 flex-shrink-0">{fmt(item.price_ngn * item.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-xs mb-4">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(order.subtotal_ngn)}</span></div>
            {!!order.jumia_fee_ngn && <div className="flex justify-between text-gray-500"><span>Jumia fee</span><span>{fmt(order.jumia_fee_ngn)}</span></div>}
            {!!order.prepaid_shipping_ngn && <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{fmt(order.prepaid_shipping_ngn)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100">
              <span>Total</span><span className="text-orange-500">{fmt(order.total_ngn)}</span>
            </div>
          </div>

          <div className="text-center text-[11px] text-gray-400">
            Payment: <span className="font-semibold text-gray-600 capitalize">{order.payment_status}</span>
            {order.payment_method && <> · {order.payment_method}</>}
          </div>
        </div>
      </div>
    </div>
  );
}
