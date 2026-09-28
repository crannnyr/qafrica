// Store subscription payments through Flutterwave (bank transfer to a one-time account).
// All pricing and activation happen on the server (supabase/functions/flutterwave).

import CONFIG from '@/lib/config';
import { supabase } from './supabase';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/flutterwave`;

export type SubscriptionPlanRequest = {
  tier: string;
  /** months (1, 3, 6, 12) or 'lifetime' */
  duration: number | 'lifetime';
  starter_pack?: boolean;
  niches?: string[];
  store_id?: string | null;
};

export type TransferAccount = {
  account_number: string;
  bank_name: string;
  account_name: string;
  /** What the payer must send, Flutterwave's fee included */
  amount_to_pay: number;
  expires_at: string | null;
  note?: string;
};

export type StartResult =
  | { ok: true; reference: string; amount: number; account: TransferAccount }
  | { ok: false; message: string };

export type PaymentStatus = 'pending' | 'activating' | 'paid' | 'review' | 'failed' | 'expired';

async function call<T>(action: string, body: unknown): Promise<T | { ok: false; message: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, message: 'Please sign in again.' };
  try {
    const res = await fetch(`${EDGE_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok === false) return { ok: false, message: payload?.message ?? 'Something went wrong. Please try again.' };
    return payload as T;
  } catch {
    return { ok: false, message: 'No connection. Check your internet and try again.' };
  }
}

export function startSubscriptionPayment(plan: SubscriptionPlanRequest) {
  return call<StartResult>('start', plan) as Promise<StartResult>;
}

export function checkSubscriptionPayment(reference: string) {
  return call<{ ok: true; status: PaymentStatus; paid: boolean; tier: string; is_starter_pack: boolean }>('status', { reference });
}
