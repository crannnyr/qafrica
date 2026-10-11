// Shared by nomba-webhook, checkout-confirm and checkout-sweep.
// Never trusts the caller: always re-checks the transaction with Nomba before creating orders
// (developer.nomba.com/docs/products/accept-payment/verify-transactions).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { NombaError, nombaFetch } from './nomba.ts';

export type FinalizeResult =
  | { status: 'paid'; order_ids: string[]; already?: boolean; contribution_complete?: boolean; amount_raised?: number; target_amount?: number; contribution_amount?: number }
  | { status: 'not_paid' | 'failed' | 'amount_mismatch' | 'fulfilment_error' | 'unknown_reference' | 'expired'; detail?: string };

const SITE = Deno.env.get('APP_URL') ?? 'https://qafrica.store';

async function verifyAndFinalizeMarketplace(
  supabase: SupabaseClient,
  reference: string,
  hint: { fee?: number } = {},
): Promise<FinalizeResult> {
  const { data: session, error: sessionError } = await supabase
    .from('marketplace_checkout_sessions')
    .select('id, status, amount, expires_at, order_ids')
    .eq('reference', reference)
    .maybeSingle();
  if (sessionError) throw new Error(`marketplace session lookup failed: ${sessionError.message}`);
  if (!session) return { status: 'unknown_reference' };
  if (session.status === 'paid') return { status: 'paid', order_ids: session.order_ids ?? [], already: true };
  if (session.status === 'amount_mismatch') {
    return { status: session.status };
  }
  if (session.status !== 'awaiting_payment' && session.status !== 'expired' && session.status !== 'failed' && session.status !== 'fulfilment_error') {
    return { status: session.status as Exclude<FinalizeResult['status'], 'paid'> };
  }

  // Always verify with Nomba; the signed webhook payload is only a trigger.
  let tx: any = null;
  try {
    const res = await nombaFetch(`/v1/transactions/accounts/single?orderReference=${encodeURIComponent(reference)}`);
    tx = res?.data ?? null;
  } catch (e) {
    if (e instanceof NombaError && (e.code === '01' || e.status === 404)) tx = null;
    else throw e;
  }

  if (!tx) {
    if (session.status === 'awaiting_payment' && new Date(session.expires_at).getTime() < Date.now()) {
      await supabase.from('marketplace_checkout_sessions').update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', session.id).eq('status', 'awaiting_payment');
      return { status: 'expired' };
    }
    return { status: 'not_paid' };
  }

  const txRef = tx.onlineCheckoutOrderReference ?? tx.orderReference;
  if (txRef !== reference) return { status: 'not_paid', detail: 'reference mismatch' };
  const txStatus = String(tx.status ?? '').toUpperCase();
  if (txStatus !== 'SUCCESS') {
    if (txStatus === 'FAILED') {
      await supabase.from('marketplace_checkout_sessions').update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', session.id).eq('status', 'awaiting_payment');
      return { status: 'failed' };
    }
    return { status: 'not_paid', detail: txStatus };
  }

  const { data, error } = await supabase.rpc('finalize_marketplace_checkout_session', {
    p_reference: reference,
    p_paid_amount: Number(tx.onlineCheckoutAmount ?? tx.amount),
    p_gateway_fee: Number(hint.fee ?? tx.fee ?? tx.fixedCharge ?? 0) || 0,
    p_transaction_id: String(tx.id ?? ''),
  });
  if (error) throw new Error(`marketplace finalize failed: ${error.message}`);
  const result = data as FinalizeResult;
  if (result.status === 'paid' && !result.already) {
    await notifyNewOrders(supabase, result.order_ids ?? []).catch((e) => console.error('marketplace notify failed', e));
  }
  return result;
}

