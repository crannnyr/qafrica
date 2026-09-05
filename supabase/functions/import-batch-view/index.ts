// import-batch-view
//
// Closed-batch admin data and billing actions. Split out of china-import
// deliberately: that file is ~1,700 lines and every unrelated change forces a
// full redeploy of the entire order/payment surface.
//
// Auth uses the same import_admin_sessions token as china-import, so there is
// one admin session concept rather than two.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DASHBOARD_BILLS_URL = 'https://qafrica.store/dashboard?tab=bills'

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

    const [linesRes, adjRes, ledgerRes] = await Promise.all([
      supabase.rpc('get_batch_customer_breakdown', { p_batch_key: batchKey }),
      supabase.from('import_batch_customer_adjustments')
        .select('*').eq('batch_key', batchKey).order('created_at'),
      supabase.rpc('get_batch_bill_ledger', { p_batch_key: batchKey, p_kind: kind }),
    ])

    if (linesRes.error) {
      console.error('[import-batch-view] breakdown failed:', linesRes.error.message)
      return json({ error: linesRes.error.message }, 500)
    }
    return json({
      rows: linesRes.data ?? [],
      adjustments: adjRes.data ?? [],
      ledger: ledgerRes.data ?? [],
    })
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

  // Close & bill.
  // The whole computation and every insert happen in one transaction inside
  // close_batch_billing(). The previous JS version looped inserts with no
  // transaction, so a failure partway through left some customers billed and
  // the batch unlocked -- and rerunning would double-bill them.
  if (action === 'close-billing') {
    if (!batchKey) return json({ error: 'Missing batch_key' }, 400)

    const orderStatusTarget = kind === 'clearance' ? 'clearance_and_closed' : 'ordered_and_closed'
    const timestampColumn   = kind === 'clearance' ? 'clearance_closed_at' : 'ordered_closed_at'

    const { data: result, error } = await supabase.rpc('close_batch_billing', {
      p_batch_key: batchKey,
      p_kind: kind,
      p_order_status_target: orderStatusTarget,
      p_batch_timestamp_column: timestampColumn,
    })
    if (error) {
      console.error('[import-batch-view] close failed:', error.message)
      return json({ error: error.message }, 500)
    }
    if (result?.error) return json({ error: result.error }, result.status ?? 400)

    // Emails are queued after the transaction commits. Holding a database
    // transaction open across network calls to the mail service would be a
    // good way to lock the batch for everyone else.
    const { data: tpl } = await supabase
      .from('import_message_templates').select('subject, body_html')
      .eq('key', kind === 'clearance' ? 'clearance_bill' : 'consolidation_shipping_bill')
      .maybeSingle()

    let queued = 0
    for (const r of (result?.recipients ?? [])) {
      if (!tpl) break
      const tokens = {
        customer_name: r.name ?? 'there',
        amount_due: Number(r.amount_ngn ?? 0).toLocaleString(),
        pay_link: DASHBOARD_BILLS_URL,
      }
      const { error: qErr } = await supabase.from('import_notification_queue').insert({
        to_email: r.email,
        subject: renderTemplate(tpl.subject, tokens),
        html: emailShell(renderTemplate(tpl.body_html, tokens)),
      })
      if (!qErr) queued++
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
