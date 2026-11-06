// Nomba webhook receiver.
// - Verifies the HMAC-SHA256 signature Nomba sends (per developer.nomba.com/docs/api-basics/webhook)
// - Stores each event exactly once (payment_webhook_events, unique on provider + requestId)
// - Always answers 2xx for well-formed requests so Nomba doesn't retry events we've already stored.
// Order/subscription processing is added separately and only ever acts on signature_valid rows,
// after re-checking the transaction with Nomba's API.
// Deploy with verify_jwt = false: Nomba cannot send a Supabase login token.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyAndFinalize } from '../_shared/checkout.ts';
import { nombaFetch } from '../_shared/nomba.ts';

const WEBHOOK_SECRET = Deno.env.get('NOMBA_WEBHOOK_SECRET') ?? '';
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// Constant-time comparison (case-insensitive, as in Nomba's reference code)
function safeEqual(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// Nomba signs: event_type:requestId:userId:walletId:transactionId:type:time:responseCode:timestamp
// deno-lint-ignore no-explicit-any
async function verifySignature(body: any, signature: string, timestamp: string): Promise<boolean> {
  if (!WEBHOOK_SECRET || !signature || !timestamp) return false;
  const merchant = body?.data?.merchant ?? {};
  const tx = body?.data?.transaction ?? {};
  let responseCode = tx.responseCode ?? '';
  if (responseCode === 'null' || responseCode === null) responseCode = '';
  const message = [
    body?.event_type ?? '', body?.requestId ?? '', merchant.userId ?? '', merchant.walletId ?? '',
    tx.transactionId ?? '', tx.type ?? '', tx.time ?? '', responseCode, timestamp,
  ].join(':');
  return safeEqual(await hmacBase64(WEBHOOK_SECRET, message), signature);
}

Deno.serve(async (req) => {
  // Nomba (and humans) may probe the URL when saving the webhook
  if (req.method === 'GET' || req.method === 'HEAD') return json(200, { ok: true, service: 'nomba-webhook' });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const raw = await req.text();
  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const signature = req.headers.get('nomba-signature') ?? req.headers.get('nomba-sig-value') ?? '';
  const timestamp = req.headers.get('nomba-timestamp') ?? '';
  const valid = await verifySignature(body, signature, timestamp);
  const requestId = String(body?.requestId ?? body?.request_id ?? `no-id-${crypto.randomUUID()}`);

  const headers = {
    'nomba-signature-algorithm': req.headers.get('nomba-signature-algorithm'),
    'nomba-signature-version': req.headers.get('nomba-signature-version'),
    'nomba-timestamp': timestamp,
    has_signature: !!signature,
  };

  const { error } = await supabase
    .from('payment_webhook_events')
    .insert({ provider: 'nomba', request_id: requestId, event_type: body?.event_type ?? null, signature_valid: valid, payload: body, headers });

  if (error && error.code !== '23505') {
    // Storage failed: ask Nomba to retry later
    console.error('store webhook failed', error);
    return json(500, { error: 'temporarily unavailable' });
  }
  if (!valid) {
    console.warn('nomba webhook with invalid/missing signature', requestId);
    return json(200, { received: true }); // stored for audit, never acted on
  }

  // China Import payment intents are separate from marketplace/Help Pay sessions.
  const ref = String(body?.data?.order?.orderReference ?? body?.data?.transaction?.merchantTxRef ?? '');
  if (body?.event_type === 'payment_success' && ref.startsWith('QAF-I')) {
    const { data: ev } = await supabase.from('payment_webhook_events')
      .select('id, processed_at').eq('provider', 'nomba').eq('request_id', requestId).maybeSingle();
    if (ev && !ev.processed_at) {
      try {
        const { data: intent, error: intentError } = await supabase.from('china_import_payment_intents')
          .select('*').eq('reference', ref).maybeSingle();
        if (intentError) throw new Error(intentError.message);
        if (intent && intent.status === 'pending') {
          const txResult = await nombaFetch(`/v1/transactions/accounts/single?orderReference=${encodeURIComponent(ref)}`);
          const tx = txResult?.data;
          const txRef = tx?.onlineCheckoutOrderReference ?? tx?.orderReference;
          const txStatus = String(tx?.status ?? '').toUpperCase();
          const paidAmount = Number(tx?.onlineCheckoutAmount ?? tx?.amount);
          if (txRef === ref && txStatus === 'SUCCESS' && Number.isFinite(paidAmount) && Math.abs(paidAmount - Number(intent.amount_ngn)) <= 0.01) {
            const now = new Date().toISOString();
            if (intent.intent_type === 'order') {
              const { data: order } = await supabase.from('china_import_orders').select('payment_status,items')
                .eq('id', intent.order_id).maybeSingle();
              if (order && order.payment_status !== 'paid') {
                await supabase.from('china_import_orders').update({ payment_status: 'paid', payment_reference: ref, paid_at: now })
                  .eq('id', intent.order_id).neq('payment_status', 'paid');
                await supabase.from('china_import_consolidation_bills').update({ status: 'paid', confirmed_paid_at: now, reminder_count: 0 })
                  .eq('order_id', intent.order_id).eq('kind', 'consolidation_shipping').eq('reason', 'Upfront shipping fee').neq('status', 'cancelled');
                await supabase.rpc('china_import_payment_confirmed', { p_order_id: intent.order_id });
              }
            } else if (intent.intent_type === 'bill') {
              await supabase.from('china_import_consolidation_bills').update({
                status: 'paid', confirmed_paid_at: now, paystack_reference: ref, reminder_count: 0,
              }).eq('id', intent.bill_id).eq('user_id', intent.customer_id).eq('status', 'pending');
            }
            await supabase.from('china_import_payment_intents').update({
              status: 'paid', nomba_transaction_id: String(tx?.id ?? ''), paid_at: now, updated_at: now,
            }).eq('id', intent.id).eq('status', 'pending');
          }
        }
        await supabase.from('payment_webhook_events').update({ processed_at: new Date().toISOString(), process_error: null }).eq('id', ev.id);
      } catch (e) {
        await supabase.from('payment_webhook_events').update({ process_error: String(e).slice(0, 500) }).eq('id', ev.id);
        return json(500, { error: 'China Import payment processing failed, please retry' });
      }
    }
    return json(200, { received: true });
  }

  // Checkout payments: our references start with QAF-. Processing always re-verifies with Nomba.
  const ref = String(body?.data?.order?.orderReference ?? body?.data?.transaction?.merchantTxRef ?? '');
  if (body?.event_type === 'payment_success' && ref.startsWith('QAF-')) {
    const { data: ev } = await supabase
      .from('payment_webhook_events')
      .select('id, processed_at')
      .eq('provider', 'nomba')
      .eq('request_id', requestId)
      .maybeSingle();
    if (ev && !ev.processed_at) {
      try {
        const fee = Number(body?.data?.transaction?.fee);
        const result = await verifyAndFinalize(supabase, ref, Number.isFinite(fee) ? { fee } : {});
        await supabase.from('payment_webhook_events')
          .update({ processed_at: new Date().toISOString(), process_error: result.status === 'paid' ? null : result.status })
          .eq('id', ev.id);
      } catch (e) {
        console.error('checkout processing failed', ref, e);
        await supabase.from('payment_webhook_events').update({ process_error: String(e).slice(0, 500) }).eq('id', ev.id);
        return json(500, { error: 'processing failed, please retry' }); // Nomba retries with backoff
      }
    }
  }
  return json(200, { received: true });
});
