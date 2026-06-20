import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '@/services';
import { toast } from 'sonner';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState(['', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Get email from location state or session storage
    const emailFromState = location.state?.email;
    const emailFromStorage = sessionStorage.getItem('signup_email');
    const userEmail = emailFromState || emailFromStorage;
    
    if (!userEmail) {
      navigate('/signup');
      return;
    }
    
    setEmail(userEmail);

    // Start resend timer
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [location, navigate]);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take last character
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are filled
    if (index === 4 && value) {
      const fullCode = [...newCode.slice(0, 4), value].join('');
      if (fullCode.length === 5) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5);
    
    const newCode = [...code];
    pastedData.split('').forEach((digit, index) => {
      if (index < 5) newCode[index] = digit;
    });
    setCode(newCode);

    // Focus the appropriate input
    const focusIndex = Math.min(pastedData.length, 4);
    inputRefs.current[focusIndex]?.focus();

    // Auto-submit if 5 digits pasted
    if (pastedData.length === 5) {
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const verificationCode = fullCode || code.join('');
    
    if (verificationCode.length !== 5) {
      toast.error('Please enter the complete 5-digit code');
      return;
    }

    setIsVerifying(true);

    try {
      // Verify the OTP
      const { error } = await authService.verifyOtp(email, verificationCode);

      if (error) {
        toast.error(error.message || 'Invalid verification code');
        setIsVerifying(false);
        return;
      }

      toast.success('Email verified successfully!');
      
      // Clear session storage
      sessionStorage.removeItem('signup_email');
      
      // Navigate to niche selection
      navigate('/select-niche');
    } catch (err) {
      toast.error('Verification failed. Please try again.');
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    setIsResending(true);

    try {
      const { error } = await authService.resendOtp(email);

      if (error) {
        toast.error(error.message || 'Failed to resend code');
      } else {
        toast.success('Verification code resent!');
        setResendTimer(60);
        setCode(['', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      toast.error('Failed to resend code. Please try again.');
    }

    setIsResending(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Back Button */}
        <button
          onClick={() => navigate('/signup')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Sign Up
        </button>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Icon */}
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-orange-600" />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Verify Your Email
            </h1>
            <p className="text-gray-500">
              We've sent a 5-digit verification code to
            </p>
            <p className="font-medium text-gray-900 mt-1">{email}</p>
          </div>

          {/* Code Input */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
              Enter verification code
            </label>
            <div 
              className="flex justify-center gap-3"
              onPaste={handlePaste}
            >
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={isVerifying}
                  className="w-14 h-16 text-2xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:bg-gray-50"
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>

          {/* Verify Button */}
          <Button
            onClick={() => handleVerify()}
            disabled={isVerifying || code.join('').length !== 5}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-lg font-medium disabled:opacity-50"
          >
            {isVerifying ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Verify Email
              </>
            )}
          </Button>

          {/* Resend Code */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm mb-2">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={isResending || resendTimer > 0}
              className="flex items-center justify-center gap-2 mx-auto text-orange-600 hover:text-orange-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {isResending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {resendTimer > 0 
                ? `Resend in ${resendTimer}s` 
                : 'Resend Code'}
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              Check your spam folder if you don't see the email in your inbox.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
