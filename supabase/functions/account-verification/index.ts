// account-verification
//
// Non-blocking email confirmation for import customers.
//
// Why non-blocking: 0 of 6,352 importation customers are currently verified.
// Gating checkout, ordering or payment on this flag would lock out the entire
// customer base overnight. The flag exists so that marketing mail can be
// restricted to addresses we know are real -- which is what protects the
// sending domain -- not to gate the product.
//
// Why it also allows correcting the address: a visible share of the 1-2 Sep
// signups typo'd their email (gamil.com, gmail.con, gmal.com, ail.com). Those
// people never received anything and currently have no way to fix it
// themselves.
//
// Security model:
//   * The caller must present a valid Supabase access token. The customer_id
//     is taken from that token, never from the request body -- otherwise
//     anyone could verify or re-address anyone else's account.
//   * The 6-digit code is generated here with crypto.getRandomValues and only
//     its SHA-256 hash is stored. A database leak yields no usable codes.
//   * 3 codes per customer per hour, 5 guesses per code, 15-minute expiry.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY          = Deno.env.get('SUPABASE_ANON_KEY')!
const APP_URL           = Deno.env.get('APP_URL') || 'https://qafrica.store'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/
function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim())
}

// Cryptographically random 6-digit code. Rejection sampling keeps the
// distribution flat -- a plain modulo would bias the low digits.
function generateCode(): string {
  const buf = new Uint32Array(1)
  let n: number
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= 4_294_000_000)
  return String(n % 1_000_000).padStart(6, '0')
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Resolve the caller from their access token. The customer id NEVER comes
// from the request body.
async function getCaller(req: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const scoped = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await scoped.auth.getUser()
  if (error || !data?.user) return null
  return { id: data.user.id, email: data.user.email ?? '' }
}

