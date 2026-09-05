// resend-webhook
//
// Receives delivery events from Resend and turns them into two things:
//   1. rows in email_delivery_events, which is what email_ramp_tick() steers
//      the per-domain hourly cap on
//   2. suppressions for genuinely dead addresses
//
// Before this existed, suppressions were only pulled by a once-a-day poll, so
// a dead address kept receiving mail for up to 24 hours and kept adding
// failures. This closes that to seconds.
//
// IMPORTANT on bounce handling: only PERMANENT bounces are suppressed. During
// 1-2 Sep, 10,489 of 10,609 bounces were transient -- Gmail deferring us with
// 421 4.7.28 because we were sending too fast, then the message ageing out.
// Those are real customers with working addresses. Suppressing on transient
// bounces would have deleted most of the list to fix a problem that was ours.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SIGNING_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Constant-time compare -- a timing-safe check matters here because the
// signature is the only thing standing between the public internet and our
// suppression list.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Resend signs webhooks with Svix: HMAC-SHA256 over `${id}.${timestamp}.${body}`
// keyed by the secret (which is base64 after the "whsec_" prefix).
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!SIGNING_SECRET) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not set — rejecting')
    return false
  }

  const svixId        = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) return false

  // Reject anything older than 5 minutes, so a captured request cannot be
  // replayed later.
  const age = Math.abs(Date.now() / 1000 - Number(svixTimestamp))
  if (!Number.isFinite(age) || age > 300) {
    console.warn('[resend-webhook] timestamp outside tolerance')
    return false
  }

  const secretBytes = base64ToBytes(SIGNING_SECRET.replace(/^whsec_/, ''))
  const key = await crypto.subtle.importKey(
    'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signed = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${svixId}.${svixTimestamp}.${rawBody}`),
  )
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)))

  // The header carries a space-separated list of `v1,<sig>` pairs.
  return svixSignature.split(' ').some(part => {
    const [version, sig] = part.split(',')
    return version === 'v1' && sig && timingSafeEqual(sig, expected)
  })
}

// Resend event names -> our shorter internal vocabulary.
const EVENT_MAP: Record<string, string> = {
  'email.sent':             'sent',
  'email.delivered':        'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.bounced':          'bounced',
  'email.complained':       'complained',
  'email.opened':           'opened',
  'email.clicked':          'clicked',
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const rawBody = await req.text()

  if (!(await verifySignature(req, rawBody))) {
    return json({ error: 'Invalid signature' }, 401)
  }

  let payload: any
  try { payload = JSON.parse(rawBody) }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const eventType = EVENT_MAP[payload?.type]
  if (!eventType) {
    // Unknown event types are acknowledged, not retried — returning an error
    // would make Resend redeliver something we will never understand.
    return json({ ok: true, ignored: payload?.type ?? 'unknown' })
  }

  const data = payload?.data ?? {}
  const recipients: string[] = Array.isArray(data.to) ? data.to : (data.to ? [data.to] : [])
  if (recipients.length === 0) return json({ ok: true, ignored: 'no recipient' })

  const bounceType   = data?.bounce?.type ?? null
  const bounceReason = data?.bounce?.message ?? data?.reason ?? null
  const occurredAt   = payload?.created_at ?? data?.created_at ?? new Date().toISOString()

  let recorded = 0
  let suppressed = 0

  for (const rawEmail of recipients) {
    const email = String(rawEmail).trim().toLowerCase()
    if (!email.includes('@')) continue

    const { error } = await supabase.from('email_delivery_events').insert({
      resend_id:     data?.email_id ?? null,
      event_type:    eventType,
      email,
      subject:       data?.subject ?? null,
      bounce_type:   bounceType,
      bounce_reason: bounceReason,
      occurred_at:   occurredAt,
    })
    // A duplicate is Resend retrying a delivery we already recorded. Expected,
    // and deliberately not an error -- double-counting would skew the bounce
    // rate the auto-ramp steers on.
    if (!error) recorded++
    else if (error.code !== '23505') {
      console.warn('[resend-webhook] insert failed:', error.message)
    }

    if (eventType === 'bounced' || eventType === 'complained') {
      const reason = eventType === 'complained'
        ? 'spam_complaint'
        : (bounceReason ?? 'bounce')
      // Complaints are always permanent: someone pressed "report spam".
      const type = eventType === 'complained' ? 'permanent' : bounceType
      try {
        const { error: rpcErr } = await supabase.rpc('record_email_bounce', {
          p_email: email, p_bounce_type: type, p_reason: reason,
        })
        if (rpcErr) console.warn('[resend-webhook] record_email_bounce:', rpcErr.message)
        else suppressed++
      } catch (e) {
        console.warn('[resend-webhook] record_email_bounce threw:', e instanceof Error ? e.message : String(e))
      }
    }
  }

  return json({ ok: true, event: eventType, recorded, suppressed })
})
