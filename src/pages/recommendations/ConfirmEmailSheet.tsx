// src/pages/recommendations/ConfirmEmailSheet.tsx
// Non-blocking email confirmation for importation customers.
//
// This never gates anything. An unconfirmed customer can browse, order and
// pay exactly as before. Confirming simply tells us the address is real, so
// bulk mail can be limited to reachable people — which is what protects the
// sending domain's reputation.
//
// It doubles as the only way a customer can fix a mistyped signup address.
// A visible share of the 1-2 Sep signups went to gamil.com / gmail.con /
// gmal.com and have never received anything from us.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, Mail, ShieldCheck, CheckCircle2, PenLine } from 'lucide-react';
import CONFIG from '@/lib/config';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/account-verification`;

type Step = 'intro' | 'code' | 'done';

export default function ConfirmEmailSheet({ onClose }: { onClose: () => void }) {
  const { customer, fetchProfile } = useCustomerAuthStore();

  const [step, setStep]           = useState<Step>('intro');
  const [email, setEmail]         = useState(customer?.email ?? '');
  const [editingEmail, setEditing] = useState(false);
  const [code, setCode]           = useState('');
  const [isLoading, setLoading]   = useState(false);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');

  const call = async (action: string, body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${EDGE_URL}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, payload: await res.json().catch(() => ({})) };
  };

  const requestCode = async () => {
    setLoading(true);
    setError('');
    setNotice('');

    const { payload } = await call('request-code', { email: email.trim() });
    setLoading(false);

    if (payload?.already_verified) {
      setStep('done');
      await fetchProfile();
      return;
    }
    // Errors are shown rather than swallowed — telling someone a code is on
    // the way when it is not is what makes these flows feel broken.
    if (payload?.ok !== true) {
      setError(payload?.message || 'We could not send the code. Please try again shortly.');
      return;
    }

    setNotice(`Code sent to ${payload.email}. It expires in 15 minutes.`);
    setEditing(false);
    setStep('code');
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    setError('');

    const { payload } = await call('verify-code', { code: code.trim() });
    setLoading(false);

    if (payload?.ok !== true) {
      const remaining = payload?.attempts_remaining;
      setError(
        typeof remaining === 'number' && remaining > 0
          ? `${payload.message} ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : (payload?.message || 'We could not confirm that code.')
      );
      return;
    }

    await fetchProfile();
    setStep('done');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-gray-900">
            {step === 'done' ? 'Email confirmed' : 'Confirm your email'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {step === 'intro' && (
          <div>
            <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-orange-500" />
            </div>
            <p className="text-sm text-gray-600 text-center mb-5">
              We'll send a 6-digit code so we know we can reach you about your
              orders and bills. You can keep using QAFRICA either way.
            </p>

            <label className="block text-xs font-bold text-gray-500 mb-1.5">YOUR EMAIL</label>
            {editingEmail ? (
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-400 focus:outline-none text-sm mb-2"
                placeholder="you@example.com"
              />
            ) : (
              <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 mb-2">
                <span className="text-sm text-gray-900 truncate">{email}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-orange-500 text-xs font-bold shrink-0"
                >
                  <PenLine className="w-3.5 h-3.5" /> Change
                </button>
              </div>
            )}
            <p className="text-[11px] text-gray-400 mb-4">
              Wrong address? Change it here and we'll send the code there instead.
            </p>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button
              onClick={requestCode}
              disabled={isLoading || !email.trim()}
              className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : null}
              Send code
            </button>
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={submitCode}>
            <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-orange-500" />
            </div>
            {notice && <p className="text-sm text-gray-600 text-center mb-5">{notice}</p>}

            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:outline-none text-center text-2xl font-bold tracking-[0.5em] mb-3"
              placeholder="······"
            />

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : null}
              Confirm email
            </button>

            <button
              type="button"
              onClick={() => { setStep('intro'); setCode(''); setError(''); }}
              className="w-full text-xs text-gray-500 font-semibold"
            >
              Didn't get it? Send again or change your email
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Thanks — <strong className="text-gray-900">{email}</strong> is confirmed.
              You'll get your order updates and bills here.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold text-sm"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
