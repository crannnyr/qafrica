// flutterwave — store subscription payments through Flutterwave (API v4), by bank transfer.
//
//   POST ?action=start    signed-in owner starts a payment for a plan. The server prices the plan
//                         and asks Flutterwave for a one-time bank account (dynamic virtual account)
//                         for exactly that amount. Returns the account number, bank and expiry.
//   POST ?action=status   signed-in owner asks "has it landed yet?". We look the charge up at
//                         Flutterwave and, if it succeeded for the full amount, activate the plan.
//   POST ?action=webhook  Flutterwave says a charge completed. Signature checked, then we re-fetch
//                         the charge from Flutterwave (never trust the body) and activate.
//
// Activation happens in one place (activate()) and only once per payment, however many of the
// three paths reach it. Secrets: FLW_CLIENT_ID, FLW_CLIENT_SECRET, FLW_SECRET_HASH.
// Optional: FLW_API_BASE (defaults to live).
//
// Checked against the live account on 28 Sep 2026: bank transfer works (Flutterwave MFB accounts,
// Flutterwave adds its fee on top of the amount); OPay is not enabled on the merchant account.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const FLW_ID       = Deno.env.get('FLW_CLIENT_ID') ?? ''
const FLW_SECRET   = Deno.env.get('FLW_CLIENT_SECRET') ?? ''
const FLW_HASH     = Deno.env.get('FLW_SECRET_HASH') ?? ''
const FLW_BASE     = (Deno.env.get('FLW_API_BASE') ?? 'https://f4bexperience.flutterwave.com').replace(/\/+$/, '')
const ACCOUNT_MINUTES = 60
const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const now = () => new Date().toISOString()

// ── Prices (₦). Must match src/pages/auth/Pricing/constants.ts ────────────────────────
const MONTHLY: Record<string, number> = { one_niche: 5000, three_niches: 10000, unlimited: 100000 }
const MULTIPLIER: Record<number, number> = { 1: 1, 3: 2.7, 6: 5, 12: 9 }
const LIFETIME: Record<string, number> = { one_niche: 2000000, three_niches: 3800000, unlimited: 10000000 }
const STARTER_PACK = { tier: 'one_niche', months: 3, price: 5000 }

function expectedPrice(tier: string, duration: number | 'lifetime', starterPack: boolean): number | null {
  if (starterPack) return tier === STARTER_PACK.tier && duration === STARTER_PACK.months ? STARTER_PACK.price : null
  if (duration === 'lifetime') return LIFETIME[tier] ?? null
  const base = MONTHLY[tier]
  const mult = MULTIPLIER[duration]
  return base && mult ? Math.round(base * mult) : null
}

// ── Flutterwave API ───────────────────────────────────────────────────────────────────
let cachedToken: { value: string; until: number } | null = null
async function flwToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.until) return cachedToken.value
  const res = await fetch('https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: FLW_ID, client_secret: FLW_SECRET, grant_type: 'client_credentials' }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    console.error('[flutterwave] token failed', res.status, JSON.stringify(data).slice(0, 300))
    throw new Error('Could not reach Flutterwave. Please try again in a minute.')
  }
  cachedToken = { value: data.access_token, until: Date.now() + (Number(data.expires_in ?? 600) - 60) * 1000 }
  return cachedToken.value
}

const randomId = (len = 24) =>
  Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')

