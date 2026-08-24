// src/pages/recommendations/ImportAuthSheet.tsx
// Compact login/signup sheet shown inline on the recommendations page when a
// logged-out user tries to check out. Keeps them on /recommendations instead
// of bouncing to a separate full-page route.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, Eye, EyeOff } from 'lucide-react';
import { useCustomerAuthStore } from '@/stores';
import { toast } from 'sonner';
import ImportForgotPasswordSheet from './ImportForgotPasswordSheet';

export default function ImportAuthSheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { login, signup } = useCustomerAuthStore();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === 'signup' && !fullName)) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsLoading(true);
    if (mode === 'signup') {
      const result = await signup(email, password, fullName, phone, 'importation');
      if (!result.success) {
        setIsLoading(false);
        toast.error(result.error || 'Sign up failed');
        return;
      }
      const loginResult = await login(email, password);
      setIsLoading(false);
      if (loginResult.success) { toast.success('Welcome to QAFRICA Import!'); onSuccess(); }
      else { toast.success('Account created — please sign in.'); setMode('login'); }
    } else {
      const result = await login(email, password);
      setIsLoading(false);
      if (result.success) onSuccess();
      else toast.error(result.error || 'Login failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-gray-900 text-lg">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-gray-400 text-xs mb-5">
          {mode === 'signup' ? 'Sign up to check out — takes under a minute.' : 'Sign in to continue checkout.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text" placeholder="Full name" value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
            />
          )}
          <input
            type="email" placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
          />
          {mode === 'signup' && (
            <input
              type="tel" placeholder="Phone number" value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
            />
          )}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
            />
            <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="block ml-auto text-[11px] font-semibold text-gray-400 hover:text-orange-500 transition-colors"
            >
              Forgot password?
            </button>
          )}

          <button
            type="submit" disabled={isLoading}
            className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader className="w-4 h-4 animate-spin" />}
            {mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}
          </button>
        </form>

        <button
          onClick={() => setMode(m => (m === 'signup' ? 'login' : 'signup'))}
          className="w-full text-center text-xs text-gray-400 font-medium mt-4"
        >
          {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
          <span className="text-orange-500 font-semibold">{mode === 'signup' ? 'Sign in' : 'Sign up'}</span>
        </button>
      </motion.div>

      {showForgotPassword && (
        <ImportForgotPasswordSheet
          onClose={() => setShowForgotPassword(false)}
          onSuccess={() => { setShowForgotPassword(false); onSuccess(); }}
        />
      )}
    </motion.div>
  );
}
