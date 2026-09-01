// src/pages/legal/ImportTrackingPage.tsx — actually lives with recommendations
// but kept import-free of auth; standalone public page (spec Section 6).
// Route: /track. Customer pastes an order code, sees a premium vertical
// progress tracker with a countdown once shipped. CSS-only animations
// (no heavy libraries) since the spec explicitly flags animation weight
// on slow mobile connections as a bottleneck risk.
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Search, Loader, CheckCircle2, Warehouse, PlaneTakeoff, AlertCircle } from 'lucide-react';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface TrackedOrder { code: string; status: string; shipping_method: 'flight' | 'sea_freight' | null; shipped_at: string | null; created_at: string; }

// Maps the real backend pipeline to the customer-facing tracking labels
// (spec 6.1). "billed" covers both consolidation and shipping bill stages
// internally (see Section 3 clarification) — both map to the same visible
// "At Consolidation Warehouse" stage until shipped_at is set, at which
// point status flips to to_review and the stage becomes "In Transit".
const STAGES = [
  { key: 'received', label: 'Order Received / Processing', icon: CheckCircle2 },
  { key: 'consolidation', label: 'At Consolidation Warehouse', icon: Warehouse },
  { key: 'transit', label: 'In Transit to Nigeria', icon: PlaneTakeoff },
];

function stageIndexFor(order: TrackedOrder): number {
  if (order.status === 'to_review' || order.shipped_at) return 2;
  if (order.status === 'billed') return 1;
  return 0; // pending / confirmed
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function CountdownWindow({ shippedAt, method }: { shippedAt: string; method: 'flight' | 'sea_freight' }) {
  const elapsed = daysSince(shippedAt);
  const [minDays, maxDays, fastest] = method === 'flight' ? [20, 30, 10] : [60, 70, 50];
  const remainingLow = Math.max(minDays - elapsed, 0);
  const remainingHigh = Math.max(maxDays - elapsed, 0);

  return (
    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
      <p className="text-[11px] font-bold text-orange-500 uppercase tracking-widest mb-1">Estimated arrival</p>
      <p className="text-2xl font-black text-gray-900">
        {remainingHigh === 0 ? 'Any day now' : `${remainingLow}–${remainingHigh} days`}
      </p>
      <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
        This is an estimated window, not a fixed promise — some shipments have arrived in as little as ~{fastest} days.
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

export default function ImportTrackingPage() {
  const [code, setCode] = useState('');
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const stageIdx = order ? stageIndexFor(order) : -1;

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
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Order</p>
              <p className="font-mono font-black text-lg text-gray-900 tracking-wider mb-4">{order.code}</p>

              {/* Vertical progress tracker */}
              <div className="relative pl-8">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-100" />
                <div
                  className="absolute left-[11px] top-2 w-0.5 bg-orange-500 transition-all duration-700"
                  style={{ height: `${(stageIdx / (STAGES.length - 1)) * 100}%` }}
                />
                <div className="space-y-6">
                  {STAGES.map((stage, i) => {
                    const isDone = i < stageIdx;
                    const isCurrent = i === stageIdx;
                    const Icon = stage.icon;
                    return (
                      <div key={stage.key} className="relative">
                        <div
                          className={`absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                            isDone || isCurrent ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-200'
                          } ${isCurrent ? 'animate-pulse ring-4 ring-orange-100' : ''}`}
                        >
                          <Icon className={`w-3 h-3 ${isDone || isCurrent ? 'text-white' : 'text-gray-300'}`} />
                        </div>
                        <p className={`text-sm font-semibold ${isCurrent ? 'text-gray-900' : isDone ? 'text-gray-600' : 'text-gray-300'}`}>
                          {stage.label}
                        </p>
                        {isCurrent && <p className="text-[10px] text-orange-500 font-medium mt-0.5">Current status</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {order.shipping_method && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <TransportAnimation method={order.shipping_method} active={stageIdx === 2} />
              </div>
            )}

            {order.shipped_at && order.shipping_method && (
              <CountdownWindow shippedAt={order.shipped_at} method={order.shipping_method} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
