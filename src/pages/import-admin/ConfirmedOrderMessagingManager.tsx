// src/pages/import-admin/ConfirmedOrderMessagingManager.tsx
// "Messages" tab: preset templates for nudging the current open batch
// (consolidation notice / last call) and notifying a closed batch once it
// has shipped. Dates are never typed by admin — the consolidation/last-call
// date is always "today" at send time, and the shipped date range is pulled
// from the batch's own orders. Shipped notices only reach customers who are
// billed AND fully paid; everyone else stays on the 8-hourly reminder cron.
import { useState, useEffect, useCallback } from 'react';
import { Send, Loader, Truck, Clock3, PackageCheck, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface OrderRow {
  id: string;
  code: string;
  customer_name: string;
  payment_status: string;
  staged_at: string | null;
  shipped_at?: string | null;
  created_at: string;
}

interface ClosedBatch {
  stagedAt: string;
  orderIds: string[];
  orderCount: number;
  allShipped: boolean;
}

function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

function buildClosedBatches(orders: OrderRow[]): ClosedBatch[] {
  const map = new Map<string, ClosedBatch>();
  for (const o of orders) {
    if (!o.staged_at) continue;
    const existing = map.get(o.staged_at) ?? { stagedAt: o.staged_at, orderIds: [], orderCount: 0, allShipped: true };
    existing.orderIds.push(o.id);
    existing.orderCount += 1;
    if (!o.shipped_at) existing.allShipped = false;
    map.set(o.staged_at, existing);
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.stagedAt).getTime() - new Date(a.stagedAt).getTime());
}

export default function ConfirmedOrderMessagingManager({ token }: { token: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openCount, setOpenCount] = useState(0);
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=all-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, payment_status: 'paid' }),
      });
      const data = await res.json();
      const rows: OrderRow[] = data.orders ?? [];
      setOrders(rows);
      setOpenCount(rows.filter(o => !o.staged_at).length);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const closedBatches = buildClosedBatches(orders).filter(b => !b.allShipped);
  const todayLabel = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  const sendConfirmedMessage = async (template: 'consolidation' | 'last_call') => {
    setSendingTemplate(template);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-send-confirmed-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, template }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Sent to ${data.sent} of ${data.recipients} customers in the open batch`);
    } finally {
      setSendingTemplate(null);
    }
  };

  const sendShippedMessage = async (batch: ClosedBatch) => {
    setSendingTemplate(`shipped:${batch.stagedAt}`);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-send-shipped-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_ids: batch.orderIds }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      if (data.sent === 0 && data.note) {
        toast.error(data.note);
      } else {
        toast.success(`Shipped notice sent to ${data.sent} customer${data.sent !== 1 ? 's' : ''}${data.skipped_unpaid ? ` — ${data.skipped_unpaid} order(s) skipped (unpaid bill)` : ''}`);
      }
      setSelectedBatch(null);
      await load();
    } finally {
      setSendingTemplate(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Consolidation / last-call templates — target the current open batch */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock3 className="w-4 h-4 text-gray-400" />
          <p className="font-semibold text-gray-800 text-sm">Current open batch</p>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          {isLoading ? 'Loading…' : `${openCount} paid order${openCount !== 1 ? 's' : ''} not yet closed`} · date auto-set to today ({todayLabel})
        </p>

        <div className="space-y-3">
          <div className="bg-gray-50 rounded-xl p-3.5">
            <p className="text-xs font-bold text-gray-700 mb-1">Consolidation notice</p>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
              "Goods from orders placed up to {todayLabel} are moving to our consolidation warehouse soon. Get ready!"
            </p>
            <button
              onClick={() => sendConfirmedMessage('consolidation')}
              disabled={sendingTemplate !== null || openCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {sendingTemplate === 'consolidation' ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send to open batch
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-3.5">
            <p className="text-xs font-bold text-gray-700 mb-1">Last call</p>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
              "Last call for the current batch (open as of {todayLabel}) — order your last set of items now!"
            </p>
            <button
              onClick={() => sendConfirmedMessage('last_call')}
              disabled={sendingTemplate !== null || openCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {sendingTemplate === 'last_call' ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send to open batch
            </button>
          </div>
        </div>
      </div>

      {/* Shipped notice — pick a closed batch */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Truck className="w-4 h-4 text-gray-400" />
          <p className="font-semibold text-gray-800 text-sm">Shipped notice</p>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          Pick a closed batch — only billed &amp; fully paid customers in it get notified.
        </p>

        {isLoading ? (
          <div className="py-6 text-center"><Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
        ) : closedBatches.length === 0 ? (
          <div className="py-8 text-center">
            <PackageCheck className="w-6 h-6 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-300">No closed batches waiting to ship. Close a batch from Total Orders first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {closedBatches.map(batch => {
              const isSelected = selectedBatch === batch.stagedAt;
              const isSendingThis = sendingTemplate === `shipped:${batch.stagedAt}`;
              return (
                <div key={batch.stagedAt} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setSelectedBatch(isSelected ? null : batch.stagedAt)}
                    className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-800">
                          Closed {new Date(batch.stagedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-gray-400">{batch.orderCount} order{batch.orderCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-orange-500' : 'text-gray-200'}`} />
                  </button>

                  {isSelected && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-50">
                      <div className="bg-gray-50 rounded-lg p-3 mb-3 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          Only customers billed and fully paid (both consolidation and shipping, where applicable) in this batch
                          will receive the notice. Unbilled or unpaid orders are skipped and stay on the reminder cycle.
                        </p>
                      </div>
                      <button
                        onClick={() => sendShippedMessage(batch)}
                        disabled={sendingTemplate !== null}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 transition-colors"
                      >
                        {isSendingThis ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send shipped notice
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
