// order-reminders — staged reminders for orders that haven't been paid /
// confirmed yet, then auto-expiry into a separate failed-orders history
// table at 24h. Meant to be called on a schedule (see pg_cron setup) with
// action=run, and can also be triggered manually with action=run-once for a
// one-off backfill (e.g. nudging everyone currently overdue right now).
//
// Stages (measured from the order's created_at):
//   ~12h  -> reminder_stage 0 -> 1: calm first nudge
//   ~20h  -> reminder_stage 1 -> 2: urgent — order will be deleted soon
//   >=24h -> order moved to china_import_failed_orders, removed from the
//            active china_import_orders table.
//
// This file also runs the BILLED-batch reminder pipeline
// (action=run-bill-reminders, on a daily cron): customers who owe a
// consolidation_shipping or clearance bill get one reminder per day.
//   - consolidation_shipping: reminders continue daily with no cap. Once
//     the batch has shipped (order status shipped_and_closed or later) the
//     reminder switches to "shipped_held_unpaid" copy — the item has gone
//     out but won't be released/delivered until the bill clears. Shipping
//     itself is never blocked on payment.
//   - clearance: reminders are daily too, but capped at 7 — after the 7th
//     reminder, nudges stop (the bill stays open, "received" still requires
//     it to be paid, but we don't keep emailing indefinitely).
//
// v2: shipping-info reminders for restored orders (action=
// run-shipping-info-reminders, hourly cron; action=
// run-shipping-info-evening-reminders, daily 17:00 UTC / 6pm WAT cron).
// china_import_failed_orders never preserved shipping_method or
// delivery_address, so an order recreated via china-import's
// admin-restore-failed-order always starts with shipping_method = null and
// stays that way until the customer completes it via the
// complete-order-shipping action. Cadence: hourly for the first 24h after
// restore, then once daily at 6pm after that, using the 'shipping_info_needed'
// row in import_message_templates (editable from the admin Message
// Templates screen, same as every other customer email in this project).
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

function hoursSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 3_600_000
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

function firstReminderEmail(name: string, code: string): { subject: string; html: string } {
  return {
    subject: `Just checking in on your QAFRICA order ${code}`,
    html: emailShell(`
      <h2 style="color:#111827;margin:0 0 8px;">Hey ${name}, still with us? 👋</h2>
      <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
        We noticed your order <strong>${code}</strong> hasn't been paid for yet. No rush at all —
        we just wanted to check in and make sure everything's okay on your end.
      </p>
      <p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
        If you've already sent payment, please confirm it from your dashboard so we can get moving.
        And if you have any questions or ran into an issue, we're right here to help.
      </p>
      <a href="https://chat.whatsapp.com/DggRK0IeD94F0vyszfhfPW" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
        Talk to us on WhatsApp →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Order code: ${code}</p>
    `),
  }
}

function urgentReminderEmail(name: string, code: string): { subject: string; html: string } {
  return {
    subject: `Your QAFRICA order ${code} will be removed soon`,
    html: emailShell(`
      <h2 style="color:#111827;margin:0 0 8px;">One more nudge, ${name} 🕐</h2>
      <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
        Your order <strong>${code}</strong> is still unpaid, and it'll be automatically removed within
        the next few hours if payment isn't confirmed. We'd hate for you to lose your spot on this one.
      </p>
      <p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
        If you've already paid, please confirm it from your dashboard right away. If anything's
        holding you up, just reach out — we're happy to help sort it out.
      </p>
      <a href="https://chat.whatsapp.com/DggRK0IeD94F0vyszfhfPW" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
        Talk to us on WhatsApp →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Order code: ${code}</p>
    `),
  }
}

function expiredEmail(name: string, code: string): { subject: string; html: string } {
  return {
    subject: `Your QAFRICA order ${code} was removed`,
    html: emailShell(`
      <h2 style="color:#111827;margin:0 0 8px;">Your order was removed 📦</h2>
      <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
        Hi ${name}, since payment for order <strong>${code}</strong> wasn't confirmed within 24 hours,
        it's been removed from our active orders. No worries though — you're welcome to place a new
        order anytime.
      </p>
      <a href="https://qafrica.store/recommendations" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
        Start a new order →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Order code: ${code}</p>
    `),
  }
}

const DASHBOARD_BILLS_URL = 'https://qafrica.store/importations/dashboard'

