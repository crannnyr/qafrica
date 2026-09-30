// Account: confirm the owner's email (step 1 of the setup guide).
// Order, payout and security emails only reach owners whose address is real.
// Never blocks the dashboard. Also the way to fix a mistyped signup address.

import { useState } from 'react';
import { Mail, ShieldCheck, CheckCircle2, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import CONFIG from '@/lib/config';
import { supabase } from '@/services';
import { useAuthStore } from '@/stores';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/owner-email-verification`;

async function call(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const res = await fetch(`${EDGE_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, payload: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, payload: { message: 'No connection. Check your internet and try again.' } };
  }
}

export default function AccountTab() {
  const { user, fetchProfile } = useAuthStore();
  const verified = !!user?.email_verified;
  const [email, setEmail] = useState(user?.email ?? '');
  const [editing, setEditing] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const input = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500';

  const sendCode = async () => {
    setBusy(true);
    setError('');
    const { payload } = await call('request-code', editing ? { email: email.trim() } : {});
    setBusy(false);
    if (payload?.already_verified) {
      await fetchProfile();
      toast.success('Your email is already confirmed.');
      return;
    }
    if (!payload?.ok) {
      setError(payload?.message ?? 'We could not send a code. Please try again.');
      return;
    }
    setSentTo(payload.email);
    setCode('');
  };

  const verify = async () => {
    setBusy(true);
    setError('');
    const { payload } = await call('verify-code', { code });
    setBusy(false);
    if (!payload?.ok) {
      setError(payload?.message ?? 'That code did not work.');
      return;
    }
    await fetchProfile();
    setSentTo('');
    setEditing(false);
    toast.success('Email confirmed. You will get order and payout emails here.');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-gray-900">Your email</h2>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg bg-gray-50 p-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">Signed in as</p>
          <p className="font-medium text-gray-900 truncate">{user?.email}</p>
        </div>
        {verified ? (
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-green-50 text-green-700 text-sm font-medium px-3 py-1">
            <CheckCircle2 className="w-4 h-4" /> Confirmed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-amber-50 text-amber-800 text-sm font-medium px-3 py-1">
            Not confirmed yet
          </span>
        )}
      </div>

      {!verified && !sentTo && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Confirm your email so new orders, payouts and security alerts reach you. It takes a minute: we send a 6-digit code, you type it here.
          </p>
          {editing ? (
            <label className="block max-w-md">
              <span className="block text-sm font-medium text-gray-800 mb-1">Correct email address</span>
              <input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm text-gray-600 underline underline-offset-4">
              <PenLine className="w-4 h-4" /> Wrong address? Change it
            </button>
          )}
          <div>
            <Button onClick={sendCode} disabled={busy || (editing && !email.trim())} className="bg-orange-500 hover:bg-orange-600 text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send me a code'}
            </Button>
          </div>
        </div>
      )}

      {!verified && sentTo && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            We sent a 6-digit code to <span className="font-medium text-gray-900">{sentTo}</span>. It expires in 15 minutes. Check spam if you don't see it.
          </p>
          <label className="block max-w-[220px]">
            <span className="block text-sm font-medium text-gray-800 mb-1">Code</span>
            <input
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={`${input} tracking-[0.4em] text-lg font-semibold text-center`}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={verify} disabled={busy || code.length !== 6} className="bg-orange-500 hover:bg-orange-600 text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm email'}
            </Button>
            <Button variant="outline" onClick={sendCode} disabled={busy}>Send a new code</Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {verified && (
        <p className="flex items-start gap-2 text-sm text-gray-600">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
          Order, payout and security emails go to this address.
        </p>
      )}
    </div>
  );
}
