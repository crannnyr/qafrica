// Admin-only: refund a customer through Nomba, then reverse the held (escrow) money in the ledger.
// Body: { order_id, amount, account_number, bank_code, note }
// Deploy with verify_jwt = true. The caller must also be an admin (checked below).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { NombaError, nombaFetch } from '../_shared/nomba.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await supabase.auth.getUser(token);
  if (!u?.user) return json(401, { error: 'Sign in again' });
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  if (prof?.role !== 'admin') return json(403, { error: 'Admins only' });

  // deno-lint-ignore no-explicit-any
  let b: any;
  try {
    b = await req.json();
  } catch {
    return json(400, { error: 'Invalid request' });
  }
  const amount = Math.round(Number(b?.amount) * 100) / 100;
  const account = String(b?.account_number ?? '').replace(/\D/g, '');
  const bankCode = String(b?.bank_code ?? '').trim();
  const note = String(b?.note ?? '').slice(0, 1000);
  if (!/^\d{10}$/.test(account)) return json(400, { error: 'Account number must be 10 digits' });
  if (!/^[0-9A-Za-z]{3,10}$/.test(bankCode)) return json(400, { error: 'Enter a valid bank code' });
  if (!(amount > 0)) return json(400, { error: 'Enter a refund amount' });

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, total, refund_amount, payment_status, payment_provider, is_escrow_released, checkout_session_id, customer_email, customer_name, store_id, stores(owner_id, name)')
    .eq('id', String(b?.order_id ?? ''))
    .maybeSingle();
  if (!order) return json(404, { error: 'Order not found' });
  if (order.payment_status !== 'paid') return json(400, { error: 'This order is not paid' });
  if (order.is_escrow_released) return json(400, { error: 'Payment was already released to the seller. Recover it from the seller first.' });
  if (order.payment_provider !== 'nomba' || !order.checkout_session_id) return json(400, { error: 'This order was paid before Nomba. Refund it manually.' });
  const refundable = Number(order.total) - Number(order.refund_amount ?? 0);
  if (amount > refundable + 0.01) return json(400, { error: `You can refund at most NGN ${refundable.toLocaleString('en-NG')}` });

  const { data: session } = await supabase.from('checkout_sessions').select('nomba_transaction_id').eq('id', order.checkout_session_id).maybeSingle();
  if (!session?.nomba_transaction_id) return json(400, { error: 'Payment reference missing; refund manually from the Nomba dashboard' });

  // Record the attempt first: the unique "one pending per order" index blocks double refunds
  const { data: rf, error: rfErr } = await supabase
    .from('order_refunds')
    .insert({ order_id: order.id, amount, account_number: account, bank_code: bankCode, note, admin_id: u.user.id })
    .select('id')
    .single();
  if (rfErr || !rf) return json(409, { error: 'A refund for this order is already in progress' });

  try {
    const res = await nombaFetch('/v1/checkout/refund', {
      method: 'POST',
      idempotencyKey: rf.id,
      body: { transactionId: session.nomba_transaction_id, amount, accountNumber: account, bankCode },
    });
    await supabase.from('order_refunds').update({ provider_response: res }).eq('id', rf.id);
    if (res?.data?.success === false) throw new Error(res?.data?.message ?? 'Refund declined');
  } catch (e) {
    const detail = e instanceof NombaError ? { status: e.status, code: e.code, description: e.description } : { message: String(e) };
    await supabase.from('order_refunds').update({ status: 'failed', provider_response: detail, completed_at: new Date().toISOString() }).eq('id', rf.id);
    return json(502, { error: `Nomba refused the refund: ${detail.description ?? detail.message ?? 'unknown error'}` });
  }

  const { data: ledger, error: lErr } = await supabase.rpc('refund_order_escrow', { p_refund_id: rf.id });
  if (lErr) {
    // Money has left: flag loudly for manual ledger fix rather than hide it
    await supabase.from('system_failure_logs').insert({
      failure_type: 'refund_ledger_failed', entity_type: 'order', entity_id: order.id,
      error_message: lErr.message, metadata: { refund_id: rf.id, amount },
    });
    return json(500, { error: 'Refund sent, but the ledger update failed. It has been flagged for review.' });
  }

  // deno-lint-ignore no-explicit-any
  const store = (order as any).stores;
  if (store?.owner_id) {
    await supabase.from('notifications').insert({
      user_id: store.owner_id, type: 'order_refunded', title: 'Order refunded',
      message: `Order #${order.order_number}: NGN ${amount.toLocaleString('en-NG')} was refunded to the customer after review.`,
      data: { order_id: order.id, amount },
    });
  }
  if (order.customer_email) {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({
        to: order.customer_email,
        subject: `Refund for order #${order.order_number}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111"><p style="font-size:18px;font-weight:700">Your refund is on its way</p><p>Hi ${String(order.customer_name ?? '').split(' ')[0]}, we've refunded NGN ${amount.toLocaleString('en-NG')} for order #${order.order_number} to your bank account ending ${account.slice(-4)}. Bank transfers usually arrive within minutes but can take up to 24 hours.</p></div>`,
      }),
    }).catch(() => {});
  }
  return json(200, { ok: true, ledger });
});
