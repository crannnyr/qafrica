// src/pages/developer/auth/DeveloperLoginPage.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import { toast } from 'sonner';

export default function DeveloperLoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, isAuthenticated, isLoading, developer } = useDeveloperAuthStore();

  const [email,     setEmail]    = useState('');
  const [password,  setPassword] = useState('');
  const [showPw,    setShowPw]   = useState(false);
  const [errors,    setErrors]   = useState<{ email?: string; password?: string; general?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill email if coming from signup
  useEffect(() => {
    const stored = sessionStorage.getItem('dev_signup_email');
    if (stored) setEmail(stored);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && developer) {
      if (!developer.onboarding_completed) {
        navigate('/developer/onboarding', { replace: true });
      } else {
        const from = (location.state as any)?.from ?? '/developer/dashboard';
        navigate(from, { replace: true });
      }
    }
  }, [isAuthenticated, developer, navigate, location]);

  function validate() {
    const errs: typeof errors = {};
    if (!email.trim())    errs.email    = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address.';
    if (!password)        errs.password = 'Password is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});

    try {
      const result = await login(email.trim().toLowerCase(), password);

      if (!result.success) {
        if (result.error?.includes('not registered as a developer')) {
          setErrors({ general: result.error });
        } else if (result.error?.includes('suspended')) {
          setErrors({ general: result.error });
        } else {
          setErrors({ general: 'Incorrect email or password. Please try again.' });
        }
        return;
      }

      // Navigation handled by useEffect above
      sessionStorage.removeItem('dev_signup_email');
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  const loading = isLoading || submitting;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Left brand panel ────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[440px] flex-shrink-0 bg-gray-900 flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,0.15)_0%,_transparent_60%)]" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white leading-tight">QAFRICA</p>
            <p className="text-xs text-gray-400 leading-tight">Developer Portal</p>
          </div>
        </div>

        <div className="relative">
          <blockquote className="text-xl font-semibold text-white leading-relaxed mb-4">
            "The simplest way to add Nigerian commerce to any platform."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center">
              <span className="text-sm font-bold text-orange-400">A</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">API Partner</p>
              <p className="text-xs text-gray-500">Integrated via QAFRICA</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-gray-600">
          © {new Date().getFullYear()} QAFRICA. All rights reserved.
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 lg:px-12">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">QAFRICA Dev</span>
          </div>
          <p className="text-sm text-gray-500 ml-auto">
            New developer?{' '}
            <Link to="/developer/signup" className="text-orange-600 font-semibold hover:underline">
              Create account
            </Link>
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md"
          >
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-500 mt-1">Sign in to your developer account.</p>
            </div>

            {/* General error */}
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl"
              >
                <p className="text-sm text-red-700">{errors.general}</p>
                {errors.general.includes('not registered') && (
                  <Link
                    to="/developer/signup"
                    className="text-sm font-semibold text-red-700 underline mt-1 block"
                  >
                    Create a developer account →
                  </Link>
                )}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((err) => ({ ...err, email: undefined, general: undefined })); }}
                  placeholder="you@yourplatform.com"
                  autoComplete="email"
                  autoFocus
                  className={`w-full h-11 px-4 rounded-xl border text-sm text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                    transition-colors bg-white
                    ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1.5">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <Link
                    to="/developer/forgot-password"
                    className="text-xs text-orange-600 font-medium hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((err) => ({ ...err, password: undefined, general: undefined })); }}
                    placeholder="Your password"
                    autoComplete="current-password"
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
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:bg-orange-700
                  disabled:opacity-60 disabled:cursor-not-allowed
                  text-white font-semibold rounded-xl transition-colors
                  flex items-center justify-center gap-2 mt-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                  : <>Sign in <ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>

            {/* Divider */}
            <div className="my-7 flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Go to store login */}
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-2">Are you a store owner instead?</p>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline transition-colors"
              >
                Go to store owner login →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}