// /track?order=QAF-...&email=...  Order tracking for anyone with the order number + email.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Package, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/services';
import CONFIG from '@/lib/config';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { EscrowExplainer, InfoButton, PageHeader } from './ui';
import { naira } from './format';

type Tracked = {
  order_number: string; status: string; payment_status: string; created_at: string; paid_at: string | null;
  shipped_at: string | null; delivered_at: string | null; escrow_released: boolean; tracking_number: string | null;
  dispute_status: string | null; refund_amount: number | null; subtotal: number; delivery_fee: number; discount: number; total: number;
  deliver_to: { city: string | null; state: string | null }; customer_first_name: string;
  store: { name: string; slug: string; logo_url: string | null };
  items: { name: string; quantity: number; total: number; options: Record<string, string> | null; image: string | null }[];
  siblings: string[];
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null);

export default function OrderTrackingPage() {
  useForceLightMode();
  const [params, setParams] = useSearchParams();
  const [order, setOrder] = useState(params.get('order') ?? '');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [data, setData] = useState<Tracked | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'notfound'>('idle');

  const lookup = async (o: string, e: string) => {
    if (!o.trim() || !e.trim()) return;
    setState('loading');
    const { data: d } = await supabase.rpc('track_order', { p_email: e.trim(), p_order_number: o.trim().replace(/^#/, '') });
    if (d) {
      setData(d as Tracked);
      setState('idle');
    } else {
      setData(null);
      setState('notfound');
    }
  };

  useEffect(() => {
    const o = params.get('order');
    const e = params.get('email');
    if (o && e) void lookup(o, e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900">
      <PageHeader title="Track order" />
      <div className="max-w-xl mx-auto p-4 space-y-3">
        {!data && (
          <form
            className="bg-white rounded-xl p-4 space-y-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              setParams({ order, email }, { replace: true });
              void lookup(order, email);
            }}
          >
            <p className="text-[13px] text-gray-600">Enter the order number from your receipt email and the email you used at checkout.</p>
            <div>
              <label htmlFor="t-order" className="block text-[12px] font-medium mb-1">Order number</label>
              <input id="t-order" value={order} onChange={(e) => setOrder(e.target.value.toUpperCase())} placeholder="QAF-260925-A1B2C3" className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[14px] uppercase focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label htmlFor="t-email" className="block text-[12px] font-medium mb-1">Email</label>
              <input id="t-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            {state === 'notfound' && <p className="text-[12px] text-[#C4320A]" role="alert">We couldn't find an order with those details. Check the order number and email.</p>}
            <button type="submit" disabled={state === 'loading'} className="w-full h-11 rounded-lg bg-gray-900 text-white text-[14px] font-semibold disabled:opacity-50">
              {state === 'loading' ? 'Looking up…' : 'Track order'}
            </button>
          </form>
        )}

        {data && <OrderView o={data} />}
      </div>
    </div>
  );
}

function OrderView({ o }: { o: Tracked }) {
  const cancelled = ['cancelled', 'refunded', 'returned', 'shipment_cancelled'].includes(o.status);
  const preparing = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'].includes(o.status);
  const shipped = !!o.shipped_at || ['shipped', 'out_for_delivery', 'delivered'].includes(o.status);
  const delivered = !!o.delivered_at || o.status === 'delivered';

  const steps = [
    { label: 'Paid', done: o.payment_status === 'paid', at: fmt(o.paid_at), info: 'Your payment was received and is held safely by QAFRICA.' },
    { label: 'Seller preparing', done: preparing, at: null, info: 'The seller has your order and is getting it ready.' },
    { label: 'On the way', done: shipped, at: fmt(o.shipped_at), info: 'The seller has sent your order. They may call you to arrange delivery.' },
    { label: 'Delivered', done: delivered, at: fmt(o.delivered_at), info: 'Your order arrived. If anything is wrong, report it before the payment is released.' },
    { label: 'Payment released', done: o.escrow_released, at: null, info: 'After delivery, we release your payment to the seller. Until then your money is protected.' },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <>
      <section className="bg-white rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-gray-500">Order</p>
            <p className="text-[15px] font-bold truncate">#{o.order_number}</p>
          </div>
          <Link to={`/${o.store.slug}`} className="flex items-center gap-2 min-w-0">
            {o.store.logo_url && <img src={o.store.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />}
            <span className="text-[13px] font-medium truncate">{o.store.name}</span>
          </Link>
        </div>

        {cancelled ? (
          <div className="mt-4 rounded-lg bg-[#FFF4F0] p-3 text-[13px] text-[#C4320A] flex gap-2" role="status">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <span>
              This order was {o.status.replace('_', ' ')}.
              {o.refund_amount ? ` A refund of ${naira(o.refund_amount)} was processed.` : ''}
            </span>
          </div>
        ) : (
          <ol className="mt-5 relative" aria-label="Order progress">
            {steps.map((s, i) => (
              <li key={s.label} className="flex gap-3 pb-5 last:pb-0 relative">
                {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 bottom-0 w-px ${s.done ? 'bg-gray-900' : 'bg-gray-200'}`} aria-hidden />}
                <span
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    s.done ? 'bg-gray-900 text-white' : i === current ? 'border-2 border-gray-900 bg-white' : 'border-2 border-gray-200 bg-white'
                  }`}
                  aria-hidden
                >
                  {s.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </span>
                <div className="flex-1 -mt-0.5">
                  <p className={`text-[13px] flex items-center gap-1 ${s.done || i === current ? 'font-semibold' : 'text-gray-400'}`}>
                    {s.label}
                    {i === current && <span className="sr-only">(current step)</span>}
                    <InfoButton title={s.label}><p>{s.info}</p></InfoButton>
                  </p>
                  {s.at && <p className="text-[11px] text-gray-500">{s.at}</p>}
                  {s.label === 'On the way' && o.tracking_number && <p className="text-[11px] text-gray-600">Tracking: {o.tracking_number}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="bg-white rounded-xl p-4">
        <p className="text-[13px] font-semibold mb-2 flex items-center gap-1.5"><Package className="w-4 h-4" aria-hidden /> Items</p>
        <ul className="space-y-2.5">
          {o.items.map((it, i) => (
            <li key={i} className="flex gap-3">
              <div className="w-12 h-12 rounded-md bg-gray-100 overflow-hidden shrink-0">{it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] line-clamp-1">{it.name}</p>
                <p className="text-[12px] text-gray-500">Qty {it.quantity}{it.options ? ` · ${Object.values(it.options).join(' / ')}` : ''}</p>
              </div>
              <p className="text-[13px] tabular-nums">{naira(it.total)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-3 border-t border-gray-100 text-[13px] space-y-1">
          <div className="flex justify-between"><span className="text-gray-600">Delivery to</span><span>{[o.deliver_to.city, o.deliver_to.state].filter(Boolean).join(', ')}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Delivery</span><span className="tabular-nums">{naira(o.delivery_fee)}</span></div>
          {o.discount > 0 && <div className="flex justify-between text-[#1A7F37]"><span>Discount</span><span>−{naira(o.discount)}</span></div>}
          <div className="flex justify-between font-semibold pt-1"><span>Total paid</span><span className="tabular-nums">{naira(o.total)}</span></div>
        </div>
        {o.siblings.length > 0 && (
          <p className="mt-3 text-[12px] text-gray-500">This checkout also included {o.siblings.map((n) => `#${n}`).join(', ')} from other stores. Each store delivers separately.</p>
        )}
      </section>

      <section className="bg-white rounded-xl p-4 text-[13px]">
        <p className="font-semibold flex items-center gap-1.5">Problem with your order? <InfoButton title="Buyer protection"><EscrowExplainer /></InfoButton></p>
        <p className="mt-1 text-gray-600">Contact us before the payment is released and we'll help sort it out with the seller.</p>
        <a
          href={`mailto:${CONFIG.PLATFORM_EMAIL}?subject=${encodeURIComponent(`Help with order #${o.order_number}`)}`}
          className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-gray-900 text-[13px] font-semibold"
        >
          <Mail className="w-4 h-4" aria-hidden /> Email support
        </a>
      </section>
    </>
  );
}
