// src/pages/legal/ImportTrackingPage.tsx — actually lives with recommendations
// but kept import-free of auth; standalone public page (spec Section 6).
// Route: /track. Customer pastes an order code, sees a premium vertical
// progress tracker with a countdown once shipped. CSS-only animations
// (no heavy libraries) since the spec explicitly flags animation weight
// on slow mobile connections as a bottleneck risk.
//
// Batch 3: layout refresh, itemized per-item shipping/delivery estimates,
// explicit Sea 60–90 / Air 20–30 day windows, and distinct milestone colors
// per stage instead of a single orange throughout.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, Search, Loader, CheckCircle2, Warehouse, PlaneTakeoff,
  AlertCircle, Plane, Ship, Store, Home, MapPin, ClipboardCheck, ShoppingCart,
  ShieldCheck, PackageCheck,
} from 'lucide-react';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const FULFILLMENT_TRACKING_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-fulfillment-tracking`;

interface TrackedItem {
  id: string; name: string; quantity: number; image_url?: string;
  shipping_method?: 'flight' | 'sea_freight';
  variant_options?: Record<string, string>;
}
interface TrackedFulfillmentItem {
  id: string; product_name: string; image_url?: string | null; variant_options?: Record<string, string> | null;
  ordered_quantity: number; received_quantity: number; allocated_quantity: number; shipped_quantity: number; delivered_quantity: number; status: string;
}
interface TrackedShipment {
  id: string; shipment_code: string; status: string; delivery_mode?: string | null; carrier_name?: string | null;
  tracking_number?: string | null; tracking_url?: string | null; waybill_url?: string | null;
  shipped_at?: string | null; delivered_at?: string | null; created_at: string; notes?: string | null;
  items: Array<{ fulfillment_item_id: string; quantity: number; product_name: string; image_url?: string | null; variant_options?: Record<string, string> | null }>;
  events: Array<{ event_type: string; status?: string | null; location?: string | null; note?: string | null; created_at: string }>;
}
interface TrackedOrder {
  id: string; code: string; status: string;
  shipping_method: 'flight' | 'sea_freight' | 'mixed' | null;
  shipped_at: string | null; received_at?: string | null; created_at: string;
  consolidation_billed?: boolean; consolidation_bill_status?: string | null;
  items?: TrackedItem[];
  delivery_mode?: 'home' | 'pickup_station';
  pickup_station_name?: string | null;
  pickup_station_address?: string | null;
  fulfillment_items?: TrackedFulfillmentItem[];
  shipments?: TrackedShipment[];
}

const STAGES = [
  { key: 'pending', label: 'Order Received', description: 'Your order has been received and is being processed.', icon: CheckCircle2, color: 'sky' },
  { key: 'confirmed', label: 'Order Confirmed', description: 'Your payment/order details have been confirmed.', icon: ClipboardCheck, color: 'blue' },
  { key: 'ordered', label: 'Order Placed', description: 'Your items have been placed with the supplier.', icon: ShoppingCart, color: 'violet' },
  { key: 'ordered_and_closed', label: 'At Consolidation Warehouse', description: 'Your consolidation & shipping bill has been raised and your order is at the warehouse stage.', icon: Warehouse, color: 'amber' },
  { key: 'shipped_and_closed', label: 'Shipped to Nigeria', description: 'Your shipment has left the consolidation warehouse and is on its way to Nigeria.', icon: PlaneTakeoff, color: 'emerald' },
  { key: 'clearance_and_closed', label: 'Received at QAfrica HQ', description: 'Your shipment has arrived at QAfrica HQ in Nigeria and is being prepared for final delivery or pickup.', icon: ShieldCheck, color: 'orange' },
  { key: 'received', label: 'Delivered', description: 'Your order has been delivered successfully.', icon: PackageCheck, color: 'teal' },
] as const;

const STAGE_CLASSES: Record<string, { dot: string; ring: string; line: string; text: string }> = {
  sky: { dot: 'bg-sky-500 border-sky-500', ring: 'ring-sky-100', line: 'bg-sky-500', text: 'text-sky-600' },
  blue: { dot: 'bg-blue-500 border-blue-500', ring: 'ring-blue-100', line: 'bg-blue-500', text: 'text-blue-600' },
  violet: { dot: 'bg-violet-500 border-violet-500', ring: 'ring-violet-100', line: 'bg-violet-500', text: 'text-violet-600' },
  amber: { dot: 'bg-amber-500 border-amber-500', ring: 'ring-amber-100', line: 'bg-amber-500', text: 'text-amber-600' },
  emerald: { dot: 'bg-emerald-500 border-emerald-500', ring: 'ring-emerald-100', line: 'bg-emerald-500', text: 'text-emerald-600' },
  orange: { dot: 'bg-orange-500 border-orange-500', ring: 'ring-orange-100', line: 'bg-orange-500', text: 'text-orange-600' },
  teal: { dot: 'bg-teal-500 border-teal-500', ring: 'ring-teal-100', line: 'bg-teal-500', text: 'text-teal-600' },
};

// A received_at timestamp means the parcel reached QAfrica HQ; it is NOT a
// delivery confirmation. Delivery is represented by the explicit `received`
// order status (or delivered quantities on the fulfillment items).
function stageIndexFor(order: TrackedOrder): number {
  if (order.status === 'received') return 6;
  if (order.status === 'clearance_and_closed' || order.received_at) return 5;
  if (order.status === 'shipped_and_closed' || order.status === 'to_review' || order.shipped_at) return 4;
  if (order.consolidation_billed || order.status === 'ordered_and_closed' || order.status === 'billed') return 3;
  if (order.status === 'ordered') return 2;
  if (order.status === 'confirmed') return 1;
  return 0;
}

function fulfillmentStatusStyle(item: TrackedFulfillmentItem) {
  if (item.delivered_quantity >= item.ordered_quantity) {
    return { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }
  if (item.delivered_quantity > 0) {
    return { label: 'Partially delivered', className: 'bg-teal-50 text-teal-700 border-teal-100' };
  }
  // Receipt at HQ must take priority over allocation/shipping because an item
  // can be allocated to a shipment while it is still physically at HQ.
  if (item.received_quantity >= item.ordered_quantity && item.ordered_quantity > 0) {
    return { label: 'Received at QAfrica HQ', className: 'bg-orange-50 text-orange-700 border-orange-100' };
  }
  if (item.received_quantity > 0) {
    return { label: 'Partially received at QAfrica HQ', className: 'bg-orange-50 text-orange-700 border-orange-100' };
  }
  if (item.shipped_quantity > 0) {
    return { label: 'Shipped', className: 'bg-violet-50 text-violet-700 border-violet-100' };
  }
  if (item.allocated_quantity > 0) {
    return { label: 'Preparing shipment', className: 'bg-blue-50 text-blue-700 border-blue-100' };
  }
  return { label: 'Awaiting arrival', className: 'bg-amber-50 text-amber-700 border-amber-100' };
}

function shipmentStatusStyle(status: string) {
  switch (status) {
    case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'out_for_delivery': return 'bg-teal-50 text-teal-700 border-teal-100';
    case 'in_transit': return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'shipped': return 'bg-violet-50 text-violet-700 border-violet-100';
    case 'ready_to_ship': return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'cancelled': return 'bg-red-50 text-red-700 border-red-100';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

const WINDOWS: Record<'flight' | 'sea_freight', { min: number; max: number; fastestSeen: number }> = {
  flight: { min: 20, max: 30, fastestSeen: 10 },
  sea_freight: { min: 60, max: 90, fastestSeen: 45 },
};

function CountdownWindow({ shippedAt, method, compact }: { shippedAt: string; method: 'flight' | 'sea_freight'; compact?: boolean }) {
  const elapsed = daysSince(shippedAt);
  const { min, max, fastestSeen } = WINDOWS[method];
  const remainingLow = Math.max(min - elapsed, 0);
  const remainingHigh = Math.max(max - elapsed, 0);

  if (compact) {
    return (
      <p className="text-[11px] text-gray-500">
        {remainingHigh === 0 ? 'Any day now' : `Est. ${remainingLow}–${remainingHigh} days left`}
        <span className="text-gray-300"> · {min}–{max} day window</span>
      </p>
    );
  }

  return (
    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
      <p className="text-[11px] font-bold text-orange-500 uppercase tracking-widest mb-1">Estimated arrival</p>
      <p className="text-2xl font-black text-gray-900">
        {remainingHigh === 0 ? 'Any day now' : `${remainingLow}–${remainingHigh} days`}
      </p>
      <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
        {method === 'flight' ? 'Air freight' : 'Sea freight'} runs a {min}–{max} day window from ship date —
        not a fixed promise, some shipments have arrived in as little as ~{fastestSeen} days.
      </p>
    </div>
  );
}

function TransportAnimation({ method, active }: { method: 'flight' | 'sea_freight'; active: boolean }) {
  return (
    <div className="relative h-16 overflow-hidden">
      <style>{`\n        @keyframes qtrack-fly { 0%{transform:translateX(-10%) translateY(0);} 50%{transform:translateX(50%) translateY(-6px);} 100%{transform:translateX(110%) translateY(0);} }\n        @keyframes qtrack-sail { 0%{transform:translateX(-10%);} 100%{transform:translateX(110%);} }\n        @keyframes qtrack-bob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-3px);} }\n        .qtrack-plane { animation: qtrack-fly 5s ease-in-out infinite; }\n        .qtrack-ship { animation: qtrack-sail 7s linear infinite, qtrack-bob 1.8s ease-in-out infinite; }\n        @media (prefers-reduced-motion: reduce) { .qtrack-plane, .qtrack-ship { animation: none; } }\n      `}</style>
      {method === 'flight' ? (
        <>
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-sky-200" />
          <div className={`absolute top-1/2 -translate-y-1/2 text-3xl ${active ? 'qtrack-plane' : ''}`}>✈️</div>
        </>
      ) : (
        <>
          <div className="absolute inset-x-0 bottom-3 h-1 bg-indigo-100 rounded-full" />
          <div className={`absolute bottom-1 text-3xl ${active ? 'qtrack-ship' : ''}`}>🚢</div>
        </>
      )}
    </div>
  );
}

function ItemRow({ item, fallbackMethod, shippedAt }: { item: TrackedItem; fallbackMethod: 'flight' | 'sea_freight' | null; shippedAt: string | null }) {
  const method = item.shipping_method ?? fallbackMethod;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-b-0">
      {item.image_url && (
        <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{item.name} × {item.quantity}</p>
        {item.variant_options && Object.keys(item.variant_options).length > 0 && (
          <p className="text-[10px] text-gray-400 truncate">{Object.values(item.variant_options).join(', ')}</p>
        )}
        {shippedAt && method && <CountdownWindow shippedAt={shippedAt} method={method} compact />}
      </div>
      {method && (
        <span className={`flex items-center gap-1 flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${method === 'flight' ? 'bg-sky-50 text-sky-600' : 'bg-indigo-50 text-indigo-600'}`}>
          {method === 'flight' ? <Plane className="w-3 h-3" /> : <Ship className="w-3 h-3" />}
          {method === 'flight' ? 'Air' : 'Sea'}
        </span>
      )}
    </div>
  );
}

export default function ImportTrackingPage() {
  const [code, setCode] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const stageIdx = order ? stageIndexFor(order) : -1;
  const isMixed = order?.shipping_method === 'mixed';
  const singleMethod = order && !isMixed ? (order.shipping_method as 'flight' | 'sea_freight' | null) : null;

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await fetch(FULFILLMENT_TRACKING_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not find that order.'); return; }
      setOrder(data.order);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ... rest of the existing component remains unchanged ...