function codeEmailHtml(code: string, name: string): string {
  return `<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td align="center" style="padding-bottom:24px;"><div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;"><span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span></div></td></tr><tr><td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.06);"><p style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px;">Confirm your email</p><p style="color:#6B7280;font-size:15px;margin:0 0 24px;">Hi ${name}, enter this code in your QAFRICA dashboard to confirm this address.</p><div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;"><span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#F97316;">${code}</span></div><p style="color:#6B7280;font-size:13px;margin:0 0 6px;">This code expires in 15 minutes.</p><p style="color:#6B7280;font-size:13px;margin:0;">If you did not request it, you can ignore this email — nothing will change.</p></td></tr><tr><td align="center" style="padding:24px 0 0;"><p style="font-size:12px;color:#9CA3AF;margin:0;">&copy; ${new Date().getFullYear()} QAFRICA · <a href="${APP_URL}" style="color:#9CA3AF;">qafrica.store</a></p></td></tr></table></td></tr></table></body>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const url    = new URL(req.url)
  const action = url.searchParams.get('action')

  const caller = await getCaller(req)
  if (!caller) return json({ error: 'Not signed in' }, 401)

  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* optional body */ }

  // ── status ───────────────────────────────────────────────────────────────
  if (action === 'status') {
    const { data } = await admin
      .from('customers')
      .select('email, is_verified')
      .eq('id', caller.id)
      .maybeSingle()
    return json({
      email:       data?.email ?? caller.email,
      is_verified: data?.is_verified === true,
    })
  }

  // ── request-code ─────────────────────────────────────────────────────────
  if (action === 'request-code') {
    const { data: customer } = await admin
      .from('customers')
      .select('email, full_name, is_verified')
      .eq('id', caller.id)
      .maybeSingle()

    if (!customer) return json({ error: 'Customer not found' }, 404)
    if (customer.is_verified) return json({ ok: true, already_verified: true })

    // An address may be supplied to correct a typo at signup; otherwise use
    // the one on file.
    const target = (body.email ? String(body.email).trim().toLowerCase() : customer.email) as string
    if (!isValidEmail(target)) {
      return json({ ok: false, reason: 'invalid_email', message: 'That email address does not look right.' }, 400)
    }

    // Availability check covers auth.users AND customers.
    //
    // This previously checked only the customers table, which misses auth
    // users that have no customer record. On 5 Sep that gap let a customer
    // "confirm" an address already held by an older auth account: the
    // customer row was rewritten, the auth update was rejected with a
    // duplicate-key error, and the UI still reported success.
    if (target !== String(customer.email).toLowerCase()) {
      const { data: available, error: availErr } = await admin.rpc('email_available_for_user', {
        p_email: target, p_user_id: caller.id,
      })
      if (availErr) {
        console.error('[account-verification] availability check failed:', availErr.message)
        return json({ ok: false, reason: 'server_error' }, 500)
      }
      if (available !== true) {
        return json({ ok: false, reason: 'email_in_use', message: 'That email is already registered to another account.' }, 409)
      }
    }

    const code = generateCode()
    const hash = await sha256(code)

    const { data: issued, error: rpcErr } = await admin.rpc('request_email_verification', {
      p_customer_id: caller.id, p_email: target, p_code_hash: hash,
    })

    if (rpcErr) {
      console.error('[account-verification] request rpc failed:', rpcErr.message)
      return json({ ok: false, reason: 'server_error' }, 500)
    }
    if (issued?.ok !== true) {
      if (issued?.reason === 'rate_limited') {
        return json({
          ok: false, reason: 'rate_limited',
          message: 'Too many codes requested. Please try again in an hour.',
        }, 429)
      }
      return json({ ok: false, reason: issued?.reason ?? 'unknown' }, 400)
    }

    // Sent at priority 1 (transactional): the customer is sitting in front of
    // the screen waiting for this, so it must never queue behind bulk mail.
    const { error: sendErr } = await admin.functions.invoke('send-email', {
      body: {
        to:         target,
        subject:    'Your QAFRICA confirmation code',
        html:       codeEmailHtml(code, customer.full_name || 'there'),
        email_type: 'email_verification',
        priority:   1,
      },
    })

    // Unlike the old forgot-password sheet, a send failure is reported rather
    // than swallowed. Telling someone "code sent" when it was not is what
    // makes an auth flow feel broken.
    if (sendErr) {
      console.error('[account-verification] send failed:', sendErr.message)
      return json({ ok: false, reason: 'send_failed', message: 'We could not send the code right now. Please try again shortly.' }, 502)
    }

    return json({ ok: true, email: target, expires_at: issued.expires_at })
  }

  // ── verify-code ──────────────────────────────────────────────────────────
  if (action === 'verify-code') {
    const raw = String(body.code ?? '').trim()
    if (!/^\d{6}$/.test(raw)) {
      return json({ ok: false, reason: 'invalid_format', message: 'Enter the 6-digit code.' }, 400)
    }

    const { data: result, error } = await admin.rpc('verify_email_code', {
      p_customer_id: caller.id, p_code_hash: await sha256(raw),
    })

    if (error) {
      console.error('[account-verification] verify rpc failed:', error.message)
      return json({ ok: false, reason: 'server_error' }, 500)
    }

    if (result?.ok !== true) {
      const messages: Record<string, string> = {
        no_active_code:    'Request a new code to continue.',
        expired:           'That code has expired. Request a new one.',
        too_many_attempts: 'Too many incorrect attempts. Request a new code.',
        incorrect:         'That code is not correct.',
      }
      return json({
        ok: false,
        reason: result?.reason ?? 'unknown',
        message: messages[result?.reason] ?? 'We could not confirm that code.',
        attempts_remaining: result?.attempts_remaining,
      }, 400)
    }

    // Auth record FIRST, customer record only once auth has accepted it.
    //
    // The original order was the other way round and the auth failure was
    // merely logged, so a rejected change left customers.email pointing at an
    // address the customer could not actually sign in with -- and a later
    // password reset resolved that address to somebody else's account.
    if (result.email && result.email.toLowerCase() !== caller.email.toLowerCase()) {
      const { error: authErr } = await admin.auth.admin.updateUserById(caller.id, {
        email: result.email, email_confirm: true,
      })
      if (authErr) {
        console.error('[account-verification] auth email update rejected:', authErr.message)
        const raw = authErr.message?.toLowerCase() ?? ''
        const inUse = raw.includes('duplicate') || raw.includes('already') || raw.includes('registered')
        return json({
          ok: false,
          reason: inUse ? 'email_in_use' : 'auth_update_failed',
          message: inUse
            ? 'That email is already registered to another account, so we could not move your account to it. Nothing has changed — please use a different address.'
            : 'We could not update your email right now. Nothing has changed — please try again shortly.',
        }, inUse ? 409 : 502)
      }
    }

    // Only now is it safe to write the customer record.
    const { error: custErr } = await admin
      .from('customers')
      .update({ email: result.email, is_verified: true, updated_at: new Date().toISOString() })
      .eq('id', caller.id)

    if (custErr) {
      console.error('[account-verification] customer record update failed:', custErr.message)
      return json({ ok: false, reason: 'server_error', message: 'Your email was confirmed but we could not finish updating your profile. Please contact support.' }, 500)
    }

    return json({ ok: true, email: result.email })
  }

  return json({ error: 'Unknown action' }, 400)
})
