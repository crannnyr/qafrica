// Dedicated checkout backend for /stores-v2.
// Intentionally separate from the legacy /stores checkout functions.
//
// Body:
// { action: "quote" | "create" | "confirm", items, state, customer, delivery, reference }
//
// Phase 1: QAFRICA is the marketplace seller for China Import items.
// China product price is product-only; flight shipping is added separately
// to the customer payment and recorded as prepaid internally.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { NombaError, nombaFetch } from '../_shared/nomba.ts';

const SITE = Deno.env.get('APP_URL') ?? 'https://qafrica.store';
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const QAFRICA_STORE_ID = '00000000-0000-0000-0000-000000000000';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const clean = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isPhone = (v: string) => /^\+?\d{10,14}$/.test(v.replace(/[^\d+]/g, ''));

function newReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const tail = Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 10).toUpperCase();
  return `QAF-MKT-${Date.now().toString(36).toUpperCase()}-${tail}`;
}

function normalizeItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 60).map((item: any) => ({
    source_type: item?.source_type === 'china_import' ? 'china_import' : 'product',
    source_id: String(item?.source_id ?? item?.product_id ?? ''),
    quantity: Math.min(Math.max(Number(item?.quantity ?? 1), 1), 99),
    variant_options: item?.variant_options && typeof item.variant_options === 'object' ? item.variant_options : null,
    attribution: item?.attribution === 'marketplace' ? 'marketplace' : 'own',
  })).filter(i => /^[0-9a-f-]{36}$/i.test(i.source_id));
}

async function requireCustomer(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('AUTH_REQUIRED');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('AUTH_REQUIRED');
  const { data: customer } = await supabase.from('customers').select('id,email,full_name,phone').eq('id', data.user.id).maybeSingle();
  if (!customer) throw new Error('CUSTOMER_REQUIRED');
  return customer;
}

