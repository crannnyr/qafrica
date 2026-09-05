// src/pages/recommendations/ImportForgotPasswordSheet.tsx
// Forgot-password flow for importation customers: email -> 6-digit code ->
// new password. Runs entirely through our own Resend-backed password-reset
// function; Supabase Auth's mailer is not involved, so nothing here depends on
// the contents of a dashboard email template.
//
// Deliberately never reveals whether an email is registered: the same
// generic "check your email" message shows regardless, since confirming
// account existence would let anyone enumerate real customer emails.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, Eye, EyeOff, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import CONFIG from '@/lib/config';

// Reset runs entirely through our own Resend-backed endpoint. Supabase Auth's
// mailer is not involved, so nothing here depends on the state of a dashboard
// email template.
const RESET_URL = `${CONFIG.SUPABASE_URL}/functions/v1/password-reset`;

type Step = 'email' | 'code' | 'newPassword' | 'done';

export default function ImportForgotPasswordSheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const call = async (action: string, payload: Record<string, unknown>) => {
    const res = await fetch(`${RESET_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: res.status, payload: await res.json().catch(() => ({})) };
  };

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setError('');

    const { payload } = await call('request-code', { email: email.trim() });
    setIsLoading(false);

    // The server returns the same generic success whether or not the address
    // has an account, so this form cannot be used to test which customer
    // emails are registered. Only genuine faults — rate limits and delivery
    // failures — surface as errors.
    if (payload?.ok !== true) {
      setError(payload?.error || 'We could not send the code right now. Please try again shortly.');
      return;
    }

    setStep('code');
  };

  // Verification and the password change happen in a single server call. The
  // old flow verified the code, which SIGNED THE USER IN, and only then set
  // the password — so abandoning the page midway left a stranger holding a
  // logged-in session on someone else's account. Nothing is granted here
  // until the new password is actually set.
  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet) { setError('Please meet all password requirements.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    setError('');

    const { payload } = await call('verify-and-reset', {
      email: email.trim(), code: code.trim(), password,
    });

    setIsLoading(false);

    if (payload?.ok !== true) {
      const remaining = payload?.attempts_remaining;
      const message = typeof remaining === 'number' && remaining > 0
        ? `${payload.error} ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
        : (payload?.error || 'We could not reset your password. Please try again.');
      setError(message);
      // A bad or expired code sends them back to the code step; a rejected
      // password keeps them here so they can simply pick another one.
      if (/code/i.test(payload?.error ?? '')) setStep('code');
      return;
    }

    setStep('done');
  };

  const goToPasswordStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError('');
    setStep('newPassword');
  };

  // NIST SP 800-63B guidance is length-first: long passphrases beat short
  // passwords with forced composition rules, and complexity mandates mostly
  // push people toward predictable substitutions. So the bar is 10 characters
  // rather than 8-plus-a-digit, and we reject the obvious reused passwords.
  // Server-side breach checking (HaveIBeenPwned) is a separate Supabase Auth
  // setting and is the real backstop.
  const COMMON_PASSWORDS = [
    'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
    'qwerty123', 'qwertyuiop', 'iloveyou', 'admin123', 'letmein1', 'welcome1',
    'football1', 'monkey123', 'abc12345', 'passw0rd', 'sunshine1', 'princess1',
  ];
  const normalised = password.trim().toLowerCase();
  const isCommon = COMMON_PASSWORDS.includes(normalised);

  const passwordRequirements = [
    { label: 'At least 10 characters', met: password.length >= 10 },
    { label: 'Not a commonly used password', met: password.length > 0 && !isCommon },
  ];
  const allRequirementsMet = passwordRequirements.every(r => r.met);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-gray-900 text-lg">
            {step === 'email' && 'Reset your password'}
            {step === 'code' && 'Enter your code'}
            {step === 'newPassword' && 'Choose a new password'}
            {step === 'done' && 'All set'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {step === 'email' && (
          <>
            <p className="text-gray-400 text-xs mb-5">Enter your email and we'll send you a 6-digit code.</p>
            <form onSubmit={requestCode} className="space-y-3">
              <input
                type="email" placeholder="Email address" value={email} autoFocus
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
              />
              <button type="submit" disabled={isLoading}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send code
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="text-gray-400 text-xs mb-5">
              If <span className="text-gray-600 font-medium">{email}</span> has a QAFRICA account, a 6-digit code is on its way. It can take a minute — check spam too.
            </p>
            <form onSubmit={goToPasswordStep} className="space-y-3">
              <input
                type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} autoFocus
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg tracking-[0.5em] font-bold focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button type="submit" disabled={isLoading}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verify code
              </button>
              <button type="button" onClick={() => setStep('email')} className="w-full text-center text-xs text-gray-400 font-medium">
                Wrong email? <span className="text-orange-500 font-semibold">Go back</span>
              </button>
            </form>
          </>
        )}

        {step === 'newPassword' && (
          <>
            <p className="text-gray-400 text-xs mb-5">Choose a new password for your account.</p>
            <form onSubmit={submitNewPassword} className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} placeholder="New password" value={password} autoFocus
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'} placeholder="Confirm new password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
              />
              <div className="space-y-1 px-1">
                {passwordRequirements.map(r => (
                  <p key={r.label} className={`text-[11px] flex items-center gap-1.5 ${r.met ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <CheckCircle2 className="w-3 h-3" /> {r.label}
                  </p>
                ))}
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button type="submit" disabled={isLoading}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                {isLoading && <Loader className="w-4 h-4 animate-spin" />}
                Update password
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-2">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-gray-500 text-sm mb-6">Your password's been updated — you're signed in.</p>
            <button onClick={onSuccess}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors">
              Continue
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
