// refunds — order cancellation + refund workflow for the import section.
// Supports both full-order cancellation and single-item cancellation
// (spec Section 5) via one shared refund pipeline: admin cancels with a
// reason -> customer submits bank details -> admin pays and marks it paid.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// paystack refund function
async function processPaystackRefund(
  paymentReference: string,
  refundAmountNgn: number
) {
  const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }

  if (!paymentReference) {
    throw new Error('Original Paystack payment reference is missing');
  }

  if (!Number.isFinite(refundAmountNgn) || refundAmountNgn <= 0) {
    throw new Error('Invalid refund amount');
  }

  // Paystack expects the amount in kobo.
  const amountKobo = Math.round(refundAmountNgn * 100);

  const response = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction: paymentReference,
      amount: amountKobo,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.status) {
    throw new Error(
      result?.message || 'Paystack refund request failed'
    );
  }

  return result;
}

async function calculateRefundDecision(
  supabase: any,
  order: any,
  reason: string
) {
  const total = round2(Number(order.total_ngn ?? 0));
  const normalizedReason = reason.trim().toLowerCase();

  /*
   * QAFRICA REFUND POLICY — SECTION 7
   *
   * 7.1 Before item is billed:
   *     Genuine cancellation → 100% refund
   *
   * 7.2 After item is billed:
   *     Customer's own reason/change of mind → 80% refund
   *     20% cancellation fee
   *
   * 7.3 Defective/damaged/incorrect:
   *     100% refund regardless of billing stage
   *
   * 7.4 Damage/malfunction caused by misuse:
   *     No refund
   */

  /*
   * Product-related problems qualify for a full refund
   * regardless of billing stage.
   */
  const isProductIssue =
    normalizedReason.includes('defective') ||
    normalizedReason.includes('faulty') ||
    normalizedReason.includes('damaged') ||
    normalizedReason.includes('incorrect') ||
    normalizedReason.includes('wrong item') ||
    normalizedReason.includes('materially different');

  /*
   * The consolidation bill is the source of truth for billing.
   *
   * A cancelled bill does NOT count as an active bill.
   */
  const { data: bill, error: billError } = await supabase
    .from('china_import_consolidation_bills')
    .select('id, amount_ngn, status, kind')
    .eq('order_id', order.id)
    .eq('kind', 'consolidation_shipping')
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle();

  if (billError) {
    throw new Error(
      `Unable to determine billing status: ${billError.message}`
    );
  }

  const isBilled = Boolean(bill);

  /*
   * SECTION 7.3
   * Defective / damaged / incorrect item:
   * full refund regardless of billing stage.
   */
  if (isProductIssue) {
    return {
      refundAmount: total,
      cancellationFee: 0,
      policy: '7.3',
      isBilled,
      billId: bill?.id ?? null,
    };
  }

  /*
   * SECTION 7.1
   * No active consolidation/shipping bill:
   * full refund.
   */
  if (!isBilled) {
    return {
      refundAmount: total,
      cancellationFee: 0,
      policy: '7.1',
      isBilled: false,
      billId: null,
    };
  }

  /*
   * SECTION 7.2
   * Active bill exists:
   * 20% cancellation fee and 80% refund.
   */
  const cancellationFee = round2(total * 0.20);
  const refundAmount = round2(total - cancellationFee);

  return {
    refundAmount,
    cancellationFee,
    policy: '7.2',
    isBilled: true,
    billId: bill.id,
  };
}

