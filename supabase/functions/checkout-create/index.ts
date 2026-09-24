// Creates a Nomba payment for a cart. Prices come ONLY from checkout_quote (server-side).
// Body: { items: [{product_id, store_id, quantity, variant_options?, attribution?}],
//         customer: {name, email, phone}, delivery: {address, city, state, landmark?},
//         coupons?: {[store_id]: code}, return_slug?, payer?: {name, email, phone} }
// Deploy with verify_jwt = false (guests can check out); a signed-in shopper's token is optional.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { NombaError, nombaFetch } from '../_shared/nomba.ts';

const SITE = Deno.env.get('APP_URL') ?? 'https://qafrica.store';
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const normPhone = (p: string) => p.replace(/[^\d+]/g, '');
const isPhone = (p: string) => /^\+?\d{10,14}$/.test(p);

function newReference() {
  const rand = crypto.getRandomValues(new Uint8Array(6));
  const tail = Array.from(rand, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10).toUpperCase();
  return `QAF-${Date.now().toString(36).toUpperCase()}-${tail}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request' });
  }

  const customer = {
    name: clean(body?.customer?.name, 80),
    email: clean(body?.customer?.email, 120).toLowerCase(),
    phone: normPhone(clean(body?.customer?.phone, 20)),
  };
  const delivery = {
    address: clean(body?.delivery?.address, 200),
    city: clean(body?.delivery?.city, 60),
    state: clean(body?.delivery?.state, 40),
    landmark: clean(body?.delivery?.landmark, 120),
  };
  const fieldErrors: Record<string, string> = {};
  if (customer.name.length < 2) fieldErrors.name = 'Enter your full name';
  if (!isEmail(customer.email)) fieldErrors.email = 'Enter a valid email address';
  if (!isPhone(customer.phone)) fieldErrors.phone = 'Enter a valid phone number';
  if (delivery.address.length < 5) fieldErrors.address = 'Enter your delivery address';
  if (!delivery.city) fieldErrors.city = 'Enter your city or area';
  if (!delivery.state) fieldErrors.state = 'Choose your state';

  const payer = body?.payer
    ? { name: clean(body.payer.name, 80), email: clean(body.payer.email, 120).toLowerCase(), phone: normPhone(clean(body.payer.phone, 20)) }
    : null;
  if (payer) {
    if (payer.name.length < 2) fieldErrors.payer_name = 'Enter your name';
    if (!isEmail(payer.email)) fieldErrors.payer_email = 'Enter a valid email address';
  }
  if (Object.keys(fieldErrors).length) return json(400, { error: 'Please check your details', field_errors: fieldErrors });

  if (!Array.isArray(body?.items) || body.items.length === 0) return json(400, { error: 'Your cart is empty' });
  const items = body.items.slice(0, 60).map((i: Record<string, unknown>) => ({
    product_id: String(i.product_id ?? ''),
    store_id: String(i.store_id ?? ''),
    quantity: Number(i.quantity ?? 1),
    variant_options: i.variant_options && typeof i.variant_options === 'object' ? i.variant_options : null,
    attribution: i.attribution === 'marketplace' ? 'marketplace' : 'own',
  }));
  const coupons = body?.coupons && typeof body.coupons === 'object' ? body.coupons : {};

  // Server-side price, stock, delivery and coupon check
  const { data: quote, error: qErr } = await supabase.rpc('checkout_quote', { p_items: items, p_state: delivery.state, p_coupons: coupons });
  if (qErr) {
    console.error('quote failed', qErr);
    return json(500, { error: 'We could not price your cart. Please try again.' });
  }
  if (!quote?.ok) return json(409, { error: 'Some items need your attention', quote });

  // Signed-in shopper (optional)
  let customerId: string | null = null;
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (token) {
    const { data: u } = await supabase.auth.getUser(token);
    if (u?.user) {
      const { data: c } = await supabase.from('customers').select('id').eq('id', u.user.id).maybeSingle();
      customerId = c?.id ?? null;
    }
  }

  const reference = newReference();
  const returnSlug = clean(body?.return_slug, 80) || null;
  const { data: session, error: sErr } = await supabase
    .from('checkout_sessions')
    .insert({
      reference,
      customer_id: customerId,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      delivery,
      attribution_source: items.some((i: { attribution: string }) => i.attribution === 'marketplace') ? 'marketplace' : 'own',
      store_orders: quote.stores,
      amount: quote.amount,
      coupons,
      return_slug: returnSlug,
      payer_name: payer?.name ?? null,
      payer_email: payer?.email ?? null,
      payer_phone: payer?.phone ?? null,
      shared_cart_id: typeof body?.shared_cart_id === 'string' ? body.shared_cart_id : null,
    })
    .select('id')
    .single();
  if (sErr || !session) {
    console.error('session insert failed', sErr);
    return json(500, { error: 'We could not start your payment. Please try again.' });
  }

  try {
    const order = await nombaFetch('/v1/checkout/order', {
      method: 'POST',
      body: {
        order: {
          orderReference: reference,
          amount: Number(quote.amount).toFixed(2),
          currency: 'NGN',
          customerEmail: payer?.email ?? customer.email,
          callbackUrl: `${SITE}/checkout/complete?ref=${encodeURIComponent(reference)}`,
        },
      },
    });
    const link = order?.data?.checkoutLink;
    if (!link) throw new Error('No checkout link returned');
    await supabase
      .from('checkout_sessions')
      .update({ checkout_link: link, nomba_order_id: order?.data?.orderReference ?? null, updated_at: new Date().toISOString() })
      .eq('id', session.id);
    return json(200, { reference, checkout_link: link, amount: quote.amount });
  } catch (e) {
    console.error('nomba order failed', e instanceof NombaError ? { status: e.status, code: e.code, description: e.description } : e);
    await supabase.from('checkout_sessions').update({ status: 'failed', error: 'nomba_create_failed', updated_at: new Date().toISOString() }).eq('id', session.id);
    return json(502, { error: 'Payment service is busy. Please try again in a moment.' });
  }
});
