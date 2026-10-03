// Pay for a store plan by bank transfer (Flutterwave).
// Shows a one-time account number for the exact amount, counts down until it expires and
// checks every few seconds until the money lands; the plan is activated on the server.
// Mount it only while paying (it starts the payment when it mounts).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Building2, CheckCircle2, Clock, Copy, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  checkSubscriptionPayment, startSubscriptionPayment,
  type PaymentStatus, type StartResult, type SubscriptionPlanRequest, type TransferAccount,
} from '@/services/flutterwave';

type StartFn = () => Promise<StartResult>;
type CheckFn = (reference: string) => Promise<{ ok: true; status: PaymentStatus; paid: boolean } | { ok: false; message: string }>;

type Props = {
  /** A plan to pay for. Leave out when passing `start` and `check` for another kind of payment. */
  plan?: SubscriptionPlanRequest;
  /** Custom start/check (e.g. custom domains). Default: subscription plan payment. */
  start?: StartFn;
  check?: CheckFn;
  /** What the payer is buying, used in the copy. Default "plan". */
  itemNoun?: string;
  /** Shown under "Payment received". */
  paidMessage?: string;
  /** e.g. "Starter Pack · 3 months" */
  planLabel: string;
  onClose: () => void;
  onPaid: (reference: string) => void;
};

type Phase = 'starting' | 'waiting' | 'checking' | 'paid' | 'review' | 'expired' | 'error';

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
export const PENDING_PAYMENT_KEY = 'qafrica_pending_payment';