// deno-lint-ignore no-explicit-any
async function flw(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<{ ok: boolean; status: number; data: any }> {
  const token = await flwToken()
  const res = await fetch(`${FLW_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Trace-Id': randomId(20),
      ...(method !== 'GET' ? { 'X-Idempotency-Key': idempotencyKey ?? randomId(24) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}
const flwError = (d: { error?: { message?: string }; message?: string } | null) =>
  String(d?.error?.message ?? d?.message ?? 'Flutterwave did not accept the request.')

// A Flutterwave customer per email (created once, found by search afterwards)
async function customerId(email: string, first: string, last: string, userId: string): Promise<string> {
  const { data: prev } = await admin.from('subscription_payments').select('provider_customer_id')
    .eq('user_id', userId).not('provider_customer_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (prev?.provider_customer_id) return prev.provider_customer_id
  const created = await flw('POST', '/customers', { email, name: { first, last } })
  if (created.ok && created.data?.data?.id) return created.data.data.id
  const found = await flw('POST', '/customers/search', { email })
  const match = Array.isArray(found.data?.data) ? found.data.data.find((c: { email?: string }) => c.email?.toLowerCase() === email.toLowerCase()) : null
  if (match?.id) return match.id
  console.error('[flutterwave] customer failed', created.status, JSON.stringify(created.data).slice(0, 300))
  throw new Error(flwError(created.data))
}

// ── Who is calling ────────────────────────────────────────────────────────────────────
async function callerId(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const scoped = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data } = await scoped.auth.getUser()
  return data?.user?.id ?? null
}

// ── Transfer details shown to the payer ──────────────────────────────────────────────
type Account = { account_number: string; bank_name: string; account_name: string; amount_to_pay: number; expires_at: string | null; note?: string }
function toAccount(va: Record<string, unknown> | null, fallbackAmount: number): Account | null {
  if (!va || !va.account_number) return null
  const note = typeof va.note === 'string' ? va.note : undefined
  const nameFromNote = note?.match(/transfer to (.+)$/i)?.[1]?.trim()
  return {
    account_number: String(va.account_number),
    bank_name: String(va.account_bank_name ?? va.bank_name ?? 'Flutterwave MFB'),
    account_name: nameFromNote ?? 'QAFRICA FLW',
    amount_to_pay: Number(va.amount ?? fallbackAmount),
    expires_at: typeof va.account_expiration_datetime === 'string' ? va.account_expiration_datetime : null,
    note,
  }
}

// ── Activation: once per payment ──────────────────────────────────────────────────────
type PaymentRow = {
  id: string; user_id: string; store_id: string | null; tier: string; duration_months: number
  is_lifetime: boolean; is_starter_pack: boolean; niches: string[]; amount: number; reference: string
  provider_charge_id: string | null; provider_customer_id: string | null; status: string; subscription_id: string | null
}
// deno-lint-ignore no-explicit-any
type Charge = Record<string, any>

const succeeded = (c: Charge) => ['succeeded', 'successful'].includes(String(c.status ?? '').toLowerCase())

async function activate(payment: PaymentRow, charge: Charge): Promise<{ ok: boolean; message?: string }> {
  if (payment.status === 'paid') return { ok: true }
  if (!succeeded(charge)) return { ok: false, message: 'not_paid' }

  const currency = String(charge.currency ?? 'NGN').toUpperCase()
  const paid = Number(charge.amount ?? 0)
  if (currency !== 'NGN' || !(paid + 0.5 >= Number(payment.amount))) {
    // Money arrived but not enough: park it for a human, don't activate.
    await admin.from('subscription_payments').update({
      status: 'review', provider_charge_id: String(charge.id ?? payment.provider_charge_id ?? ''),
      error: `Paid ${paid} ${currency}, plan costs ${payment.amount} NGN`, raw_confirm: charge, updated_at: now(),
    }).eq('id', payment.id)
    console.error('[flutterwave] underpaid', payment.reference, paid, currency, payment.amount)
    return { ok: false, message: 'underpaid' }
  }

  // Claim it, so a webhook and a status check arriving together cannot both activate
  const { data: claimed } = await admin.from('subscription_payments')
    .update({ status: 'activating', provider_charge_id: String(charge.id ?? ''), updated_at: now() })
    .eq('id', payment.id).in('status', ['pending', 'failed', 'review'])
    .select('id').maybeSingle()
  if (!claimed) return { ok: true }

  try {
    const { data: existing } = await admin.from('subscriptions').select('id').eq('payment_reference', payment.reference).maybeSingle()
    let subscriptionId = existing?.id as string | undefined

    if (!subscriptionId) {
      const months = payment.is_lifetime ? 0 : payment.duration_months
      const expiresAt = payment.is_lifetime
        ? new Date('2099-12-31T00:00:00Z').toISOString()
        : new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: sub, error } = await admin.from('subscriptions').insert({
        user_id: payment.user_id,
        store_id: payment.store_id,
        tier: payment.tier,
        niches: payment.niches ?? [],
        duration_months: months,
        amount_paid: Number(payment.amount),
        payment_reference: payment.reference,
        starts_at: now(),
        expires_at: expiresAt,
        is_active: true,
        is_trial: false,
        auto_renew: false,
        cancel_at_period_end: false,
      }).select('id').single()
      if (error) throw new Error(error.message)
      subscriptionId = sub.id
    }

    if (payment.store_id) {
      await admin.from('stores').update({ is_active: true, ...(payment.niches?.length ? { niches: payment.niches } : {}) }).eq('id', payment.store_id)
    }
    await admin.from('profiles').update({ onboarding_completed: true, onboarding_step: 4 }).eq('id', payment.user_id)

    await admin.from('subscription_payments').update({
      status: 'paid', paid_amount: paid, paid_at: now(), subscription_id: subscriptionId,
      raw_confirm: charge, error: null, updated_at: now(),
    }).eq('id', payment.id)
    return { ok: true }
  } catch (e) {
    console.error('[flutterwave] activation failed', payment.reference, (e as Error).message)
    await admin.from('subscription_payments').update({
      status: 'review', error: `Activation failed: ${(e as Error).message}`, raw_confirm: charge, updated_at: now(),
    }).eq('id', payment.id)
    return { ok: false, message: 'activation_failed' }
  }
}

async function chargeById(id: string): Promise<Charge | null> {
  const r = await flw('GET', `/charges/${encodeURIComponent(id)}`)
  if (!r.ok) {
    console.error('[flutterwave] charge lookup failed', id, r.status, JSON.stringify(r.data).slice(0, 300))
    return null
  }
  return (r.data?.data ?? null) as Charge | null
}
async function chargesByReference(reference: string): Promise<Charge[]> {
  const r = await flw('GET', `/charges?reference=${encodeURIComponent(reference)}`)
  return r.ok && Array.isArray(r.data?.data) ? r.data.data : []
}

// ── start ─────────────────────────────────────────────────────────────────────────────
async function start(req: Request) {
  const userId = await callerId(req)
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)
  if (!FLW_ID || !FLW_SECRET) return json({ ok: false, message: 'Payments are not set up yet. Contact support.' }, 500)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const tier = String(body.tier ?? '')
  const starterPack = body.starter_pack === true
  const duration: number | 'lifetime' = body.duration === 'lifetime' ? 'lifetime' : Number(body.duration)
  const price = expectedPrice(tier, duration, starterPack)
  if (price === null) return json({ ok: false, message: 'Unknown plan or duration.' }, 400)
  const niches = Array.isArray(body.niches) ? (body.niches as unknown[]).filter((n) => typeof n === 'string').slice(0, 50) as string[] : []
  const durationMonths = duration === 'lifetime' ? 0 : duration

  // The store must be the caller's
  const { data: store } = body.store_id
    ? await admin.from('stores').select('id, owner_id, name').eq('id', String(body.store_id)).maybeSingle()
    : await admin.from('stores').select('id, owner_id, name').eq('owner_id', userId).order('created_at').limit(1).maybeSingle()
  if (store && store.owner_id !== userId) return json({ ok: false, message: 'Store not found on your account.' }, 403)

  // Same plan asked again while an account is still open: show the same account
  const { data: recent } = await admin.from('subscription_payments')
    .select('reference, amount, next_action, expires_at')
    .eq('user_id', userId).eq('tier', tier).eq('duration_months', durationMonths).eq('is_starter_pack', starterPack)
    .eq('status', 'pending').gt('expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const recentAccount = recent ? toAccount(recent.next_action as Record<string, unknown>, Number(recent.amount)) : null
  if (recent && recentAccount) {
    return json({ ok: true, reference: recent.reference, amount: Number(recent.amount), account: recentAccount, reused: true })
  }

  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const email = authUser?.user?.email ?? profile?.email
  if (!email) return json({ ok: false, message: 'Add an email address to your account first.' }, 400)
  const nameParts = String(profile?.full_name || store?.name || 'QAFRICA Seller').trim().split(/\s+/)
  const first = (nameParts[0] || 'QAFRICA').slice(0, 50)
  const last = (nameParts.slice(1).join(' ') || 'Seller').slice(0, 50)

  const reference = `QSUB${Date.now().toString(36)}${randomId(10)}`.toUpperCase()

  const { data: row, error: rowErr } = await admin.from('subscription_payments').insert({
    user_id: userId, store_id: store?.id ?? null, method: 'bank_transfer', tier, duration_months: durationMonths,
    is_lifetime: duration === 'lifetime', is_starter_pack: starterPack, niches, amount: price, reference,
  }).select('id').single()
  if (rowErr) {
    console.error('[flutterwave] could not save payment', rowErr.message)
    return json({ ok: false, message: 'Could not start the payment. Please try again.' }, 500)
  }

  try {
    const cus = await customerId(email, first, last, userId)
    const r = await flw('POST', '/virtual-accounts', {
      reference, customer_id: cus, amount: price, currency: 'NGN',
      account_type: 'dynamic', expiry: ACCOUNT_MINUTES * 60, narration: 'QAFRICA',
    }, reference)
    const va = r.data?.data as Record<string, unknown> | undefined
    const account = toAccount(va ?? null, price)
    if (!r.ok || !account) {
      console.error('[flutterwave] account failed', r.status, JSON.stringify(r.data).slice(0, 500))
      await admin.from('subscription_payments').update({ status: 'failed', provider_customer_id: cus, raw_init: r.data, error: flwError(r.data), updated_at: now() }).eq('id', row.id)
      return json({ ok: false, message: `Payment could not start: ${flwError(r.data)}` }, 502)
    }
    await admin.from('subscription_payments').update({
      provider_customer_id: cus, next_action: va, raw_init: r.data,
      expires_at: account.expires_at ?? new Date(Date.now() + ACCOUNT_MINUTES * 60 * 1000).toISOString(), updated_at: now(),
    }).eq('id', row.id)
    return json({ ok: true, reference, amount: price, account })
  } catch (e) {
    await admin.from('subscription_payments').update({ status: 'failed', error: (e as Error).message, updated_at: now() }).eq('id', row.id)
    return json({ ok: false, message: (e as Error).message }, 502)
  }
}

// ── status ────────────────────────────────────────────────────────────────────────────
async function status(req: Request) {
  const userId = await callerId(req)
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const reference = String(body.reference ?? '')

  const { data: payment } = await admin.from('subscription_payments').select('*').eq('reference', reference).maybeSingle()
  if (!payment || payment.user_id !== userId) return json({ ok: false, message: 'Payment not found.' }, 404)

  if (!['paid', 'activating'].includes(payment.status)) {
    const charge = payment.provider_charge_id
      ? await chargeById(payment.provider_charge_id)
      : (await chargesByReference(payment.reference)).find(succeeded) ?? null
    if (charge && succeeded(charge)) await activate(payment as PaymentRow, charge)
  }

  const { data: p } = await admin.from('subscription_payments').select('status, subscription_id, expires_at, error').eq('id', payment.id).single()
  const expired = p?.status === 'pending' && p.expires_at && Date.parse(p.expires_at) < Date.now()
  return json({
    ok: true, reference, tier: payment.tier, is_starter_pack: payment.is_starter_pack,
    status: expired ? 'expired' : p?.status, paid: p?.status === 'paid', subscription_id: p?.subscription_id ?? null,
  })
}

// ── webhook ───────────────────────────────────────────────────────────────────────────
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
async function hmacBase64(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function webhook(req: Request) {
  const raw = await req.text()
  const signature = req.headers.get('flutterwave-signature') ?? ''
  const legacyHash = req.headers.get('verif-hash') ?? ''
  let valid = false
  if (FLW_HASH) {
    if (signature) valid = safeEqual(signature, await hmacBase64(FLW_HASH, raw))
    if (!valid && legacyHash) valid = safeEqual(legacyHash, FLW_HASH)
  }

  let payload: Record<string, unknown> = {}
  try { payload = JSON.parse(raw) } catch { /* not json */ }
  const data = (payload.data ?? {}) as Charge
  const eventType = String(payload.type ?? payload.event ?? '')

  const { data: logged } = await admin.from('payment_webhook_events').insert({
    provider: 'flutterwave',
    request_id: String(payload.webhook_id ?? payload.id ?? data.id ?? crypto.randomUUID()),
    event_type: eventType || null,
    signature_valid: valid,
    payload,
    headers: { 'flutterwave-signature': signature ? 'present' : 'absent', 'verif-hash': legacyHash ? 'present' : 'absent' },
  }).select('id').maybeSingle()

  if (!valid) return json({ ok: false }, 401)

  let processError: string | null = null
  try {
    if (!eventType.startsWith('charge.')) {
      processError = 'ignored event'
    } else {
      // Never trust the body: fetch the charge from Flutterwave
      const charge = data.id ? await chargeById(String(data.id)) : null
      if (!charge) throw new Error('charge lookup failed')

      // Match by our reference first; otherwise the latest open payment for this Flutterwave customer
      const reference = String(charge.reference ?? data.reference ?? '')
      let { data: payment } = await admin.from('subscription_payments').select('*').eq('reference', reference).maybeSingle()
      if (!payment) {
        const cus = String(charge.customer?.id ?? charge.customer ?? charge.customer_id ?? data.customer?.id ?? '')
        if (cus) {
          const res = await admin.from('subscription_payments').select('*')
            .eq('provider_customer_id', cus).in('status', ['pending', 'failed'])
            .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          payment = res.data
        }
      }
      if (!payment) processError = 'not a subscription payment'
      else if (payment.status !== 'paid') {
        const res = await activate(payment as PaymentRow, charge)
        if (!res.ok) processError = res.message ?? 'not activated'
      }
    }
  } catch (e) {
    processError = (e as Error).message
  }
  if (logged?.id) {
    await admin.from('payment_webhook_events').update({ processed_at: now(), process_error: processError }).eq('id', logged.id)
  }
  return json({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const action = new URL(req.url).searchParams.get('action')
  try {
    if (action === 'start') return await start(req)
    if (action === 'status') return await status(req)
    if (action === 'webhook') return await webhook(req)
    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('[flutterwave] error', (e as Error).message)
    return json({ ok: false, message: (e as Error).message }, 500)
  }
})
