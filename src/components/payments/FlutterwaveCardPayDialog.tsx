// Pay for a store plan by card (Flutterwave). Collects card details, tokenizes + charges on
// the server, then walks through whatever step the issuer asks for (PIN, OTP, AVS address, or
// a 3DS redirect) before the plan activates. Mount it only while paying (it does not auto-start
// like the bank-transfer dialog — the payer must submit their card first).

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  authorizeCardPayment, checkSubscriptionPayment, startCardPayment,
  type CardInput, type NextAction, type SubscriptionPlanRequest,
} from '@/services/flutterwave';

type Props = {
  plan: SubscriptionPlanRequest;
  /** e.g. "Starter Pack · 3 months" */
  planLabel: string;
  amount: number;
  onClose: () => void;
  onPaid: (reference: string) => void;
};

type Phase = 'form' | 'submitting' | 'pin' | 'otp' | 'avs' | 'redirect' | 'confirming' | 'paid' | 'error';

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export default function FlutterwaveCardPayDialog({ plan, planLabel, amount, onClose, onPaid }: Props) {
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  const [card, setCard] = useState<CardInput>({ number: '', cvv: '', expiry_month: '', expiry_year: '' });
  const [saveCard, setSaveCard] = useState(true);
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [avsLine1, setAvsLine1] = useState('');
  const [avsCity, setAvsCity] = useState('');
  const [avsState, setAvsState] = useState('');
  const [avsZip, setAvsZip] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');

  const cardComplete = card.number.replace(/\s+/g, '').length >= 12 && card.cvv.length >= 3
    && card.expiry_month.length === 2 && card.expiry_year.length === 2;

  const finishIfPaid = async (ref: string, status?: string) => {
    if (status && ['succeeded', 'successful'].includes(status.toLowerCase())) {
      setPhase('paid');
      setTimeout(() => onPaid(ref), 1200);
      return true;
    }
    // Fall back to a status check — the webhook or the charge response may already have landed.
    const res = await checkSubscriptionPayment(ref);
    if (res.ok && res.paid) {
      setPhase('paid');
      setTimeout(() => onPaid(ref), 1200);
      return true;
    }
    return false;
  };

  const handleNextAction = async (ref: string, next: NextAction) => {
    if (!next) { setPhase('confirming'); if (!(await finishIfPaid(ref))) { setError('Payment is still processing. Check back shortly.'); setPhase('error'); } return; }
    if (next.type === 'requires_pin' || next.type === 'pin') { setPhase('pin'); return; }
    if (next.type === 'requires_otp' || next.type === 'otp') { setPhase('otp'); return; }
    if (next.type === 'requires_additional_fields' || next.type === 'avs') { setPhase('avs'); return; }
    if (next.type === 'redirect_url' && 'redirect_url' in next && next.redirect_url) { setRedirectUrl(String(next.redirect_url)); setPhase('redirect'); return; }
    // Unknown step type — let the payer know and ask them to retry from the dashboard.
    setError('Your bank needs an extra verification step we don’t support yet. Please try a different card, or contact support with reference ' + ref + '.');
    setPhase('error');
  };

  const submitCard = async () => {
    if (!cardComplete) { toast.error('Fill in all card details.'); return; }
    setPhase('submitting');
    setError('');
    const res = await startCardPayment({ ...plan, card, save_card: saveCard });
    if (!res.ok) { setError(res.message); setPhase('error'); return; }
    setReference(res.reference);
    await handleNextAction(res.reference, res.next_action);
  };

  const submitPin = async () => {
    if (pin.length < 4) { toast.error('Enter your 4-digit card PIN.'); return; }
    setPhase('submitting');
    const res = await authorizeCardPayment(reference, { type: 'pin', pin });
    if (!res.ok) { setError(res.message); setPhase('error'); return; }
    await handleNextAction(reference, res.next_action);
  };

  const submitOtp = async () => {
    if (otp.trim().length < 4) { toast.error('Enter the OTP sent by your bank.'); return; }
    setPhase('submitting');
    const res = await authorizeCardPayment(reference, { type: 'otp', otp: otp.trim() });
    if (!res.ok) { setError(res.message); setPhase('error'); return; }
    await handleNextAction(reference, res.next_action);
  };

  const submitAvs = async () => {
    if (!avsLine1.trim() || !avsCity.trim() || !avsZip.trim()) { toast.error('Fill in your billing address.'); return; }
    setPhase('submitting');
    const res = await authorizeCardPayment(reference, {
      type: 'avs',
      address: { line1: avsLine1.trim(), city: avsCity.trim(), state: avsState.trim(), zip: avsZip.trim() },
    });
    if (!res.ok) { setError(res.message); setPhase('error'); return; }
    await handleNextAction(reference, res.next_action);
  };

  // After the payer comes back from a 3DS redirect (or while waiting on it), keep checking status.
  const pollAfterRedirect = async () => {
    setPhase('confirming');
    const res = await checkSubscriptionPayment(reference);
    if (res.ok && res.paid) { setPhase('paid'); setTimeout(() => onPaid(reference), 1200); }
    else if (res.ok && res.status === 'review') { setError('We received a payment that needs manual review. We’ll follow up shortly.'); setPhase('error'); }
    else { toast.info('Not confirmed yet. If you completed the bank verification, this can take a moment.'); setPhase('redirect'); }
  };

  const canClose = phase !== 'submitting' && phase !== 'confirming';

  return (
    <Dialog open onOpenChange={(o) => { if (!o && canClose) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
          <DialogTitle className="text-lg">Pay by card</DialogTitle>
          <DialogDescription className="mt-1">{planLabel} · {naira(amount)}</DialogDescription>
        </div>

        <div className="px-6 py-5">
          <AnimatePresence mode="wait">
            {phase === 'form' && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Card number</label>
                  <input
                    inputMode="numeric" placeholder="1234 5678 9012 3456" value={card.number}
                    onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/[^\d\s]/g, '').slice(0, 23) }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">MM</label>
                    <input inputMode="numeric" placeholder="MM" maxLength={2} value={card.expiry_month}
                      onChange={(e) => setCard((c) => ({ ...c, expiry_month: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">YY</label>
                    <input inputMode="numeric" placeholder="YY" maxLength={2} value={card.expiry_year}
                      onChange={(e) => setCard((c) => ({ ...c, expiry_year: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">CVV</label>
                    <input inputMode="numeric" placeholder="123" maxLength={4} value={card.cvv}
                      onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} className="rounded border-gray-300" />
                  Save this card for auto-renewal
                </label>

                <Button onClick={submitCard} disabled={!cardComplete} className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white">
                  <Lock className="w-4 h-4 mr-2" /> Pay {naira(amount)}
                </Button>
                <p className="text-xs text-gray-500 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Your card details are encrypted and sent straight to Flutterwave.</p>
              </motion.div>
            )}

            {phase === 'submitting' && (
              <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-10 flex flex-col items-center gap-3 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm text-gray-600 dark:text-gray-300">Processing your card…</p>
              </motion.div>
            )}

            {phase === 'pin' && (
              <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">Enter your card's 4-digit PIN to confirm this payment.</p>
                <input inputMode="numeric" maxLength={4} placeholder="••••" value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-center text-lg tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <Button onClick={submitPin} disabled={pin.length < 4} className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white">Confirm</Button>
              </motion.div>
            )}

            {phase === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">Your bank sent a one-time code (SMS or app). Enter it below.</p>
                <input inputMode="numeric" placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <Button onClick={submitOtp} disabled={otp.trim().length < 4} className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white">Confirm</Button>
              </motion.div>
            )}

            {phase === 'avs' && (
              <motion.div key="avs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">Your bank needs your billing address to confirm this payment.</p>
                <input placeholder="Address" value={avsLine1} onChange={(e) => setAvsLine1(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="City" value={avsCity} onChange={(e) => setAvsCity(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <input placeholder="State" value={avsState} onChange={(e) => setAvsState(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <input placeholder="Postal / ZIP code" value={avsZip} onChange={(e) => setAvsZip(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <Button onClick={submitAvs} className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white">Confirm</Button>
              </motion.div>
            )}

            {phase === 'redirect' && (
              <motion.div key="redirect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center space-y-4">
                <ExternalLink className="w-10 h-10 mx-auto text-orange-500" />
                <p className="font-semibold text-gray-900 dark:text-white">Your bank needs one more step</p>
                <p className="text-sm text-gray-500">Complete verification in the window that opened. Come back here when you're done.</p>
                <Button onClick={() => window.open(redirectUrl, '_blank', 'noopener,noreferrer')} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  <ExternalLink className="w-4 h-4 mr-2" /> Open verification page
                </Button>
                <Button variant="outline" onClick={pollAfterRedirect} className="w-full">I've completed it</Button>
              </motion.div>
            )}

            {phase === 'confirming' && (
              <motion.div key="confirming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center gap-3 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm text-gray-600 dark:text-gray-300">Confirming your payment…</p>
              </motion.div>
            )}

            {phase === 'paid' && (
              <motion.div key="paid" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center text-center gap-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
                  <CheckCircle2 className="w-14 h-14 text-green-500" />
                </motion.div>
                <p className="font-semibold text-gray-900 dark:text-white">Payment received</p>
                <p className="text-sm text-gray-500">Your plan is active. Taking you in…</p>
              </motion.div>
            )}

            {phase === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
                <AlertCircle className="w-10 h-10 mx-auto text-red-500" />
                <p className="mt-3 font-semibold text-gray-900 dark:text-white">Payment couldn't go through</p>
                <p className="mt-1 text-sm text-gray-500">{error}</p>
                <div className="mt-5 flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                  <Button onClick={() => { setError(''); setPhase('form'); }} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">Try again</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/40 text-[11px] text-gray-500 flex flex-wrap items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" /> Secured by Flutterwave{reference ? <> · Ref <span className="font-mono">{reference}</span></> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