export async function verifyAndFinalize(
  supabase: SupabaseClient,
  reference: string,
  hint: { fee?: number } = {},
): Promise<FinalizeResult> {
  if (reference.startsWith('QAF-MKT-')) {
    return await verifyAndFinalizeMarketplace(supabase, reference, hint);
  }

  const { data: session } = await supabase
    .from('checkout_sessions')
    .select('id, status, amount, expires_at')
    .eq('reference', reference)
    .maybeSingle();
  if (!session) return { status: 'unknown_reference' };
  if (session.status === 'paid') {
    const r = await supabase.rpc('finalize_checkout_session', { p_reference: reference, p_paid_amount: session.amount, p_gateway_fee: 0, p_transaction_id: '' });
    return r.data as FinalizeResult;
  }
  if (session.status !== 'awaiting_payment' && session.status !== 'expired' && session.status !== 'failed') {
    return { status: session.status as Exclude<FinalizeResult['status'], 'paid'> };
  }

  // deno-lint-ignore no-explicit-any
  let tx: any = null;
  try {
    const res = await nombaFetch(`/v1/transactions/accounts/single?orderReference=${encodeURIComponent(reference)}`);
    tx = res?.data ?? null;
  } catch (e) {
    if (e instanceof NombaError && (e.code === '01' || e.status === 404)) tx = null; // not paid (yet)
    else throw e;
  }

  if (!tx) {
    if (new Date(session.expires_at).getTime() < Date.now() && session.status === 'awaiting_payment') {
      await supabase.from('checkout_sessions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', session.id).eq('status', 'awaiting_payment');
      return { status: 'expired' };
    }
    return { status: 'not_paid' };
  }

  const txRef = tx.onlineCheckoutOrderReference ?? tx.orderReference;
  if (txRef && txRef !== reference) return { status: 'not_paid', detail: 'reference mismatch' };

  const status = String(tx.status ?? '').toUpperCase();
  if (status !== 'SUCCESS') {
    if (status === 'FAILED') {
      await supabase.from('checkout_sessions').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', session.id).eq('status', 'awaiting_payment');
      return { status: 'failed' };
    }
    return { status: 'not_paid', detail: status };
  }

  const paid = Number(tx.onlineCheckoutAmount ?? tx.amount);
  const fee = Number(hint.fee ?? tx.fee ?? tx.fixedCharge ?? 0) || 0;

  const { data, error } = await supabase.rpc('finalize_checkout_session', {
    p_reference: reference,
    p_paid_amount: paid,
    p_gateway_fee: fee,
    p_transaction_id: String(tx.id ?? ''),
  });
  if (error) throw new Error(`finalize failed: ${error.message}`);
  const result = data as FinalizeResult;
  if (result.status === 'paid' && !result.already) {
    await notifySharedCartContribution(supabase, reference).catch((e) => console.error('shared cart contribution email failed', e));
    await notifyNewOrders(supabase, result.order_ids).catch((e) => console.error('notify failed', e));
  }
  return result;
}

async function sendEmail(to: string, subject: string, html: string) {
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    body: JSON.stringify({ to, subject, html }),
  });
}

