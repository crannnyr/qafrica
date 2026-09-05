import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL    = Deno.env.get('APP_URL') || 'https://qafrica.store'

// ── Single sending identity ─────────────────────────────────────────────────
// Was noreply@qafrica.store here and hello@qafrica.store in send-email, so the
// same message went out from a different address depending on which path
// delivered it. That splits the domain's reputation across two identities.
// One FROM, with a real Reply-To.
const FROM     = 'QAFRICA <hello@qafrica.store>'
const REPLY_TO = 'hello@qafrica.store'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ─── THE BUG THIS FILE EXISTED TO CAUSE ──────────────────────────────────────
// supabase.rpc() returns a PostgrestFilterBuilder: thenable, but with NO
// .catch() method. The old code did:
//
//     await supabase.rpc('record_email_sent', {...}).catch(() => {})
//
// which threw a TypeError on every single successful send. Because that line
// sat AFTER the row was marked 'sent', the throw fell through to the outer
// catch, which rewrote the row to failed/pending and requeued it. Net effect:
// the customer received the email up to 3 times, while the database claimed it
// had failed. Resend measured 10,788 messages to 3,782 addresses on 2 Sep --
// 2.85 attempts per address -- and Gmail throttled the domain for it.
//
// Never call .catch() on an rpc() result. Use this instead.
async function safeRpc(fn: string, args: Record<string, unknown>) {
  try {
    const { error } = await supabase.rpc(fn, args)
    if (error) console.warn(`[process-email-queue] rpc ${fn} failed:`, error.message)
  } catch (e) {
    console.warn(`[process-email-queue] rpc ${fn} threw:`, e instanceof Error ? e.message : String(e))
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────────────────────
function renderTemplate(name: string, data: Record<string, any>): { subject: string; html: string } | null {
  switch (name) {
    case 'price_change':
      return {
        subject: `Price update: ${data.product_name}`,
        html: `<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td align="center" style="padding-bottom:24px;"><div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;"><span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span></div></td></tr><tr><td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.06);"><p style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px;">Supplier Price Update</p><p style="color:#6B7280;font-size:15px;margin:0 0 24px;"><strong>${data.supplier_store}</strong> has updated the price of a product you're selling.</p><div style="background:#FFF7ED;border-radius:12px;padding:20px;margin-bottom:24px;"><p style="font-weight:700;font-size:16px;color:#111827;margin:0 0 12px;">${data.product_name}</p><table width="100%"><tr><td style="color:#6B7280;font-size:14px;padding:6px 0;">Customer price</td><td style="text-align:right;"><span style="text-decoration:line-through;color:#9CA3AF;">₦${Number(data.old_selling_price).toLocaleString()}</span> → <strong style="color:#F97316;">₦${Number(data.new_selling_price).toLocaleString()}</strong></td></tr><tr><td style="color:#6B7280;font-size:14px;padding:6px 0;">Your cost</td><td style="text-align:right;"><span style="text-decoration:line-through;color:#9CA3AF;">₦${Number(data.old_dropship_price).toLocaleString()}</span> → <strong style="color:#F97316;">₦${Number(data.new_dropship_price).toLocaleString()}</strong></td></tr></table></div><table width="100%"><tr><td align="center"><a href="${APP_URL}/dashboard/imports" style="display:inline-block;padding:13px 32px;background:#F97316;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Review Imported Products →</a></td></tr></table></td></tr><tr><td align="center" style="padding:24px 0 0;"><p style="font-size:12px;color:#9CA3AF;margin:0;">&copy; ${new Date().getFullYear()} QAFRICA</p></td></tr></table></td></tr></table></body>`,
      }

    case 'new_product_in_niche':
      return {
        subject: `New ${data.niche} product available — ${data.product_name}`,
        html: `<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td align="center" style="padding-bottom:24px;"><div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;"><span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span></div></td></tr><tr><td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.06);"><p style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px;">🔆 New product to import</p><p style="color:#6B7280;font-size:15px;margin:0 0 24px;">A new product just dropped in the <strong>${data.niche}</strong> niche.</p><div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;margin-bottom:24px;"><p style="font-weight:700;font-size:16px;color:#111827;margin:0 0 8px;">${data.product_name}</p><p style="color:#6B7280;font-size:13px;margin:0 0 12px;">${data.category} · by ${data.source_store}</p><p style="margin:0;font-size:14px;color:#374151;">Dropship from <strong style="color:#F97316;">₦${Number(data.dropship_price).toLocaleString()}</strong> &nbsp;·&nbsp; Sell for <strong>₦${Number(data.selling_price).toLocaleString()}</strong></p></div><table width="100%"><tr><td align="center"><a href="${APP_URL}/dashboard/catalog?product=${data.product_id}" style="display:inline-block;padding:13px 32px;background:#F97316;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Import This Product →</a></td></tr></table></td></tr><tr><td align="center" style="padding:24px 0 0;"><p style="font-size:12px;color:#9CA3AF;margin:0;">&copy; ${new Date().getFullYear()} QAFRICA</p></td></tr></table></td></tr></table></body>`,
      }

    case 'new_importer':
      return {
        subject: `${data.importer_store} is now selling ${data.product_name}`,
        html: `<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td align="center" style="padding-bottom:24px;"><div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;"><span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span></div></td></tr><tr><td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.06);"><p style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px;">🎉 New seller for your product</p><p style="color:#374151;font-size:15px;margin:0 0 24px;"><strong>${data.importer_store}</strong> just imported <strong>${data.product_name}</strong> and is now selling it.</p><table width="100%"><tr><td align="center"><a href="${APP_URL}/dashboard/products" style="display:inline-block;padding:13px 32px;background:#F97316;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">View My Products →</a></td></tr></table></td></tr><tr><td align="center" style="padding:24px 0 0;"><p style="font-size:12px;color:#9CA3AF;margin:0;">&copy; ${new Date().getFullYear()} QAFRICA</p></td></tr></table></td></tr></table></body>`,
      }

    case 'out_of_stock':
      return {
        subject: `Out of stock: ${data.product_name}`,
        html: `<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td align="center" style="padding-bottom:24px;"><div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;"><span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span></div></td></tr><tr><td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.06);"><p style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px;">⚠️ Product out of stock</p><div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:16px;margin-bottom:24px;"><p style="font-weight:700;color:#991B1B;margin:0;">${data.product_name}</p><p style="color:#B91C1C;font-size:13px;margin:4px 0 0;">Store: ${data.store_name} · Stock: 0</p></div><table width="100%"><tr><td align="center"><a href="${APP_URL}/dashboard/products/${data.product_id}/edit" style="display:inline-block;padding:13px 32px;background:#EF4444;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Restock Now →</a></td></tr></table></td></tr><tr><td align="center" style="padding:24px 0 0;"><p style="font-size:12px;color:#9CA3AF;margin:0;">&copy; ${new Date().getFullYear()} QAFRICA</p></td></tr></table></td></tr></table></body>`,
      }

    case 'low_stock':
      return {
        subject: `Low stock warning: ${data.product_name}`,
        html: `<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td align="center" style="padding-bottom:24px;"><div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;"><span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span></div></td></tr><tr><td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.06);"><p style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px;">⚠️ Low stock warning</p><div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px;margin-bottom:24px;"><p style="font-weight:700;color:#92400E;margin:0;">${data.product_name}</p><p style="color:#B45309;font-size:13px;margin:4px 0 0;">${data.current_stock} unit(s) remaining</p></div><table width="100%"><tr><td align="center"><a href="${APP_URL}/dashboard/products/${data.product_id}/edit" style="display:inline-block;padding:13px 32px;background:#F97316;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Restock →</a></td></tr></table></td></tr><tr><td align="center" style="padding:24px 0 0;"><p style="font-size:12px;color:#9CA3AF;margin:0;">&copy; ${new Date().getFullYear()} QAFRICA</p></td></tr></table></td></tr></table></body>`,
      }

    default:
      // For emails queued with raw html_body (from send-email scheduling)
      if (data?._raw_subject && data?._raw_html) {
        return { subject: data._raw_subject, html: data._raw_html }
      }
      return null
  }
}

// A synchronous rejection from the Resend API (as opposed to an async bounce
// reported later) usually means the address itself is malformed/invalid --
// safe to suppress immediately rather than retry.
function looksPermanentlyBad(status: number, message: string): boolean {
  const m = (message || '').toLowerCase()
  return status === 422 || /invalid|does not exist|not a valid|malformed/.test(m)
}

// Only 429 and 5xx deserve another attempt. Any other 4xx will fail the same
// way forever, and every attempt counts toward the rate Gmail measures.
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

// Transactional mail (priority 1: bills, password resets, confirmation codes)
// gets one retry. Everything else gets a single attempt -- Resend's guidance is
// explicitly to stop resending to addresses that are already Delayed or
// Bounced, and bulk mail is exactly what was generating that volume.
const MAX_ATTEMPTS_CEILING = 2
function maxAttemptsFor(priority: number | null | undefined): number {
  return (priority ?? 5) <= 1 ? 2 : 1
}

// Malformed addresses must never reach Resend -- they only burn rate budget.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/
function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim())
}

