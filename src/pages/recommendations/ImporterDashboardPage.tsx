// src/pages/recommendations/ImporterDashboardPage.tsx
// Customer-facing "My Dashboard" for the Importation section — icon-grid
// navigation over the order pipeline: To Pay -> Confirmed -> Billed
// (Consolidation | Ship to Nigeria) -> To Receive -> Refund.
// Route: /importations/dashboard (added in App.tsx)
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, RefreshCw, Settings, Clock, CreditCard, CheckCircle2,
  Receipt, PackageCheck, RotateCcw, MapPin, Headset, Info, X, Loader,
  ShoppingBag, Ship, ExternalLink, ChevronDown, Heart,
  FileText, ShieldCheck, Navigation, MailWarning, Sparkles, Plus,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { useCustomerAuthStore } from '@/stores';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';
import { fallbackAvatarColor, initialsFrom } from '@/lib/avatarFallback';
import { AvatarImage } from '@/lib/presetAvatars';
import { fmt } from './RecommendationsPage';
import ImportSettingsSheet from './ImportSettingsSheet';
import SavedItemsSheet from './SavedItemsSheet';
import WhyTrustUsSheet from './WhyTrustUsSheet';
import HelpCenterSheet from './HelpCenterSheet';
import TrackOrderModal from './TrackOrderModal';
import RetryPaymentSheet from './RetryPaymentSheet';
import AvatarSheet from './AvatarSheet';
import ConfirmEmailSheet from './ConfirmEmailSheet';
import OrderReceiptSheet from './OrderReceiptSheet';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const REMINDERS_EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/order-reminders`;
const REFUNDS_EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/refunds`;
const CUSTOM_ORDERS_EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/custom-orders`;

interface FailedOrder {
  id: string;
  code: string;
  items: Array<{ id: string; name: string; price_ngn: number; quantity: number }>;
  total_ngn: number;
  delivery_type: 'to_qafrica' | 'to_me';
  order_created_at: string;
  failed_at: string;
}

interface CustomOrderItem {
  id: string;
  image_url: string;
  description: string;
  quantity: number;
  estimated_budget_ngn: number | null;
  product_url: string | null;
  product_name: string | null;
}
interface CustomOrderRequest {
  id: string;
  status: 'pending' | 'in_progress' | 'ready';
  created_at: string;
  ready_at: string | null;
  custom_order_items: CustomOrderItem[];
}

interface DashboardOrder {
  id: string;
  code: string;
  status: 'pending' | 'confirmed' | 'ordered' | 'ordered_and_closed' | 'shipped_and_closed' | 'clearance_and_closed' | 'received';
  payment_status: 'unpaid' | 'awaiting_confirmation' | 'paid' | 'failed';
  payment_method: 'paystack' | 'manual' | null;
  total_ngn: number;
  subtotal_ngn: number;              
  jumia_fee_ngn?: number;           
  prepaid_shipping_ngn?: number | null; 
  delivery_type: 'to_qafrica' | 'to_me';
  items: Array<{ id: string; name: string; price_ngn: number; quantity: number; image_url: string; variant_options?: Record<string, string> }>;
  created_at: string;
}

interface ConsolidationBill {
  id: string;
  order_id: string | null;
  amount_ngn: number;
  reason: string;
  kind: 'consolidation_shipping' | 'clearance';
  bank_account_number: string;
  bank_name: string;
  bank_account_name: string;
  status: 'pending' | 'awaiting_confirmation' | 'paid' | 'cancelled';
  line_items?: { label: string; amount_ngn: number }[];
  created_at: string;
}

interface Refund {
  id: string;
  code: string;
  items: Array<{ id: string; name: string; price_ngn: number; quantity: number; image_url?: string }>;
  total_ngn: number;
  refund_amount_ngn: number;
  cancellation_fee_ngn: number;
  refund_policy?: string | null;
  cancel_reason: string;
  status: 'pending' | 'submitted' | 'paid';
  payment_method: 'paystack' | 'manual' | null;
  paystack_refund_status?: string | null;
  paystack_refund_id?: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  cancelled_at: string;
  paid_at: string | null;
}

const BILL_STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting your payment',
  awaiting_confirmation: 'Confirming your transfer',
  paid: 'Paid & confirmed',
  cancelled: 'Cancelled',
};

const BILL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-red-50 text-red-600',
  awaiting_confirmation: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// Which pipeline tab a bank icon-grid tile is
type PipelineTab = 'to_pay' | 'confirmed' | 'billed' | 'shipped' | 'to_receive' | 'refund' | 'custom';

export default function ImporterDashboardPage() {
  useImportPwaManifest();
  const navigate = useNavigate();
  const { customer, isAuthenticated } = useCustomerAuthStore();

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [bills, setBills] = useState<ConsolidationBill[]>([]);
  const [failedOrders, setFailedOrders] = useState<FailedOrder[]>([]);
  const [customOrderRequests, setCustomOrderRequests] = useState<CustomOrderRequest[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PipelineTab>('to_pay');
  const [showSettings, setShowSettings] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showWhyTrustUs, setShowWhyTrustUs] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showTrackOrder, setShowTrackOrder] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);
  const [retryOrder, setRetryOrder] = useState<DashboardOrder | null>(null);
  const [isPayingBill, setIsPayingBill] = useState(false);
  const [infoBillKind, setInfoBillKind] = useState<'consolidation_shipping' | 'clearance' | null>(null);
  const [refundBankForm, setRefundBankForm] = useState<Refund | null>(null);
  const [bankFormData, setBankFormData] = useState({ bank_account_number: '', bank_account_name: '', bank_name: '' });
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [receiptOrder, setReceiptOrder] = useState<DashboardOrder | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Bounce logged-out visitors back to the recommendations page rather than
  // a dead end — consistent with how checkout handles the logged-out case.
  useEffect(() => {
    if (!isAuthenticated) navigate('/recommendations', { replace: true });
  }, [isAuthenticated, navigate]);

  const load = useCallback(async () => {
    if (!customer?.id) return;
    setIsLoading(true);
    try {
      const [ordersRes, billsRes, failedRes, refundsRes, customOrdersRes] = await Promise.all([
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
        fetch(`${REMINDERS_EDGE_URL}?action=my-failed-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customer.id }),
        }),
        fetch(`${REFUNDS_EDGE_URL}?action=my-refunds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customer.id }),
        }),
        fetch(`${CUSTOM_ORDERS_EDGE_URL}?action=my-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customer.id }),
        }),
      ]);
      const ordersData = await ordersRes.json();
      const billsData = await billsRes.json();
      const failedData = await failedRes.json();
      const refundsData = await refundsRes.json();
      const customOrdersData = await customOrdersRes.json();
      setOrders(ordersData.orders ?? []);
      setBills(billsData.bills ?? []);
      setFailedOrders(failedData.failed_orders ?? []);
      setRefunds(refundsData.refunds ?? []);
      setCustomOrderRequests(customOrdersData.requests ?? []);
    } catch {
      // leave lists empty; the UI already handles empty state gracefully
    } finally {
      setIsLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => { load(); }, [load]);

  // Bills are paid via Paystack, verified server-side against the actual
  // charge (see bill-pay-verify in the edge function) — no manual admin
  // confirmation step needed anymore.
  const isPayingBillRef = useRef(false);
  const [billPayError, setBillPayError] = useState('');

  const payBillWithPaystack = async (bill: ConsolidationBill) => {
    if (!customer?.id) return;
    if (isPayingBillRef.current) return; // hard guard, not dependent on re-render timing
    isPayingBillRef.current = true;
    setIsPayingBill(true);
    setBillPayError('');
    try {
      await loadPaystackScript();
      const reference = generateReference('QAFBILL');
  
      await fetch(`${EDGE_URL}?action=bill-pay-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customer.id, bill_id: bill.id, reference }),
      }).catch(() => {});
  
      initializePayment({
        email: customer.email,
        amount: toKobo(bill.amount_ngn),
        reference,
        metadata: { type: 'china_import_bill', bill_id: bill.id, kind: bill.kind },
        onSuccess: async () => {
          try {
            const res = await fetch(`${EDGE_URL}?action=bill-pay-verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customer_id: customer.id, bill_id: bill.id, reference }),
            });
            const data = await res.json();
            if (data?.success) {
              await load();
            } else {
              setBillPayError('Payment could not be verified. If you were charged, contact support.');
            }
          } catch {
            setBillPayError('Payment verification failed. Contact support.');
          } finally {
            setIsPayingBill(false);
            isPayingBillRef.current = false;
          }
        },
        onCancel: () => {
          setIsPayingBill(false);
          isPayingBillRef.current = false;
        },
      });
    } catch (e: any) {
      setBillPayError(e?.message ?? 'Could not start payment');
      setIsPayingBill(false);
      isPayingBillRef.current = false;
    }
  };
  const submitBankDetails = async () => {
    if (!refundBankForm || !customer?.id) return;
    if (!bankFormData.bank_account_number.trim() || !bankFormData.bank_account_name.trim() || !bankFormData.bank_name.trim()) return;
    setIsSubmittingBank(true);
    try {
      const res = await fetch(`${REFUNDS_EDGE_URL}?action=submit-bank-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id, refund_id: refundBankForm.id,
          ...bankFormData,
        }),
      });
      if (!res.ok) throw new Error();
      setRefundBankForm(null);
      setBankFormData({ bank_account_number: '', bank_account_name: '', bank_name: '' });
      await load();
    } catch {
      // leave the form open so they can retry
    } finally {
      setIsSubmittingBank(false);
    }
  };

  // ── Derived pipeline buckets ─────────────────────────────────────────────
  // "To Pay" covers both: orders that still need payment (unpaid/failed —
  // tapping opens the retry sheet) and orders where the customer already
  // claimed a manual transfer but admin hasn't confirmed it yet
  // (awaiting_confirmation — tapping just shows status, not a retry sheet).
  // Both used to be filtered out of every tab once payment_status left
  // 'unpaid', which made awaiting_confirmation orders invisible entirely.
  const toPay = orders.filter(o => o.payment_status === 'unpaid' || o.payment_status === 'failed' || o.payment_status === 'awaiting_confirmation');
  const confirmedOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'ordered');
  const unpaidBillsCount = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled').length;
  const shippedOrders = orders.filter(o => o.status === 'shipped_and_closed' || o.status === 'clearance_and_closed');
  const toReceiveOrders = orders.filter(o => o.status === 'received');
  const pendingRefundsCount = refunds.filter(r => r.status === 'pending').length;

  const TABS: Array<{ key: PipelineTab; label: string; icon: any; count: number }> = [
    { key: 'to_pay', label: 'To Pay', icon: CreditCard, count: toPay.length },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, count: confirmedOrders.length },
    { key: 'billed', label: 'Billed', icon: Receipt, count: unpaidBillsCount },
    { key: 'shipped', label: 'Shipped', icon: Ship, count: shippedOrders.length },
    { key: 'to_receive', label: 'To Receive', icon: PackageCheck, count: toReceiveOrders.length },
    { key: 'refund', label: 'Refund', icon: RotateCcw, count: pendingRefundsCount },
    { key: 'custom', label: 'Custom', icon: Sparkles, count: customOrderRequests.filter(r => r.status === 'ready').length },
  ];

  const avatarBg = fallbackAvatarColor(customer?.id ?? 'x');
  const initials = initialsFrom(customer?.full_name);

  if (!isAuthenticated) return null; // redirect effect above handles this

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/recommendations" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
            <ChevronLeft className="w-4 h-4" /> Back to catalog
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={load} disabled={isLoading} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowSaved(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <Heart className="w-4 h-4 text-gray-400" />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* ── Profile header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowAvatar(true)} className="relative flex-shrink-0">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow"
              style={{ backgroundColor: customer?.avatar_url ? undefined : avatarBg }}
            >
              {customer?.avatar_url ? (
                <AvatarImage avatarUrl={customer.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-lg font-bold">{initials}</span>
              )}
            </div>
          </button>
          <div>
            <h1 className="font-black text-gray-900 text-lg leading-tight">{customer?.full_name}</h1>
            <button onClick={() => setShowAvatar(true)} className="text-orange-500 text-xs font-semibold">
              Edit profile picture
            </button>
          </div>
        </div>

        {/* ── Unconfirmed email chip ───────────────────────────────────────────
            Deliberately a prompt, not a gate: nothing below is blocked by it.
            Confirming lets us keep bulk mail to reachable addresses, and is
            the only way a customer can fix an address they mistyped at
            signup. */}
        {customer && customer.is_verified === false && (
          <button
            onClick={() => setShowConfirmEmail(true)}
            className="w-full flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 text-left"
          >
            <MailWarning className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-bold text-amber-900">Email not confirmed</span>
              <span className="block text-[11px] text-amber-700 truncate">
                Confirm {customer.email} so we can reach you about bills
              </span>
            </span>
            <span className="text-[11px] font-bold text-amber-900 shrink-0">Confirm</span>
          </button>
        )}

        {/* ── Order pipeline icon grid ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="grid grid-cols-4 gap-y-3 gap-x-1">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className="flex flex-col items-center gap-1.5 relative py-1">
                  {t.count > 0 && (
                    <span className="absolute -top-0.5 right-2 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {t.count}
                    </span>
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-orange-500' : 'bg-gray-50'}`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-orange-600' : 'text-gray-500'}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Secondary row: address / help are real, rest are coming soon ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-8">
          <div className="grid grid-cols-4 gap-3">
            <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">Shipping<br />Address</span>
            </button>
            <button onClick={() => setShowHelpCenter(true)} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <Headset className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">Help<br />Center</span>
            </button>
            <a href="https://qafrica.store" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <Ship className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">Drop<br />Shipping</span>
            </a>
            <a href="https://jforce.jumia.com.ng/s/C6tCHzq" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">Jumia</span>
            </a>
            <Link to="/import-terms" className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">Policies</span>
            </Link>
            <button onClick={() => setShowWhyTrustUs(true)} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">Why Trust<br />Us</span>
            </button>
            <button onClick={() => setShowTrackOrder(true)} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">Track</span>
            </button>
          </div>
        </div>

        {/* ── Active tab content ────────────────────────────────────────── */}
        {activeTab === 'to_pay' && (
          <section>
            <h2 className="font-bold text-gray-800 text-sm mb-3">To Pay</h2>
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-16" />
            ) : toPay.length === 0 ? (
              <EmptyState icon={Clock} text="Nothing waiting on payment right now." />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {toPay.map(order => {
                  const isAwaitingConfirmation = order.payment_status === 'awaiting_confirmation';
                  return (
                    <div key={order.id}>
                      <button
                        onClick={() => setRetryOrder(order)}
                        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-gray-900 font-mono text-xs tracking-wider">{order.code}</span>
                            {order.payment_status === 'failed' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Payment failed</span>
                            )}
                            {isAwaitingConfirmation && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Awaiting admin approval</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400">
                            {order.items?.length ?? 0} item{order.items?.length === 1 ? '' : 's'} ·{' '}
                            {isAwaitingConfirmation ? 'Not yet approved — tap to retry' : 'Tap to complete payment'}
                          </p>
                        </div>
                        <span className="font-semibold text-gray-800 text-sm flex-shrink-0">{fmt(order.total_ngn)}</span>
                      </button>
                      <OrderItemsDropdown
                        order={order}
                        isExpanded={expandedOrderIds.has(order.id)}
                        onToggle={() => toggleExpanded(order.id)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'confirmed' && (
          <section>
            <h2 className="font-bold text-gray-800 text-sm mb-3">Confirmed</h2>
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-16" />
            ) : confirmedOrders.length === 0 ? (
              <EmptyState icon={CheckCircle2} text="No confirmed orders waiting to be billed." />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {confirmedOrders.map(order => (
                  <div key={order.id}>
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-gray-900 font-mono text-xs tracking-wider block mb-0.5">{order.code}</span>
                        <p className="text-[11px] text-gray-400">
                          {order.status === 'ordered'
                            ? "Being sourced — we're getting your items together."
                            : "Payment received — we're getting this ready to source."}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="font-semibold text-gray-800 text-sm">{fmt(order.total_ngn)}</span>
                        <button
                          onClick={() => setReceiptOrder(order)}
                          className="flex items-center gap-1 text-[10px] font-bold text-orange-500 hover:text-orange-600"
                        >
                          <Receipt className="w-3 h-3" /> Receipt
                        </button>
                      </div>
                    </div>
                    <OrderItemsDropdown
                      order={order}
                      isExpanded={expandedOrderIds.has(order.id)}
                      onToggle={() => toggleExpanded(order.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'billed' && (
          <section>
            <h2 className="font-bold text-gray-800 text-sm mb-3">Billed</h2>
            {billPayError && <p className="text-red-500 text-xs mb-3">{billPayError}</p>}
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-24" />
            ) : bills.length === 0 ? (
              <EmptyState icon={Receipt} text="No bills right now." />
            ) : (
              <div className="space-y-3">
                {bills.map(bill => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onInfo={() => setInfoBillKind(bill.kind)}
                    onPay={() => payBillWithPaystack(bill)}
                    disabled={isPayingBill}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'shipped' && (
          <section>
            <h2 className="font-bold text-gray-800 text-sm mb-3">Shipped</h2>
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-16" />
            ) : shippedOrders.length === 0 ? (
              <EmptyState icon={Ship} text="Nothing shipped right now." />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {shippedOrders.map(order => {
                  const unpaidShippingBill = bills.find(b => b.kind === 'consolidation_shipping' && b.status !== 'paid');
                  const unpaidClearanceBill = order.status === 'clearance_and_closed'
                    ? bills.find(b => b.kind === 'clearance' && b.status !== 'paid')
                    : undefined;
                  const held = unpaidShippingBill ?? unpaidClearanceBill;
                  return (
                    <div key={order.id}>
                      <div className="px-5 py-4 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-gray-900 font-mono text-xs tracking-wider block mb-0.5">{order.code}</span>
                          {held ? (
                            <p className="text-[11px] text-amber-600">
                              On its way, but held — pay your {held.kind === 'clearance' ? 'clearance' : 'consolidation & shipping'} fee to release it.
                            </p>
                          ) : (
                            <p className="text-[11px] text-emerald-600">
                              {order.status === 'clearance_and_closed' ? 'Clearing customs — fully paid.' : 'On its way — fully paid.'}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="font-semibold text-gray-800 text-sm">{fmt(order.total_ngn)}</span>
                          <button
                            onClick={() => setReceiptOrder(order)}
                            className="flex items-center gap-1 text-[10px] font-bold text-orange-500 hover:text-orange-600"
                          >
                            <Receipt className="w-3 h-3" /> Receipt
                          </button>
                        </div>
                      </div>
                      {held && (
                        <div className="px-5 pb-4">
                          <button
                            onClick={() => payBillWithPaystack(held)}
                            disabled={isPayingBill}
                            className="text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-lg"
                          >
                            Pay now to release
                          </button>
                        </div>
                      )}
                      <OrderItemsDropdown
                        order={order}
                        isExpanded={expandedOrderIds.has(order.id)}
                        onToggle={() => toggleExpanded(order.id)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'to_receive' && (
          <section>
            <h2 className="font-bold text-gray-800 text-sm mb-3">To Receive</h2>
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-16" />
            ) : toReceiveOrders.length === 0 ? (
              <EmptyState icon={PackageCheck} text="Nothing ready for pickup or delivery yet." />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {toReceiveOrders.map(order => (
                  <div key={order.id}>
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-gray-900 font-mono text-xs tracking-wider block mb-0.5">{order.code}</span>
                        <p className="text-[11px] text-emerald-600">Cleared and ready — reach out to arrange pickup or delivery.</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="font-semibold text-gray-800 text-sm">{fmt(order.total_ngn)}</span>
                        <button
                          onClick={() => setReceiptOrder(order)}
                          className="flex items-center gap-1 text-[10px] font-bold text-orange-500 hover:text-orange-600"
                        >
                          <Receipt className="w-3 h-3" /> Receipt
                        </button>
                      </div>
                    </div>
                    <OrderItemsDropdown
                      order={order}
                      isExpanded={expandedOrderIds.has(order.id)}
                      onToggle={() => toggleExpanded(order.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'refund' && (
          <section>
            <h2 className="font-bold text-gray-800 text-sm mb-3">Refund</h2>
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-24" />
            ) : refunds.length === 0 ? (
              <EmptyState icon={RotateCcw} text="No cancelled orders — nothing here." />
            ) : (
              <div className="space-y-3">
                {refunds.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-gray-900 font-mono text-xs tracking-wider">{r.code}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                        r.status === 'submitted' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {r.status === 'paid' ? 'Refund paid' : r.status === 'submitted' ? 'Processing' : 'Cancelled'}
                      </span>
                    </div>

                    <div className="bg-red-50 rounded-xl px-3 py-2.5 mb-3">
                      <p className="text-xs text-red-700">{r.cancel_reason}</p>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      {(r.items ?? []).map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                          <p className="text-xs text-gray-600 flex-1 truncate">{item.name} × {item.quantity}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3 space-y-1">
                      <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Original amount</span><span className="font-semibold text-gray-800">{fmt(r.total_ngn)}</span></div>
                      {Number(r.cancellation_fee_ngn ?? 0) > 0 && <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Cancellation fee</span><span className="font-semibold text-red-600">-{fmt(r.cancellation_fee_ngn)}</span></div>}
                      <div className="border-t border-gray-200 pt-1 flex items-center justify-between"><span className="text-sm font-bold text-gray-900">Refund amount</span><span className="text-sm font-black text-gray-900">{fmt(r.refund_amount_ngn)}</span></div>
                    </div>

                    {r.status === 'pending' && r.payment_method === 'paystack' && (
                      <div className="bg-blue-50 rounded-xl px-3 py-2.5 text-[11px] text-blue-700">
                        Your refund will be returned through the original Paystack payment method. No bank details are required.
                      </div>
                    )}

                    {r.status === 'pending' && r.payment_method === 'manual' && (
                      <>
                        <button
                          onClick={() => { setRefundBankForm(r); setBankFormData({ bank_account_number: '', bank_account_name: '', bank_name: '' }); }}
                          className="w-full bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                        >
                          Submit Bank Details
                        </button>
                        <p className="text-[11px] text-gray-400 mt-2 text-center">
                          Refunds are usually processed within 2–4 hours of submitting your details.
                          You can reorder anytime.
                        </p>
                      </>
                    )}

                    {r.status === 'submitted' && r.payment_method === 'paystack' && (
                      <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                        <p className="font-semibold">Paystack refund submitted</p>
                        <p>Your refund is being returned through your original payment method.</p>
                        {r.paystack_refund_status && <p className="text-[11px]">Status: {r.paystack_refund_status}</p>}
                      </div>
                    )}

                    {r.status === 'submitted' && r.payment_method === 'manual' && r.bank_account_number && (
                      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-0.5">
                        <p className="font-semibold text-gray-800">{r.bank_account_name}</p>
                        <p>{r.bank_account_number} · {r.bank_name}</p>
                        <p className="text-amber-600 mt-1">Submitted — we're processing your refund.</p>
                      </div>
                    )}

                    {r.status === 'paid' && (
                      <p className="text-[11px] text-emerald-600">
                        Paid {r.paid_at ? timeAgo(r.paid_at) : ''} · You're welcome to place a new order anytime.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'custom' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-800 text-sm">Custom Orders</h2>
              <Link
                to="/custom-order"
                className="flex items-center gap-1 text-[11px] font-bold text-orange-500 hover:text-orange-600"
              >
                <Plus className="w-3 h-3" /> New request
              </Link>
            </div>
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-24" />
            ) : customOrderRequests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <Sparkles className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400 mb-3">You haven't sent a custom order request yet.</p>
                <Link
                  to="/custom-order"
                  className="inline-block px-4 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Request a custom order
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {customOrderRequests.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] text-gray-400">{new Date(r.created_at).toLocaleDateString()} · {r.custom_order_items.length} item{r.custom_order_items.length !== 1 ? 's' : ''}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === 'ready' ? 'bg-emerald-50 text-emerald-700' :
                        r.status === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {r.status === 'ready' ? 'Ready to order' : r.status === 'in_progress' ? 'Sourcing in progress' : 'Received'}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {r.custom_order_items.map(item => (
                        <div key={item.id} className="flex items-center gap-2.5">
                          <img src={item.image_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-700 truncate">{item.description}</p>
                            <p className="text-[10px] text-gray-400">
                              Qty {item.quantity}{item.estimated_budget_ngn ? ` · up to ${fmt(item.estimated_budget_ngn)} each` : ''}
                            </p>
                          </div>
                          {item.product_url ? (
                            <a
                              href={item.product_url} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 text-[10px] font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-2.5 py-1.5"
                            >
                              Order now
                            </a>
                          ) : (
                            <span className="flex-shrink-0 text-[10px] font-semibold text-gray-300">Sourcing…</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Failed orders — expired unpaid orders, kept for reference ──── */}
        {failedOrders.length > 0 && activeTab === 'to_pay' && (
          <section className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-red-300" />
              <h2 className="font-bold text-gray-800 text-sm">Expired orders</h2>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              {failedOrders.map(f => (
                <div key={f.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-gray-500 font-mono text-xs tracking-wider">{f.code}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">Removed</span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Payment wasn't confirmed in time · removed {timeAgo(f.failed_at)}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-400 text-sm flex-shrink-0">{fmt(f.total_ngn)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {showSettings && <ImportSettingsSheet onClose={() => setShowSettings(false)} />}
      {showSaved && <SavedItemsSheet onClose={() => setShowSaved(false)} />}
      {showWhyTrustUs && <WhyTrustUsSheet onClose={() => setShowWhyTrustUs(false)} />}
      {showHelpCenter && <HelpCenterSheet onClose={() => setShowHelpCenter(false)} />}
      {showTrackOrder && <TrackOrderModal onClose={() => setShowTrackOrder(false)} />}
      {showAvatar && <AvatarSheet onClose={() => setShowAvatar(false)} />}
      {showConfirmEmail && <ConfirmEmailSheet onClose={() => setShowConfirmEmail(false)} />}

      {retryOrder && customer && (
        <RetryPaymentSheet
          order={retryOrder}
          customer={{ id: customer.id, email: customer.email, full_name: customer.full_name }}
          onClose={() => setRetryOrder(null)}
          onPaid={() => { setRetryOrder(null); load(); }}
        />
      )}

      {receiptOrder && customer && (
        <OrderReceiptSheet
          order={{ ...receiptOrder, customer_name: customer.full_name }}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* Bill info popover — explains what each fee is for */}
      {infoBillKind && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setInfoBillKind(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-xs rounded-t-3xl sm:rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">{infoBillKind === 'consolidation_shipping' ? 'Consolidation & shipping fee' : 'Clearance fee'}</h3>
              <button onClick={() => setInfoBillKind(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {infoBillKind === 'consolidation_shipping'
                ? "This covers getting your goods to our warehouse, combining everyone's orders into one shipment, and shipping that consolidated batch to Nigeria — this is what keeps costs so low."
                : "This covers customs clearance for your batch once it arrives in Nigeria. Once paid and your item passes clearance, it moves to \"To Receive.\""}
            </p>
          </div>
        </div>
      )}

      {/* Refund bank details form */}
      {refundBankForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => !isSubmittingBank && setRefundBankForm(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Bank Details for Refund</h3>
              <button onClick={() => setRefundBankForm(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Account Number</label>
                <input
                  type="text" value={bankFormData.bank_account_number}
                  onChange={e => setBankFormData(p => ({ ...p, bank_account_number: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 font-mono"
                  placeholder="0123456789"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Account Name</label>
                <input
                  type="text" value={bankFormData.bank_account_name}
                  onChange={e => setBankFormData(p => ({ ...p, bank_account_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400"
                  placeholder="Full name on account"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bank Name</label>
                <input
                  type="text" value={bankFormData.bank_name}
                  onChange={e => setBankFormData(p => ({ ...p, bank_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400"
                  placeholder="e.g. GTBank"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-400 mb-4">
              Refunds are usually processed within 2–4 hours of submitting your details.
            </p>

            <button
              onClick={submitBankDetails}
              disabled={isSubmittingBank || !bankFormData.bank_account_number || !bankFormData.bank_account_name || !bankFormData.bank_name}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
              {isSubmittingBank ? <Loader className="w-4 h-4 animate-spin" /> : null}
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
      <Icon className="w-7 h-7 text-gray-200 mx-auto mb-2" />
      <p className="text-xs text-gray-300">{text}</p>
    </div>
  );
}

// Expandable "what's in this order" dropdown — tap the header to reveal the
// item list, tap any item to open its live product page in a new tab.
function OrderItemsDropdown({ order, isExpanded, onToggle, compact = false }: {
  order: DashboardOrder;
  isExpanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const itemCount = order.items?.length ?? 0;
  const padX = compact ? 'px-0' : 'px-5';
  return (
    <div className={compact ? 'border-t border-gray-100 mt-3 pt-3' : 'border-t border-gray-50'}>
      <button
        onClick={onToggle}
        className={`w-full ${padX} ${compact ? '' : 'py-2.5'} flex items-center justify-between gap-2 text-left`}
      >
        <span className="text-[11px] font-semibold text-gray-500">
          {itemCount} item{itemCount === 1 ? '' : 's'} in this order
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && (
        <div className={`${padX} ${compact ? 'pt-2' : 'pb-4'} space-y-2`}>
          {(order.items ?? []).map((item, i) => (
            <Link
              key={`${item.id}-${i}`}
              to={`/recommendations/${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-2 group hover:bg-gray-100 transition-colors"
            >
              {item.image_url && (
                <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-700 truncate flex items-center gap-1">
                  {item.name}
                  <ExternalLink className="w-2.5 h-2.5 text-gray-300 group-hover:text-orange-400 flex-shrink-0" />
                </p>
                {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                  <p className="text-[10px] text-gray-400">
                    {Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-gray-400">×{item.quantity}</p>
                <p className="text-[11px] font-semibold text-gray-700">{fmt(item.price_ngn * item.quantity)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function BillCard({ bill, onInfo, onPay, disabled }: {
  bill: ConsolidationBill;
  onInfo: () => void;
  onPay: () => void;
  disabled?: boolean;
}) {
  const [showItems, setShowItems] = useState(false);
  const hasLineItems = bill.line_items && bill.line_items.length > 1;
  const Icon = bill.kind === 'clearance' ? ShieldCheck : Ship;
  const label = bill.kind === 'clearance' ? 'Clearance' : 'Consolidation & shipping';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          <button onClick={onInfo} className="p-0.5">
            <Info className="w-3.5 h-3.5 text-gray-300" />
          </button>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${BILL_STATUS_COLORS[bill.status]}`}>
          {BILL_STATUS_LABELS[bill.status]}
        </span>
      </div>

      <button
        onClick={() => hasLineItems && setShowItems(v => !v)}
        className="block text-lg font-black text-gray-900 mb-2"
        disabled={!hasLineItems}
      >
        {fmt(bill.amount_ngn)}
        {hasLineItems && <span className="text-[10px] font-semibold text-orange-500 ml-1.5">{showItems ? '▲ hide items' : '▼ show items'}</span>}
      </button>

      {hasLineItems && showItems && (
        <div className="bg-gray-50 rounded-lg p-2.5 mb-3 space-y-1">
          {bill.line_items!.map((li, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] text-gray-600 gap-2">
              <span className="truncate">{li.label}</span>
              <span className="font-semibold flex-shrink-0">{fmt(li.amount_ngn)}</span>
            </div>
          ))}
        </div>
      )}

      {bill.status === 'pending' && (
        <button
          onClick={onPay}
          disabled={disabled}
          className="text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-lg disabled:opacity-40"
        >
          Pay with Paystack
        </button>
      )}
    </div>
  );
}
