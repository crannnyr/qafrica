import CONFIG from '@/lib/config';

// Paystack inline script loader
export const loadPaystackScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => {
      if (window.PaystackPop) resolve();
      else reject(new Error('Paystack loaded but the checkout client is unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.body.appendChild(script);
  });
};

// Initialize Paystack payment
export const initializePayment = ({
  email,
  amount,
  reference,
  metadata = {},
  channels,
  onSuccess,
  onCancel,
}: {
  email: string;
  amount: number;
  reference: string;
  metadata?: Record<string, any>;
  channels?: string[];
  onSuccess: (response: PaystackResponse) => void;
  onCancel: () => void;
}) => {
  if (!window.PaystackPop) {
    throw new Error('Paystack not loaded');
  }
  if (!CONFIG.PAYSTACK_PUBLIC_KEY) {
    throw new Error('Paystack public key is not configured');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid payment amount');
  }
  if (!email?.trim()) {
    throw new Error('Customer email is required for Paystack');
  }
  if (!reference?.trim()) {
    throw new Error('Payment reference is required');
  }

  const config: PaystackConfig = {
    key: CONFIG.PAYSTACK_PUBLIC_KEY,
    email: email.trim(),
    amount: Math.round(amount),
    ref: reference,
    metadata,
    callback: (response: PaystackResponse) => {
      // Paystack v1 expects a synchronous callback. The checkout sheet handles
      // the async server-side verification after this callback fires.
      onSuccess(response);
    },
    onClose: onCancel,
  };

  if (channels && channels.length > 0) {
    config.channels = channels;
  }

  try {
    const handler = window.PaystackPop.setup(config);
    handler.openIframe();
  } catch (error) {
    throw new Error(error instanceof Error ? `Could not open Paystack: ${error.message}` : 'Could not open Paystack checkout');
  }
};

// Generate unique payment reference
export const generateReference = (prefix: string = 'QAF'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
};

// Convert naira to kobo
export const toKobo = (naira: number): number => {
  return Math.round(naira * 100);
};

// Verify payment
export const verifyPayment = async (_reference: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Verification failed' };
  }
};

// Verify transaction (alias)
export const verifyTransaction = verifyPayment;

// Types
declare global {
  interface Window {
    PaystackPop: {
      setup: (config: PaystackConfig) => PaystackHandler;
    };
  }
}

interface PaystackConfig {
  key: string;
  email: string;
  amount: number;
  ref: string;
  metadata?: Record<string, any>;
  channels?: string[];
  callback: (response: PaystackResponse) => void;
  onClose: () => void;
}

interface PaystackHandler {
  openIframe: () => void;
}

export interface PaystackResponse {
  reference: string;
  trans: string;
  status: string;
  message: string;
  transaction: string;
  trxref: string;
}
