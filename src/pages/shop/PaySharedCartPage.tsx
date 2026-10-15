// /pay/:code  Someone asked you to pay for their cart. No account needed.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Gift, Lock, ShieldCheck, MapPin, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { EscrowExplainer, Field, InfoButton } from './ui';
import { naira } from './format';
import { getSharedCart, paySharedCart, type SharedCartView } from './checkoutApi';

export default function PaySharedCartPage() {
  useForceLightMode();
  const { code = '' } = useParams();
  const [cart, setCart] = useState<SharedCartView | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSharedCart(code).then((c) => alive && setCart(c));
    return () => {
      alive = false;
    };
  }, [code]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (name.trim().length < 2) fe.payer_name = 'Enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) fe.payer_email = 'Enter a valid email for your receipt';
    if (cart?.is_marketplace && contributionAmount.trim()) {
      const amount = Number(contributionAmount);
      const remaining = Math.max(Number(cart.remaining_amount ?? cart.quote?.amount ?? 0), 0);
      const minimum = Math.min(1000, remaining);
      if (!Number.isFinite(amount) || amount < minimum) fe.contribution_amount = 'Minimum contribution is ' + naira(minimum);
      else if (amount > remaining) fe.contribution_amount = 'Maximum contribution is ' + naira(remaining);
    }
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setFormError(null);
    const r = await paySharedCart(code, { name: name.trim(), email: email.trim() }, cart?.is_marketplace && contributionAmount.trim() ? Number(contributionAmount) : undefined);
    if (!r.ok) {
      setBusy(false);
      if (r.field_errors) setErrors(r.field_errors);
      setFormError(r.error);
      return;
    }
    window.location.href = r.checkout_link;
  };

  if (cart === undefined) {
    return <div className="min-h-screen flex items-center justify-center"><span className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" aria-label="Loading" /></div>;
  }

  if (!cart || cart.status !== 'active' || !cart.quote) {
    const msg = !cart ? 'This link is not valid.' : cart.status === 'paid' ? `Someone has already paid for ${cart.first_name}'s cart. Thank you!` : 'This payment link has expired.';
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <Gift className="w-12 h-12 text-gray-300" aria-hidden />
        <p className="mt-4 text-[15px] font-semibold">{msg}</p>
        <Link to="/stores" className="mt-6 inline-flex h-10 px-6 items-center rounded-lg bg-gray-900 text-white text-[13px] font-semibold">Shop on QAFRICA</Link>
      </div>
    );
  }

  const q = cart.quote;
  const blocked = !q.ok;
  const targetAmount = Number(cart.target_amount ?? q.amount);
  const amountRaised = Math.max(Number(cart.amount_raised ?? 0), 0);
  const remainingAmount = Math.max(Number(cart.remaining_amount ?? q.amount), 0);
  const paymentLabelAmount = cart.is_marketplace && contributionAmount.trim() && Number(contributionAmount) > 0 ? Number(contributionAmount) : remainingAmount;

  // Allocate pooled contributions to the lowest-priced cart lines first.
  // This is a deterministic display rule; the underlying payment total remains unchanged.
  const progressLines = q.stores.flatMap((store) =>
    store.items.map((item, index) => ({
      key: `${store.store_id}:${item.product_id}:${index}`,
      name: item.name,
      image: item.image,
      quantity: item.quantity,
      total: Math.max(0, Number(item.total_price) || 0),
      variant_options: item.variant_options,
    })),
  ).sort((a, b) => a.total - b.total);
  let fundsToAllocate = amountRaised;
  const itemProgress = progressLines.map((item) => {
    const funded = Math.min(item.total, fundsToAllocate);
    fundsToAllocate = Math.max(0, fundsToAllocate - funded);
    return { ...item, funded, complete: item.total > 0 && funded >= item.total, percent: item.total > 0 ? Math.min(100, funded / item.total * 100) : 0 };
  });

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-gray-900 pb-10">
      <header className="bg-white border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto h-12 px-4 flex items-center gap-2">
          <img src="/qafrica-bag-logo.svg" alt="" className="w-6 h-6 rounded-md object-cover" />
          <span className="text-[14px] font-bold">QAFRICA</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500"><Lock className="w-3.5 h-3.5" aria-hidden />Secure</span>
        </div>
      </header>

      <div className="max-w-md mx-auto space-y-2 pt-2">
        <section className="bg-white px-4 py-5 text-center">
          <Gift className="w-9 h-9 mx-auto text-[#FA6338]" aria-hidden />
          <h1 className="mt-2 text-[17px] font-bold">{cart.first_name} asked you to help pay</h1>
          <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-gray-500"><MapPin className="w-3.5 h-3.5" aria-hidden />Delivers to {[cart.city, cart.state].filter(Boolean).join(', ')}</p>
          {cart.note && <p className="mt-3 mx-auto max-w-xs rounded-lg bg-[#FFF6EE] px-3 py-2 text-[13px] text-gray-800">“{cart.note}”</p>}
        </section>

        {q.stores.map((s) => (
          <section key={s.store_id} className="bg-white px-4 py-4">
            <p className="text-[13px] font-semibold mb-2">{s.store_name}</p>
            <ul className="space-y-2.5">
              {s.items.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <div className="w-14 h-14 rounded-md bg-gray-100 overflow-hidden shrink-0">{l.image && <img src={l.image} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] line-clamp-2">{l.name}</p>
                    <p className="text-[12px] text-gray-500">Qty {l.quantity}{l.variant_options ? ` · ${Object.values(l.variant_options).join(' / ')}` : ''}</p>
                  </div>
                  <p className="text-[13px] font-semibold tabular-nums">{naira(l.total_price)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-[13px]">
              <span className="text-gray-600">Delivery</span>
              <span className="tabular-nums">{s.delivery_fee ? naira(s.delivery_fee) : 'Free'}</span>
            </div>
          </section>
        ))}

        {cart.is_marketplace && (
          <section className="bg-white px-4 py-4">
            <div className="flex items-center justify-between text-[13px] font-semibold"><span>Help Pay progress</span><span>{naira(amountRaised)} of {naira(targetAmount)}</span></div>
            <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={targetAmount} aria-valuenow={Math.min(amountRaised, targetAmount)}><div className="h-full bg-[#FA6338] transition-all duration-300" style={{ width: (targetAmount > 0 ? Math.min(100, amountRaised / targetAmount * 100) : 0) + '%' }} /></div>
            <p className="mt-2 text-[12px] text-gray-500">Remaining: {naira(remainingAmount)}. Contributions cover the lowest-priced items first; an item is marked complete once its full amount is covered.</p>
            <ul className="mt-4 space-y-3" aria-label="Item funding progress">
              {itemProgress.map((item) => (
                <li key={item.key} className="flex items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-medium text-gray-800 line-clamp-1">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</p>
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums">{item.complete ? 'Completed' : `${Math.round(item.percent)}%`}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label={`${item.name} funding progress`} aria-valuemin={0} aria-valuemax={item.total} aria-valuenow={item.funded}>
                      <div className="h-full rounded-full bg-[#FA6338] transition-all duration-300" style={{ width: `${item.percent}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-500 tabular-nums">{naira(item.funded)} of {naira(item.total)}</p>
                  </div>
                  {item.complete ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Item fully funded" /> : <Circle className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />}
                </li>
              ))}
            </ul>
          </section>
        )}

        {blocked && (
          <div className="mx-4 rounded-lg bg-[#FFF4F0] border border-[#FFD8CC] p-3 text-[12px] text-[#C4320A] flex gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
            <span>{q.errors[0]?.message ?? 'Some items are no longer available.'} Let {cart.first_name} know so they can update their cart.</span>
          </div>
        )}

        <form onSubmit={pay} className="bg-white px-4 py-4 space-y-3">
          <h2 className="text-[14px] font-semibold flex items-center gap-1.5">
            Your details
            <InfoButton title="Paying for someone">
              <p>You pay through QAFRICA and the order is delivered to {cart.first_name}. You don't need an account.</p>
              <p>We'll email your receipt. We never share your details with {cart.first_name}'s sellers.</p>
            </InfoButton>
          </h2>
          {cart.is_marketplace && <div><label htmlFor="contribution_amount" className="block text-[12px] font-medium text-gray-700 mb-1">Contribution amount (₦)</label><input id="contribution_amount" type="number" min={Math.min(1000, remainingAmount)} max={remainingAmount} step="0.01" inputMode="decimal" value={contributionAmount} onChange={(e) => setContributionAmount(e.target.value)} placeholder={String(Math.round(remainingAmount))} className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900" aria-describedby="contribution-help" aria-invalid={Boolean(errors.contribution_amount)} />{errors.contribution_amount && <p className="mt-1 text-[12px] text-[#C4320A]" role="alert">{errors.contribution_amount}</p>}<p id="contribution-help" className="mt-1 text-[11px] text-gray-500">Minimum {naira(Math.min(1000, remainingAmount))}. Leave blank to pay the remaining balance.</p></div>}
          <Field id="payer_name" label="Your name" value={name} onChange={setName} error={errors.payer_name} autoComplete="name" />
          <Field id="payer_email" label="Email for your receipt" type="email" inputMode="email" value={email} onChange={setEmail} error={errors.payer_email} autoComplete="email" />
          <div className="flex items-start gap-2 text-[12px] text-gray-500">
            <ShieldCheck className="w-4 h-4 text-[#1A7F37] shrink-0" aria-hidden />
            <span>Money is held by QAFRICA until delivery. <InfoButton title="Buyer protection"><EscrowExplainer /></InfoButton></span>
          </div>
          {formError && <p className="text-[13px] text-[#C4320A]" role="alert">{formError}</p>}
          <button type="submit" disabled={busy || blocked} className="w-full h-12 rounded-lg bg-gray-900 text-white text-[15px] font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" aria-hidden />
            {busy ? 'Opening payment…' : `Pay ${naira(paymentLabelAmount)}`}
          </button>
          <p className="text-center text-[11px] text-gray-400">Never send money to anyone outside QAFRICA for this cart.</p>
        </form>
      </div>
    </div>
  );
}
