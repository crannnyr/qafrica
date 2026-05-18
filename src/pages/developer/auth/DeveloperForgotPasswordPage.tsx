// src/pages/developer/auth/DeveloperForgotPasswordPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Mail, ArrowLeft, Loader2, Send, CheckCircle } from 'lucide-react';
import { developerAuthService } from '@/services/developer';

export default function DeveloperForgotPasswordPage() {
  const [email,     setEmail]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await developerAuthService.forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch {
      // Always show success to prevent email enumeration
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/developer/login" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">QAFRICA Dev</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <AnimatePresence mode="wait">
            {/* ── Before submit ─────────────────────────── */}
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex justify-center mb-6">
                  <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center">
                    <Mail className="w-7 h-7 text-orange-500" />
                  </div>
                </div>

                <div className="text-center mb-7">
                  <h1 className="text-xl font-bold text-gray-900 mb-2">Reset your password</h1>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Enter the email address associated with your developer account and
                    we'll send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      placeholder="you@yourplatform.com"
                      autoFocus
                      autoComplete="email"
                      className={`w-full h-11 px-4 rounded-xl border text-sm text-gray-900 placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                        transition-colors bg-white
                        ${error ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                    />
                    {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:bg-orange-700
                      disabled:opacity-60 disabled:cursor-not-allowed
                      text-white font-semibold rounded-xl transition-colors
                      flex items-center justify-center gap-2"
                  >
                    {isLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending link...</>
                      : <><Send className="w-4 h-4" /> Send reset link</>
                    }
                  </button>
                </form>
              </motion.div>
            ) : (
              /* ── After submit ─────────────────────────── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-1">
                  If <span className="font-medium text-gray-700">{email}</span> is registered,
                  you'll receive a password reset link shortly.
                </p>
                <p className="text-xs text-gray-400 mb-7">
                  Check your spam folder if you don't see it within a few minutes.
                </p>
                <Link
                  to="/developer/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer link */}
        {!submitted && (
          <div className="text-center mt-5">
            <Link
              to="/developer/login"
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 mx-auto justify-center transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}