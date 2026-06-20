import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, Check, Loader2, AlertCircle, ArrowRight, 
  ExternalLink, Shield, Sparkles, Info, CreditCard, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore, useAuthStore } from '@/stores';
import { toast } from 'sonner';
import { supabase } from '@/services';
import { loadPaystackScript, initializePayment, generateReference, toKobo } from '@/services/paystack';

// Change 1: Updated pricing with per-extension breakdown
const DOMAIN_PRICING = {
  com: 30000,
  shop: 12900,
  store: 12900,
  connect: 7000,
};

type DomainType = 'new' | 'existing';

// Change 2: Extension detector + dynamic price resolver
function detectExtension(domain: string): string | null {
  const clean = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
  const parts = clean.split('.');
  if (parts.length >= 2) return parts[parts.length - 1];
  return null;
}

function getPriceForDomain(domainType: DomainType, domain: string): number {
  if (domainType === 'existing') return DOMAIN_PRICING.connect;
  const ext = detectExtension(domain);
  if (ext === 'com') return DOMAIN_PRICING.com;
  if (ext === 'shop' || ext === 'store') return DOMAIN_PRICING.shop;
  // Default for any other extension when buying new
  return DOMAIN_PRICING.store;
}

export default function DomainPage() {
  const { currentStore, fetchStore } = useStoreStore();
  const { user } = useAuthStore();
  const [domainType, setDomainType] = useState<DomainType>('new');
  const [domainInput, setDomainInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    available?: boolean;
    message?: string;
    formatted?: string;
  } | null>(null);
  const [isPaystackReady, setIsPaystackReady] = useState(false);
  const [paystackError, setPaystackError] = useState<string | null>(null);

  useEffect(() => {
    loadPaystackScript()
      .then(() => {
        console.log('Paystack script loaded successfully');
        setIsPaystackReady(true);
        setPaystackError(null);
      })
      .catch((err) => {
        console.error('Paystack load error:', err);
        setPaystackError('Payment system failed to load');
        toast.error('Payment system failed to load');
      });
  }, []);

  useEffect(() => {
    if (currentStore?.custom_domain) {
      setDomainInput(currentStore.custom_domain);
      setDomainType('existing');
    }
  }, [currentStore]);

  // Clear check result when input changes
  useEffect(() => {
    setCheckResult(null);
  }, [domainInput, domainType]);

  // Change 3: formatDomain no longer auto-appends .store — user must type full domain
  const formatDomain = (input: string): string => {
    return input.toLowerCase().trim()
      .replace(/\s+/g, '')
      .replace(/^(https?:\/\/)/, '')
      .split('/')[0];
  };

  const handleCheckDomain = async () => {
    if (!domainInput.trim()) {
      toast.error('Please enter a domain name');
      return;
    }

    // Change 3: use formatDomain without type argument
    const formatted = formatDomain(domainInput);
    console.log('Checking domain:', formatted);

    const isValid = /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/.test(formatted);
    
    if (!isValid) {
      setCheckResult({
        available: false,
        message: 'Invalid domain format. Please enter a full domain including extension (e.g. mystore.com).',
        formatted
      });
      return;
    }

    setIsChecking(true);
    setCheckResult(null);

    setTimeout(() => {
      const isTaken = formatted.includes('taken') || formatted === 'test.store';
      const isAvailable = domainType === 'new' ? !isTaken : true;
      
      setCheckResult({
        available: isAvailable,
        formatted: formatted,
        message: domainType === 'new' 
          ? (isAvailable ? `${formatted} is available!` : `${formatted} is already taken. Try another.`)
          : `${formatted} will be connected to your store`
      });
      setIsChecking(false);
    }, 800);
  };

  // This is called by Paystack - MUST NOT be async
  const handlePaystackCallback = (response: any) => {
    console.log('Paystack callback received:', response);
    processPaymentSuccess(response).catch(err => {
      console.error('Payment processing error:', err);
      toast.error('Payment succeeded but failed to save. Contact support.');
    });
  };

  const processPaymentSuccess = async (response: any) => {
    console.log('Processing payment success:', response);
    
    if (!currentStore?.id || !checkResult?.formatted) {
      toast.error('Missing store information');
      return;
    }

    setIsSubmitting(true);

    // Change 5: use getPriceForDomain for the saved amount
    const amountPaid = getPriceForDomain(domainType, checkResult.formatted ?? domainInput);

    try {
      const { error: requestError } = await supabase
        .from('domain_requests')
        .insert({
          store_id: currentStore.id,
          user_id: user?.id,
          domain_name: checkResult.formatted,
          domain_type: domainType,
          amount_paid: amountPaid,
          payment_reference: response.reference,
          payment_status: 'paid',
          status: 'pending',
          requested_at: new Date().toISOString(),
        });

      if (requestError) {
        console.error('Domain request insert error:', requestError);
        throw requestError;
      }

      const { error: storeError } = await supabase
        .from('stores')
        .update({
          custom_domain: checkResult.formatted,
          domain_status: 'pending',
          domain_paid_amount: amountPaid,
        })
        .eq('id', currentStore.id);

      if (storeError) {
        console.error('Store update error:', storeError);
        throw storeError;
      }

      await fetchStore(currentStore.id);
      toast.success('Payment successful! Domain request submitted to admin.');
      
      setCheckResult(null);
      setDomainInput('');
      
    } catch (err: any) {
      console.error('Full error:', err);
      toast.error(`Failed to save request: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRequest = () => {
    console.log('Submit clicked - User:', user?.email, 'CheckResult:', checkResult);

    if (!checkResult?.available) {
      toast.error('Please check domain availability first');
      return;
    }

    if (!user?.email) {
      toast.error('User email not found. Please log in again.');
      return;
    }

    if (!isPaystackReady) {
      toast.error('Payment system not ready. Please refresh.');
      return;
    }

    // Change 5: dynamic amount via getPriceForDomain
    const amount = getPriceForDomain(domainType, checkResult.formatted ?? domainInput);
    const reference = generateReference('DOM');
    
    console.log('Initializing payment:', { email: user.email, amount, reference });

    try {
      initializePayment({
        email: user.email,
        amount: toKobo(amount),
        reference,
        metadata: {
          store_id: currentStore?.id,
          user_id: user?.id,
          domain_name: checkResult.formatted,
          domain_type: domainType,
        },
        onSuccess: handlePaystackCallback,
        onCancel: () => {
          console.log('Payment cancelled by user');
          toast.error('Payment cancelled');
        }
      });
    } catch (err: any) {
      console.error('Payment initialization error:', err);
      toast.error(`Payment failed: ${err.message || 'Unknown error'}`);
    }
  };

  const clearSearch = () => {
    setDomainInput('');
    setCheckResult(null);
  };

  if (paystackError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
        <h3 className="text-red-800 font-semibold mb-2">Payment System Error</h3>
        <p className="text-red-600">{paystackError}</p>
        <Button onClick={() => window.location.reload()} className="mt-4 bg-orange-500">
          Refresh Page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom Domain</h1>
        <p className="text-gray-500 mt-1">Connect your own domain to your store</p>
      </div>

      {/* Current Domain Status */}
      {currentStore?.custom_domain && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-100 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Domain Request</h2>
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Globe className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{currentStore.custom_domain}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    currentStore.domain_status === 'connected' ? 'bg-green-100 text-green-700' :
                    currentStore.domain_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    currentStore.domain_status === 'processing' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {(currentStore.domain_status || 'pending').toUpperCase()}
                  </span>
                </div>
              </div>
              {currentStore.domain_status === 'connected' && (
                <a 
                  href={`https://${currentStore.custom_domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Visit
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            
            <div className="text-sm text-gray-600">
              <p>Your current store URL: <strong>{currentStore.slug}.store</strong></p>
              <p className="mt-1 text-gray-500">This will redirect to your custom domain once approved.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Domain Selection */}
      {!currentStore?.custom_domain && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => { setDomainType('new'); clearSearch(); }}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                domainType === 'new'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">from ₦{DOMAIN_PRICING.store.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">one-time</p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Buy New Domain</h3>
              <p className="text-gray-600 text-sm mb-4">Get a .store, .com, or other domain extension.</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />.store / .shop — ₦{DOMAIN_PRICING.store.toLocaleString()}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />.com — ₦{DOMAIN_PRICING.com.toLocaleString()}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Free SSL included</li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => { setDomainType('existing'); clearSearch(); }}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                domainType === 'existing'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">₦{DOMAIN_PRICING.connect.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">setup fee</p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Existing</h3>
              <p className="text-gray-600 text-sm mb-4">Already own a domain? We'll connect it.</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Any extension works</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Expert assistance</li>
              </ul>
            </motion.div>
          </div>

          {/* Domain Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl border border-gray-100 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {domainType === 'new' ? 'Search for Your Domain' : 'Enter Your Domain'}
            </h2>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder={domainType === 'new' ? 'yourstore.com' : 'yourstore.com'}
                  className="w-full px-4 py-4 pr-12 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-lg"
                />
                {domainInput && (
                  <button 
                    onClick={clearSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <Button
                onClick={handleCheckDomain}
                disabled={isChecking || !domainInput.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 h-14"
              >
                {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check'}
              </Button>
            </div>

            {/* Results */}
            {checkResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                checkResult.available 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                <div className="flex items-center gap-2">
                  {checkResult.available 
                    ? <Check className="w-5 h-5 text-green-500" /> 
                    : <AlertCircle className="w-5 h-5 text-red-500" />
                  }
                  <p>{checkResult.message}</p>
                </div>
              </div>
            )}

            {/* Change 5: Payment Section with dynamic pricing */}
            {checkResult?.available && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-gray-500">Total Cost</p>
                    <p className="text-3xl font-bold text-gray-900">
                      ₦{getPriceForDomain(domainType, checkResult.formatted ?? domainInput).toLocaleString()}
                    </p>
                    {/* Change 5: show detected extension and its price */}
                    <p className="text-sm text-gray-500 mt-1">
                      {domainType === 'new'
                        ? `.${detectExtension(checkResult.formatted ?? '')} domain`
                        : 'Connection fee'
                      }
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmitRequest}
                    disabled={isSubmitting || !isPaystackReady}
                    className="bg-green-500 hover:bg-green-600 text-white px-8 h-14"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay & Submit
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-4 flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  Your store URL stays <strong>{currentStore?.slug}.store</strong> until admin approves.
                </p>
              </div>
            )}
          </motion.div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">How it works</h4>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Enter your desired domain name (including extension) and check availability</li>
                  <li>Pay securely via Paystack (one-time fee)</li>
                  <li>Admin receives your request and configures the domain (24-48 hours)</li>
                  <li>Your custom domain goes live and original URL redirects</li>
                </ol>
                {/* Change 4: Availability notice */}
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                  Domain acquisition is subject to availability. If your chosen domain is unavailable or cannot be registered, our support team will reach out within 24 hours with alternatives. Your payment will be refunded if we cannot fulfil the request.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}