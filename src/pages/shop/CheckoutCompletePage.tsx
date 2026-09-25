// /checkout/complete?ref=QAF-...  (Nomba redirects here after payment)
// Asks the server to confirm with Nomba; never assumes success from the URL.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/stores';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { EscrowExplainer, InfoButton } from './ui';
import { naira } from './format';
import { clearPending, confirmCheckout, readPending, type SessionStatus } from './checkoutApi';

const MAX_WAIT_MS = 2 * 60_000;

export default function CheckoutCompletePage() {
  useForceLightMode();
  const [params] = useSearchParams();
  const ref = params.get('ref') ?? params.get('orderReference') ?? readPending()?.reference ?? '';
  const [s, setS] = useState<SessionStatus | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const removeItem = useCartStore((st) => st.removeItem);
  const started = useRef(0);
  const cleared = useRef(false);

  useEffect(() => {
    if (!ref) return;
    let alive = true;
    let timer: number | undefined;
    started.current = Date.now();
    const tick = async () => {
      const r = await confirmCheckout(ref);
      if (!alive) return;
      if (r) setS(r);
      const done = r && r.status !== 'awaiting_payment';
      if (!done) {
        if (Date.now() - started.current > MAX_WAIT_MS) setTimedOut(true);
        else timer = window.setTimeout(tick, 3000);
      }
    };
    void tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [ref]);

  // Paid: remove just the purchased lines from the cart (once)
  useEffect(() => {
    if (s?.status !== 'paid' || cleared.current) return;
    cleared.current = true;
    const pending = readPending();
    if (pending?.reference === ref) {
      pending.cartItemIds.forEach((id) => removeItem(id));
      clearPending();
    }
  }, [s?.status, ref, removeItem]);

  const email = readPending()?.email ?? '';
  const trackHref = (orderNo: string) => `/track?order=${encodeURIComponent(orderNo)}${email ? `&email=${encodeURIComponent(email)}` : ''}`;

  let body;
  if (!ref) {
    body = <Result icon={<AlertTriangle className="w-12 h-12 text-amber-500" />} title="We couldn't find this payment" text="If you were charged, check your email for a receipt or track your order with your order number." action={<Link to="/track" className={btn}>Track an order</Link>} />;
  } else if (!s || s.status === 'awaiting_payment') {
    body = timedOut ? (
      <Result
        icon={<Clock className="w-12 h-12 text-gray-400" />}
        title="Still waiting for your bank"
        text="Bank transfers can take a few minutes. You don't need to pay again. We'll email you as soon as it's confirmed."
        action={<Link to="/stores" className={btn}>Continue shopping</Link>}
        foot={<p className="text-[11px] text-gray-400 mt-3">Reference {ref}</p>}
      />
    ) : (
      <Result icon={<span className="w-12 h-12 border-[3px] border-gray-900 border-t-transparent rounded-full animate-spin" aria-hidden />} title="Confirming your payment…" text="This usually takes a few seconds. Please keep this page open." />
    );
  } else if (s.status === 'paid') {
    body = (
      <Result
        icon={<CheckCircle2 className="w-12 h-12 text-[#1A7F37]" />}
        title="Payment received"
        text={`${naira(s.amount)} paid. We've emailed your receipt.`}
        foot={
          <div className="mt-5 w-full text-left">
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {s.orders.map((o) => (
                <li key={o.order_number} className="flex items-center justify-between px-3 py-2.5 text-[13px]">
                  <span className="font-medium">#{o.order_number}</span>
                  <Link to={trackHref(o.order_number)} className="text-[12px] font-semibold underline underline-offset-2">Track</Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-gray-500 flex items-start gap-1.5">
              Your money is held safely until you receive your order. <InfoButton title="Buyer protection"><EscrowExplainer /></InfoButton>
            </p>
            <Link to="/stores" className={`${btn} mt-5 w-full justify-center`}>Continue shopping</Link>
          </div>
        }
      />
    );
  } else if (s.status === 'failed' || s.status === 'expired') {
    body = <Result icon={<XCircle className="w-12 h-12 text-[#C4320A]" />} title={s.status === 'expired' ? 'Payment window expired' : 'Payment not completed'} text="You haven't been charged for this order. Your cart is still saved." action={<Link to="/cart" className={btn}>Back to cart</Link>} />;
  } else {
    body = (
      <Result
        icon={<AlertTriangle className="w-12 h-12 text-amber-500" />}
        title="We're checking your payment"
        text="We received a payment but need to review it before confirming your order. Our team will email you within 24 hours. You don't need to pay again."
        action={<Link to="/stores" className={btn}>Continue shopping</Link>}
        foot={<p className="text-[11px] text-gray-400 mt-3">Reference {ref}</p>}
      />
    );
  }

  return <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">{body}</div>;
}

const btn = 'inline-flex h-11 px-6 items-center rounded-lg bg-gray-900 text-white text-[14px] font-semibold';

function Result({ icon, title, text, action, foot }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm flex flex-col items-center text-center" role="status" aria-live="polite">
      {icon}
      <h1 className="mt-4 text-[18px] font-bold">{title}</h1>
      <p className="mt-1.5 text-[13px] text-gray-600">{text}</p>
      {action && <div className="mt-6">{action}</div>}
      {foot}
    </div>
  );
}
