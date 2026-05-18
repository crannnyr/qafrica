// src/pages/developer/auth/DeveloperVerifyEmailPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Mail, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { developerAuthService } from '@/services/developer';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import { toast } from 'sonner';

const OTP_LENGTH = 6;

export default function DeveloperVerifyEmailPage() {
  const navigate = useNavigate();
  const { fetchProfile } = useDeveloperAuthStore();

  const email = sessionStorage.getItem('dev_signup_email') ?? '';

  const [otp,         setOtp]         = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown,   setCountdown]   = useState(60);
  const [error,       setError]       = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown for resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // Redirect if no email in session
  useEffect(() => {
    if (!email) navigate('/developer/signup', { replace: true });
  }, [email, navigate]);

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (otp.every((d) => d !== '') && otp.join('').length === OTP_LENGTH) {
      handleVerify(otp.join(''));
    }
  }, [otp]);

  function handleOtpChange(index: number, value: string) {
    // Allow only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');

    // Move to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const next = [...otp];
        next[index] = '';
        setOtp(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...otp];
        next[index - 1] = '';
        setOtp(next);
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    // Focus last filled or last input
    const lastIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastIdx]?.focus();
  }

  async function handleVerify(code: string) {
    if (isVerifying) return;
    setIsVerifying(true);
    setError('');

    try {
      await developerAuthService.verifyEmail(email, code);
      await fetchProfile();
      sessionStorage.removeItem('dev_signup_email');
      toast.success('Email verified! Welcome to QAFRICA Developer Portal.');
      navigate('/developer/onboarding', { replace: true });
    } catch (err: any) {
      setError('Invalid or expired code. Please try again or request a new one.');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    try {
      await developerAuthService.resendOtp(email);
      setCountdown(60);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      toast.success('New verification code sent.');
    } catch {
      toast.error('Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  }

  const maskedEmail = email
    ? email.replace(/(.{2})[^@]+(@.+)/, '$1***$2')
    : '';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-sm">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">QAFRICA Dev</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
            <p className="text-sm text-gray-500">
              We sent a 6-digit verification code to
            </p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{maskedEmail}</p>
          </div>

          {/* OTP input */}
          <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                disabled={isVerifying}
                className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-150
                  focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${digit ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-white border-gray-200 text-gray-900'}
                  ${error ? 'border-red-400 bg-red-50 text-red-700' : ''}
                `}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-600 text-center mb-4"
            >
              {error}
            </motion.p>
          )}

          {/* Verify button (shown when not auto-submitted) */}
          {!otp.every((d) => d !== '') && (
            <button
              onClick={() => handleVerify(otp.join(''))}
              disabled={otp.some((d) => d === '') || isVerifying}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed
                text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mb-4"
            >
              {isVerifying
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                : 'Verify email'
              }
            </button>
          )}

          {/* Loading state (auto-submitted) */}
          {isVerifying && otp.every((d) => d !== '') && (
            <div className="flex items-center justify-center gap-2 py-3 mb-4">
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              <span className="text-sm text-gray-600">Verifying your code...</span>
            </div>
          )}

          {/* Resend */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={countdown > 0 || isResending}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700 disabled:text-gray-400
                disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 mx-auto"
            >
              {isResending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                : countdown > 0
                ? `Resend in ${countdown}s`
                : <><RefreshCw className="w-3.5 h-3.5" /> Resend code</>
              }
            </button>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-5">
          <button
            onClick={() => navigate('/developer/signup')}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 mx-auto transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign up
          </button>
        </div>
      </motion.div>
    </div>
  );
}