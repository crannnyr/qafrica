// src/pages/recommendations/TrackOrderModal.tsx
// Access flow for the public tracking page (spec Section 6.5): lists the
// customer's own orders and codes, lets them copy the one they want
// (deliberately no auto-copy — they may have several), then continues to
// the public tracking page where they paste it manually.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Copy, Check, Loader, Package } from 'lucide-react';
import CONFIG from '@/lib/config';
import { useCustomerAuthStore } from '@/stores';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface OrderRow { id: string; code: string; status: string; created_at: string; }

export default function TrackOrderModal({ onClose }: { onClose: () => void }) {
  const { customer } = useCustomerAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!customer?.id) { setIsLoading(false); return; }
    fetch(`${EDGE_URL}?action=my-orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id }),
    })
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setIsLoading(false));
  }, [customer?.id]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // clipboard API unavailable — selection still visible on screen
    }
    setCopiedCode(code);
    setSelectedCode(code);
    toast.success('Order code copied');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base">Track an order</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          <p className="text-xs text-gray-500 mb-3">
            Copy the order code you want to track, then continue — you'll paste it on the tracking page.
          </p>

          {isLoading ? (
            <div className="py-8 text-center"><Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-7 h-7 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">You don't have any orders yet.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {orders.map(o => (
                <button
                  key={o.id}
                  onClick={() => copyCode(o.code)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                    selectedCode === o.code ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <div>
                    <p className="font-mono font-bold text-sm text-gray-900 tracking-wider">{o.code}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{o.status.replace(/_/g, ' ')} · {new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  {copiedCode === o.code ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Copy className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          <button
            onClick={() => { onClose(); navigate('/track'); }}
            className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Continue to Tracking Page
          </button>
        </div>
      </div>
    </div>
  );
}
