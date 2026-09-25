// /customer/login and /customer/signup: one clean page, two modes. Honours ?return=/path
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useCustomerAuthStore } from '@/stores';
import { useForceLightMode } from '@/hooks/useForceLightMode';
import { Field, PageHeader } from '../ui';

const safeReturn = (r: string | null) => (r && r.startsWith('/') && !r.startsWith('//') ? r : '/customer/dashboard');

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  useForceLightMode();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = safeReturn(params.get('return'));
  const { login, signup, loginWithGoogle } = useCustomerAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const fe: Record<string, string> = {};
    if (mode === 'signup' && name.trim().length < 2) fe.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) fe.email = 'Enter a valid email address';
    if (password.length < (mode === 'signup' ? 8 : 1)) fe.password = mode === 'signup' ? 'Use at least 8 characters' : 'Enter your password';
    if (mode === 'signup' && !agree) fe.agree = 'Please accept the terms to continue';
    setErrors(fe);
    if (Object.keys(fe).length) return;

    setBusy(true);
    if (mode === 'signup') {
      const r = await signup(email.trim(), password, name.trim(), phone.trim(), 'dropship', undefined, true, '2026-09');
      if (!r.success) {
        setBusy(false);
        setFormError(friendly(r.error));
        return;
      }
    }
    const r = await login(email.trim(), password);
    setBusy(false);
    if (!r.success) {
      setFormError(mode === 'signup' ? 'Account created. Please sign in.' : friendly(r.error));
      if (mode === 'signup') navigate(`/customer/login?return=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }
    navigate(returnTo, { replace: true });
  };

  const other = mode === 'login' ? 'signup' : 'login';
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PageHeader title="" />
      <div className="max-w-sm mx-auto px-5 pb-12">
        <img src="/qafrica-bag-logo.svg" alt="" className="w-10 h-10" />
        <h1 className="mt-4 text-[22px] font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1 text-[13px] text-gray-500">
          {mode === 'login' ? 'Sign in to see your orders, wishlist and pay-for-me links.' : 'Track orders, save items and join the Cart Clearers board.'}
        </p>

        <button
          type="button"
          onClick={() => loginWithGoogle(returnTo)}
          className="mt-6 w-full h-11 rounded-lg border border-gray-300 text-[14px] font-medium inline-flex items-center justify-center gap-2 hover:bg-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continue with Google
        </button>
        <div className="my-5 flex items-center gap-3 text-[11px] text-gray-400"><span className="flex-1 h-px bg-gray-200" />or<span className="flex-1 h-px bg-gray-200" /></div>

        <form onSubmit={submit} className="space-y-3" noValidate>
          {mode === 'signup' && <Field id="name" label="Full name" value={name} onChange={setName} error={errors.name} autoComplete="name" />}
          <Field id="email" label="Email" type="email" inputMode="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
          {mode === 'signup' && <Field id="phone" label="Phone" optional type="tel" inputMode="tel" value={phone} onChange={setPhone} autoComplete="tel" />}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="text-[12px] font-medium text-gray-700">Password</label>
              {mode === 'login' && <Link to="/forgot-password" className="text-[12px] text-gray-500 underline underline-offset-2">Forgot?</Link>}
            </div>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                aria-invalid={!!errors.password}
                className={`w-full h-11 pl-3 pr-11 rounded-lg border text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-900 ${errors.password ? 'border-[#C4320A]' : 'border-gray-300'}`}
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-gray-500">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-[12px] text-[#C4320A]">{errors.password}</p>}
          </div>
          {mode === 'signup' && (
            <label className="flex items-start gap-2 text-[12px] text-gray-600">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 accent-gray-900" />
              <span>I agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link></span>
            </label>
          )}
          {errors.agree && <p className="text-[12px] text-[#C4320A]">{errors.agree}</p>}
          {formError && <p className="text-[13px] text-[#C4320A]" role="alert">{formError}</p>}
          <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-gray-900 text-white text-[14px] font-semibold disabled:opacity-50">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-gray-600">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <Link to={`/customer/${other}?return=${encodeURIComponent(returnTo)}`} className="font-semibold text-gray-900 underline underline-offset-2">
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </Link>
        </p>
        <p className="mt-6 flex items-start gap-2 text-[11px] text-gray-400">
          <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden /> You don't need an account to buy. Guests can check out and track orders with their order number.
        </p>
        <p className="mt-3 text-center text-[11px] text-gray-400">Selling on QAFRICA? <Link to="/login" className="underline">Seller sign in</Link></p>
      </div>
    </div>
  );
}

function friendly(msg?: string) {
  if (!msg) return 'Something went wrong. Please try again.';
  if (/invalid login|invalid credentials/i.test(msg)) return 'Email or password is incorrect.';
  if (/already registered|already exists/i.test(msg)) return 'An account with this email already exists. Try signing in.';
  if (/store owner/i.test(msg)) return 'This email is a seller account. Use Seller sign in below.';
  return msg;
}
