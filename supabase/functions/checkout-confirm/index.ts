// Called by the "confirming your payment" page after Nomba redirects back.
// Body: { reference }. Re-checks with Nomba (never trusts the browser), then returns public status.
// Deploy with verify_jwt = false (guests and pay-for-me payers use it).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyAndFinalize } from '../_shared/checkout.ts';

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
  let reference = '';
  try {
    reference = String((await req.json())?.reference ?? '').slice(0, 60);
  } catch { /* fallthrough */ }
  if (!/^QAF-[A-Z0-9-]+$/.test(reference)) return json(400, { error: 'Invalid reference' });

  try {
    await verifyAndFinalize(supabase, reference);
  } catch (e) {
    console.error('confirm failed', e);
    // Fall through: return current status; the webhook / sweep will finish the job
  }
  // QAF-MKT references are finalized through marketplace checkout so
  // China Import Help Pay can return the same public payment-status contract.
  if (reference.startsWith('QAF-MKT-')) {
    const { data: marketplaceSession, error: marketplaceError } = await supabase
      .from('marketplace_checkout_sessions')
      .select('status,amount,paid_amount,order_ids')
      .eq('reference', reference)
      .maybeSingle();
    if (marketplaceError) {
      console.error('marketplace confirm status lookup failed', marketplaceError.message);
      return json(500, { error: 'Could not load your payment status' });
    }
    if (!marketplaceSession) return json(404, { error: 'Not found' });

    const { data: contribution } = await supabase.from('shared_cart_contributions')
      .select('shared_cart_id,amount,status')
      .eq('checkout_reference', reference)
      .maybeSingle();
    let contributionView: { amount: number; amount_raised: number; target_amount: number; complete: boolean } | undefined;
    if (contribution) {
      const { data: cart } = await supabase.from('shared_carts')
        .select('amount_snapshot,status')
        .eq('id', contribution.shared_cart_id)
        .maybeSingle();
      const { data: rows } = await supabase.from('shared_cart_contributions')
        .select('amount')
        .eq('shared_cart_id', contribution.shared_cart_id)
        .eq('status', 'paid');
      const amountRaised = (rows ?? []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      const targetAmount = Number(cart?.amount_snapshot || 0);
      contributionView = {
        amount: Number(contribution.amount),
        amount_raised: amountRaised,
        target_amount: targetAmount,
        complete: cart?.status === 'paid' || amountRaised + 0.01 >= targetAmount,
      };
    }
    const orderIds = Array.isArray(marketplaceSession.order_ids) ? marketplaceSession.order_ids : [];
    const { data: orderRows } = orderIds.length
      ? await supabase.from('orders').select('order_number,total').in('id', orderIds)
      : { data: [], error: null };
    return json(200, {
      status: marketplaceSession.status,
      amount: Number(contribution?.amount ?? marketplaceSession.amount ?? 0),
      return_slug: null,
      orders: (orderRows ?? []).map((order: any) => ({ order_number: order.order_number, total: Number(order.total || 0) })),
      ...(contributionView ? { contribution: contributionView } : {}),
    });
  }

  const { data } = await supabase.rpc('checkout_session_status', { p_reference: reference });
  if (!data) return json(404, { error: 'Not found' });
  const { data: session } = await supabase.from('checkout_sessions').select('shared_cart_id').eq('reference', reference).maybeSingle();
  if (session?.shared_cart_id && data.status === 'paid') {
    const { data: contribution } = await supabase.from('shared_cart_contributions')
      .select('amount, is_marketplace').eq('checkout_reference', reference).eq('status', 'paid').maybeSingle();
    if (contribution?.is_marketplace) {
      const { data: cart } = await supabase.from('shared_carts').select('amount_snapshot').eq('id', session.shared_cart_id).maybeSingle();
      const { data: rows } = await supabase.from('shared_cart_contributions').select('amount')
        .eq('shared_cart_id', session.shared_cart_id).eq('status', 'paid');
      const amountRaised = (rows ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const targetAmount = Number(cart?.amount_snapshot || 0);
      return json(200, { ...data, contribution: { amount: Number(contribution.amount), amount_raised: amountRaised, target_amount: targetAmount, complete: amountRaised + 0.01 >= targetAmount } });
    }
  }
  return json(200, data);
});
