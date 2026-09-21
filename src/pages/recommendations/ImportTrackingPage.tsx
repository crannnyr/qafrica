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

interface TrackedItem {
  id: string; name: string; quantity: number; image_url?: string;
  shipping_method?: 'flight' | 'sea_freight';
  variant_options?: Record<string, string>;
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
}

// Each stage carries its own color so the milestone bar reads as distinct
// steps rather than one continuous fill — spec asks for "distinct color
// coding across different progress stages along the timeline".
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

// Maps the real backend pipeline to the customer-facing tracking labels
// (spec 6.1). "billed" covers both consolidation and shipping bill stages
// internally (see Section 3 clarification) — both map to the same visible
// "At Consolidation Warehouse" stage until shipped_at is set, at which
// point status flips to to_review and the stage becomes "In Transit".
function stageIndexFor(order: TrackedOrder): number {
  if (order.received_at || order.status === 'received') return 6;
  if (order.status === 'clearance_and_closed') return 5;
  if (order.status === 'shipped_and_closed' || order.status === 'to_review' || order.shipped_at) return 4;
  if (order.consolidation_billed || order.status === 'ordered_and_closed' || order.status === 'billed') return 3;
  if (order.status === 'ordered') return 2;
  if (order.status === 'confirmed') return 1;
  return 0;
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

// Sea: 60–90 days. Air: 20–30 days. Countdown only ever renders once
// shipped_at is set (the trigger for the whole countdown), never before —
// callers gate on that, this just does the math.
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
      <style>{`
        @keyframes qtrack-fly { 0%{transform:translateX(-10%) translateY(0);} 50%{transform:translateX(50%) translateY(-6px);} 100%{transform:translateX(110%) translateY(0);} }
        @keyframes qtrack-sail { 0%{transform:translateX(-10%);} 100%{transform:translateX(110%);} }
        @keyframes qtrack-bob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-3px);} }
        .qtrack-plane { animation: qtrack-fly 5s ease-in-out infinite; }
        .qtrack-ship { animation: qtrack-sail 7s linear infinite, qtrack-bob 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .qtrack-plane, .qtrack-ship { animation: none; } }
      `}</style>
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

// One line per item: name/qty, its own shipping method badge, and (once
// shipped) its own remaining-days estimate. Falls back to the order-level
// shipping_method for items placed before per-item shipping existed.
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
      const res = await fetch(`${EDGE_URL}?action=track-order`, {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">QAFRICA Track</span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="font-black text-gray-900 text-xl mb-1">Track your order</h1>
        <p className="text-xs text-gray-400 mb-5">Enter your order code to see live status.</p>

        <form onSubmit={lookup} className="flex gap-2 mb-6">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. BVUXQ9"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 font-mono font-bold tracking-wider text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none uppercase"
            maxLength={6}
          />
          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="px-5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white rounded-xl transition-colors flex items-center justify-center"
          >
            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-6">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {order && (
          <div className="space-y-4">
            {/* Order header + milestone tracker */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Order</p>
                  <p className="font-mono font-black text-lg text-gray-900 tracking-wider">{order.code}</p>
                </div>
                {order.delivery_mode && (
                  <div className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1.5 text-[10px] font-bold text-gray-500">
                    {order.delivery_mode === 'pickup_station' ? <Store className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                    {order.delivery_mode === 'pickup_station' ? 'Pickup station' : 'Home delivery'}
                  </div>
                )}
              </div>

              {order.delivery_mode === 'pickup_station' && order.pickup_station_name && (
                <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-4">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{order.pickup_station_name}</p>
                    {order.pickup_station_address && <p className="text-[11px] text-gray-400 truncate">{order.pickup_station_address}</p>}
                  </div>
                </div>
              )}

              {/* Full customer-facing lifecycle. */}
              <div className="relative pl-8">
                <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gray-100" />
                <div className="space-y-5">
                  {STAGES.map((stage, i) => {
                    const isDone = i < stageIdx;
                    const isCurrent = i === stageIdx;
                    const Icon = stage.icon;
                    const classes = STAGE_CLASSES[stage.color];
                    return (
                      <div key={stage.key} className="relative">
                        {i < STAGES.length - 1 && (
                          <div className={`absolute left-[-21px] top-6 w-0.5 h-5 transition-colors duration-500 ${i < stageIdx ? classes.line : 'bg-gray-100'}`} />
                        )}
                        <div className={`absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center border-2 ${isDone || isCurrent ? classes.dot : 'bg-white border-gray-200'} ${isCurrent ? `animate-pulse ring-4 ${classes.ring}` : ''}`}>
                          <Icon className={`w-3 h-3 ${isDone || isCurrent ? 'text-white' : 'text-gray-300'}`} />
                        </div>
                        <p className={`text-sm font-semibold ${isCurrent ? 'text-gray-900' : isDone ? 'text-gray-600' : 'text-gray-300'}`}>{stage.label}</p>
                        {isCurrent && <p className={`text-[10px] font-medium mt-0.5 leading-relaxed ${classes.text}`}>{stage.description}</p>}
                        {isDone && <p className="text-[10px] text-gray-400 mt-0.5">Completed</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Itemized shipping details — always shown so a mixed-method
                order (some items flying, some by sea) is legible per item,
                not just as one ambiguous order-level badge. */}
            {order.items && order.items.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Items {isMixed && <span className="text-gray-300 font-normal normal-case">· mixed shipping</span>}
                </p>
                <div>
                  {order.items.map((item, i) => (
                    <ItemRow key={item.id ?? i} item={item} fallbackMethod={singleMethod} shippedAt={order.shipped_at} />
                  ))}
                </div>
              </div>
            )}

            {singleMethod && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <TransportAnimation method={singleMethod} active={stageIdx === 2} />
              </div>
            )}

            {/* Countdown only ever appears once the item has actually shipped
                (shipped_at set) — this is the trigger, never before. */}
            {order.shipped_at && singleMethod && (
              <CountdownWindow shippedAt={order.shipped_at} method={singleMethod} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
