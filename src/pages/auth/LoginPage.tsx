import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShoppingBag, ArrowRight, Loader as Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate    = useNavigate();
  const { login }   = useAuthStore();
  const [isLoading, setIsLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData]         = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const result = await login(formData.email, formData.password);

    if (result.success) {
      if (result.onboardingIncomplete) {
        toast.success("Welcome! Let's continue setting up your store.");

        // ── FIX 6: route to the exact step they left at, not always /select-niche
        const step = result.currentStep ?? 0;
        if (step >= 3) {
          // Store already created — go to plan selection
          navigate('/onboarding/choice');
        } else if (step >= 2) {
          // Niche selected — go to store setup
          navigate('/onboarding/store-setup');
        } else {
          // Nothing saved yet — start from niche
          navigate('/select-niche');
        }
      } else {
        toast.success('Welcome back!');
        navigate(result.intent === 'jumia' ? '/jumia-dashboard' : '/dashboard');
      }
    } else {
      toast.error(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-500">Sign in to access your seller dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-custom"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-custom pr-12"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-orange-500 hover:text-orange-600">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-5 h-5 ml-2" /></>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            By signing in, you agree to our{' '}
            <Link to="/terms-of-service" className="underline hover:text-orange-500">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy-policy" className="underline hover:text-orange-500">Privacy Policy</Link>.
          </p>
        </div>

        <p className="text-center mt-6 text-gray-600">
          Don't have an account?{' '}
          <Link to="/signup" className="text-orange-500 hover:text-orange-600 font-medium">Create one free</Link>
        </p>

        <p className="text-center mt-2 text-sm text-gray-500">
          Shopping on QAFRICA?{' '}
          <Link to="/customer/login" className="text-orange-500 hover:text-orange-600 font-medium">Shopper login</Link>
        </p>
      </motion.div>
    </div>
  );
}
