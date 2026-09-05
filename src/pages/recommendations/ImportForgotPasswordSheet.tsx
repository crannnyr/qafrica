// src/pages/recommendations/ImportForgotPasswordSheet.tsx
// Forgot-password flow for importation customers: email -> 6-digit code ->
// new password. Uses Supabase's own OTP mechanism (signInWithOtp + verifyOtp)
// rather than a custom code table — same underlying pattern already used for
// signup verification elsewhere in the app, just repurposed for recovery.
//
// Deliberately never reveals whether an email is registered: the same
// generic "check your email" message shows regardless, since confirming
// account existence would let anyone enumerate real customer emails.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, Eye, EyeOff, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';

type Step = 'email' | 'code' | 'newPassword' | 'done';

export default function ImportForgotPasswordSheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { fetchProfile } = useCustomerAuthStore();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setError('');

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    setIsLoading(false);

    // Enumeration protection still applies: "no account with that email" must
    // look identical to success, or this form becomes a way to test which
    // addresses are registered.
    //
    // But the previous version swallowed EVERY error with .catch(() => {}),
    // including rate limits and outright send failures. That told people
    // "check your email" when nothing had been sent, and is a large part of
    // why password reset felt unreliable. Real infrastructure failures are
    // now surfaced; only the account-existence signal stays hidden.
    if (otpError) {
      const message = otpError.message?.toLowerCase() ?? '';
      const isRateLimited =
        otpError.status === 429 ||
        message.includes('rate limit') ||
        message.includes('only request this after') ||
        message.includes('too many');

      if (isRateLimited) {
        setError('Too many code requests. Please wait a minute and try again.');
        return;
      }

      // Anything that is clearly a delivery/infrastructure fault, as opposed
      // to "that user does not exist", is worth telling the person about —
      // otherwise they sit waiting for a code that is never coming.
      const isSendFailure =
        message.includes('error sending') ||
        message.includes('smtp') ||
        (otpError.status ?? 0) >= 500;

      if (isSendFailure) {
        setError('We could not send the code right now. Please try again shortly.');
        return;
      }
      // Otherwise fall through silently — same screen as success.
    }

    setStep('code');
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setIsLoading(true);
    setError('');
    const { error: otpError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setIsLoading(false);
    if (otpError) {
      setError('That code is invalid or has expired. Please try again.');
      return;
    }
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

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet) { setError('Please meet all password requirements.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setIsLoading(false);
      // Once leaked-password protection is enabled in Supabase Auth, a
      // password found in the HaveIBeenPwned corpus is rejected here. The raw
      // message is not something a customer can act on, so translate it.
      const raw = updateError.message?.toLowerCase() ?? '';
      if (raw.includes('pwned') || raw.includes('compromised') || raw.includes('data breach')) {
        setError('That password has appeared in a known data breach. Please choose a different one.');
        return;
      }
      setError(updateError.message || 'Could not update your password. Please try again.');
      return;
    }

    // Branded confirmation email — same nice-touch pattern used across the app.
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      supabase.functions.invoke('send-email', {
        body: {
          to: user.email,
          subject: 'Your QAFRICA password was reset',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
                <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
              </div>
              <h2 style="color:#111827;margin:0 0 8px;">Password Reset Successful</h2>
              <p style="color:#6B7280;margin:0 0 20px;">
                Your QAFRICA Import account password was just reset. You can now sign in with your new password.
              </p>
              <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;">
                <p style="margin:0;font-size:14px;color:#374151;">
                  <strong>If you did not request this reset</strong>, please contact support immediately.
                </p>
              </div>
            </div>
          `,
        },
      }).catch(() => {});
    }

    await fetchProfile();
    setIsLoading(false);
    setStep('done');
  };

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
            <form onSubmit={verifyCode} className="space-y-3">
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
            <form onSubmit={setNewPassword} className="space-y-3">
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
