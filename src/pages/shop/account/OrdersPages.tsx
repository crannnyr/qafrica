// /customer/orders?tab=  and  /customer/orders/:orderId
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Package, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import CONFIG from '@/lib/config';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { EscrowExplainer, InfoButton, PageHeader } from '../ui';
import { naira } from '../format';
import { BUCKETS, bucketOf, fetchOrder, productImages, statusLabel, useMyOrders, type Bucket, type MyOrder } from './data';

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function OrdersPage() {
  useForceLightMode();
  const { isAuthenticated } = useCustomerAuthStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Bucket) || 'all';
  const { orders } = useMyOrders();
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orders?.length) return;
    let alive = true;
    productImages(orders.flatMap((o) => o.order_items.map((i) => i.product_id ?? ''))).then((m) => alive && setImages(m));
    return () => {
      alive = false;
    };
  }, [orders]);

  if (!isAuthenticated) return <Navigate to={`/customer/login?return=${encodeURIComponent('/customer/orders')}`} replace />;
  const shown = (orders ?? []).filter((o) => tab === 'all' || bucketOf(o) === tab);

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-10">
      <PageHeader title="My orders" back="/customer/dashboard" />
      <div className="bg-white border-b border-gray-100 sticky top-12 z-30">
        <div className="max-w-2xl mx-auto flex gap-5 px-4 overflow-x-auto scrollbar-hide" role="tablist">
          {BUCKETS.map((b) => (
            <button key={b.id} role="tab" aria-selected={tab === b.id} onClick={() => setParams({ tab: b.id })}
              className={`shrink-0 py-2.5 text-[13px] border-b-2 ${tab === b.id ? 'border-gray-900 font-semibold' : 'border-transparent text-gray-500'}`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-2xl mx-auto space-y-2 pt-2">
        {!orders && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-white animate-pulse" />)}
        {orders && shown.length === 0 && (
          <div className="bg-white px-6 py-14 text-center">
            <Package className="w-10 h-10 mx-auto text-gray-300" aria-hidden />
            <p className="mt-3 text-[14px] font-semibold">No orders here</p>
            <p className="mt-1 text-[12px] text-gray-500">Orders you place while signed in show up here. Guest orders can be tracked with your order number.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link to="/stores" className="h-9 px-4 inline-flex items-center rounded-lg bg-gray-900 text-white text-[12px] font-semibold">Shop now</Link>
              <Link to="/track-order" className="h-9 px-4 inline-flex items-center rounded-lg border border-gray-900 text-[12px] font-semibold">Track an order</Link>
            </div>
          </div>
        )}
        {shown.map((o) => (
          <Link key={o.id} to={`/customer/orders/${o.id}`} className="block bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="font-semibold truncate">{o.stores?.name ?? 'Store'}</span>
              <span className={o.buyer_reported_issue ? 'text-[#C4320A]' : 'text-gray-600'}>{statusLabel(o)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {o.order_items.slice(0, 4).map((it, i) => (
                <span key={i} className="w-14 h-14 rounded-md bg-gray-100 overflow-hidden shrink-0">
                  {it.product_id && images[it.product_id] && <img src={images[it.product_id]} alt="" className="w-full h-full object-cover" />}
                </span>
              ))}
              {o.order_items.length === 1 && <span className="text-[12px] text-gray-700 line-clamp-2 flex-1">{o.order_items[0].product_name}</span>}
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px] text-gray-500">
              <span>#{o.order_number} · {fmt(o.created_at)}</span>
              <span className="text-[13px] font-bold text-gray-900">{naira(o.total)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function OrderPage() {
  useForceLightMode();
  const { orderId = '' } = useParams();
  const { customer, isAuthenticated } = useCustomerAuthStore();
  const [o, setO] = useState<MyOrder | null | undefined>(undefined);
  const [images, setImages] = useState<Record<string, string>>({});
  const [reporting, setReporting] = useState(false);
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!customer) return;
    const d = await fetchOrder(orderId, customer.id);
    setO(d);
    if (d) setImages(await productImages(d.order_items.map((i) => i.product_id ?? '')));
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, customer?.id]);

  if (!isAuthenticated) return <Navigate to={`/customer/login?return=${encodeURIComponent(`/customer/orders/${orderId}`)}`} replace />;
  if (o === undefined) return <div className="min-h-screen bg-white"><PageHeader title="Order" back="/customer/orders" /><div className="h-40 m-4 bg-gray-100 rounded-xl animate-pulse" /></div>;
  if (o === null) return <div className="min-h-screen bg-white"><PageHeader title="Order" back="/customer/orders" /><p className="p-10 text-center text-[13px] text-gray-600">We couldn't find this order on your account.</p></div>;

  const canConfirm = o.payment_status === 'paid' && ['shipped', 'out_for_delivery', 'delivered'].includes(o.status) && !o.is_escrow_released && !o.buyer_reported_issue;
  const canReport = o.payment_status === 'paid' && !o.is_escrow_released && !o.buyer_reported_issue;

  const confirm = async () => {
    if (!window.confirm('Confirm you received everything in this order? The seller will then be paid.')) return;
    setBusy(true);
    const { error } = await supabase.rpc('release_escrow_funds', { p_order_id: o.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Thanks! The seller has been paid.');
    void load();
  };
  const report = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('report_order_issue', { p_order_id: o.id, p_description: issue });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Problem reported. Payment is on hold while we look into it.');
    setReporting(false);
    void load();
  };

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-28">
      <PageHeader title={`Order #${o.order_number}`} back="/customer/orders" />
      <div className="max-w-2xl mx-auto space-y-2 pt-2">
        <section className="bg-white px-4 py-4">
          <p className={`text-[15px] font-bold ${o.buyer_reported_issue ? 'text-[#C4320A]' : ''}`}>{statusLabel(o)}</p>
          <p className="mt-1 text-[12px] text-gray-500">
            {o.buyer_reported_issue ? 'QAFRICA is reviewing the problem you reported. The seller has not been paid.'
              : o.is_escrow_released ? 'Order complete. The seller has been paid.'
              : canConfirm ? 'Received everything? Confirm below so the seller gets paid. If not, report a problem.'
              : 'Your payment is held safely until you receive this order.'}
            {' '}<InfoButton title="Buyer protection"><EscrowExplainer /></InfoButton>
          </p>
          {o.tracking_number && <p className="mt-2 text-[12px]">Tracking: <span className="font-medium">{o.tracking_number}</span></p>}
          <Link to={`/track?order=${encodeURIComponent(o.order_number)}&email=${encodeURIComponent(o.customer_email ?? '')}`} className="mt-3 inline-block text-[12px] font-semibold underline underline-offset-2">See full timeline</Link>
        </section>

        <section className="bg-white px-4 py-4">
          <Link to={`/${o.stores?.slug ?? ''}`} className="text-[13px] font-semibold">{o.stores?.name}</Link>
          <ul className="mt-3 space-y-2.5">
            {o.order_items.map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-14 h-14 rounded-md bg-gray-100 overflow-hidden shrink-0">{it.product_id && images[it.product_id] && <img src={images[it.product_id]} alt="" className="w-full h-full object-cover" />}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] line-clamp-2">{it.product_name}</p>
                  <p className="text-[12px] text-gray-500">Qty {it.quantity}{it.variant_options ? ` · ${Object.values(it.variant_options).join(' / ')}` : ''}</p>
                </div>
                <p className="text-[13px] tabular-nums">{naira(it.total_price)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-100 text-[13px] space-y-1">
            <div className="flex justify-between"><span className="text-gray-600">Items</span><span>{naira(o.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Delivery</span><span>{naira(o.delivery_fee)}</span></div>
            {!!o.coupon_discount && <div className="flex justify-between text-[#1A7F37]"><span>Discount</span><span>−{naira(o.coupon_discount)}</span></div>}
            <div className="flex justify-between font-semibold pt-1"><span>Total paid</span><span>{naira(o.total)}</span></div>
          </div>
          {o.delivery_address && (
            <p className="mt-3 text-[12px] text-gray-600">Delivering to {[o.delivery_address.address, o.delivery_address.city, o.delivery_address.state].filter(Boolean).join(', ')}</p>
          )}
        </section>

        {reporting && (
          <section className="bg-white px-4 py-4">
            <label htmlFor="issue" className="text-[13px] font-semibold">What's wrong?</label>
            <p className="text-[12px] text-gray-500 mt-0.5">E.g. item not received, damaged, wrong item or size. The seller won't be paid until this is resolved.</p>
            <textarea id="issue" rows={4} value={issue} onChange={(e) => setIssue(e.target.value.slice(0, 1000))} className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900" />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={report} disabled={busy || issue.trim().length < 10} className="h-10 px-4 rounded-lg bg-[#C4320A] text-white text-[13px] font-semibold disabled:opacity-40">Send report</button>
              <button type="button" onClick={() => setReporting(false)} className="h-10 px-4 rounded-lg border border-gray-300 text-[13px]">Cancel</button>
            </div>
          </section>
        )}

        <section className="bg-white px-4 py-4 text-[13px]">
          <p className="font-semibold">Need help?</p>
          <a href={`mailto:${CONFIG.PLATFORM_EMAIL}?subject=${encodeURIComponent(`Order #${o.order_number}`)}`} className="mt-2 inline-flex items-center gap-1.5 text-[12px] underline underline-offset-2"><Mail className="w-4 h-4" aria-hidden />Email customer service</a>
        </section>
      </div>

      {(canConfirm || (canReport && !reporting)) && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="max-w-2xl mx-auto h-16 px-4 flex items-center gap-2">
            {canReport && !reporting && (
              <button type="button" onClick={() => setReporting(true)} className="h-11 flex-1 rounded-lg border border-gray-300 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4" aria-hidden />Report a problem
              </button>
            )}
            {canConfirm && (
              <button type="button" onClick={confirm} disabled={busy} className="h-11 flex-1 rounded-lg bg-gray-900 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" aria-hidden />Confirm received
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
