import { supabase } from '@/services';
import type { CartItem } from '@/stores/cartStore';

export type QuoteLine = {
  product_id: string;
  store_id: string;
  name: string;
  image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_options: Record<string, string> | null;
  attribution: 'own' | 'marketplace';
};
export type QuoteStore = {
  store_id: string;
  store_name: string;
  store_slug: string;
  logo_url: string | null;
  items: QuoteLine[];
  subtotal: number;
  delivery_fee: number | null;
  coupon_code: string | null;
  coupon_discount: number;
  coupon_message: string | null;
  total: number;
};
export type QuoteError = { code: string; message: string; product_id?: string; store_id?: string; available?: number };
export type Quote = { ok: boolean; stores: QuoteStore[]; amount: number; errors: QuoteError[]; state?: string | null };

export const toQuoteItems = (items: CartItem[]) =>
  items.map((i) => ({
    product_id: i.productId,
    store_id: i.storeId,
    quantity: i.quantity,
    variant_options: i.variantOptions ?? null,
    attribution: i.attribution ?? 'own',
  }));

export async function fetchQuote(items: CartItem[], state: string | null, coupons: Record<string, string> = {}): Promise<Quote> {
  const { data, error } = await supabase.rpc('checkout_quote', { p_items: toQuoteItems(items), p_state: state, p_coupons: coupons });
  if (error) throw new Error(error.message);
  return data as Quote;
}

export type CheckoutDetails = {
  customer: { name: string; email: string; phone: string };
  delivery: { address: string; city: string; state: string; landmark?: string };
  coupons?: Record<string, string>;
  return_slug?: string | null;
  payer?: { name: string; email: string; phone?: string } | null;
  shared_cart_id?: string | null;
};

export type CreateResult =
  | { ok: true; reference: string; checkout_link: string; amount: number }
  | { ok: false; error: string; field_errors?: Record<string, string>; quote?: Quote };

export async function createCheckout(items: CartItem[] | ReturnType<typeof toQuoteItems>, details: CheckoutDetails): Promise<CreateResult> {
  const payloadItems = (items as CartItem[])[0] && 'productId' in (items as CartItem[])[0] ? toQuoteItems(items as CartItem[]) : items;
  const { data, error } = await supabase.functions.invoke('checkout-create', { body: { items: payloadItems, ...details } });
  if (error) {
    // Supabase wraps non-2xx responses; read our JSON error body when present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any)?.context;
    let body: Record<string, unknown> | null = null;
    try {
      body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
    } catch {
      body = null;
    }
    return {
      ok: false,
      error: (body?.error as string) ?? 'We could not start your payment. Please try again.',
      field_errors: body?.field_errors as Record<string, string> | undefined,
      quote: body?.quote as Quote | undefined,
    };
  }
  return { ok: true, ...(data as { reference: string; checkout_link: string; amount: number }) };
}

export type SessionStatus = {
  status: 'awaiting_payment' | 'paid' | 'failed' | 'expired' | 'amount_mismatch' | 'fulfilment_error';
  amount: number;
  return_slug: string | null;
  orders: { order_number: string; total: number }[];
};

export async function confirmCheckout(reference: string): Promise<SessionStatus | null> {
  const { data, error } = await supabase.functions.invoke('checkout-confirm', { body: { reference } });
  if (error) return null;
  return data as SessionStatus;
}

// Remember which cart lines a checkout was for, so they can be removed once payment is confirmed
const PENDING_KEY = 'qafrica_pending_checkout';
export function rememberPending(reference: string, cartItemIds: string[], email: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ reference, cartItemIds, email, at: Date.now() }));
  } catch { /* ignore */ }
}
export function readPending(): { reference: string; cartItemIds: string[]; email: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    return v && typeof v.reference === 'string' ? v : null;
  } catch {
    return null;
  }
}
export function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch { /* ignore */ }
}

// Contact + address remembered on this device for faster checkout next time
const DETAILS_KEY = 'qafrica_checkout_details_v1';
export function loadSavedDetails(): Partial<CheckoutDetails> {
  try {
    return JSON.parse(localStorage.getItem(DETAILS_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}
export function saveDetails(d: Pick<CheckoutDetails, 'customer' | 'delivery'>) {
  try {
    localStorage.setItem(DETAILS_KEY, JSON.stringify(d));
  } catch { /* ignore */ }
}