// ─── Queue processor ────────────────────────────────────────────────────────────────────────────
async function processQueue() {
  const now = new Date().toISOString()

  // Fetch pending emails that are:
  // 1. Due now (scheduled_for <= now) OR manually triggered
  // 2. Under the highest possible retry ceiling (per-job limit applied below)
  // 3. Ordered by: priority ASC (1 = highest), then scheduled_for ASC (oldest first)
  //    EXCEPT manually triggered emails jump to the front regardless of priority.
  const { data: pending, error } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS_CEILING)
    .or(`scheduled_for.lte.${now},is_manually_triggered.eq.true`)
    .order('is_manually_triggered', { ascending: false }) // manual first
    .order('priority',              { ascending: true  }) // then by priority
    .order('scheduled_for',         { ascending: true  }) // then oldest
    .limit(50)

  if (error) {
    console.error('[process-email-queue] Fetch error:', error.message)
    return { processed: 0, error: error.message }
  }

  if (!pending?.length) {
    return { processed: 0, skipped: 0, message: 'Queue empty' }
  }

  let processed = 0
  let skipped   = 0
  let deferred  = 0
  let suppressed = 0
  let rejected  = 0

  for (const job of pending) {
    const emailType = job.email_type || job.template_name || 'generic'
    const maxAttempts = maxAttemptsFor(job.priority)

    // Per-job retry ceiling (the query above uses the global maximum).
    if (job.attempts >= maxAttempts) {
      await supabase.from('email_queue')
        .update({ status: 'failed', error: 'Retry limit reached', processed_at: now })
        .eq('id', job.id)
      skipped++
      continue
    }

    // Reject malformed recipients before they ever reach Resend.
    if (!isValidEmail(job.to_email)) {
      await supabase.from('email_queue')
        .update({ status: 'failed', error: 'Invalid recipient address', processed_at: now })
        .eq('id', job.id)
      rejected++
      continue
    }

    // ── Check daily type limit, per-domain hourly throttle, and suppression ──────
    // Skipped for manually triggered emails (admin override).
    if (!job.is_manually_triggered) {
      const { data: limitData } = await supabase
        .rpc('can_send_email_now', { p_email_type: emailType, p_to_email: job.to_email })

      if (limitData?.can_send === false) {
        if (limitData.reason === 'disabled') {
          await supabase.from('email_queue')
            .update({ status: 'failed', error: 'Email type disabled by admin', processed_at: now })
            .eq('id', job.id)
          skipped++
          continue
        }

        if (limitData.reason === 'suppressed') {
          await supabase.from('email_queue')
            .update({ status: 'failed', error: 'Recipient is suppressed', processed_at: now })
            .eq('id', job.id)
          suppressed++
          continue
        }

        if (limitData.reason === 'limit_reached' || limitData.reason === 'domain_rate_limited') {
          // Reschedule -- for domain_rate_limited this pushes to the top of
          // the next hourly window rather than retrying immediately, which
          // is exactly what stops us hammering an already-throttled domain.
          await supabase.from('email_queue')
            .update({ scheduled_for: limitData.scheduled_for })
            .eq('id', job.id)
          deferred++
          continue
        }
      }
    }

    // ── Mark as processing ─────────────────────────────────────────────
    await supabase.from('email_queue')
      .update({ status: 'processing', attempts: job.attempts + 1 })
      .eq('id', job.id)

    // ── Resolve content ──────────────────────────────────────────────────
    // Scheduled emails from send-email carry raw subject+html in template_data
    let subject: string
    let html: string

    if (job.subject && job.html_body) {
      // Direct-scheduled email (from send-email fallback)
      subject = job.subject
      html    = job.html_body
    } else {
      // Template-based email (from queue producer)
      const rendered = renderTemplate(job.template_name, job.template_data || {})
      if (!rendered) {
        await supabase.from('email_queue')
          .update({
            status:       'failed',
            error:        `Unknown template: ${job.template_name}`,
            processed_at: now,
          })
          .eq('id', job.id)
        skipped++
        continue
      }
      subject = rendered.subject
      html    = rendered.html
    }

    // ── Send via Resend ──────────────────────────────────────────────────
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          from:     FROM,
          reply_to: REPLY_TO,
          to:       [job.to_email],
          subject,
          html,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        if (looksPermanentlyBad(res.status, errText)) {
          await safeRpc('record_email_permanent_failure', { p_email: job.to_email, p_reason: `send_rejected: ${errText.slice(0, 200)}` })
          await supabase.from('email_queue')
            .update({ status: 'failed', error: errText, processed_at: now })
            .eq('id', job.id)
          suppressed++
          continue
        }
        // Retry only on 429/5xx, and only while under this job's own ceiling.
        const isFinal = !isRetryable(res.status) || (job.attempts + 1) >= maxAttempts
        await supabase.from('email_queue')
          .update({
            status:       isFinal ? 'failed' : 'pending',
            error:        errText,
            processed_at: now,
            // Retry in 10 mins if not final
            scheduled_for: isFinal ? undefined : new Date(Date.now() + 10 * 60_000).toISOString(),
          })
          .eq('id', job.id)
        if (isFinal) skipped++
      } else {
        await supabase.from('email_queue')
          .update({ status: 'sent', processed_at: now })
          .eq('id', job.id)

        // Increment daily counter. safeRpc CANNOT throw -- this is the line
        // that used to blow up and undo the 'sent' status above.
        await safeRpc('record_email_sent', { p_email_type: emailType })
        processed++
      }
    } catch (err: any) {
      const isFinal = (job.attempts + 1) >= maxAttempts
      await supabase.from('email_queue')
        .update({
          status:        isFinal ? 'failed' : 'pending',
          error:         err.message,
          scheduled_for: isFinal ? undefined : new Date(Date.now() + 10 * 60_000).toISOString(),
        })
        .eq('id', job.id)
      if (isFinal) skipped++
    }
  }

  return { processed, skipped, deferred, suppressed, rejected, total: pending.length }
}

// ─── Entry point ─────────────────────────────────────────────────────────────
serve(async (req) => {
  const result = await processQueue()
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