function billReminderEmail(name: string, amountNgn: number, kind: 'consolidation_shipping' | 'clearance'): { subject: string; html: string } {
  const label = kind === 'clearance' ? 'clearance fee' : 'consolidation & shipping fee'
  return {
    subject: `Reminder: your ${label} is still due 💳`,
    html: emailShell(`
      <h2 style="color:#111827;margin:0 0 8px;">Reminder — fee still due 💳</h2>
      <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
        Hi ${name}, this is a reminder that your ${label} is still unpaid.
      </p>
      <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#111827;">₦${Math.round(amountNgn).toLocaleString()}</p>
      </div>
      <a href="${DASHBOARD_BILLS_URL}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
        Pay now →
      </a>
    `),
  }
}

function billHeldShippedReminderEmail(name: string, amountNgn: number): { subject: string; html: string } {
  return {
    subject: 'Reminder — your item is held until this fee is cleared 📦',
    html: emailShell(`
      <h2 style="color:#111827;margin:0 0 8px;">Your item is on its way, but held 📦</h2>
      <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
        Hi ${name}, your batch has already shipped, but your consolidation & shipping fee is still
        unpaid — your item is being held and won't be released until it's cleared.
      </p>
      <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#111827;">₦${Math.round(amountNgn).toLocaleString()}</p>
      </div>
      <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">Please visit your dashboard to pay and release your item.</p>
      <a href="${DASHBOARD_BILLS_URL}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
        Go to dashboard →
      </a>
    `),
  }
}

// ── Shared with china-import's editable-template mechanism ──────────────
// Duplicated (not imported — edge functions don't share code across
// deployments in this project) rather than hardcoded, so admins can edit
// the shipping-info-needed copy from the same Message Templates screen as
// every other customer email.
function renderTemplate(template: string, tokens: Record<string, string>): string {
  let out = template
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split(`{{${k}}}`).join(v)
  }
  out = out.replace(/\{\{[a-z_]+\}\}/g, '')
  return out
}

