import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShoppingBag, ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';
import LiveActivityPanel from './LiveActivityPanel';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const validateForm = () => {
    if (!formData.full_name || !formData.email || !formData.phone || !formData.password) {
      toast.error('Please fill in all fields');
      return false;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }

    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match');
      return false;
    }

    // Validate phone number (Nigerian format)
    const phoneRegex = /^[0-9]{11}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      toast.error('Please enter a valid 11-digit phone number');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setRateLimitError(false);
    
    try {
      const { success, error } = await signup(
        formData.email,
        formData.password,
        {
          full_name: formData.full_name,
          phone: formData.phone,
          user_type: 'store_owner',
        }
      );

      if (!success) {
        if (error?.includes('rate limit') || error?.includes('429')) {
          setRateLimitError(true);
          toast.error('Too many signup attempts. Please wait a few minutes and try again.');
        } else {
          toast.error(error || 'Signup failed');
        }
        setIsLoading(false);
        return;
      }

      toast.success('Account created! Welcome to QAFRICA.');
      sessionStorage.setItem('signup_email', formData.email);
      sessionStorage.setItem('signup_full_name', formData.full_name);
      sessionStorage.setItem('signup_phone', formData.phone);
      navigate('/select-niche');
    } catch (err) {
      console.error('Signup error:', err);
      toast.error('An unexpected error occurred. Please try again.');
    }
    
    setIsLoading(false);
  };

  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(formData.password) },
    { label: 'Contains number', met: /[0-9]/.test(formData.password) },
    { label: 'Contains special character', met: /[!@#$%^&*]/.test(formData.password) },
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 lg:bg-none">
      {/* ── Right: live activity panel — desktop only, rendered first in the
          grid so it visually sits second (order-2) while keeping the form
          as the first, more important, DOM element for accessibility ── */}
      <div className="hidden lg:block lg:order-2">
        <LiveActivityPanel
          headline="Join sellers scaling smoothly across Nigeria."
          sub="Every store on QAFRICA starts the same way you're about to — one signup, then it compounds."
        />
      </div>

      {/* ── Left: the form, unchanged ── */}
      <div className="relative flex items-center justify-center p-4 py-16 lg:order-1 lg:bg-white dark:lg:bg-gray-900">
        {/* Background Elements — mobile/tablet only, panel replaces this on desktop */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none lg:hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 dark:bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 dark:bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg relative z-10"
        >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">QAFRICA</span>
          </Link>
        </div>

        {/* Signup Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create Your Account</h1>
            <p className="text-gray-500 dark:text-gray-400">Start your e-commerce journey today</p>
          </div>

          {/* Rate Limit Warning */}
          {rateLimitError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-300">Too Many Attempts</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    We've hit a rate limit. Please wait 2-3 minutes before trying again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <span className="text-sm font-medium text-orange-600">Account</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Niche</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Plan</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="input-custom"
                placeholder="Enter your full name"
                required
              />
            </div>

            {/* Email & Phone */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-custom"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-custom"
                  placeholder="08012345678"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-custom pr-12"
                  placeholder="Create a strong password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  className="input-custom pr-12"
                  placeholder="Confirm your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            {formData.password && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password requirements:</p>
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 ${req.met ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                    <span className={`text-sm ${req.met ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500 mt-0.5"
                required
              />
            <label className="text-sm text-gray-600 dark:text-gray-400">
  I agree to the{' '}
  <Link to="/terms-of-service" target="_blank" className="text-orange-500 hover:text-orange-600">Terms of Service</Link>
  {' '}and{' '}
  <Link to="/privacy-policy" target="_blank" className="text-orange-500 hover:text-orange-600">Privacy Policy</Link>
</label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Sign In Link */}
        <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-500 hover:text-orange-600 font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
      </div>
    </div>
  );
}