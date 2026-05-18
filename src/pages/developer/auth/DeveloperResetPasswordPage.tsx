// src/pages/developer/auth/DeveloperResetPasswordPage.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Eye, EyeOff, Loader2, ShieldCheck, Check, AlertTriangle } from 'lucide-react';
import { developerAuthService } from '@/services/developer';
import { toast } from 'sonner';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter',       ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',       ok: /[a-z]/.test(password) },
    { label: 'Number',                 ok: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const strengthLabel = score <= 1 ? 'Weak' : score <= 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const strengthColor = score <= 1 ? 'bg-red-400' : score <= 2 ? 'bg-yellow-400' : score === 3 ? 'bg-blue-400' : 'bg-green-500';

  if (!password) return null;
  return (
    <div className="mt-3 space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
            style={{ width: `${(score / 4) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          score <= 1 ? 'text-red-500' : score <= 2 ? 'text-yellow-600' :
          score === 3 ? 'text-blue-600' : 'text-green-600'
        }`}>{strengthLabel}</span>
      </div>
      {/* Checklist */}
      <div className="grid grid-cols-2 gap-1">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${c.ok ? 'bg-green-500' : 'bg-gray-200'}`}>
              {c.ok && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className={`text-xs transition-colors ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeveloperResetPasswordPage() {
  const navigate = useNavigate();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenError,  setTokenError]  = useState(false);
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [errors,      setErrors]      = useState<{ password?: string; confirm?: string }>({});
  const [success,     setSuccess]     = useState(false);

  // Extract access token from URL hash (Supabase sends it as #access_token=...)
  useEffect(() => {
    const hash   = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const token  = params.get('access_token');
    const type   = params.get('type');

    if (token && type === 'recovery') {
      setAccessToken(token);
    } else {
      // Also check query params (some email clients strip hash)
      const qParams = new URLSearchParams(window.location.search);
      const qToken  = qParams.get('access_token');
      if (qToken) {
        setAccessToken(qToken);
      } else {
        setTokenError(true);
      }
    }
  }, []);

  function validate() {
    const errs: typeof errors = {};
    if (!password)                errs.password = 'Password is required.';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (!confirm)                 errs.confirm  = 'Please confirm your new password.';
    else if (password !== confirm) errs.confirm = 'Passwords do not match.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !validate()) return;

    setIsLoading(true);
    try {
      await developerAuthService.resetPassword(accessToken, password);
      setSuccess(true);
      toast.success('Password updated successfully.');
      setTimeout(() => navigate('/developer/login', { replace: true }), 3000);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to reset password. The link may have expired.';
      toast.error(msg);
      if (msg.includes('expired')) {
        setTokenError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">QAFRICA Dev</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {/* ── Invalid / expired token ─────────────────────── */}
          {tokenError ? (
            <div className="text-center">
              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired or invalid</h1>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                This password reset link is invalid or has expired.
                Reset links are valid for 1 hour.
              </p>
              <Link
                to="/developer/forgot-password"
                className="inline-flex items-center justify-center w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Request a new link
              </Link>
              <Link
                to="/developer/login"
                className="block text-sm text-gray-500 hover:text-gray-700 mt-4 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : success ? (
            /* ── Success state ─────────────────────────────── */
            <div className="text-center">
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-green-500" />
                </div>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Password updated</h1>
              <p className="text-sm text-gray-500 mb-6">
                Your password has been changed successfully.
                Redirecting you to sign in...
              </p>
              <div className="flex items-center justify-center gap-2 text-orange-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Redirecting...</span>
              </div>
            </div>
          ) : (
            /* ── Reset form ───────────────────────────────── */
            <>
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-orange-500" />
                </div>
              </div>

              <div className="text-center mb-7">
                <h1 className="text-xl font-bold text-gray-900 mb-2">Set new password</h1>
                <p className="text-sm text-gray-500">
                  Choose a strong password for your developer account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    New password <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors((err) => ({ ...err, password: undefined })); }}
                      placeholder="Minimum 8 characters"
                      autoFocus
                      className={`w-full h-11 pl-4 pr-11 rounded-xl border text-sm text-gray-900 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                        transition-colors bg-white
                        ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((p) => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>}
                  <PasswordStrength password={password} />
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm new password <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); setErrors((err) => ({ ...err, confirm: undefined })); }}
                      placeholder="Re-enter your new password"
                      className={`w-full h-11 pl-4 pr-11 rounded-xl border text-sm text-gray-900 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                        transition-colors bg-white
                        ${errors.confirm ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((p) => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirm && <p className="text-xs text-red-500 mt-1.5">{errors.confirm}</p>}
                  {/* Match indicator */}
                  {confirm && password && !errors.confirm && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs text-green-600">Passwords match</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:bg-orange-700
                    disabled:opacity-60 disabled:cursor-not-allowed
                    text-white font-semibold rounded-xl transition-colors
                    flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating password...</>
                    : <><ShieldCheck className="w-4 h-4" /> Update password</>
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}