async function sendTemplatedEmail(supabase: any, key: string, to: string, tokens: Record<string, string>): Promise<boolean> {
  const { data: tpl } = await supabase.from('import_message_templates').select('subject, body_html').eq('key', key).single()
  if (!tpl) return false
  const subject = renderTemplate(tpl.subject, tokens)
  const html = emailShell(renderTemplate(tpl.body_html, tokens))
  const res = await supabase.functions.invoke('send-email', { body: { to, subject, html } }).catch(() => null)
  return !!res && !res.error
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    if (req.method === 'POST' && (action === 'run' || action === 'run-once')) {
      // Every order that hasn't actually landed on 'paid' is in scope for the
      // 24h hard cutoff — unpaid, awaiting_confirmation (customer claimed a
      // manual transfer but admin hasn't approved it), and failed (Paystack
      // failure or an admin-rejected manual claim) all expire the same way.
      // The 12h/20h nudge emails, though, only make sense for genuinely
      // unpaid orders — nudging someone who already claimed payment to "pay"
      // would be confusing.
      const { data: candidates, error } = await supabase
        .from('china_import_orders')
        .select('id, code, customer_name, user_id, items, total_ngn, delivery_type, payment_method, payment_status, created_at, reminder_stage')
        .in('payment_status', ['unpaid', 'awaiting_confirmation', 'failed'])

      if (error) return json({ error: error.message }, 500)

      let firstSent = 0, urgentSent = 0, expired = 0

      for (const order of (candidates ?? [])) {
        const hrs = hoursSince(order.created_at)
        let customerEmail: string | null = null
        if (order.user_id) {
          const { data: c } = await supabase.from('customers').select('email').eq('id', order.user_id).single()
          customerEmail = c?.email ?? null
        }

        if (hrs >= 24) {
          await supabase.from('china_import_failed_orders').insert({
            original_order_id: order.id, code: order.code, customer_name: order.customer_name,
            customer_whatsapp: null, user_id: order.user_id, items: order.items,
            total_ngn: order.total_ngn, delivery_type: order.delivery_type,
            payment_method: order.payment_method, order_created_at: order.created_at,
          })
          await supabase.from('china_import_orders').delete().eq('id', order.id)
          expired++

          if (customerEmail) {
            const { subject, html } = expiredEmail(order.customer_name ?? 'there', order.code)
            await supabase.functions.invoke('send-email', { body: { to: customerEmail, subject, html } }).catch(() => {})
          }
          continue
        }

        if (order.payment_status !== 'unpaid') continue // no "you haven't paid" nudges once a claim/rejection exists

        if (hrs >= 20 && order.reminder_stage < 2) {
          await supabase.from('china_import_orders').update({ reminder_stage: 2 }).eq('id', order.id)
          urgentSent++
          if (customerEmail) {
            const { subject, html } = urgentReminderEmail(order.customer_name ?? 'there', order.code)
            await supabase.functions.invoke('send-email', { body: { to: customerEmail, subject, html } }).catch(() => {})
          }
          continue
        }

        if (hrs >= 12 && order.reminder_stage < 1) {
          await supabase.from('china_import_orders').update({ reminder_stage: 1 }).eq('id', order.id)
          firstSent++
          if (customerEmail) {
            const { subject, html } = firstReminderEmail(order.customer_name ?? 'there', order.code)
            await supabase.functions.invoke('send-email', { body: { to: customerEmail, subject, html } }).catch(() => {})
          }
        }
      }

      return json({ success: true, checked: candidates?.length ?? 0, first_reminders_sent: firstSent, urgent_reminders_sent: urgentSent, expired })
    }

    if (req.method === 'POST' && action === 'send-first-to-all-now') {
      const { data: candidates, error } = await supabase
        .from('china_import_orders')
        .select('id, code, customer_name, user_id, reminder_stage')
        .eq('payment_status', 'unpaid')

      if (error) return json({ error: error.message }, 500)

      let sent = 0
      for (const order of (candidates ?? [])) {
        let customerEmail: string | null = null
        if (order.user_id) {
          const { data: c } = await supabase.from('customers').select('email').eq('id', order.user_id).single()
          customerEmail = c?.email ?? null
        }
        if (!customerEmail) continue

        const { subject, html } = firstReminderEmail(order.customer_name ?? 'there', order.code)
        const res = await supabase.functions.invoke('send-email', { body: { to: customerEmail, subject, html } }).catch(() => null)
        if (res) {
          sent++
          if (order.reminder_stage < 1) {
            await supabase.from('china_import_orders').update({ reminder_stage: 1 }).eq('id', order.id)
          }
        }
      }

      return json({ success: true, checked: candidates?.length ?? 0, sent })
    }

    if (req.method === 'POST' && action === 'my-failed-orders') {
      const { customer_id } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)

      const { data, error } = await supabase
        .from('china_import_failed_orders')
        .select('id, code, items, total_ngn, delivery_type, order_created_at, failed_at')
        .eq('user_id', customer_id)
        .order('failed_at', { ascending: false })
        .limit(100)
      if (error) return json({ error: error.message }, 500)
      return json({ failed_orders: data ?? [] })
    }

    // Daily reminders for unpaid consolidation_shipping / clearance bills.
    // consolidation_shipping: unlimited daily reminders; once the related
    // order has shipped, the copy switches to the "held until cleared"
    // variant. clearance: daily too, but capped at 7 reminders total.
    if (req.method === 'POST' && action === 'run-bill-reminders') {
      const { data: bills, error } = await supabase
        .from('china_import_consolidation_bills')
        .select('id, user_id, order_id, amount_ngn, kind, status, last_reminder_sent_at, reminder_count')
        .in('status', ['pending', 'awaiting_confirmation'])
        .in('kind', ['consolidation_shipping', 'clearance'])

      if (error) return json({ error: error.message }, 500)

      let reminded = 0, capped = 0

      for (const bill of (bills ?? [])) {
        const reminderCount = Number(bill.reminder_count ?? 0)

        if (bill.kind === 'clearance' && reminderCount >= 7) {
          capped++
          continue
        }

        const lastSent = bill.last_reminder_sent_at ? new Date(bill.last_reminder_sent_at).getTime() : 0
        const hoursSinceLast = (Date.now() - lastSent) / 3_600_000
        if (lastSent && hoursSinceLast < 24) continue

        let customerEmail: string | null = null
        let customerName: string | null = null
        if (bill.user_id) {
          const { data: c } = await supabase.from('customers').select('email, full_name').eq('id', bill.user_id).single()
          customerEmail = c?.email ?? null
          customerName = c?.full_name ?? 'there'
        }

        let orderShipped = false
        if (bill.kind === 'consolidation_shipping' && bill.order_id) {
          const { data: order } = await supabase.from('china_import_orders').select('shipped_at').eq('id', bill.order_id).single()
          orderShipped = !!order?.shipped_at
        }

        await supabase.from('china_import_consolidation_bills')
          .update({ last_reminder_sent_at: new Date().toISOString(), reminder_count: reminderCount + 1 })
          .eq('id', bill.id)

        if (customerEmail) {
          const { subject, html } = orderShipped
            ? billHeldShippedReminderEmail(customerName ?? 'there', Number(bill.amount_ngn ?? 0))
            : billReminderEmail(customerName ?? 'there', Number(bill.amount_ngn ?? 0), bill.kind)
          await supabase.functions.invoke('send-email', { body: { to: customerEmail, subject, html } }).catch(() => {})
        }
        reminded++
      }

      return json({ success: true, checked: bills?.length ?? 0, reminded, capped_out: capped })
    }

    // Hourly cron, first 24h after a restore. Only ever targets orders with
    // restored_at set AND shipping_method still null — complete-order-shipping
    // always sets shipping_method the moment the customer finishes the form,
    // so that single column is a reliable "still needs it" gate.
    if (req.method === 'POST' && action === 'run-shipping-info-reminders') {
      const { data: candidates, error } = await supabase
        .from('china_import_orders')
        .select('id, code, customer_name, user_id, restored_at, last_shipping_info_reminder_at, shipping_info_reminder_count')
        .not('restored_at', 'is', null)
        .is('shipping_method', null)
      if (error) return json({ error: error.message }, 500)

      let reminded = 0, skipped = 0
      for (const order of (candidates ?? [])) {
        if (hoursSince(order.restored_at) >= 24) { skipped++; continue } // handed off to the evening job below

        const lastSent = order.last_shipping_info_reminder_at ? new Date(order.last_shipping_info_reminder_at).getTime() : 0
        if (lastSent && (Date.now() - lastSent) / 3_600_000 < 1) { skipped++; continue }

        let customerEmail: string | null = null
        let customerName = order.customer_name ?? 'there'
        if (order.user_id) {
          const { data: c } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
          customerEmail = c?.email ?? null
          customerName = c?.full_name ?? customerName
        }

        await supabase.from('china_import_orders').update({
          last_shipping_info_reminder_at: new Date().toISOString(),
          shipping_info_reminder_count: (order.shipping_info_reminder_count ?? 0) + 1,
        }).eq('id', order.id)

        if (customerEmail) {
          const ok = await sendTemplatedEmail(supabase, 'shipping_info_needed', customerEmail, {
            customer_name: customerName, order_code: order.code, dashboard_link: DASHBOARD_BILLS_URL,
          })
          if (ok) reminded++
        }
      }

      return json({ success: true, checked: candidates?.length ?? 0, reminded, skipped })
    }

    // Daily cron at 17:00 UTC (6pm WAT). Same candidate set, but only for
    // orders restored 24h+ ago — the hourly job above already covers the
    // first day. One reminder per calendar day from here on.
    if (req.method === 'POST' && action === 'run-shipping-info-evening-reminders') {
      const { data: candidates, error } = await supabase
        .from('china_import_orders')
        .select('id, code, customer_name, user_id, restored_at, last_shipping_info_reminder_at, shipping_info_reminder_count')
        .not('restored_at', 'is', null)
        .is('shipping_method', null)
      if (error) return json({ error: error.message }, 500)

      let reminded = 0, skipped = 0
      for (const order of (candidates ?? [])) {
        if (hoursSince(order.restored_at) < 24) { skipped++; continue } // still in the hourly window

        const lastSent = order.last_shipping_info_reminder_at ? new Date(order.last_shipping_info_reminder_at).getTime() : 0
        if (lastSent && (Date.now() - lastSent) / 3_600_000 < 20) { skipped++; continue } // already reminded today

        let customerEmail: string | null = null
        let customerName = order.customer_name ?? 'there'
        if (order.user_id) {
          const { data: c } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
          customerEmail = c?.email ?? null
          customerName = c?.full_name ?? customerName
        }

        await supabase.from('china_import_orders').update({
          last_shipping_info_reminder_at: new Date().toISOString(),
          shipping_info_reminder_count: (order.shipping_info_reminder_count ?? 0) + 1,
        }).eq('id', order.id)

        if (customerEmail) {
          const ok = await sendTemplatedEmail(supabase, 'shipping_info_needed', customerEmail, {
            customer_name: customerName, order_code: order.code, dashboard_link: DASHBOARD_BILLS_URL,
          })
          if (ok) reminded++
        }
      }

      return json({ success: true, checked: candidates?.length ?? 0, reminded, skipped })
    }

    return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[order-reminders]', message)
    return json({ error: message }, 500)
  }
})
