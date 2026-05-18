// src/pages/developer/onboarding/DeveloperOnboardingPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Check, ArrowRight, ExternalLink, Loader2,
  CreditCard, Globe, Building2, User, AlertCircle,
  ChevronRight, Sparkles,
} from 'lucide-react';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import { developerPaystackService } from '@/services/developer';
import { developerSupabase } from '@/services/developer';
import { toast } from 'sonner';

// ── Step definitions ──────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Welcome',         icon: Sparkles },
  { id: 2, label: 'Connect Paystack', icon: CreditCard },
  { id: 3, label: 'All set',          icon: Check },
];

// ── Step indicator ────────────────────────────────────────────
function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {STEPS.map((s) => {
        const done    = s.id < current;
        const active  = s.id === current;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`transition-all duration-300 rounded-full flex items-center justify-center
              ${done   ? 'w-6 h-6 bg-green-500' :
                active ? 'w-6 h-6 bg-orange-500 ring-4 ring-orange-500/20' :
                         'w-2 h-2 bg-gray-200'}`}
            >
              {done   && <Check className="w-3.5 h-3.5 text-white" />}
              {active && <span className="text-xs font-bold text-white">{s.id}</span>}
            </div>
            {s.id < STEPS.length && (
              <div className={`h-px w-8 transition-colors duration-300 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Profile summary card ──────────────────────────────────────
function ProfileSummary({ developer }: { developer: any }) {
  const name = developer.account_type === 'company'
    ? developer.company_name ?? developer.full_name
    : developer.full_name;
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
        {developer.account_type === 'company'
          ? <Building2 className="w-5 h-5 text-orange-600" />
          : <User className="w-5 h-5 text-orange-600" />
        }
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">{developer.email}</p>
      </div>
      <div className="ml-auto flex-shrink-0">
        <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full capitalize">
          {developer.plan}
        </span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperOnboardingPage() {
  const navigate = useNavigate();
  const { developer, isAuthenticated, fetchProfile } = useDeveloperAuthStore();

  const [step,          setStep]          = useState(1);
  const [isConnecting,  setIsConnecting]  = useState(false);
  const [isCompleting,  setIsCompleting]  = useState(false);
  const [connectStatus, setConnectStatus] = useState<'idle' | 'success' | 'skipped'>('idle');

  // ── Guards ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/developer/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // If already onboarded, go to dashboard
  useEffect(() => {
    if (developer?.onboarding_completed) {
      navigate('/developer/dashboard', { replace: true });
    }
  }, [developer, navigate]);

  // Check if Paystack already connected (e.g. returning after callback)
  useEffect(() => {
    if (developer?.paystack_connected && step === 2) {
      setConnectStatus('success');
    }
  }, [developer, step]);

  if (!developer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // ── Connect Paystack ──────────────────────────────────────────
  async function handleConnectPaystack() {
    setIsConnecting(true);
    try {
      const { connect_url } = await developerPaystackService.getConnectUrl();
      // Store current step so callback page can resume
      sessionStorage.setItem('dev_onboarding_step', '2');
      window.location.href = connect_url;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to start Paystack Connect. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }

  function handleSkipPaystack() {
    setConnectStatus('skipped');
    setStep(3);
  }

  // ── Complete onboarding ───────────────────────────────────────
  // Updates the developers table directly — no edge function needed.
  async function handleComplete() {
    setIsCompleting(true);
    try {
      if (!developer) throw new Error('No developer session.');

      const { error } = await developerSupabase
        .from('developers')
        .update({ onboarding_completed: true })
        .eq('auth_user_id', developer.auth_user_id);

      if (error) throw new Error(error.message);

      // Refresh local state so DeveloperLayout guard sees the updated flag
      await fetchProfile();
      toast.success('Welcome to QAFRICA Developer Portal! 🎉');
      navigate('/developer/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to complete setup. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  }

  const displayName = developer.account_type === 'company'
    ? developer.company_name ?? developer.full_name
    : developer.full_name.split(' ')[0];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-sm">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">QAFRICA Developer Portal</span>
      </div>

      <div className="w-full max-w-lg">
        <StepDots current={step} />

        <AnimatePresence mode="wait">

          {/* ── STEP 1: Welcome ────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8"
            >
              {/* Confetti icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-orange-500" />
                </div>
              </div>

              <div className="text-center mb-7">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome, {displayName}! 👋
                </h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Your developer account is created. Let's finish setup — it takes
                  less than 2 minutes.
                </p>
              </div>

              {/* Profile summary */}
              <div className="mb-7">
                <ProfileSummary developer={developer} />
              </div>

              {/* What's next */}
              <div className="space-y-3 mb-7">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  What you'll set up
                </p>
                {[
                  { step: 1, label: 'Connect your Paystack account', desc: 'Required to receive automatic commission payouts on every order.' },
                  { step: 2, label: 'Get your API key', desc: 'Generate keys and start integrating from your dashboard.' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-white">{item.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trial notice */}
              {developer.plan === 'starter' && (
                <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-green-50 border border-green-200 rounded-xl">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-700">
                    <span className="font-semibold">7-day Starter trial activated.</span>{' '}
                    Full API access — no credit card needed right now.
                  </p>
                </div>
              )}

              <button
                onClick={() => setStep(2)}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:bg-orange-700
                  text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Get started
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ── STEP 2: Connect Paystack ───────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8"
            >
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="text-center mb-7">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Paystack</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  QAFRICA uses Paystack Split to automatically pay your commission on every
                  order — directly into your Paystack account. No manual payouts needed.
                </p>
              </div>

              {/* How it works */}
              <div className="space-y-3 mb-7">
                {[
                  { icon: '💳', title: 'Customer pays on your site',   desc: 'Using Paystack — full payment flow you control.' },
                  { icon: '⚡', title: 'Paystack splits automatically', desc: 'Your share lands in your account instantly.' },
                  { icon: '🏭', title: 'QAFRICA fulfills the order',   desc: 'We handle the product, packing, and delivery.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Split info */}
              <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-orange-800">Split breakdown</p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    You keep <strong>92%</strong> of the dropship price difference.
                    QAFRICA takes <strong>8%</strong> as a platform fee.
                    Paystack handles the split — no manual calculation.
                  </p>
                </div>
              </div>

              {/* Already connected */}
              {developer.paystack_connected ? (
                <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Paystack connected</p>
                    <p className="text-xs text-green-600">Your account is linked and splits are configured.</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {!developer.paystack_connected && (
                  <button
                    onClick={handleConnectPaystack}
                    disabled={isConnecting}
                    className="w-full h-12 bg-[#01C6C6] hover:bg-[#00b3b3] disabled:opacity-60 disabled:cursor-not-allowed
                      text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isConnecting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                      : <><ExternalLink className="w-4 h-4" /> Connect Paystack account</>
                    }
                  </button>
                )}

                <button
                  onClick={developer.paystack_connected ? () => setStep(3) : handleSkipPaystack}
                  className="w-full h-11 border border-gray-200 text-gray-600 hover:bg-gray-50
                    font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {developer.paystack_connected
                    ? <><ChevronRight className="w-4 h-4" /> Continue</>
                    : 'Skip for now — connect later from Settings'
                  }
                </button>
              </div>

              {!developer.paystack_connected && (
                <p className="text-center text-xs text-gray-400 mt-4">
                  You'll need a Paystack account. Don't have one?{' '}
                  <a
                    href="https://paystack.com/signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 font-medium hover:underline"
                  >
                    Create one free →
                  </a>
                </p>
              )}
            </motion.div>
          )}

          {/* ── STEP 3: All set ────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center"
            >
              {/* Animated checkmark */}
              <div className="flex justify-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1, stiffness: 200, damping: 14 }}
                  className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.25, stiffness: 200 }}
                  >
                    <Check className="w-10 h-10 text-green-500" />
                  </motion.div>
                </motion.div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
              <p className="text-sm text-gray-500 mb-7 leading-relaxed">
                Your developer account is ready. Head to your dashboard to generate
                an API key and start building.
              </p>

              {/* Checklist summary */}
              <div className="text-left space-y-2.5 mb-7">
                {[
                  { done: true,                          label: 'Developer account created' },
                  { done: developer.email_verified,      label: 'Email verified' },
                  { done: developer.paystack_connected,  label: 'Paystack account connected',  note: developer.paystack_connected ? '' : '(Connect from Settings anytime)' },
                  { done: true,                          label: '7-day Starter trial activated' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                      {item.done
                        ? <Check className="w-3 h-3 text-white" />
                        : <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      }
                    </div>
                    <span className="text-sm text-gray-700">{item.label}</span>
                    {item.note && <span className="text-xs text-gray-400">{item.note}</span>}
                  </div>
                ))}
              </div>

              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:bg-orange-700
                  disabled:opacity-60 disabled:cursor-not-allowed
                  text-white font-semibold rounded-xl transition-colors
                  flex items-center justify-center gap-2"
              >
                {isCompleting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up your dashboard...</>
                  : <><Zap className="w-4 h-4" /> Go to dashboard</>
                }
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}