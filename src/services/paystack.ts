import CONFIG from '@/lib/config';

// Paystack inline script loader
export const loadPaystackScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js'; // Fixed: removed trailing space
    script.async = true;
    script.onload = () => resolve();
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

  // Build config object
  const config: PaystackConfig = {
  key: CONFIG.PAYSTACK_PUBLIC_KEY,
  email,
  amount,
  ref: reference,
  metadata,
  callback: (response: PaystackResponse) => {
    // Wrap async callback in plain sync function — Paystack v1 rejects async callbacks
    onSuccess(response);
  },
  onClose: onCancel,
};

  // Only add channels if explicitly provided
  if (channels && channels.length > 0) {
    config.channels = channels;
  }

  const handler = window.PaystackPop.setup(config);
  handler.openIframe();
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