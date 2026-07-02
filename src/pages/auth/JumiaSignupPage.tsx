// src/pages/auth/JumiaSignupPage.tsx
// Separate signup flow for Jumia-only sellers.
// No niche selection, no plan step, no store setup.
// After signup: profile gets signup_intent='jumia', onboarding_completed=true,
// then redirects to /jumia-dashboard.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { supabase } from '@/services';
import { toast } from 'sonner';

type Step = 1 | 2 | 3;

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  referral_source: 'tiktok' | 'instagram' | 'friend' | '';
  goal: 'has_goods' | 'needs_sourcing' | '';
}

const WHATSAPP_NUMBER = '2349069149803';

export default function JumiaSignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    referral_source: '',
    goal: '',
  });

  const set = (field: keyof FormData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const validateStep1 = (): string | null => {
    if (!formData.full_name.trim()) return 'Full name is required';
    if (!formData.email.trim()) return 'Email is required';
    const phoneRegex = /^[0-9]{11}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) return 'Enter a valid 11-digit phone number';
    if (formData.password.length < 8) return 'Password must be at least 8 characters';
    if (formData.password !== formData.confirm_password) return 'Passwords do not match';
    return null;
  };

  const handleStep1Next = () => {
    const error = validateStep1();
    if (error) { toast.error(error); return; }
    setStep(2);
  };

  const handleStep2Next = () => {
    if (!formData.referral_source) { toast.error('Please tell us where you heard about us'); return; }
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!formData.goal) { toast.error('Please select an option'); return; }

    setIsLoading(true);

    // 1. Create the auth account — same as store signup but with signup_intent in metadata
    const { success, error } = await signup(
      formData.email,
      formData.password,
      {
        full_name: formData.full_name,
        phone: formData.phone,
        user_type: 'store_owner', // triggers handle_new_user to create the profile row
      }
    );

    if (!success) {
      toast.error(error || 'Signup failed. Please try again.');
      setIsLoading(false);
      return;
    }

    // 2. Update the profile with Jumia-specific fields.
    // We do this separately because the DB trigger doesn't know about signup_intent.
    // onboarding_completed = true skips the store onboarding guard entirely.
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        signup_intent: 'jumia',
        jumia_referral_source: formData.referral_source,
        jumia_goal: formData.goal,
        onboarding_completed: true,
      })
      .eq('email', formData.email);

    if (updateError) {
      // Non-fatal — user is created, just log and continue.
      // The intent defaults to 'store' which would redirect wrong, so we warn.
      console.error('Failed to set Jumia intent on profile:', updateError);
      toast.error('Account created but setup incomplete. Please contact support.');
      setIsLoading(false);
      return;
    }

    toast.success('Welcome to Qafrica! Your Jumia seller account is ready.');
    // Do NOT set sessionStorage 'signup_email' — that would trigger store onboarding guard
    navigate('/jumia-dashboard');
    setIsLoading(false);
  };

  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(formData.password) },
    { label: 'Contains number', met: /[0-9]/.test(formData.password) },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v14a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5h12v11H6V7z"/>
              </svg>
            </div>
            <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
          </Link>
          <p className="text-sm text-gray-500 mt-2">Jumia Seller Account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {([1, 2, 3] as Step[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step === s ? 'bg-orange-500 text-white' :
                  step > s ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > s ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`w-10 h-0.5 ${step > s ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* ── Step 1: Account details ── */}
            {step === 1 && (
              <motion.div key="step1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-5">
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
                  <p className="text-gray-500 text-sm mt-1">Start selling on Jumia through Qafrica</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input type="text" value={formData.full_name} onChange={(e) => set('full_name', e.target.value)}
                    className="input-custom" placeholder="Enter your full name" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => set('email', e.target.value)}
                    className="input-custom" placeholder="your@email.com" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                  <input type="tel" value={formData.phone} onChange={(e) => set('phone', e.target.value)}
                    className="input-custom" placeholder="08012345678" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={formData.password}
                      onChange={(e) => set('password', e.target.value)}
                      className="input-custom pr-12" placeholder="Create a strong password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={formData.confirm_password}
                      onChange={(e) => set('confirm_password', e.target.value)}
                      className="input-custom pr-12" placeholder="Confirm your password" />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {formData.password && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    {passwordRequirements.map((req) => (
                      <div key={req.label} className="flex items-center gap-2">
                        <CheckCircle className={`w-3.5 h-3.5 ${req.met ? 'text-green-500' : 'text-gray-300'}`} />
                        <span className={`text-xs ${req.met ? 'text-green-600' : 'text-gray-400'}`}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={handleStep1Next} className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* ── Step 2: Referral source ── */}
            {step === 2 && (
              <motion.div key="step2"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-5">
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-gray-900">Where did you hear about us?</h1>
                  <p className="text-gray-500 text-sm mt-1">This helps us understand how to reach more sellers</p>
                </div>

                <div className="space-y-3">
                  {[
                    { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
                    { value: 'instagram', label: 'Instagram', emoji: '📸' },
                    { value: 'friend', label: 'A friend told me', emoji: '👥' },
                  ].map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => set('referral_source', opt.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        formData.referral_source === opt.value
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className="font-medium text-gray-900">{opt.label}</span>
                      {formData.referral_source === opt.value && (
                        <CheckCircle className="w-5 h-5 text-orange-500 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(1)}
                    className="flex items-center gap-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <Button onClick={handleStep2Next} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white h-12">
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Goal ── */}
            {step === 3 && (
              <motion.div key="step3"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-5">
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-gray-900">What's your plan?</h1>
                  <p className="text-gray-500 text-sm mt-1">We'll tailor your experience accordingly</p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      value: 'has_goods',
                      label: 'I already have physical goods to sell',
                      desc: 'You have products ready and want to list them on Jumia through us.',
                      emoji: '📦',
                    },
                    {
                      value: 'needs_sourcing',
                      label: 'Help me find items that sell fast',
                      desc: 'We help you source high-demand products from trusted suppliers.',
                      emoji: '🔍',
                    },
                  ].map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => set('goal', opt.value)}
                      className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        formData.goal === opt.value
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className="text-2xl mt-0.5">{opt.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                      </div>
                      {formData.goal === opt.value && (
                        <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(2)}
                    className="flex items-center gap-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <Button onClick={handleSubmit} disabled={isLoading}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white h-12">
                    {isLoading
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <><span>Create Account</span><ArrowRight className="w-4 h-4 ml-2" /></>}
                  </Button>
                </div>

                <p className="text-center text-xs text-gray-400">
                  Need help?{' '}
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-600 font-medium">
                    Chat with us on WhatsApp
                  </a>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center mt-6 text-gray-600 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-500 hover:text-orange-600 font-medium">Sign in</Link>
        </p>
        <p className="text-center mt-2 text-sm text-gray-500">
          Want a full store instead?{' '}
          <Link to="/signup" className="text-orange-500 hover:text-orange-600 font-medium">Sign up here</Link>
        </p>
      </motion.div>
    </div>
  );
}
