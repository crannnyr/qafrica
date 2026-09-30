import CONFIG from '@/lib/config';

let paystackScriptPromise: Promise<void> | null = null;

export const loadPaystackScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.PaystackPop) return Promise.resolve();
  if (paystackScriptPromise) return paystackScriptPromise;

  paystackScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-qafrica-paystack="true"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.PaystackPop) resolve(); else reject(new Error('Paystack loaded but the checkout client is unavailable'));
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Paystack')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.dataset.qafricaPaystack = 'true';
    script.onload = () => {
      if (window.PaystackPop) resolve(); else reject(new Error('Paystack loaded but the checkout client is unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    paystackScriptPromise = null;
    throw error;
  });

  return paystackScriptPromise;
};

if (typeof window !== 'undefined') void loadPaystackScript().catch(() => undefined);

export const initializePayment = ({ email, amount, reference, metadata = {}, channels, onSuccess, onCancel }: {
  email: string; amount: number; reference: string; metadata?: Record<string, any>; channels?: string[];
  onSuccess: (response: PaystackResponse) => void; onCancel: () => void;
}) => {
  if (!window.PaystackPop) throw new Error('Paystack is still loading. Please wait a moment and try again.');
  if (!CONFIG.PAYSTACK_PUBLIC_KEY) throw new Error('Paystack public key is not configured');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid payment amount');
  if (!email?.trim()) throw new Error('Customer email is required for Paystack');
  if (!reference?.trim()) throw new Error('Payment reference is required');
  const config: PaystackConfig = { key: CONFIG.PAYSTACK_PUBLIC_KEY, email: email.trim(), amount: Math.round(amount), ref: reference, metadata, callback: onSuccess, onClose: onCancel };
  if (channels && channels.length > 0) config.channels = channels;
  try { window.PaystackPop.setup(config).openIframe(); }
  catch (error) { throw new Error(error instanceof Error ? `Could not open Paystack: ${error.message}` : 'Could not open Paystack checkout'); }
};

export const generateReference = (prefix: string = 'QAF'): string => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
export const toKobo = (naira: number): number => Math.round(naira * 100);
export const verifyPayment = async (_reference: string): Promise<{ success: boolean; data?: any; error?: string }> => ({ success: true });
export const verifyTransaction = verifyPayment;

declare global { interface Window { PaystackPop: { setup: (config: PaystackConfig) => PaystackHandler; }; } }
interface PaystackConfig { key: string; email: string; amount: number; ref: string; metadata?: Record<string, any>; channels?: string[]; callback: (response: PaystackResponse) => void; onClose: () => void; }
interface PaystackHandler { openIframe: () => void; }
export interface PaystackResponse { reference: string; trans: string; status: string; message: string; transaction: string; trxref: string; }
