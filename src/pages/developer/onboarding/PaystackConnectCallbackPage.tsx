// src/pages/developer/onboarding/PaystackConnectCallbackPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { developerPaystackService } from '@/services/developer';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import { toast } from 'sonner';

type Status = 'processing' | 'success' | 'error';

export default function PaystackConnectCallbackPage() {
  const navigate  = useNavigate();
  const { fetchProfile } = useDeveloperAuthStore();

  const [status,  setStatus]  = useState<Status>('processing');
  const [message, setMessage] = useState('Connecting your Paystack account...');
  const [detail,  setDetail]  = useState('');

  useEffect(() => {
    async function handleCallback() {
      // Extract code from URL query params (?code=xxxx)
      const params = new URLSearchParams(window.location.search);
      const code   = params.get('code');
      const error  = params.get('error');

      // User denied access on Paystack side
      if (error || !code) {
        setStatus('error');
        setMessage('Paystack connection cancelled');
        setDetail(error
          ? 'You cancelled the Paystack authorisation. You can connect your account later from Settings.'
          : 'No authorisation code received. Please try again.');
        return;
      }

      try {
        setMessage('Verifying your Paystack account...');
        const result = await developerPaystackService.handleCallback(code);

        setMessage('Configuring payment splits...');
        await fetchProfile(); // Refresh developer record

        setStatus('success');
        setMessage('Paystack connected successfully!');
        setDetail(`${result.account_name} · ${result.bank_name}`);

        toast.success('Paystack account connected. You can now create orders via the API.');

        // Resume onboarding at step 3
        setTimeout(() => {
          navigate('/developer/onboarding', { replace: true });
        }, 2500);

      } catch (err: any) {
        console.error('[PaystackCallback] Error:', err);
        setStatus('error');
        setMessage('Connection failed');
        setDetail(err?.message ?? 'An unexpected error occurred. Please try connecting again from Settings.');
      }
    }

    handleCallback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm text-center"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">QAFRICA Dev</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {/* Status icon */}
          <div className="flex justify-center mb-5">
            {status === 'processing' && (
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center"
              >
                <CheckCircle className="w-8 h-8 text-green-500" />
              </motion.div>
            )}
            {status === 'error' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center"
              >
                <XCircle className="w-8 h-8 text-red-500" />
              </motion.div>
            )}
          </div>

          {/* Message */}
          <h2 className="text-lg font-bold text-gray-900 mb-2">{message}</h2>
          {detail && (
            <p className="text-sm text-gray-500 leading-relaxed">{detail}</p>
          )}

          {/* Processing: animated dots */}
          {status === 'processing' && (
            <div className="flex justify-center gap-1.5 mt-5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-orange-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          )}

          {/* Success: redirect notice */}
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-400"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Redirecting back to setup...
            </motion.div>
          )}

          {/* Error: action buttons */}
          {status === 'error' && (
            <div className="mt-6 space-y-3">
              <button
                onClick={() => navigate('/developer/onboarding')}
                className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold
                  rounded-xl transition-colors text-sm"
              >
                Return to setup
              </button>
              <button
                onClick={() => navigate('/developer/dashboard/settings')}
                className="w-full h-11 border border-gray-200 text-gray-600 hover:bg-gray-50
                  font-medium rounded-xl transition-colors text-sm"
              >
                Connect from Settings later
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}