function emailShell(bodyHtml: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
        <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
      </div>
      ${bodyHtml}
    </div>
  `
}

async function requireAdmin(supabase: any, token: unknown): Promise<boolean> {
  if (!token || typeof token !== 'string') return false
  const { data, error } = await supabase
    .from('import_admin_sessions')
    .select('token')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !data) return false
  supabase.from('import_admin_sessions').update({ last_used_at: new Date().toISOString() }).eq('token', token).then(() => {})
  return true
}

async function reverseUnitsSold(supabase: any, items: any[]) {
  for (const item of items) {
    const qty = Number(item?.quantity)
    if (!item?.id || !Number.isFinite(qty) || qty <= 0) continue
    try {
      await supabase.rpc('increment_units_sold', { p_product_id: item.id, p_qty: -qty })
    } catch (e) {
      console.warn('[refunds] units_sold reversal failed:', e)
    }
  }
}

// Shared full-order cancellation: creates the refund record, deletes the
// order, reverses units_sold, and notifies the customer. Used directly by
// admin-cancel-order, and reused by admin-cancel-item when cancelling the
// last remaining item in an order (which is equivalent to cancelling the
// whole order).
async function cancelFullOrder(supabase: any, order: any, reason: string, cancellationType: 'full_order' | 'item' = 'full_order') {
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return { error: 'This order has already been cancelled.', status: 409 };
  }

  const { data: existingRefund, error: existingRefundError } = await supabase
    .from('china_import_refunds')
    .select('id, status')
    .eq('original_order_id', order.id)
    .in('status', ['pending', 'submitted'])
    .limit(1)
    .maybeSingle();

  if (existingRefundError) {
    return { error: `Unable to check existing refund: ${existingRefundError.message}`, status: 500 };
  }

  if (existingRefund) {
    return { error: 'A refund for this order is already in progress.', status: 409 };
  }

  const refundDecision = await calculateRefundDecision(
    supabase,
    order,
    reason
  );

  const { data: refund, error: insertErr } = await supabase
    .from('china_import_refunds')
    .insert({
      original_order_id: order.id,
      code: order.code,
      customer_name: order.customer_name,
      user_id: order.user_id,
      items: order.items,

      // Original order amount
      total_ngn: order.total_ngn,

      // Actual amount customer should receive
      refund_amount_ngn: refundDecision.refundAmount,

      // 20% fee where applicable
      cancellation_fee_ngn: refundDecision.cancellationFee,

      // Policy decision
      refund_policy: refundDecision.policy,

      // bill reference
      billing_bill_id: refundDecision.billId,

      // Original payment information
      payment_method: order.payment_method,
      payment_reference: order.payment_reference,

      // We will use Paystack for Paystack payments
      refund_method:
        order.payment_method === 'paystack'
          ? 'paystack'
          : 'bank',

      cancel_reason: reason,
      cancellation_type: cancellationType,
    })
    .select()
    .single();

  if (insertErr) {
    return { error: insertErr.message };
  }

  if (order.payment_status === 'paid' && Array.isArray(order.items)) {
    await reverseUnitsSold(supabase, order.items)
  }

  // Keep the cancelled order for audit/history. A DB trigger changes it to
  // `refunded` only when the full refund reaches `paid`.
  const { error: orderCancelError } = await supabase
    .from('china_import_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', order.id);

  if (orderCancelError) {
    await supabase.from('china_import_refunds').delete().eq('id', refund.id);
    return { error: `Unable to cancel order: ${orderCancelError.message}`, status: 500 };
  }

  const { error: billCancelError } = await supabase
    .from('china_import_consolidation_bills')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', order.id)
    .neq('status', 'cancelled');

  if (billCancelError) {
    return { error: `Order was cancelled, but its outstanding bill could not be closed: ${billCancelError.message}`, status: 500 };
  }

  const { error: batchReconcileError } = await supabase
    .rpc('reconcile_import_batch_after_order_cancel', { p_order_id: order.id });

  if (batchReconcileError) {
    return { error: `Order was cancelled, but batch billing could not be reconciled: ${batchReconcileError.message}`, status: 500 };
  }

  const refundAmount = Number(refundDecision.refundAmount);
  const cancellationFee = Number(refundDecision.cancellationFee);

  const refundExplanation =
    cancellationFee > 0
      ? `
        Your approved refund is
        <strong>₦${refundAmount.toLocaleString()}</strong>.
        A 20% cancellation fee of
        <strong>₦${cancellationFee.toLocaleString()}</strong>
        has been deducted in accordance with our cancellation policy.
      `
      : `
        You are eligible for a full refund of
        <strong>₦${refundAmount.toLocaleString()}</strong>.
      `;

  if (order.user_id) {
    const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
    if (customer?.email) {
      const html = emailShell(`
        <h2 style="color:#111827;margin:0 0 8px;">One of your orders was cancelled</h2>
        <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
          Hi ${customer.full_name ?? order.customer_name ?? 'there'}, your order <strong>${order.code}</strong>
          has been cancelled by our team.
        </p>
        <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;">
          <p style="margin:0 0 4px;font-size:13px;color:#991B1B;font-weight:600;">Reason</p>
          <p style="margin:0;font-size:14px;color:#7F1D1D;">${reason}</p>
        </div>
        <p style="color:#374151;font-size:14px;margin-bottom:16px;line-height:1.6;">
          <p style="color:#374151;font-size:14px;margin-bottom:16px;line-height:1.6;">
            ${refundExplanation}
          </p>
          ${
            order.payment_method === 'paystack'
              ? `Your refund will be returned through the original Paystack payment method.`
              : `Please head to the Refund section of your dashboard and submit your bank details — refunds are typically processed within 2–4 hours once submitted.`
          }
        </p>
        <p style="color:#6B7280;font-size:13px;">You're welcome to place a new order anytime.</p>
      `)
      await supabase.functions.invoke('send-email', {
        body: { to: customer.email, subject: `Your QAFRICA order ${order.code} was cancelled`, html },
      }).catch(() => {})
    }
  }

  return { refund }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    if (req.method === 'POST' && action === 'admin-cancel-order') {
      const { manager_token, order_id, reason } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!order_id || !reason || !reason.trim()) return json({ error: 'Missing order_id or reason' }, 400)

      const { data: order, error: findErr } = await supabase.from('china_import_orders').select('*').eq('id', order_id).single()
      if (findErr || !order) return json({ error: 'Order not found' }, 404)

      const result = await cancelFullOrder(supabase, order, reason.trim(), 'full_order')
      if (result.error) return json({ error: result.error }, 500)
      return json({ success: true, refund: result.refund })
    }

    // Cancel a single item within an order (spec Section 5). The rest of
    // the order stays intact and continues its normal pipeline; only the
    // cancelled item's value is refunded. If it was the only item, this
    // is equivalent to a full-order cancellation and reuses that exact path.
    if (req.method === 'POST' && action === 'admin-cancel-item') {
      const { manager_token, order_id, item_index, reason } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!order_id || typeof item_index !== 'number' || !reason || !reason.trim()) {
        return json({ error: 'Missing order_id, item_index, or reason' }, 400)
      }

      const { data: order, error: findErr } = await supabase.from('china_import_orders').select('*').eq('id', order_id).single()
      if (findErr || !order) return json({ error: 'Order not found' }, 404)

      const items = Array.isArray(order.items) ? order.items : []
      if (item_index < 0 || item_index >= items.length) return json({ error: 'That item no longer exists on this order — it may have already been cancelled or changed. Please refresh and try again.' }, 400)

      const cancelledItem = items[item_index]
      const remainingItems = items.filter((_: any, i: number) => i !== item_index)

      // Cancelling the last remaining item is the same thing as cancelling
      // the whole order — reuse that exact pipeline rather than a second one.
      if (remainingItems.length === 0) {
        const result = await cancelFullOrder(supabase, order, reason.trim(), 'item')
        if (result.error) return json({ error: result.error }, 500)
        return json({ success: true, refund: result.refund, order_fully_cancelled: true })
      }

      const itemLineTotal = Number(cancelledItem.price_ngn ?? 0) * Number(cancelledItem.quantity ?? 0)
      const itemJumiaFee = order.delivery_type === 'to_qafrica' ? 200 * Number(cancelledItem.quantity ?? 0) : 0
      const itemRefundTotal = round2(itemLineTotal + itemJumiaFee)

      const { data: refund, error: insertErr } = await supabase
        .from('china_import_refunds')
        .insert({
          original_order_id: order.id,
          code: order.code,
          customer_name: order.customer_name,
          user_id: order.user_id,
          items: [cancelledItem],
          total_ngn: itemRefundTotal,
          cancel_reason: reason.trim(),
          cancellation_type: 'item',
        })
        .select().single()
      if (insertErr) return json({ error: insertErr.message }, 500)

      if (order.payment_status === 'paid') {
        await reverseUnitsSold(supabase, [cancelledItem])
      }

      const newSubtotal = remainingItems.reduce((s: number, i: any) => s + Number(i.price_ngn ?? 0) * Number(i.quantity ?? 0), 0)
      const newJumiaFee = order.delivery_type === 'to_qafrica' ? remainingItems.reduce((s: number, i: any) => s + 200 * Number(i.quantity ?? 0), 0) : 0
      const newTotal = round2(newSubtotal + newJumiaFee)

      const { error: updateErr } = await supabase
        .from('china_import_orders')
        .update({
          items: remainingItems,
          subtotal_ngn: round2(newSubtotal),
          jumia_fee_ngn: round2(newJumiaFee),
          total_ngn: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id)
      if (updateErr) return json({ error: updateErr.message }, 500)

      const { error: itemBatchReconcileError } = await supabase
        .rpc('reconcile_import_batch_after_order_cancel', { p_order_id: order.id });
      if (itemBatchReconcileError) {
        return json({ error: `Item was cancelled, but batch billing could not be reconciled: ${itemBatchReconcileError.message}` }, 500);
      }

      if (order.user_id) {
        const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
        if (customer?.email) {
          const html = emailShell(`
            <h2 style="color:#111827;margin:0 0 8px;">One item from your order was cancelled</h2>
            <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
              Hi ${customer.full_name ?? order.customer_name ?? 'there'}, <strong>${cancelledItem.name}</strong>
              (× ${cancelledItem.quantity}) has been cancelled from your order <strong>${order.code}</strong>.
              The rest of your order remains unaffected and continues as normal.
            </p>
            <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:13px;color:#991B1B;font-weight:600;">Reason</p>
              <p style="margin:0;font-size:14px;color:#7F1D1D;">${reason.trim()}</p>
            </div>
            <p style="color:#374151;font-size:14px;margin-bottom:16px;line-height:1.6;">
              Since this item was paid for, you're due a refund of <strong>₦${itemRefundTotal.toLocaleString()}</strong>.
              Please head to the Refund section of your dashboard and submit your bank details —
              refunds are typically processed within 2–4 hours once submitted.
            </p>
          `)
          await supabase.functions.invoke('send-email', {
            body: { to: customer.email, subject: `An item in your QAFRICA order ${order.code} was cancelled`, html },
          }).catch(() => {})
        }
      }

      return json({ success: true, refund })
    }

    if (req.method === 'POST' && action === 'submit-bank-details') {
      const { customer_id, refund_id, bank_account_number, bank_account_name, bank_name } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)
      if (!refund_id || !bank_account_number || !bank_account_name || !bank_name) {
        return json({ error: 'Missing required fields' }, 400)
      }

      const { data: refund, error: findErr } = await supabase
        .from('china_import_refunds').select('id, user_id, status').eq('id', refund_id).single()
      if (findErr || !refund) return json({ error: 'Refund not found' }, 404)
      if (refund.user_id !== customer_id) return json({ error: 'Unauthorized' }, 403)
      if (refund.status !== 'pending') return json({ refund }, 200)

      const { data, error } = await supabase
        .from('china_import_refunds')
        .update({
          bank_account_number, bank_account_name, bank_name,
          status: 'submitted',
          bank_details_submitted_at: new Date().toISOString(),
        })
        .eq('id', refund_id).select().single()
      if (error) return json({ error: error.message }, 500)
      return json({ refund: data })
    }

    if (req.method === 'POST' && action === 'my-refunds') {
      const { customer_id } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)

      const { data, error } = await supabase
        .from('china_import_refunds')
        .select('*')
        .eq('user_id', customer_id)
        .order('cancelled_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      return json({ refunds: data ?? [] })
    }

    if (req.method === 'POST' && action === 'admin-list-refunds') {
      const { manager_token, status } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      let query = supabase.from('china_import_refunds').select('*').order('cancelled_at', { ascending: false })
      if (status) query = query.eq('status', status)

      const { data, error } = await query.limit(500)
      if (error) return json({ error: error.message }, 500)
      return json({ refunds: data ?? [] })
    }

    if (req.method === 'POST' && action === 'admin-refund-paystack') {
      const { manager_token, refund_id } = await req.json();

      if (!(await requireAdmin(supabase, manager_token))) {
        return json({ error: 'Unauthorized' }, 401);
      }

      if (!refund_id) {
        return json({ error: 'Missing refund_id' }, 400);
      }

      /*
      * Load the refund and lock the operation logically by checking
      * its current Paystack state before submitting anything.
      */
      const { data: refund, error: findErr } = await supabase
        .from('china_import_refunds')
        .select('*')
        .eq('id', refund_id)
        .single();

      if (findErr || !refund) {
        return json({ error: 'Refund not found' }, 404);
      }

      /*
      * Only Paystack refunds should come through this action.
      */
      if (refund.payment_method !== 'paystack') {
        return json({
          error: 'This refund was not originally paid through Paystack',
        }, 400);
      }

      if (!refund.payment_reference) {
        return json({
          error: 'Original Paystack payment reference is missing',
        }, 400);
      }

      /*
      * Prevent duplicate refunds.
      */
      if (
        refund.paystack_refund_id ||
        refund.paystack_refund_status === 'processed' ||
        refund.paystack_refund_status === 'processing'
      ) {
        return json({
          error: 'A Paystack refund has already been submitted for this refund',
          refund,
        }, 409);
      }

      if (refund.status === 'paid') {
        return json({
          error: 'This refund has already been completed',
          refund,
        }, 409);
      }

      const refundAmount = Number(refund.refund_amount_ngn ?? 0);

      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        return json({
          error: 'Refund amount is invalid',
        }, 400);
      }

      /*
      * Record that processing has started before calling Paystack.
      * This gives us a server-side state to inspect if the request
      * takes longer than expected.
      */
      const { error: processingErr } = await supabase
        .from('china_import_refunds')
        .update({
          paystack_refund_status: 'processing',
          refund_error: null,
        })
        .eq('id', refund_id)
        .is('paystack_refund_id', null);

      if (processingErr) {
        return json({
          error: `Unable to start refund: ${processingErr.message}`,
        }, 500);
      }

      try {
        const paystackResult = await processPaystackRefund(
          refund.payment_reference,
          refundAmount
        );

        const paystackRefund = paystackResult?.data;

        /*
        * Paystack should return a refund object.
        * Keep the returned reference/status for audit purposes.
        */
        const paystackRefundId =
          paystackRefund?.id != null
            ? String(paystackRefund.id)
            : null;

        const paystackStatus =
          paystackRefund?.status
            ? String(paystackRefund.status).toLowerCase()
            : 'processing';

        const successful =
          paystackStatus === 'processed' ||
          paystackStatus === 'completed' ||
          paystackStatus === 'refunded';

        const updatePayload: Record<string, unknown> = {
          paystack_refund_id: paystackRefundId,
          paystack_refund_status: paystackStatus,
          refund_error: null,
        };

        /*
        * Do not mark the internal refund as paid unless Paystack
        * reports a completed/processed refund.
        */
        if (successful) {
          updatePayload.status = 'paid';
          updatePayload.paid_at = new Date().toISOString();
          updatePayload.paystack_refunded_at = new Date().toISOString();
        }

        const { data: updatedRefund, error: updateErr } = await supabase
          .from('china_import_refunds')
          .update(updatePayload)
          .eq('id', refund_id)
          .select()
          .single();

        if (updateErr) {
          return json({
            error: `Paystack refund succeeded but saving refund status failed: ${updateErr.message}`,
            paystack_refund_id: paystackRefundId,
          }, 500);
        }

        /*
        * Notify the customer only after the refund has actually
        * been reported as processed.
        */
        if (successful && updatedRefund.user_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('email, full_name')
            .eq('id', updatedRefund.user_id)
            .single();

          if (customer?.email) {
            const html = emailShell(`
              <h2 style="color:#111827;margin:0 0 8px;">
                Your refund has been processed ✅
              </h2>

              <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
                Hi ${customer.full_name ?? updatedRefund.customer_name ?? 'there'},
                your refund of
                <strong>₦${Number(
                  updatedRefund.refund_amount_ngn ?? 0
                ).toLocaleString()}</strong>
                for order
                <strong>${updatedRefund.code}</strong>
                has been processed through Paystack.
              </p>

              <p style="color:#6B7280;font-size:13px;">
                The refund is being returned through your original payment method.
              </p>
            `);

            await supabase.functions.invoke('send-email', {
              body: {
                to: customer.email,
                subject: `Your QAFRICA refund for ${updatedRefund.code} has been processed`,
                html,
              },
            }).catch(() => {});
          }
        }

        return json({
          success: true,
          refund: updatedRefund,
          paystack: paystackResult,
        });

      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Paystack refund failed';

        await supabase
          .from('china_import_refunds')
          .update({
            paystack_refund_status: 'failed',
            refund_error: message,
          })
          .eq('id', refund_id);

        return json({
          error: message,
        }, 502);
      }
    }

    if (req.method === 'POST' && action === 'admin-mark-paid') {
      const { manager_token, refund_id } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!refund_id) return json({ error: 'Missing refund_id' }, 400)

      const { data: existingRefund, error: existingErr } = await supabase
        .from('china_import_refunds')
        .select('id, status, payment_method')
        .eq('id', refund_id)
        .single()
      if (existingErr || !existingRefund) return json({ error: 'Refund not found' }, 404)
      if (existingRefund.payment_method !== 'manual') return json({ error: 'Only manual bank refunds can be marked paid with this action' }, 400)
      if (existingRefund.status !== 'submitted') return json({ error: 'Refund is not ready to be marked paid' }, 409)

      const { data, error } = await supabase
        .from('china_import_refunds')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', refund_id).select().single()
      if (error) return json({ error: error.message }, 500)

      if (data.user_id) {
        const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', data.user_id).single()
        if (customer?.email) {
          const html = emailShell(`
            <h2 style="color:#111827;margin:0 0 8px;">Your refund has been paid ✅</h2>
            <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
              Hi ${customer.full_name ?? data.customer_name ?? 'there'}, your refund of
              <strong>₦${Number(data.refund_amount_ngn ?? 0).toLocaleString()}</strong> for order
              <strong>${data.code}</strong> has been sent to your bank account.
            </p>
            <p style="color:#6B7280;font-size:13px;">You're welcome to place a new order anytime.</p>
          `)
          await supabase.functions.invoke('send-email', {
            body: { to: customer.email, subject: `Your QAFRICA refund for ${data.code} has been paid`, html },
          }).catch(() => {})
        }
      }

      return json({ refund: data })
    }

    return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[refunds]', message)
    return json({ error: message }, 500)
  }
})
