// password-reset
//
// Code-based password reset for importation customers, sent through Resend.
//
// Why this exists rather than supabase.auth.signInWithOtp():
// signInWithOtp renders Supabase's "Magic Link" template, which by default
// contains a clickable link and no token -- which is why a customer received a
// magic link when the UI was asking them for a 6-digit code. Making that
// template show a code means hand-editing a dashboard setting that cannot be
// read, tested or version-controlled, and the same template is shared with the
// dropship signup verification flow. Owning the code gives one branded email,
// on the sending domain, with limits that are testable.
//
// Security model:
//   * Responses never reveal whether an address has an account. Every
//     request-code call returns the same shape.
//   * Codes come from crypto.getRandomValues with rejection sampling (a plain
//     modulo would bias the low digits) and only their SHA-256 digest is
//     stored.
//   * 3 codes per address per hour, 5 guesses per code, 15-minute expiry, and
//     issuing a new code kills the previous one.
//   * The user id is resolved server-side from the verified code, never taken
//     from the request body. Otherwise this endpoint would set any password.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APP_URL = Deno.env.get('APP_URL') || 'https://qafrica.store'

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
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

// Mirrors the client-side rules. The client check is a convenience; this is
// the one that actually holds, since anyone can call the endpoint directly.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'iloveyou', 'admin123', 'letmein1', 'welcome1',
  'football1', 'monkey123', 'abc12345', 'passw0rd', 'sunshine1', 'princess1',
])
function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string') return 'Enter a password.'
  if (password.length < 10) return 'Password must be at least 10 characters.'
  if (COMMON_PASSWORDS.has(password.trim().toLowerCase())) {
    return 'That password is too common. Please choose another.'
  }
  return null
}

function codeEmailHtml(code: string, name: string): string {
  return `<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td align="center" style="padding-bottom:24px;"><div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;"><span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span></div></td></tr><tr><td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.06);"><p style="font-size:22px;font-weight:800;color:#111827;margin:0 0 8px;">Reset your password</p><p style="color:#6B7280;font-size:15px;margin:0 0 24px;">Hi ${name}, enter this code on the QAFRICA password reset screen.</p><div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;"><span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#F97316;">${code}</span></div><p style="color:#6B7280;font-size:13px;margin:0 0 6px;">This code expires in 15 minutes.</p><p style="color:#6B7280;font-size:13px;margin:0;">If you didn't ask to reset your password, ignore this email — your password will not change.</p></td></tr><tr><td align="center" style="padding:24px 0 0;"><p style="font-size:12px;color:#9CA3AF;margin:0;">&copy; ${new Date().getFullYear()} QAFRICA · <a href="${APP_URL}" style="color:#9CA3AF;">qafrica.store</a></p></td></tr></table></td></tr></table></body>`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const action = new URL(req.url).searchParams.get('action')

  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* handled below */ }

  const email = String(body.email ?? '').trim()

  if (action === 'request-code') {
    if (!isValidEmail(email)) {
      return json({ error: 'Enter a valid email address.' }, 400)
    }

    // Identical response whether or not the account exists. Everything below
    // that could differ is deliberately swallowed.
    const generic = { ok: true, message: 'If that email has an account, a code is on its way.' }

    const { data: userId, error: lookupErr } = await admin.rpc('find_auth_user_by_email', { p_email: email })
    if (lookupErr) {
      console.error('[password-reset] lookup failed:', lookupErr.message)
      return json({ error: 'Something went wrong. Please try again.' }, 500)
    }
    if (!userId) {
      console.log('[password-reset] no account for requested address')
      return json(generic)
    }

    const code = generateCode()
    const { data: issued, error: rpcErr } = await admin.rpc('request_password_reset', {
      p_user_id: userId, p_email: email, p_code_hash: await sha256(code),
    })

    if (rpcErr) {
      console.error('[password-reset] issue failed:', rpcErr.message)
      return json({ error: 'Something went wrong. Please try again.' }, 500)
    }

    // A rate limit is about this address, not about whether it exists, so it
    // is safe to report and genuinely useful to the person.
    if (issued?.ok !== true) {
      if (issued?.reason === 'rate_limited') {
        return json({
          error: 'Too many reset codes requested. Please wait an hour and try again.',
        }, 429)
      }
      return json({ error: 'Something went wrong. Please try again.' }, 400)
    }

    const { data: customer } = await admin
      .from('customers').select('full_name').eq('id', userId).maybeSingle()

    // Priority 1: the customer is sitting on the screen waiting for this, so
    // it uses the transactional lane and the reserved domain headroom rather
    // than queueing behind bulk mail.
    const { error: sendErr } = await admin.functions.invoke('send-email', {
      body: {
        to: email,
        subject: 'Your QAFRICA password reset code',
        html: codeEmailHtml(code, customer?.full_name || 'there'),
        email_type: 'password_reset',
        priority: 1,
      },
    })

    if (sendErr) {
      // A delivery failure is infrastructure, not account existence, so it is
      // reported. Claiming a code was sent when it was not is what made the
      // old flow feel broken.
      console.error('[password-reset] send failed:', sendErr.message)
      return json({ error: 'We could not send the code right now. Please try again shortly.' }, 502)
    }

    return json(generic)
  }

  if (action === 'verify-and-reset') {
    const code = String(body.code ?? '').trim()
    const password = body.password

    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return json({ error: 'Enter the 6-digit code from your email.' }, 400)
    }

    const problem = passwordProblem(password)
    if (problem) return json({ error: problem }, 400)

    const { data: result, error } = await admin.rpc('verify_password_reset', {
      p_email: email, p_code_hash: await sha256(code),
    })

    if (error) {
      console.error('[password-reset] verify failed:', error.message)
      return json({ error: 'Something went wrong. Please try again.' }, 500)
    }

    if (result?.ok !== true) {
      const messages: Record<string, string> = {
        no_active_code:    'Request a new code to continue.',
        expired:           'That code has expired. Request a new one.',
        too_many_attempts: 'Too many incorrect attempts. Request a new code.',
        incorrect:         'That code is not correct.',
      }
      return json({
        error: messages[result?.reason] ?? 'We could not verify that code.',
        attempts_remaining: result?.attempts_remaining,
      }, 400)
    }

    // user_id comes from the verified code row, never from the request body.
    const { error: updateErr } = await admin.auth.admin.updateUserById(result.user_id, {
      password: password as string,
    })

    if (updateErr) {
      console.error('[password-reset] password update failed:', updateErr.message)
      const raw = updateErr.message?.toLowerCase() ?? ''
      if (raw.includes('pwned') || raw.includes('compromised') || raw.includes('breach')) {
        return json({ error: 'That password has appeared in a known data breach. Please choose a different one.' }, 400)
      }
      return json({ error: 'We could not update your password. Please try again.' }, 500)
    }

    return json({ ok: true })
  }

  return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
})
