// src/pages/recommendations/ImporterDashboardPage.tsx
// Customer-facing "My Dashboard" for the Importation section. Shows:
//  - the customer's own orders and their consolidation/shipping status
//  - any consolidation drop-off bills admin has issued them, with a
//    pay-by-transfer flow (warning -> account details -> "I have paid")
// Route: /importations/dashboard (added in App.tsx)
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Package, Receipt, ChevronLeft, RefreshCw, Clock } from 'lucide-react';
import CONFIG from '@/lib/config';
import { useCustomerAuthStore } from '@/stores';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';
import { fmt } from './RecommendationsPage';
import ManualPaymentFlow from './ManualPaymentFlow';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface DashboardOrder {
  id: string;
  code: string;
  status: 'pending' | 'shipping_quoted' | 'order_placed' | 'billed' | 'awaiting_shipment' | 'shipped' | 'delivered';
  payment_status: 'unpaid' | 'awaiting_confirmation' | 'paid' | 'failed';
  payment_method: 'paystack' | 'manual' | null;
  total_ngn: number;
  delivery_type: 'to_qafrica' | 'to_me';
  created_at: string;
}

interface ConsolidationBill {
  id: string;
  order_id: string | null;
  amount_ngn: number;
  reason: string;
  bank_account_number: string;
  bank_name: string;
  bank_account_name: string;
  status: 'pending' | 'awaiting_confirmation' | 'paid' | 'cancelled';
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  shipping_quoted: 'Quoted',
  order_placed: 'Ordered',
  billed: 'Billed — fee due',
  awaiting_shipment: 'Awaiting shipment',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  shipping_quoted: 'bg-sky-50 text-sky-700',
  order_placed: 'bg-violet-50 text-violet-700',
  billed: 'bg-rose-50 text-rose-700',
  awaiting_shipment: 'bg-cyan-50 text-cyan-700',
  shipped: 'bg-indigo-50 text-indigo-700',
  delivered: 'bg-emerald-50 text-emerald-700',
};

const BILL_STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting your payment',
  awaiting_confirmation: 'Payment reported — confirming',
  paid: 'Paid & confirmed',
  cancelled: 'Cancelled',
};

const BILL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-red-50 text-red-600',
  awaiting_confirmation: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

export default function ImporterDashboardPage() {
  useImportPwaManifest();
  const navigate = useNavigate();
  const { customer, isAuthenticated } = useCustomerAuthStore();

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [bills, setBills] = useState<ConsolidationBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingBill, setPayingBill] = useState<ConsolidationBill | null>(null);

  // Bounce logged-out visitors back to the recommendations page rather than
  // a dead end — consistent with how checkout handles the logged-out case.
  useEffect(() => {
    if (!isAuthenticated) navigate('/recommendations', { replace: true });
  }, [isAuthenticated, navigate]);

  const load = useCallback(async () => {
    if (!customer?.id) return;
    setIsLoading(true);
    try {
      const [ordersRes, billsRes] = await Promise.all([
        fetch(`${EDGE_URL}?action=my-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customer.id }),
        }),
        fetch(`${EDGE_URL}?action=my-bills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customer.id }),
        }),
      ]);
      const ordersData = await ordersRes.json();
      const billsData = await billsRes.json();
      setOrders(ordersData.orders ?? []);
      setBills(billsData.bills ?? []);
    } catch {
      // leave lists empty; the UI already handles empty state gracefully
    } finally {
      setIsLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => { load(); }, [load]);

  const handleBillPaid = async () => {
    if (!payingBill || !customer?.id) return;
    const res = await fetch(`${EDGE_URL}?action=bill-mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, bill_id: payingBill.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Could not record your payment. Please try again.');
    await load(); // refresh so the bill now shows "awaiting confirmation" if they reopen
  };

  const pendingBillsCount = bills.filter(b => b.status === 'pending').length;

  if (!isAuthenticated) return null; // redirect effect above handles this

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/recommendations" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
            <ChevronLeft className="w-4 h-4" /> Back to catalog
          </Link>
          <button onClick={load} disabled={isLoading} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="font-black text-gray-900 text-xl mb-1">My Dashboard</h1>
        <p className="text-gray-400 text-sm mb-6">{customer?.full_name}</p>

        {/* ── Consolidation bills ─────────────────────────────────────── */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-gray-400" />
            <h2 className="font-bold text-gray-800 text-sm">Consolidation billing</h2>
            {pendingBillsCount > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {pendingBillsCount} awaiting payment
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-20" />
          ) : bills.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm text-gray-300">No consolidation bills right now.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              {bills.map(bill => (
                <div key={bill.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800">{bill.reason}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${BILL_STATUS_COLORS[bill.status]}`}>
                      {BILL_STATUS_LABELS[bill.status]}
                    </span>
                  </div>
                  <p className="text-lg font-black text-gray-900 mb-2">{fmt(bill.amount_ngn)}</p>
                  {bill.status === 'pending' && (
                    <button
                      onClick={() => setPayingBill(bill)}
                      className="text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-lg"
                    >
                      Pay now
                    </button>
                  )}
                  {bill.status === 'awaiting_confirmation' && (
                    <p className="text-[11px] text-amber-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> We're confirming your transfer — this can take a little while.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Orders / consolidation status ───────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-gray-400" />
            <h2 className="font-bold text-gray-800 text-sm">My orders</h2>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-16" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <ShoppingBag className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-300 mb-3">No orders yet.</p>
              <Link to="/recommendations" className="text-xs font-bold text-orange-600">
                Browse products →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              {orders.map(order => (
                <div key={order.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-gray-900 font-mono text-xs tracking-wider">{order.code}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {order.delivery_type === 'to_qafrica' ? 'Consolidated to QAfrica' : 'Direct to you'}
                      {order.payment_status === 'awaiting_confirmation' && ' · payment submitted, awaiting admin confirmation'}
                      {order.payment_status === 'failed' && ' · payment failed'}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-800 text-sm flex-shrink-0">{fmt(order.total_ngn)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {payingBill && (
        <ManualPaymentFlow
          amountLabel={fmt(payingBill.amount_ngn)}
          bank={{
            bank_account_number: payingBill.bank_account_number,
            bank_account_name: payingBill.bank_account_name,
            bank_name: payingBill.bank_name,
          }}
          onConfirmPaid={handleBillPaid}
          onClose={() => setPayingBill(null)}
        />
      )}
    </div>
  );
}
