// import-batch-view
//
// Closed-batch admin data and billing actions. Split out of china-import
// deliberately: that file is ~1,700 lines and every unrelated change forces a
// full redeploy of the entire order/payment surface.
//
// Auth uses the same import_admin_sessions token as china-import, so there is
// one admin session concept rather than two.
//
// v5: auto-billing. set-customer-price now checks, after every save,
// whether that customer's order in this batch is now fully priced (every
// line item has a price, via get_batch_billing_eligible_customers) and if
// so bills them immediately via close_batch_billing(p_customer_id=...) and
// sends the itemized bill email right away -- no separate "close batch"
// step needed for that customer. The bulk close-billing action uses the
// same eligibility function, so the two can never disagree about who's
// billable. Bill emails now include a per-item price breakdown grouped by
// shipping method (air/sea), not just a total.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DASHBOARD_BILLS_URL = 'https://qafrica.store/importations/dashboard'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function requireAdmin(supabase: any, token: unknown): Promise<boolean> {
  if (!token || typeof token !== 'string') return false
  const { data, error } = await supabase
    .from('import_admin_sessions')
    .select('token')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return !error && !!data
}

function emailShell(bodyHtml: string) {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
      <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
    </div>${bodyHtml}</div>`
}

function renderTemplate(template: string, tokens: Record<string, string>): string {
  let out = template
  for (const [k, v] of Object.entries(tokens)) out = out.split(`{{${k}}}`).join(v)
  return out.replace(/\{\{[a-z_]+\}\}/g, '')
}

// Line items from close_batch_billing carry shipping_method when they're
// a real order item (even if null, for legacy pre-per-item-shipping
// orders); adjustment lines (discounts, manual charges) never carry that
// key at all -- that's how we tell the two apart here.
function buildItemsBreakdownHtml(lineItems: any[]): string {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return ''
  const priced = lineItems.filter((l: any) => l && typeof l.amount_ngn === 'number' && l.label)
  const items = priced.filter((l: any) => 'shipping_method' in l)
  const adjustments = priced.filter((l: any) => !('shipping_method' in l))
  if (items.length === 0 && adjustments.length === 0) return ''

  const flight = items.filter((i: any) => i.shipping_method === 'flight')
  const sea = items.filter((i: any) => i.shipping_method === 'sea_freight')
  const other = items.filter((i: any) => i.shipping_method !== 'flight' && i.shipping_method !== 'sea_freight')

  const section = (title: string, rows: any[]) => rows.length === 0 ? '' : `
    <p style="margin:12px 0 4px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">${title}</p>
    <table style="width:100%;border-collapse:collapse;">
      ${rows.map((r: any) => `<tr><td style="padding:4px 0;color:#374151;font-size:13px;">${r.label}</td><td style="padding:4px 0;color:#111827;font-size:13px;text-align:right;">₦${Number(r.amount_ngn).toLocaleString()}</td></tr>`).join('')}
    </table>`

  return `<div style="margin-bottom:16px;">${section('Arriving by air · 20–30 days', flight)}${section('Arriving by sea · 60–90 days', sea)}${section('Items', other)}${section('Adjustments', adjustments)}</div>`
}

async function queueTemplated(supabase: any, key: string, to: string, tokens: Record<string, string>): Promise<boolean> {
  const { data: tpl } = await supabase.from('import_message_templates').select('subject, body_html').eq('key', key).maybeSingle()
  if (!tpl) return false
  const { error } = await supabase.from('import_notification_queue').insert({
    to_email: to,
    subject: renderTemplate(tpl.subject, tokens),
    html: emailShell(renderTemplate(tpl.body_html, tokens)),
  })
  return !error
}

// Bills one customer via close_batch_billing (p_customer_id set) and, if it
// actually billed them (they were fully priced and not already billed),
// queues the itemized bill email. Used both after a single per-customer
// price save and, in bulk, after a batch-wide default price save.
async function autoBillAndNotify(
  supabase: any, batchKey: string, kind: 'consolidation_shipping' | 'clearance', customerId: string | null,
): Promise<{ billedCount: number }> {
  const orderStatusTarget = kind === 'clearance' ? 'clearance_and_closed' : 'ordered_and_closed'
  const timestampColumn = kind === 'clearance' ? 'clearance_closed_at' : 'ordered_closed_at'

  const { data: result, error } = await supabase.rpc('close_batch_billing', {
    p_batch_key: batchKey, p_kind: kind,
    p_order_status_target: orderStatusTarget, p_batch_timestamp_column: timestampColumn,
    p_customer_id: customerId,
  })
  if (error || result?.error) return { billedCount: 0 } // not eligible yet -- not an error condition here

  const templateKey = kind === 'clearance' ? 'clearance_bill' : 'consolidation_shipping_bill'
  for (const recip of (result?.recipients ?? [])) {
    await queueTemplated(supabase, templateKey, recip.email, {
      customer_name: recip.name ?? 'there',
      amount_due: Number(recip.amount_ngn ?? 0).toLocaleString(),
      pay_link: DASHBOARD_BILLS_URL,
      items_breakdown: buildItemsBreakdownHtml(recip.line_items ?? []),
    })
  }
  return { billedCount: result?.customers_billed ?? 0 }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const action = new URL(req.url).searchParams.get('action')

  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* optional */ }

  if (!(await requireAdmin(supabase, body.manager_token))) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const batchKey = body.batch_key
  const kind: 'consolidation_shipping' | 'clearance' =
    body.kind === 'clearance' ? 'clearance' : 'consolidation_shipping'

  // One row per (customer, product) line, already carrying price paid, the
  // 1688 link, and both "others ordered this" counts.
  if (action === 'customer-breakdown') {
    if (!batchKey || typeof batchKey !== 'string') return json({ error: 'Missing batch_key' }, 400)

    const [linesRes, adjRes, ledgerRes, overridesRes, statusRes] = await Promise.all([
      supabase.rpc('get_batch_customer_breakdown', { p_batch_key: batchKey }),
      supabase.from('import_batch_customer_adjustments')
        .select('*').eq('batch_key', batchKey).order('created_at'),
      supabase.rpc('get_batch_bill_ledger', { p_batch_key: batchKey, p_kind: kind }),
      supabase.from('import_batch_customer_item_prices')
        .select('*').eq('batch_key', batchKey).eq('kind', kind),
      // Per-customer status for this kind: sent/draft + the internal note.
      supabase.from('import_batch_bill_status')
        .select('customer_id, status, sent_at, admin_note').eq('batch_key', batchKey).eq('kind', kind),
    ])

    if (linesRes.error) {
      console.error('[import-batch-view] breakdown failed:', linesRes.error.message)
      return json({ error: linesRes.error.message }, 500)
    }
    return json({
      rows: linesRes.data ?? [],
      adjustments: adjRes.data ?? [],
      ledger: ledgerRes.data ?? [],
      price_overrides: overridesRes.data ?? [],
      customer_status: statusRes.data ?? [],
    })
  }

  // Per-customer price override, sitting on top of the batch default in
  // import_batch_item_bills. Deleting a row here just reverts that one
  // customer back to the batch default -- it does not touch anyone else.
  if (action === 'set-customer-price') {
    const { customer_id, product_id, product_name, unit_amount_ngn } = body
    if (!batchKey || !customer_id || !product_id || typeof unit_amount_ngn !== 'number') {
      return json({ error: 'Missing batch_key, customer_id, product_id, or unit_amount_ngn' }, 400)
    }
    const { error } = await supabase
      .from('import_batch_customer_item_prices')
      .upsert(
        { batch_key: batchKey, customer_id, product_id, kind, unit_amount_ngn, updated_at: new Date().toISOString() },
        { onConflict: 'batch_key,customer_id,product_id,kind' },
      )
    // The database trigger refuses writes once this customer's bill has been sent.
    if (error) return json({ error: error.message }, /locked/i.test(error.message) ? 409 : 500)

    // Only this one customer could have just become fully priced -- check
    // and bill them immediately if so. Never blocks the save response on
    // failure; a failed auto-bill here just means they stay pending for
    // the next price save or the bulk button to pick up.
    const { billedCount } = await autoBillAndNotify(supabase, batchKey, kind, customer_id)
    return json({ success: true, auto_billed: billedCount > 0 })
  }

  if (action === 'delete-customer-price') {
    const { customer_id, product_id } = body
    if (!batchKey || !customer_id || !product_id) return json({ error: 'Missing batch_key, customer_id, or product_id' }, 400)
    const { error } = await supabase
      .from('import_batch_customer_item_prices')
      .delete()
      .eq('batch_key', batchKey).eq('customer_id', customer_id).eq('product_id', product_id).eq('kind', kind)
    if (error) return json({ error: error.message }, /locked/i.test(error.message) ? 409 : 500)
    return json({ success: true })
  }

  // Internal-only note against a customer's bill for this batch & kind.
  // Never sent to the customer. Settable before billing (creates a draft
  // row) or after (just updates the note -- never touches status, so it
  // can't accidentally unlock or relock a sent bill).
  if (action === 'set-admin-note') {
    const { customer_id, admin_note } = body
    if (!batchKey || !customer_id) return json({ error: 'Missing batch_key or customer_id' }, 400)

    const { data: existing } = await supabase
      .from('import_batch_bill_status')
      .select('status')
      .eq('batch_key', batchKey).eq('kind', kind).eq('customer_id', customer_id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('import_batch_bill_status')
        .update({ admin_note: admin_note ?? null })
        .eq('batch_key', batchKey).eq('kind', kind).eq('customer_id', customer_id)
      if (error) return json({ error: error.message }, 500)
    } else {
      const { error } = await supabase
        .from('import_batch_bill_status')
        .insert({ batch_key: batchKey, kind, customer_id, status: 'draft', admin_note: admin_note ?? null })
      if (error) return json({ error: error.message }, 500)
    }
    return json({ success: true })
  }

  // One row per product, quantities summed across every customer -- for
  // placing the actual 1688 order. No prices, no customer names. Excludes
  // already-billed customers and splits qty by shipping method.
  if (action === 'sourcing-totals') {
    if (!batchKey) return json({ error: 'Missing batch_key' }, 400)
    const { data, error } = await supabase.rpc('get_batch_sourcing_totals', { p_batch_key: batchKey })
    if (error) return json({ error: error.message }, 500)
    return json({ rows: data ?? [] })
  }

  // Variant x shipping-method breakdown for one product in Sourcing --
  // unbilled customers only, same exclusion as sourcing-totals.
  if (action === 'sourcing-product-breakdown') {
    const { product_id } = body
    if (!batchKey || !product_id) return json({ error: 'Missing batch_key or product_id' }, 400)
    const { data, error } = await supabase.rpc('get_batch_product_shipping_breakdown', {
      p_batch_key: batchKey, p_product_id: product_id,
    })
    if (error) return json({ error: error.message }, 500)
    return json({ rows: data ?? [] })
  }

  // Ship one customer, or every eligible (billed, not-yet-shipped) customer
  // in the batch. Gated on that customer's consolidation bill being sent --
  // not paid. Same underlying function either way; bulk just leaves
  // customer_id out, so it naturally skips anyone already shipped
  // individually.
  if (action === 'ship') {
    if (!batchKey) return json({ error: 'Missing batch_key' }, 400)
    const customerId = body.customer_id ?? null

    const { data: result, error } = await supabase.rpc('ship_batch_customers', {
      p_batch_key: batchKey,
      p_customer_id: customerId,
      p_shipping_method_final: body.shipping_method_final ?? null,
    })
    if (error) return json({ error: error.message }, 500)
    if (result?.error) return json({ error: result.error }, result.status ?? 400)

    const methodLabel = body.shipping_method_final === 'flight' ? ' by air'
      : body.shipping_method_final === 'sea_freight' ? ' by sea' : ''

    let paidQueued = 0, unpaidQueued = 0
    for (const recip of (result?.paid_recipients ?? [])) {
      const ok = await queueTemplated(supabase, 'shipped_paid', recip.email, { customer_name: recip.name, shipping_method_label: methodLabel })
      if (ok) paidQueued++
    }
    for (const recip of (result?.unpaid_recipients ?? [])) {
      const ok = await queueTemplated(supabase, 'shipped_held_unpaid', recip.email, { customer_name: recip.name, shipping_method_label: methodLabel })
      if (ok) unpaidQueued++
    }

    return json({
      success: true,
      shipped_count: result?.shipped_count ?? 0,
      paid_notified: paidQueued,
      held_unpaid_notified: unpaidQueued,
    })
  }

  // Mark one customer, or every eligible customer, received. Gated on that
  // customer's clearance bill being paid -- the actual release gate.
  if (action === 'mark-received') {
    if (!batchKey) return json({ error: 'Missing batch_key' }, 400)
    const customerId = body.customer_id ?? null

    const { data: result, error } = await supabase.rpc('mark_batch_customers_received', {
      p_batch_key: batchKey,
      p_customer_id: customerId,
    })
    if (error) return json({ error: error.message }, 500)
    if (result?.error) return json({ error: result.error }, result.status ?? 400)

    let queued = 0
    for (const recip of (result?.recipients ?? [])) {
      if (!recip.email) continue
      const ok = await queueTemplated(supabase, 'order_received', recip.email, { customer_name: recip.name })
      if (ok) queued++
    }

    return json({ success: true, received_count: result?.received_count ?? 0, queued })
  }

  // Cancel a sent-but-unpaid bill so it can be corrected and resent.
  // Refuses if that bill has already been confirmed paid.
  if (action === 'cancel-bill') {
    const { customer_id } = body
    if (!batchKey || !customer_id) return json({ error: 'Missing batch_key or customer_id' }, 400)

    const { data: result, error } = await supabase.rpc('cancel_batch_customer_bill', {
      p_batch_key: batchKey, p_kind: kind, p_customer_id: customer_id,
    })
    if (error) return json({ error: error.message }, 500)
    if (result?.error) return json({ error: result.error }, result.status ?? 400)
    return json({ success: true })
  }

  // Per-customer adjustment lines.
  if (action === 'add-adjustment') {
    const { customer_id, label, amount_ngn } = body
    if (!batchKey || !customer_id) return json({ error: 'Missing batch_key or customer_id' }, 400)
    const amount = Number(amount_ngn)
    if (!Number.isFinite(amount) || amount === 0) {
      return json({ error: 'Enter an amount. Use a negative number for a discount.' }, 400)
    }
    const cleanLabel = String(label ?? '').trim()
    if (!cleanLabel) return json({ error: 'Give the adjustment a label so the customer knows what it is.' }, 400)

    const { data, error } = await supabase
      .from('import_batch_customer_adjustments')
      .insert({ batch_key: batchKey, customer_id, kind, label: cleanLabel, amount_ngn: amount })
      .select().single()

    // The database trigger refuses writes once the bill has been sent.
    if (error) return json({ error: error.message }, /locked/i.test(error.message) ? 409 : 500)
    return json({ adjustment: data })
  }

  if (action === 'delete-adjustment') {
    if (!body.id) return json({ error: 'Missing id' }, 400)
    const { error } = await supabase
      .from('import_batch_customer_adjustments').delete().eq('id', body.id)
    if (error) return json({ error: error.message }, /locked/i.test(error.message) ? 409 : 500)
    return json({ success: true })
  }

  // Close & bill -- now only ever bills customers who are fully priced
  // (every line item), via get_batch_billing_eligible_customers inside
  // close_batch_billing. Previously this would bill anyone with at least
  // one priced line, silently dropping unpriced items from their total;
  // that partial-billing behavior has been removed. Emails are itemized,
  // grouped by shipping method.
  if (action === 'close-billing') {
    if (!batchKey) return json({ error: 'Missing batch_key' }, 400)
    const customerId = body.customer_id ?? null // null = bulk: everyone fully priced & not yet billed

    const orderStatusTarget = kind === 'clearance' ? 'clearance_and_closed' : 'ordered_and_closed'
    const timestampColumn   = kind === 'clearance' ? 'clearance_closed_at' : 'ordered_closed_at'

    const { data: result, error } = await supabase.rpc('close_batch_billing', {
      p_batch_key: batchKey,
      p_kind: kind,
      p_order_status_target: orderStatusTarget,
      p_batch_timestamp_column: timestampColumn,
      p_customer_id: customerId,
    })
    if (error) {
      console.error('[import-batch-view] close failed:', error.message)
      return json({ error: error.message }, 500)
    }
    if (result?.error) return json({ error: result.error }, result.status ?? 400)

    const templateKey = kind === 'clearance' ? 'clearance_bill' : 'consolidation_shipping_bill'
    let queued = 0
    for (const r of (result?.recipients ?? [])) {
      const ok = await queueTemplated(supabase, templateKey, r.email, {
        customer_name: r.name ?? 'there',
        amount_due: Number(r.amount_ngn ?? 0).toLocaleString(),
        pay_link: DASHBOARD_BILLS_URL,
        items_breakdown: buildItemsBreakdownHtml(r.line_items ?? []),
      })
      if (ok) queued++
    }

    return json({
      success: true,
      customers_billed: result?.customers_billed ?? 0,
      expected_total_ngn: result?.expected_total_ngn ?? 0,
      skipped: result?.skipped ?? [],
      queued,
    })
  }

  return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
})