async function quoteV2(items: ReturnType<typeof normalizeItems>, state: string) {
  const normal = items.filter(i => i.source_type === 'product');
  const china = items.filter(i => i.source_type === 'china_import');
  let normalQuote: any = { stores: [], errors: [], amount: 0, ok: true };

  if (normal.length) {
    const rows = await supabase.from('products').select('id,store_id').in('id', normal.map(i => i.source_id));
    if (rows.error) throw new Error(rows.error.message);
    const storeByProduct = new Map((rows.data ?? []).map((p: any) => [p.id, p.store_id]));
    const missing = normal.filter(i => !storeByProduct.get(i.source_id));
    if (missing.length) return { ok: false, stores: [], amount: 0, errors: missing.map(i => ({ code: 'product_unavailable', product_id: i.source_id, message: 'This item is no longer available' })) };
    const payload = normal.map(i => ({ product_id: i.source_id, store_id: storeByProduct.get(i.source_id), quantity: i.quantity, variant_options: i.variant_options, attribution: i.attribution }));
    const { data, error } = await supabase.rpc('checkout_quote', { p_items: payload, p_state: state, p_coupons: {} });
    if (error) throw new Error(error.message);
    normalQuote = data ?? normalQuote;
  }

  const errors: any[] = [];
  const chinaItems: any[] = [];
  if (china.length) {
    const { data: products, error } = await supabase
      .from('china_import_products')
      .select('id,name,image_url,image_urls,price_ngn,flight_shipping_cost_ngn,is_active,variants')
      .in('id', china.map(i => i.source_id));
    if (error) throw new Error(error.message);
    const byId = new Map((products ?? []).map((p: any) => [p.id, p]));

    for (const item of china) {
      const p = byId.get(item.source_id);
      if (!p || !p.is_active || Number(p.price_ngn ?? 0) <= 0 || Number(p.flight_shipping_cost_ngn ?? 0) <= 0) {
        errors.push({ code: 'china_product_unavailable', product_id: item.source_id, message: 'This China Import item is no longer available for marketplace purchase' });
        continue;
      }
      const image = Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls[0] : p.image_url;
      const unit = Number(p.price_ngn);
      const shippingUnit = Number(p.flight_shipping_cost_ngn);
      chinaItems.push({
        product_id: p.id, source_id: p.id, source_type: 'china_import', store_id: QAFRICA_STORE_ID,
        name: p.name, image, image_url: image, quantity: item.quantity,
        unit_price: unit, total_price: unit * item.quantity, variant_options: item.variant_options,
        attribution: 'own', is_imported: true, flight_shipping_cost_ngn: shippingUnit,
      });
    }
  }

  const productTotal = chinaItems.reduce((sum, l) => sum + Number(l.total_price), 0);
  const flightShippingTotal = chinaItems.reduce((sum, l) => sum + Number(l.flight_shipping_cost_ngn) * Number(l.quantity), 0);
  const landedTotal = productTotal + flightShippingTotal;
  const chinaStore = chinaItems.length ? [{
    store_id: QAFRICA_STORE_ID, store_name: 'QAFRICA', store_slug: 'qafrica',
    logo_url: '/qafrica-bag-logo.svg', items: chinaItems,
    subtotal: productTotal, delivery_fee: flightShippingTotal,
    coupon_code: null, coupon_discount: 0, coupon_message: null,
    total: landedTotal, shipping_included: true, flight_shipping_total: flightShippingTotal,
  }] : [];

  const stores = [...(normalQuote.stores ?? []), ...chinaStore];
  const amount = stores.reduce((sum: number, s: any) => sum + Number(s.total ?? 0), 0);
  return { ok: errors.length === 0 && stores.length > 0 && !!state, state, stores, amount, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid request' }); }

  let customer: any;
  try { customer = await requireCustomer(req); }
  catch (e) { return json(401, { error: e instanceof Error && e.message === 'CUSTOMER_REQUIRED' ? 'Customer account is required' : 'Please sign in to checkout' }); }

  const action = clean(body?.action, 20).toLowerCase();
  const items = normalizeItems(body?.items);
  const state = clean(body?.delivery?.state ?? body?.state, 40);

  if (action === 'quote') {
    if (!items.length) return json(400, { error: 'Your cart is empty' });
    if (!state) return json(200, { ok: false, stores: [], amount: 0, errors: [{ code: 'state_required', message: 'Choose your state' }] });
    try { return json(200, await quoteV2(items, state)); }
    catch (e) { console.error('marketplace-v2 quote failed', e); return json(500, { error: 'We could not price your cart. Please try again.' }); }
  }

  if (action === 'create') {
    const name = clean(body?.customer?.name ?? customer.full_name, 80);
    const email = clean(body?.customer?.email ?? customer.email, 120).toLowerCase();
    const phone = clean(body?.customer?.phone ?? customer.phone, 20).replace(/[^\d+]/g, '');
    const delivery = { address: clean(body?.delivery?.address, 200), city: clean(body?.delivery?.city, 60), state, landmark: clean(body?.delivery?.landmark, 120) };
    const errors: Record<string, string> = {};
    if (name.length < 2) errors.name = 'Enter your full name';
    if (!isEmail(email)) errors.email = 'Enter a valid email address';
    if (!isPhone(phone)) errors.phone = 'Enter a valid phone number';
    if (delivery.address.length < 5) errors.address = 'Enter your street address';
    if (!delivery.city) errors.city = 'Enter your city or area';
    if (!delivery.state) errors.state = 'Choose your state';
    if (!items.length) errors.cart = 'Your cart is empty';
    if (Object.keys(errors).length) return json(400, { error: 'Please check your details', field_errors: errors });

    try {
      const quote = await quoteV2(items, state);
      if (!quote.ok) return json(409, { error: 'Some items need your attention', quote });
      const reference = newReference();
      const { data: session, error: sessionError } = await supabase.from('marketplace_checkout_sessions').insert({
        reference, customer_id: customer.id, customer_name: name, customer_email: email, customer_phone: phone,
        delivery, items: quote.stores.flatMap((s: any) => s.items).map((line: any) => ({
          ...line, source_type: line.source_type ?? (line.is_imported ? 'china_import' : 'product'),
          source_id: line.source_id ?? line.product_id,
        })),
        store_orders: quote.stores.filter((s: any) => !s.shipping_included), amount: quote.amount,
      }).select('id').single();
      if (sessionError || !session) throw new Error(sessionError?.message ?? 'Session insert failed');

      const order = await nombaFetch('/v1/checkout/order', {
        method: 'POST',
        body: {
          order: {
            orderReference: reference,
            amount: Number(quote.amount).toFixed(2),
            currency: 'NGN',
            customerEmail: email,
            callbackUrl: `${SITE}/stores-v2/checkout/complete?ref=${encodeURIComponent(reference)}`,
          },
        },
        idempotencyKey: reference,
      });
      const link = order?.data?.checkoutLink;
      if (!link) throw new Error('No checkout link returned');
      await supabase.from('marketplace_checkout_sessions').update({
        checkout_link: link, nomba_order_id: order?.data?.orderReference ?? null, updated_at: new Date().toISOString(),
      }).eq('id', session.id);
      return json(200, { reference, checkout_link: link, amount: quote.amount });
    } catch (e) {
      console.error('marketplace-v2 create failed', e instanceof NombaError ? { status: e.status, code: e.code, description: e.description } : e);
      return json(502, { error: 'Payment service is busy. Please try again in a moment.' });
    }
  }

  if (action === 'confirm') {
    const reference = clean(body?.reference, 80);
    if (!/^QAF-MKT-[A-Z0-9-]+$/.test(reference)) return json(400, { error: 'Invalid reference' });
    const sessionResult = await supabase.from('marketplace_checkout_sessions').select('status,amount,expires_at,order_ids,china_import_order_ids,customer_id').eq('reference', reference).maybeSingle();
    const session = sessionResult.data;
    if (!session) return json(404, { error: 'Checkout not found' });
    if (session.customer_id !== customer.id) return json(403, { error: 'You are not allowed to confirm this checkout' });

    if (session.status !== 'paid') {
      try {
        const txResult = await nombaFetch(`/v1/transactions/accounts/single?orderReference=${encodeURIComponent(reference)}`);
        const tx = txResult?.data ?? null;
        if (tx) {
          const txRef = tx.onlineCheckoutOrderReference ?? tx.orderReference;
          const txStatus = String(tx.status ?? '').toUpperCase();
          const paid = Number(tx.onlineCheckoutAmount ?? tx.amount);
          if (txRef === reference && txStatus === 'SUCCESS') {
            const result = await supabase.rpc('finalize_marketplace_checkout_session', {
              p_reference: reference, p_paid_amount: paid,
              p_gateway_fee: Number(tx.fee ?? tx.fixedCharge ?? 0) || 0,
              p_transaction_id: String(tx.id ?? ''),
            });
            if (result.error) throw new Error(result.error.message);
          }
        }
      } catch (e) {
        console.error('marketplace-v2 confirm failed', e);
        return json(502, { error: 'We could not confirm your payment yet. Please try again.' });
      }
    }

    const { data: current } = await supabase.from('marketplace_checkout_sessions')
      .select('status,amount,order_ids,china_import_order_ids').eq('reference', reference).maybeSingle();
    return current ? json(200, current) : json(404, { error: 'Checkout not found' });
  }

  return json(400, { error: 'Unknown action' });
});