const naira = (n: number) => 'NGN ' + Math.round(Number(n) || 0).toLocaleString('en-NG');
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function notifySharedCartContribution(supabase: SupabaseClient, reference: string) {
  const { data: contribution } = await supabase.from('shared_cart_contributions')
    .select('id, shared_cart_id, amount, payer_name, status, is_marketplace, notification_sent_at')
    .eq('checkout_reference', reference).eq('status', 'paid').maybeSingle();
  if (!contribution || !contribution.is_marketplace || contribution.notification_sent_at) return;
  const { data: cart } = await supabase.from('shared_carts')
    .select('recipient_name, recipient_email, amount_snapshot').eq('id', contribution.shared_cart_id).maybeSingle();
  if (!cart?.recipient_email) return;
  const { data: contributions } = await supabase.from('shared_cart_contributions')
    .select('amount').eq('shared_cart_id', contribution.shared_cart_id).eq('status', 'paid');
  const raised = (contributions ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const target = Number(cart.amount_snapshot || 0);
  const remaining = Math.max(target - raised, 0);
  const completed = remaining <= 0.01;
  const subject = completed ? 'Your QAFRICA Help Pay cart is fully funded' : 'Someone contributed to your QAFRICA cart';
  const html = '<div style="font-family:system-ui,sans-serif;max-width:540px;margin:auto;padding:24px;color:#111">' +
    '<p style="font-size:20px;font-weight:700;margin:0 0 12px">' + (completed ? 'Your cart is fully funded!' : 'Your cart received a contribution') + '</p>' +
    '<p style="color:#555;margin:0 0 16px">Hi ' + esc(cart.recipient_name) + ', ' + esc(contribution.payer_name) + ' contributed <b>' + naira(Number(contribution.amount)) + '</b> toward your shared cart.</p>' +
    '<div style="background:#F9FAFB;border-radius:12px;padding:16px;margin-bottom:20px">' +
    '<p style="margin:0 0 8px">Raised so far: <b>' + naira(raised) + ' of ' + naira(target) + '</b></p>' +
    '<p style="margin:0;color:#555">' + (completed ? 'The cart is fully funded and the order is being prepared.' : 'Remaining balance: ' + naira(remaining)) + '</p></div>' +
    '<a href="' + SITE + '/customer/links" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">View my payment links</a>' +
    '<p style="font-size:12px;color:#777;margin-top:20px">QAFRICA will only place the order once the full amount has been raised.</p></div>';
  await sendEmail(cart.recipient_email, subject, html);
  await supabase.from('shared_cart_contributions').update({ notification_sent_at: new Date().toISOString() })
    .eq('id', contribution.id).is('notification_sent_at', null);
}

async function notifyNewOrders(supabase: SupabaseClient, orderIds: string[]) {
  if (!orderIds?.length) return;
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total, customer_name, customer_email, delivery_address, store_id, stores(name, owner_id), order_items(product_name, quantity, total_price)')
    .in('id', orderIds);
  if (!orders?.length) return;

  for (const o of orders) {
    // deno-lint-ignore no-explicit-any
    const store = (o as any).stores;
    if (!store?.owner_id) continue;
    // deno-lint-ignore no-explicit-any
    const items = ((o as any).order_items ?? []).map((i: any) => `${esc(i.product_name)} x ${i.quantity}`).join('<br>');
    await supabase.from('notifications').insert({
      user_id: store.owner_id,
      type: 'order_placed',
      title: 'New paid order',
      message: `Order #${o.order_number} - ${naira(o.total)} from ${o.customer_name}. Payment is held until delivery.`,
      data: { order_id: o.id, order_number: o.order_number, total: o.total },
    });
    const { data: owner } = await supabase.from('profiles').select('email, full_name').eq('id', store.owner_id).maybeSingle();
    if (owner?.email) {
      await sendEmail(owner.email, `New paid order #${o.order_number} - ${naira(o.total)}`,
        `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111">
          <p style="font-size:18px;font-weight:700;margin:0 0 8px">You have a new paid order</p>
          <p style="margin:0 0 16px;color:#555">${esc(store.name)} - #${o.order_number} - <b>${naira(o.total)}</b></p>
          <p style="margin:0 0 16px">${items}</p>
          <p style="margin:0 0 16px;color:#555">The payment is held safely and released to you after the customer receives the order. Please deliver it and update the order status.</p>
          <a href="${SITE}/dashboard/orders/${o.id}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">View order</a>
        </div>`).catch(() => {});
    }
  }

  const first = orders[0];
  if (first?.customer_email) {
    const lines = orders.map((o) => `#${o.order_number} - ${naira(o.total)}`).join('<br>');
    await sendEmail(first.customer_email, 'Your QAFRICA order is confirmed',
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111">
        <p style="font-size:18px;font-weight:700;margin:0 0 8px">Thanks, ${esc(first.customer_name)}. Your payment was received.</p>
        <p style="margin:0 0 16px">${lines}</p>
        <p style="margin:0 0 16px;color:#555">Your money is held safely by QAFRICA and only released to the seller after you receive your order.</p>
        <a href="${SITE}/track?email=${encodeURIComponent(first.customer_email)}&order=${encodeURIComponent(first.order_number)}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Track your order</a>
      </div>`).catch(() => {});
  }
}