export default function FlutterwavePayDialog({ plan, start, check: checkFn, itemNoun = 'plan', paidMessage, planLabel, onClose, onPaid }: Props) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [price, setPrice] = useState(0);
  const [account, setAccount] = useState<TransferAccount | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  const startRef = useRef<StartFn>(start ?? (() => startSubscriptionPayment(plan as SubscriptionPlanRequest)));
  const checkRef = useRef<CheckFn>(checkFn ?? checkSubscriptionPayment);
  const isPlanRef = useRef(!start);
  const paidRef = useRef(false);

  // Start (or restart after expiry)
  useEffect(() => {
    let alive = true;
    startRef.current().then((res) => {
      if (!alive) return;
      if (!res.ok) { setError(res.message); setPhase('error'); return; }
      setReference(res.reference);
      setPrice(res.amount);
      setAccount(res.account);
      setPhase('waiting');
      if (isPlanRef.current) { try { sessionStorage.setItem(PENDING_PAYMENT_KEY, res.reference); } catch { /* private mode */ } }
    });
    return () => { alive = false; };
  }, [attempt]);

  const check = useCallback(async (manual = false) => {
    if (!reference || paidRef.current) return;
    if (manual) setPhase('checking');
    const res = await checkRef.current(reference);
    if (!res.ok) { if (manual) { setPhase('waiting'); toast.error(res.message); } return; }
    if (res.paid) {
      paidRef.current = true;
      setPhase('paid');
      try { sessionStorage.removeItem(PENDING_PAYMENT_KEY); } catch { /* ignore */ }
      setTimeout(() => onPaid(reference), 1200);
    } else if (res.status === 'review') {
      setPhase('review');
    } else if (res.status === 'expired') {
      setPhase('expired');
    } else if (manual) {
      setPhase('waiting');
      toast.info('Not received yet. Bank transfers usually land within a minute. We’ll keep checking.');
    }
  }, [reference, onPaid]);

  // Poll every 5 seconds while waiting; tick the countdown every second
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'checking') return;
    const poll = setInterval(() => { void check(); }, 5000);
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [phase, check]);

  const expiresMs = account?.expires_at ? Date.parse(account.expires_at) : NaN;
  const secondsLeft = Number.isFinite(expiresMs) ? Math.max(0, Math.floor((expiresMs - nowMs) / 1000)) : null;
  const timeLeft = secondsLeft === null ? '' : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const fee = account ? Math.max(0, Math.round((account.amount_to_pay - price) * 100) / 100) : 0;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error('Could not copy. Please copy it by hand.'); }
  };

  const restart = () => { setAccount(null); setReference(''); setPhase('starting'); setAttempt((a) => a + 1); };
  const canClose = phase !== 'checking';

  return (
    <Dialog open onOpenChange={(o) => { if (!o && canClose) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
          <DialogTitle className="text-lg">Pay by bank transfer</DialogTitle>
          <DialogDescription className="mt-1">{planLabel}</DialogDescription>
        </div>

        <div className="px-6 py-5">
          <AnimatePresence mode="wait">
            {phase === 'starting' && (
              <motion.div key="starting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-10 flex flex-col items-center gap-3 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm text-gray-600 dark:text-gray-300">Getting your payment account…</p>
              </motion.div>
            )}

            {(phase === 'waiting' || phase === 'checking') && account && (
              <motion.div key="waiting" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Open your bank app and send <strong>exactly</strong> this amount, in one transfer, to the account below.
                </p>

                <div className="mt-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                  <Row label="Amount" value={naira(account.amount_to_pay)} big onCopy={() => copy(String(account.amount_to_pay), 'Amount')} />
                  <Row label="Account number" value={account.account_number} big mono onCopy={() => copy(account.account_number, 'Account number')} />
                  <Row label="Bank" value={account.bank_name} />
                  <Row label="Account name" value={account.account_name} />
                </div>

                {fee > 0 && (
                  <p className="mt-2 text-xs text-gray-500"><span className="capitalize">{itemNoun}</span> {naira(price)} + {naira(fee)} Flutterwave transfer fee.</p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-gray-600 dark:text-gray-300">
                    <Clock className="w-4 h-4" />
                    {timeLeft ? <>Account expires in <strong className="tabular-nums">{timeLeft}</strong></> : 'Account valid for 60 minutes'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-500">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>
                    Watching for your transfer
                  </span>
                </div>

                <Button onClick={() => check(true)} disabled={phase === 'checking'} className="mt-5 w-full h-11 bg-orange-500 hover:bg-orange-600 text-white">
                  {phase === 'checking' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking…</> : 'I’ve sent the money'}
                </Button>

                <ul className="mt-4 space-y-1.5 text-xs text-gray-500">
                  <li className="flex gap-2"><Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> This account is only for this payment. Don’t save it for later.</li>
                  <li className="flex gap-2"><ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {itemNoun === 'plan' ? 'Your plan switches on by itself' : 'We record your payment by itself'} when the money lands, even if you close this window.</li>
                </ul>
              </motion.div>
            )}

            {phase === 'paid' && (
              <motion.div key="paid" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center text-center gap-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
                  <CheckCircle2 className="w-14 h-14 text-green-500" />
                </motion.div>
                <p className="font-semibold text-gray-900 dark:text-white">Payment received</p>
                <p className="text-sm text-gray-500">{paidMessage ?? 'Your plan is active. Taking you in…'}</p>
              </motion.div>
            )}

            {phase === 'expired' && (
              <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
                <Clock className="w-10 h-10 mx-auto text-gray-400" />
                <p className="mt-3 font-semibold text-gray-900 dark:text-white">This account has expired</p>
                <p className="mt-1 text-sm text-gray-500">If you already sent the money, it will still be matched to your {itemNoun}. Otherwise get a new account.</p>
                <Button onClick={restart} className="mt-5 w-full bg-orange-500 hover:bg-orange-600 text-white"><RefreshCw className="w-4 h-4 mr-2" /> Get a new account</Button>
              </motion.div>
            )}

            {phase === 'review' && (
              <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
                <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
                <p className="mt-3 font-semibold text-gray-900 dark:text-white">We received a transfer that needs checking</p>
                <p className="mt-1 text-sm text-gray-500">The amount didn’t match the {itemNoun}. Our team will sort it out and contact you. Your reference: <span className="font-mono">{reference}</span></p>
                <Button variant="outline" onClick={onClose} className="mt-5 w-full">Close</Button>
              </motion.div>
            )}

            {phase === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
                <AlertCircle className="w-10 h-10 mx-auto text-red-500" />
                <p className="mt-3 font-semibold text-gray-900 dark:text-white">Payment couldn’t start</p>
                <p className="mt-1 text-sm text-gray-500">{error}</p>
                <div className="mt-5 flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                  <Button onClick={restart} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">Try again</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/40 text-[11px] text-gray-500 flex flex-wrap items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Secured by Flutterwave{reference ? <> · Ref <span className="font-mono">{reference}</span></> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, big, mono, onCopy }: { label: string; value: string; big?: boolean; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`${big ? 'text-xl font-bold' : 'text-sm font-medium'} ${mono ? 'font-mono tracking-wider' : ''} text-gray-900 dark:text-white break-words`}>{value}</p>
      </div>
      {onCopy && (
        <button type="button" onClick={onCopy} aria-label={`Copy ${label.toLowerCase()}`} className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10">
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
      )}
    </div>
  );
}
