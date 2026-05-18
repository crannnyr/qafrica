// src/pages/developer/auth/DeveloperSignupPage.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Eye, EyeOff, ArrowRight, User, Building2,
  Globe, Phone, FileText, ChevronDown, Loader2, Check,
} from 'lucide-react';
import { developerAuthService } from '@/services/developer';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import { toast } from 'sonner';
import type { DeveloperSignupFormData, DeveloperAccountType } from '@/types/developer';

// ── helpers ───────────────────────────────────────────────────
function InputField({
  label, name, type = 'text', placeholder, value, onChange,
  required, error, icon: Icon, hint, maxLength,
}: {
  label: string; name: string; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void; required?: boolean;
  error?: string; icon?: React.ElementType; hint?: string; maxLength?: number;
}) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === 'password';
  const inputType  = isPassword ? (showPw ? 'text' : 'password') : type;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        )}
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full h-11 rounded-xl border text-sm text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
            transition-colors bg-white
            ${Icon ? 'pl-10' : 'pl-4'}
            ${isPassword ? 'pr-11' : 'pr-4'}
            ${error ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw((p) => !p)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error  && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function SelectField({
  label, value, onChange, options, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 pl-4 pr-10 rounded-xl border border-gray-200 text-sm text-gray-900
            focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
            bg-white appearance-none transition-colors"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

// Password strength meter
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters',   ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number',           ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${c.ok ? 'bg-green-500' : 'bg-gray-200'}`}>
            {c.ok && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
          <span className={`text-xs ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

const PLATFORM_TYPES = [
  { value: '',          label: 'Select platform type (optional)' },
  { value: 'ecommerce', label: 'E-commerce Website' },
  { value: 'mobile_app', label: 'Mobile Application' },
  { value: 'pos',       label: 'Point of Sale (POS)' },
  { value: 'marketplace', label: 'Marketplace / Aggregator' },
  { value: 'erp',       label: 'ERP / Business Software' },
  { value: 'other',     label: 'Other' },
];

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperSignupPage() {
  const navigate = useNavigate();
  const { login } = useDeveloperAuthStore();

  const [step, setStep]               = useState<1 | 2>(1); // 1 = account type + identity, 2 = platform details
  const [accountType, setAccountType] = useState<DeveloperAccountType>('individual');
  const [isLoading, setIsLoading]     = useState(false);

  const [form, setForm] = useState({
    full_name:     '',
    email:         '',
    password:      '',
    confirm:       '',
    phone:         '',
    company_name:  '',
    rc_number:     '',
    platform_name: '',
    platform_url:  '',
    platform_type: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string) => (val: string) => setForm((f) => ({ ...f, [key]: val }));
  const clearErr = (key: string) => setErrors((e) => { const n = { ...e }; delete n[key]; return n; });

  // ── Step 1 validation ────────────────────────────────────────
  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required.';
    if (!form.email.trim())     errs.email     = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (!form.password)         errs.password  = 'Password is required.';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match.';
    if (accountType === 'company' && !form.company_name.trim()) {
      errs.company_name = 'Company name is required for company accounts.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Step 2 validation ────────────────────────────────────────
  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (!form.platform_name.trim()) errs.platform_name = 'Platform name is required.';
    if (!form.platform_url.trim())  errs.platform_url  = 'Platform URL is required.';
    else {
      try { new URL(form.platform_url); }
      catch { errs.platform_url = 'Enter a valid URL (e.g. https://mysite.com).'; }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validateStep1()) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;

    setIsLoading(true);
    try {
      const payload: DeveloperSignupFormData = {
        account_type:  accountType,
        full_name:     form.full_name.trim(),
        email:         form.email.trim().toLowerCase(),
        password:      form.password,
        phone:         form.phone.trim() || undefined,
        platform_name: form.platform_name.trim(),
        platform_url:  form.platform_url.trim(),
        platform_type: form.platform_type || undefined,
        company_name:  accountType === 'company' ? form.company_name.trim() : undefined,
        rc_number:     form.rc_number.trim() || undefined,
      };

      // 1. Create the account
      await developerAuthService.signup(payload);

      // 2. Immediately log in — email is auto-confirmed by the edge function
      const loginResult = await login(
        form.email.trim().toLowerCase(),
        form.password,
      );

      if (!loginResult.success) {
        // Account was created but login failed — send to login page
        toast.success('Account created! Please sign in.');
        navigate('/developer/login');
        return;
      }

      // 3. Go straight to onboarding
      toast.success('Welcome to QAFRICA Developer Portal!');
      navigate('/developer/onboarding');
    } catch (err: any) {
      const msg = err?.message ?? 'Signup failed. Please try again.';
      if (err?.code === 'email_taken') {
        setErrors({ email: 'This email is already registered.' });
        setStep(1);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Left panel (brand) ───────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex-col justify-between p-10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-lg leading-tight">QAFRICA</p>
              <p className="text-xs text-gray-400 leading-tight">Developer Portal</p>
            </div>
          </div>
        </div>

        {/* Pitch */}
        <div className="relative space-y-6">
          <h2 className="text-3xl font-bold text-white leading-snug">
            Build on Africa's<br />
            <span className="text-orange-400">fastest-growing</span><br />
            commerce network.
          </h2>
          <div className="space-y-4">
            {[
              { title: 'Import & Sell',     desc: 'Browse 10,000+ products. List on your platform in minutes.' },
              { title: 'Zero Fulfillment',  desc: 'QAFRICA handles storage, packing, and delivery.' },
              { title: 'Automatic Payouts', desc: 'Paystack splits your commission on every transaction.' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-xs text-gray-600">
          By signing up you agree to the QAFRICA{' '}
          <a href="#" className="text-gray-400 hover:text-white underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-gray-400 hover:text-white underline">Privacy Policy</a>.
        </p>
      </div>

      {/* ── Right panel (form) ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">QAFRICA Dev</span>
          </div>
          <p className="text-sm text-gray-500 ml-auto">
            Already have an account?{' '}
            <Link to="/developer/login" className="text-orange-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 flex items-start justify-center px-6 pb-12 lg:px-10">
          <div className="w-full max-w-lg">
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-8">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    s < step ? 'bg-green-500 text-white' :
                    s === step ? 'bg-orange-500 text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {s < step ? <Check className="w-3.5 h-3.5" /> : s}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${s === step ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s === 1 ? 'Your details' : 'Platform info'}
                  </span>
                  {s < 2 && <div className={`w-8 h-px ${step > s ? 'bg-green-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* ── STEP 1 ─────────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
                  <p className="text-sm text-gray-500 mb-7">Start with a 7-day free Starter trial. No credit card needed.</p>

                  {/* Account type toggle */}
                  <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
                    {(['individual', 'company'] as DeveloperAccountType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => { setAccountType(type); clearErr('company_name'); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          accountType === type
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {type === 'individual'
                          ? <><User className="w-4 h-4" /> Individual</>
                          : <><Building2 className="w-4 h-4" /> Company</>
                        }
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <InputField
                      label="Full name"
                      name="full_name"
                      placeholder="Chidi Okeke"
                      value={form.full_name}
                      onChange={(v) => { set('full_name')(v); clearErr('full_name'); }}
                      required
                      error={errors.full_name}
                      icon={User}
                    />

                    <AnimatePresence>
                      {accountType === 'company' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4 pb-1">
                            <InputField
                              label="Company name"
                              name="company_name"
                              placeholder="Acme Technologies Ltd."
                              value={form.company_name}
                              onChange={(v) => { set('company_name')(v); clearErr('company_name'); }}
                              required
                              error={errors.company_name}
                              icon={Building2}
                            />
                            <InputField
                              label="RC Number"
                              name="rc_number"
                              placeholder="RC1234567 (optional)"
                              value={form.rc_number}
                              onChange={set('rc_number')}
                              icon={FileText}
                              hint="Your CAC registration number. Helps with verification."
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <InputField
                      label="Email address"
                      name="email"
                      type="email"
                      placeholder="you@yourplatform.com"
                      value={form.email}
                      onChange={(v) => { set('email')(v); clearErr('email'); }}
                      required
                      error={errors.email}
                    />

                    <InputField
                      label="Phone number"
                      name="phone"
                      type="tel"
                      placeholder="+234 800 000 0000 (optional)"
                      value={form.phone}
                      onChange={set('phone')}
                      icon={Phone}
                    />

                    <div>
                      <InputField
                        label="Password"
                        name="password"
                        type="password"
                        placeholder="Minimum 8 characters"
                        value={form.password}
                        onChange={(v) => { set('password')(v); clearErr('password'); }}
                        required
                        error={errors.password}
                      />
                      <PasswordStrength password={form.password} />
                    </div>

                    <InputField
                      label="Confirm password"
                      name="confirm"
                      type="password"
                      placeholder="Re-enter your password"
                      value={form.confirm}
                      onChange={(v) => { set('confirm')(v); clearErr('confirm'); }}
                      required
                      error={errors.confirm}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="mt-7 w-full h-12 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* ── STEP 2 ─────────────────────────────────── */}
              {step === 2 && (
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleSubmit}
                >
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">Your platform details</h1>
                  <p className="text-sm text-gray-500 mb-7">Tell us about what you're building so we can tailor your experience.</p>

                  <div className="space-y-4">
                    <InputField
                      label="Platform name"
                      name="platform_name"
                      placeholder="ShopEase Nigeria"
                      value={form.platform_name}
                      onChange={(v) => { set('platform_name')(v); clearErr('platform_name'); }}
                      required
                      error={errors.platform_name}
                      hint="The name of your app, website, or integration."
                    />
                    <InputField
                      label="Platform URL"
                      name="platform_url"
                      type="url"
                      placeholder="https://shopease.ng"
                      value={form.platform_url}
                      onChange={(v) => { set('platform_url')(v); clearErr('platform_url'); }}
                      required
                      error={errors.platform_url}
                      icon={Globe}
                      hint="The main URL of your platform. Must start with https://."
                    />
                    <SelectField
                      label="Platform type"
                      value={form.platform_type}
                      onChange={set('platform_type')}
                      options={PLATFORM_TYPES}
                    />
                  </div>

                  {/* Summary */}
                  <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Account summary</p>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Type',  val: accountType === 'company' ? `Company — ${form.company_name}` : 'Individual' },
                        { label: 'Email', val: form.email },
                        { label: 'Trial', val: '7-day Starter plan — free' },
                      ].map((r) => (
                        <div key={r.label} className="flex gap-3 text-xs">
                          <span className="text-gray-400 w-12 flex-shrink-0">{r.label}</span>
                          <span className="text-gray-700 font-medium truncate">{r.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-7">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="h-12 px-5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {isLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                        : <><Zap className="w-4 h-4" /> Create account</>
                      }
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}