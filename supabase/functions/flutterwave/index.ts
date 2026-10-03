// flutterwave — store subscription payments through Flutterwave (API v4): bank transfer and card.
//
//   POST ?action=start            signed-in owner starts a bank-transfer payment for a plan. The
//                                 server prices the plan and asks Flutterwave for a one-time bank
//                                 account (dynamic virtual account). Returns account, bank, expiry.
//   POST ?action=start-card       signed-in owner pays for a plan by card. Server encrypts the card
//                                 fields, tokenizes (payment-methods), then charges. May come back
//                                 needing a PIN, an OTP, a 3DS redirect, or an address (AVS) —
//                                 reported as `next_action`, resolved by ?action=card-authorize.
//   POST ?action=card-authorize   signed-in owner submits the PIN/OTP/AVS step next_action asked for.
//   POST ?action=charge-saved-card  signed-in owner charges an already-saved card (manual "renew now",
//                                 or called internally by ?action=auto-renew). recurring:true — no
//                                 PIN/OTP expected, though a card can still force a step; if so the
//                                 payment is parked in 'review' rather than silently stuck.
//   POST ?action=auto-renew       cron only (service-role bearer required). Finds subscriptions
//                                 expiring within the next 2h with auto_renew_method='card' and a
//                                 saved card, charges each, extends on success, backs off and emails
//                                 the owner after repeated failure. Runs well ahead of the existing
//                                 hourly expire_overdue_subscriptions() sweep.
//   POST ?action=remove-card      signed-in owner deactivates a saved card (soft delete). Clears
//                                 auto-renew off any subscription that pointed at it, rather than
//                                 leaving auto-renew silently pointing at a dead card.
//   POST ?action=set-default-card signed-in owner marks one saved card default.
//   POST ?action=status           signed-in owner asks "has it landed yet?" (works for any method).
//   POST ?action=domain-start     signed-in owner starts a bank-transfer payment for a custom domain
//                                 (row in domain_requests, priced here). Admin connects it afterwards.
//   POST ?action=domain-status    signed-in owner asks whether the domain payment has landed.
//   POST ?action=webhook          Flutterwave says a charge completed. Signature checked, then we
//                                 re-fetch the charge from Flutterwave (never trust the body),
//                                 activate, and — for a card charge that asked to be saved — save it.
//
// Activation happens in one place (activate()) and only once per payment, however many of the
// paths reach it. A card is only ever saved to flutterwave_saved_cards AFTER its charge succeeds —
// never before, never on a mere tokenize. Raw card number/cvv are held in memory for one
// encrypt-and-forward request only: never logged, never written to any table.
//
// Secrets: FLW_CLIENT_ID, FLW_CLIENT_SECRET, FLW_SECRET_HASH, FLW_ENCRYPTION_KEY (base64, from the
// Flutterwave dashboard's Settings > API, "Encryption Key" — separate from the client secret).
// Optional: FLW_API_BASE (defaults to live).
//
// Checked against the live account on 28 Sep 2026: bank transfer works (Flutterwave MFB accounts,
// Flutterwave adds its fee on top of the amount); OPay is not enabled on the merchant account.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!
const FLW_ID         = Deno.env.get('FLW_CLIENT_ID') ?? ''
const FLW_SECRET     = Deno.env.get('FLW_CLIENT_SECRET') ?? ''
const FLW_HASH       = Deno.env.get('FLW_SECRET_HASH') ?? ''
const FLW_ENC_KEY_B64 = Deno.env.get('FLW_ENCRYPTION_KEY') ?? ''
const FLW_BASE       = (Deno.env.get('FLW_API_BASE') ?? 'https://f4bexperience.flutterwave.com').replace(/\/+$/, '')
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

// Plan ranks: a payment may renew or upgrade, never silently replace a better plan that is still running.
const RANK: Record<string, number> = { one_niche: 1, three_niches: 2, unlimited: 3 }
const DAY = 24 * 60 * 60 * 1000
type ActivePlan = { tier: string; expires_at: string; duration_months: number | null }
async function runningPlans(userId: string, storeId: string | null): Promise<ActivePlan[]> {
  let q = admin.from('subscriptions').select('tier, expires_at, duration_months')
    .eq('user_id', userId).eq('is_active', true).eq('is_trial', false).gt('expires_at', new Date().toISOString())
  q = storeId ? q.or(`store_id.eq.${storeId},store_id.is.null`) : q.is('store_id', null)
  const { data } = await q
  return (data ?? []) as ActivePlan[]
}
const isLifetimePlan = (p: ActivePlan) => Date.parse(p.expires_at) > Date.now() + 50 * 365 * DAY
const tierName = (t: string) => ({ one_niche: 'Starter', three_niches: 'Growth', unlimited: 'Enterprise' } as Record<string, string>)[t] ?? t

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

// ── Card field encryption (v4): AES-256-GCM, one shared nonce per request, each field
// encrypted separately. Key comes from the dashboard's "Encryption Key" (base64), decoded
// once. Never logged, never persisted — used only to encrypt-and-forward in this one request.
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function bytesToB64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}
const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
function randomNonce(len = 12): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => NONCE_CHARS[b % NONCE_CHARS.length]).join('')
}
let cachedEncKey: CryptoKey | null = null
async function encryptionKey(): Promise<CryptoKey> {
  if (cachedEncKey) return cachedEncKey
  if (!FLW_ENC_KEY_B64) throw new Error('Card payments are not set up yet (missing encryption key). Contact support.')
  const raw = b64ToBytes(FLW_ENC_KEY_B64)
  cachedEncKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt'])
  return cachedEncKey
}
// One field, AES-256-GCM, IV = the 12-byte nonce (shared across all fields in one request,
// per Flutterwave's v4 spec). Output: base64(ciphertext || 16-byte auth tag), as Web Crypto
// returns them concatenated already.
async function encryptField(value: string, nonce: string): Promise<string> {
  const key = await encryptionKey()
  const iv = new TextEncoder().encode(nonce) // 12 chars -> 12 bytes, the standard AES-GCM IV size
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
  return bytesToB64(ct)
}
type RawCard = { number: string; cvv: string; expiry_month: string; expiry_year: string }
async function encryptCard(card: RawCard): Promise<{ nonce: string; encrypted_card_number: string; encrypted_cvv: string; encrypted_expiry_month: string; encrypted_expiry_year: string }> {
  const nonce = randomNonce(12)
  const [encrypted_card_number, encrypted_cvv, encrypted_expiry_month, encrypted_expiry_year] = await Promise.all([
    encryptField(card.number.replace(/\s+/g, ''), nonce),
    encryptField(card.cvv, nonce),
    encryptField(card.expiry_month, nonce),
    encryptField(card.expiry_year, nonce),
  ])
  return { nonce, encrypted_card_number, encrypted_cvv, encrypted_expiry_month, encrypted_expiry_year }
}

// ── Tokenize a card (POST /payment-methods): returns a payment_method_id (pmd_...) plus
// safe-to-store card metadata. Does NOT charge anything and does NOT touch our DB — the
// caller decides when (if ever) to persist it, and only after a real charge succeeds.
type TokenizedCard = { paymentMethodId: string; last4: string; first6: string | null; network: string | null; expMonth: number; expYear: number }
async function tokenizeCard(card: RawCard, agreementId: string): Promise<TokenizedCard> {
  const enc = await encryptCard(card)
  const r = await flw('POST', '/payment-methods', {
    type: 'card',
    card: {
      encrypted_card_number: enc.encrypted_card_number,
      encrypted_expiry_month: enc.encrypted_expiry_month,
      encrypted_expiry_year: enc.encrypted_expiry_year,
      encrypted_cvv: enc.encrypted_cvv,
      nonce: enc.nonce,
      cof: { enabled: true, agreement_id: agreementId },
    },
  })
  const d = r.data?.data as Record<string, unknown> | undefined
  if (!r.ok || !d?.id) {
    console.error('[flutterwave] tokenize failed', r.status, JSON.stringify(r.data).slice(0, 300))
    throw new Error(flwError(r.data))
  }
  const cardMeta = (d.card ?? {}) as Record<string, unknown>
  return {
    paymentMethodId: String(d.id),
    last4: String(cardMeta.last4 ?? '0000'),
    first6: cardMeta.first6 ? String(cardMeta.first6) : null,
    network: cardMeta.network ? String(cardMeta.network) : null,
    expMonth: Number(cardMeta.expiry_month ?? 0),
    expYear: Number(cardMeta.expiry_year ?? 0),
  }
}

// ── Charge a tokenized card. `recurring: true` for an auto-renewal (no cardholder present) —
// most issuers waive PIN/OTP on these once an initial cardholder-present charge succeeded;
// if one still asks for a step, the caller must treat it as needing manual attention, not retry blindly.
async function chargeCard(opts: { reference: string; customerId: string; paymentMethodId: string; amount: number; currency?: string; recurring: boolean; redirectUrl?: string }) {
  return flw('POST', '/charges', {
    reference: opts.reference,
    currency: opts.currency ?? 'NGN',
    amount: opts.amount,
    customer_id: opts.customerId,
    payment_method_id: opts.paymentMethodId,
    recurring: opts.recurring,
    redirect_url: opts.redirectUrl ?? 'https://qafrica.store/dashboard/subscription',
  }, opts.reference)
}
// PIN / OTP / AVS follow-up on an existing charge (PUT /charges/{id}).
async function authorizeCharge(chargeId: string, authorization: Record<string, unknown>) {
  return flw('PUT', `/charges/${encodeURIComponent(chargeId)}`, { authorization })
}

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
  method?: string; save_card?: boolean; provider_payment_method_id?: string | null; provider_card_meta?: Record<string, unknown> | null
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
      // Renewing or upgrading early: the new months start when the current plan would have ended
      const running = await runningPlans(payment.user_id, payment.store_id)
      const carryFrom = running
        .filter((p) => !isLifetimePlan(p) && (RANK[p.tier] ?? 0) <= (RANK[payment.tier] ?? 0))
        .reduce((max, p) => Math.max(max, Date.parse(p.expires_at)), Date.now())
      const expiresAt = payment.is_lifetime
        ? new Date('2099-12-31T00:00:00Z').toISOString()
        : new Date(carryFrom + months * 30 * DAY).toISOString()
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

    if (payment.method === 'card' && payment.save_card && payment.provider_payment_method_id) {
      await saveCardIfRequested(payment)
    }
    return { ok: true }
  } catch (e) {
    console.error('[flutterwave] activation failed', payment.reference, (e as Error).message)
    await admin.from('subscription_payments').update({
      status: 'review', error: `Activation failed: ${(e as Error).message}`, raw_confirm: charge, updated_at: now(),
    }).eq('id', payment.id)
    return { ok: false, message: 'activation_failed' }
  }
}

// A card is only ever saved AFTER its charge succeeded — never on a bare tokenize. Idempotent
// (unique index on payment_method_id): a webhook and a status-poll racing each other just upserts.
async function saveCardIfRequested(payment: PaymentRow): Promise<void> {
  const meta = (payment.provider_card_meta ?? {}) as Record<string, unknown>
  const pmd = payment.provider_payment_method_id
  if (!pmd || !payment.provider_customer_id) return
  const { data: existing } = await admin.from('flutterwave_saved_cards').select('id')
    .eq('payment_method_id', pmd).maybeSingle()
  if (existing) return
  const { count } = await admin.from('flutterwave_saved_cards')
    .select('*', { count: 'exact', head: true }).eq('user_id', payment.user_id).eq('is_active', true)
  const { error } = await admin.from('flutterwave_saved_cards').insert({
    user_id: payment.user_id,
    provider_customer_id: payment.provider_customer_id,
    payment_method_id: pmd,
    last4: String(meta.last4 ?? '0000'),
    first6: meta.first6 ? String(meta.first6) : null,
    network: meta.network ? String(meta.network) : null,
    exp_month: Number(meta.expMonth ?? meta.exp_month ?? 0),
    exp_year: Number(meta.expYear ?? meta.exp_year ?? 0),
    is_default: (count ?? 0) === 0,
    is_active: true,
  })
  if (error) console.error('[flutterwave] save card failed', payment.reference, error.message)
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

  // Don't sell a lower plan over a better one that is still running
  const running = await runningPlans(userId, store?.id ?? null)
  const better = running.find((p) => (RANK[p.tier] ?? 0) > (RANK[tier] ?? 0) && Date.parse(p.expires_at) > Date.now() + 3 * DAY)
  if (better) {
    const until = isLifetimePlan(better) ? 'for life' : `until ${new Date(better.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    return json({ ok: false, message: `This store is already on ${tierName(better.tier)} ${until}. Choose ${tierName(better.tier)} or a higher plan to renew or upgrade.` }, 409)
  }
  if (running.some((p) => isLifetimePlan(p) && (RANK[p.tier] ?? 0) >= (RANK[tier] ?? 0))) {
    return json({ ok: false, message: 'This store already has lifetime access on this plan or a higher one.' }, 409)
  }

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

      // A custom-domain payment? (matched by our reference)
      let domainRow: DomainRow | null = null
      if (!payment && reference) {
        const res = await admin.from('domain_requests').select('*').eq('payment_reference', reference).maybeSingle()
        domainRow = res.data as DomainRow | null
      }
      if (!payment && !domainRow) {
        const cus = String(charge.customer?.id ?? charge.customer ?? charge.customer_id ?? data.customer?.id ?? '')
        if (cus) {
          const res = await admin.from('subscription_payments').select('*')
            .eq('provider_customer_id', cus).in('status', ['pending', 'failed'])
            .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          payment = res.data
          // The latest open domain payment for this customer, if it is newer than the plan payment
          const dres = await admin.from('domain_requests').select('*')
            .eq('provider_customer_id', cus).eq('payment_provider', 'flutterwave').in('payment_status', ['pending', 'failed'])
            .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (dres.data && (!payment || Date.parse(dres.data.created_at) > Date.parse(payment.created_at))) {
            domainRow = dres.data as DomainRow
            payment = null
          }
        }
      }
      if (domainRow) {
        if (domainRow.payment_status !== 'paid') {
          const res = await activateDomain(domainRow, charge)
          if (!res.ok) processError = res.message ?? 'domain not activated'
        }
      } else if (!payment) processError = 'not a subscription payment'
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

// ── Shared plan resolution (price, store ownership, better-plan-running guard, payer identity) —
// used by both start (bank transfer, above) and start-card, kept as a separate function rather
// than refactoring start() itself, so the working transfer flow is never touched by this change.
type PlanContext = {
  userId: string; tier: string; starterPack: boolean; duration: number | 'lifetime'; durationMonths: number
  price: number; niches: string[]; storeId: string | null; email: string; first: string; last: string
}
async function resolvePlan(req: Request, body: Record<string, unknown>): Promise<{ ctx: PlanContext } | { error: Response }> {
  const userId = await callerId(req)
  if (!userId) return { error: json({ ok: false, message: 'Please sign in again.' }, 401) }
  if (!FLW_ID || !FLW_SECRET) return { error: json({ ok: false, message: 'Payments are not set up yet. Contact support.' }, 500) }

  const tier = String(body.tier ?? '')
  const starterPack = body.starter_pack === true
  const duration: number | 'lifetime' = body.duration === 'lifetime' ? 'lifetime' : Number(body.duration)
  const price = expectedPrice(tier, duration, starterPack)
  if (price === null) return { error: json({ ok: false, message: 'Unknown plan or duration.' }, 400) }
  const niches = Array.isArray(body.niches) ? (body.niches as unknown[]).filter((n) => typeof n === 'string').slice(0, 50) as string[] : []
  const durationMonths = duration === 'lifetime' ? 0 : duration

  const { data: store } = body.store_id
    ? await admin.from('stores').select('id, owner_id, name').eq('id', String(body.store_id)).maybeSingle()
    : await admin.from('stores').select('id, owner_id, name').eq('owner_id', userId).order('created_at').limit(1).maybeSingle()
  if (store && store.owner_id !== userId) return { error: json({ ok: false, message: 'Store not found on your account.' }, 403) }

  const running = await runningPlans(userId, store?.id ?? null)
  const better = running.find((p) => (RANK[p.tier] ?? 0) > (RANK[tier] ?? 0) && Date.parse(p.expires_at) > Date.now() + 3 * DAY)
  if (better) {
    const until = isLifetimePlan(better) ? 'for life' : `until ${new Date(better.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    return { error: json({ ok: false, message: `This store is already on ${tierName(better.tier)} ${until}. Choose ${tierName(better.tier)} or a higher plan to renew or upgrade.` }, 409) }
  }
  if (running.some((p) => isLifetimePlan(p) && (RANK[p.tier] ?? 0) >= (RANK[tier] ?? 0))) {
    return { error: json({ ok: false, message: 'This store already has lifetime access on this plan or a higher one.' }, 409) }
  }

  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const email = authUser?.user?.email ?? profile?.email
  if (!email) return { error: json({ ok: false, message: 'Add an email address to your account first.' }, 400) }
  const nameParts = String(profile?.full_name || store?.name || 'QAFRICA Seller').trim().split(/\s+/)
  const first = (nameParts[0] || 'QAFRICA').slice(0, 50)
  const last = (nameParts.slice(1).join(' ') || 'Seller').slice(0, 50)

  return { ctx: { userId, tier, starterPack, duration, durationMonths, price, niches, storeId: store?.id ?? null, email, first, last } }
}

// ── start-card ────────────────────────────────────────────────────────────────────────
async function startCard(req: Request) {
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const resolved = await resolvePlan(req, body)
  if ('error' in resolved) return resolved.error
  const ctx = resolved.ctx

  const card = body.card as Partial<RawCard> | undefined
  if (!card?.number || !card.cvv || !card.expiry_month || !card.expiry_year) {
    return json({ ok: false, message: 'Card details are incomplete.' }, 400)
  }
  const wantsSave = body.save_card === true

  const reference = `QSUBC${Date.now().toString(36)}${randomId(10)}`.toUpperCase()
  const { data: row, error: rowErr } = await admin.from('subscription_payments').insert({
    user_id: ctx.userId, store_id: ctx.storeId, method: 'card', tier: ctx.tier, duration_months: ctx.durationMonths,
    is_lifetime: ctx.duration === 'lifetime', is_starter_pack: ctx.starterPack, niches: ctx.niches,
    amount: ctx.price, reference, save_card: wantsSave,
  }).select('id').single()
  if (rowErr) {
    console.error('[flutterwave] could not save card payment', rowErr.message)
    return json({ ok: false, message: 'Could not start the payment. Please try again.' }, 500)
  }

  try {
    const cus = await customerId(ctx.email, ctx.first, ctx.last, ctx.userId)
    const tokenized = await tokenizeCard(card as RawCard, `QAFRICA-SUB-${ctx.userId}`)
    const r = await chargeCard({ reference, customerId: cus, paymentMethodId: tokenized.paymentMethodId, amount: ctx.price, recurring: false })
    const chargeData = r.data?.data as Record<string, unknown> | undefined
    if (!r.ok || !chargeData?.id) {
      console.error('[flutterwave] card charge failed', r.status, JSON.stringify(r.data).slice(0, 500))
      await admin.from('subscription_payments').update({
        status: 'failed', provider_customer_id: cus, provider_payment_method_id: tokenized.paymentMethodId,
        provider_card_meta: tokenized, raw_init: r.data, error: flwError(r.data), updated_at: now(),
      }).eq('id', row.id)
      return json({ ok: false, message: `Payment could not start: ${flwError(r.data)}` }, 502)
    }
    await admin.from('subscription_payments').update({
      provider_customer_id: cus, provider_charge_id: String(chargeData.id), provider_payment_method_id: tokenized.paymentMethodId,
      provider_card_meta: tokenized, next_action: chargeData.next_action ?? null, raw_init: r.data, updated_at: now(),
    }).eq('id', row.id)

    if (succeeded(chargeData as Charge)) {
      const { data: payment } = await admin.from('subscription_payments').select('*').eq('id', row.id).single()
      await activate(payment as PaymentRow, chargeData as Charge)
    }
    return json({ ok: true, reference, amount: ctx.price, status: String(chargeData.status ?? 'pending'), next_action: chargeData.next_action ?? null })
  } catch (e) {
    await admin.from('subscription_payments').update({ status: 'failed', error: (e as Error).message, updated_at: now() }).eq('id', row.id)
    return json({ ok: false, message: (e as Error).message }, 502)
  }
}

// ── card-authorize: submit the PIN / OTP / AVS step a card charge asked for ────────────
async function cardAuthorize(req: Request) {
  const userId = await callerId(req)
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const reference = String(body.reference ?? '')
  const type = String(body.type ?? '')

  const { data: payment } = await admin.from('subscription_payments').select('*').eq('reference', reference).maybeSingle()
  if (!payment || payment.user_id !== userId) return json({ ok: false, message: 'Payment not found.' }, 404)
  if (!payment.provider_charge_id) return json({ ok: false, message: 'Nothing to authorize yet.' }, 400)

  let authorization: Record<string, unknown>
  if (type === 'pin') {
    const pinNonce = randomNonce(12)
    authorization = { type: 'pin', pin: { nonce: pinNonce, encrypted_pin: await encryptField(String(body.pin ?? ''), pinNonce) } }
  }
  else if (type === 'otp') authorization = { type: 'otp', otp: { code: String(body.otp ?? '') } }
  else if (type === 'avs') authorization = { type: 'avs', avs: { address: body.address ?? {} } }
  else return json({ ok: false, message: 'Unknown authorization step.' }, 400)

  const r = await authorizeCharge(payment.provider_charge_id, authorization)
  const chargeData = r.data?.data as Record<string, unknown> | undefined
  if (!r.ok || !chargeData) {
    return json({ ok: false, message: flwError(r.data) }, 400)
  }
  await admin.from('subscription_payments').update({ next_action: chargeData.next_action ?? null, raw_confirm: chargeData, updated_at: now() }).eq('id', payment.id)

  if (succeeded(chargeData as Charge)) {
    await activate(payment as PaymentRow, chargeData as Charge)
  }
  return json({ ok: true, status: String(chargeData.status ?? 'pending'), next_action: chargeData.next_action ?? null })
}

// ── Charge a saved card (manual "renew now", and the engine behind auto-renew) ─────────
async function chargeSavedCardInternal(sub: {
  id: string; user_id: string; store_id: string | null; tier: string; niches: string[]; duration_months: number
}, card: { id: string; payment_method_id: string; provider_customer_id: string; is_active: boolean }): Promise<{ ok: boolean; message?: string }> {
  if (!card.is_active) return { ok: false, message: 'card_inactive' }
  const price = expectedPrice(sub.tier, sub.duration_months, false)
  if (price === null) return { ok: false, message: 'unknown_plan' }

  const reference = `QREN${Date.now().toString(36)}${randomId(10)}`.toUpperCase()
  const { data: row, error: rowErr } = await admin.from('subscription_payments').insert({
    user_id: sub.user_id, store_id: sub.store_id, method: 'card', tier: sub.tier, duration_months: sub.duration_months,
    is_lifetime: false, is_starter_pack: false, niches: sub.niches ?? [], amount: price, reference,
    provider_customer_id: card.provider_customer_id, provider_payment_method_id: card.payment_method_id, save_card: false,
  }).select('id').single()
  if (rowErr) return { ok: false, message: `could not create payment row: ${rowErr.message}` }

  try {
    const r = await chargeCard({ reference, customerId: card.provider_customer_id, paymentMethodId: card.payment_method_id, amount: price, recurring: true })
    const chargeData = r.data?.data as Record<string, unknown> | undefined
    if (!r.ok || !chargeData?.id) {
      await admin.from('subscription_payments').update({ status: 'failed', raw_init: r.data, error: flwError(r.data), updated_at: now() }).eq('id', row.id)
      return { ok: false, message: flwError(r.data) }
    }
    await admin.from('subscription_payments').update({
      provider_charge_id: String(chargeData.id), raw_init: r.data, next_action: chargeData.next_action ?? null, updated_at: now(),
    }).eq('id', row.id)

    if (succeeded(chargeData as Charge)) {
      const { data: payment } = await admin.from('subscription_payments').select('*').eq('id', row.id).single()
      const res = await activate(payment as PaymentRow, chargeData as Charge)
      return res
    }
    if (chargeData.next_action) {
      // A recurring charge unexpectedly needs a step (PIN/OTP/3DS) — the card issuer didn't
      // waive it. Park it; auto-renew treats this as a failure and the owner must renew by hand.
      await admin.from('subscription_payments').update({ status: 'review', updated_at: now() }).eq('id', row.id)
      return { ok: false, message: 'requires_manual_authorization' }
    }
    return { ok: false, message: `status: ${String(chargeData.status ?? 'unknown')}` }
  } catch (e) {
    await admin.from('subscription_payments').update({ status: 'failed', error: (e as Error).message, updated_at: now() }).eq('id', row.id)
    return { ok: false, message: (e as Error).message }
  }
}

async function chargeSavedCard(req: Request) {
  const userId = await callerId(req)
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const subscriptionId = String(body.subscription_id ?? '')

  const { data: sub } = await admin.from('subscriptions').select('*').eq('id', subscriptionId).maybeSingle()
  if (!sub || sub.user_id !== userId) return json({ ok: false, message: 'Subscription not found.' }, 404)
  const cardId = String(body.card_id ?? sub.auto_renew_card_id ?? '')
  const { data: card } = await admin.from('flutterwave_saved_cards').select('*').eq('id', cardId).maybeSingle()
  if (!card || card.user_id !== userId) return json({ ok: false, message: 'Card not found.' }, 404)

  const result = await chargeSavedCardInternal(sub, card)
  if (!result.ok) return json({ ok: false, message: result.message }, 400)
  return json({ ok: true })
}

// ── auto-renew: cron only ────────────────────────────────────────────────────────────
function sendAdminBearerOk(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  return !!token && token === SERVICE_ROLE
}
async function notifyOwner(userId: string, subject: string, html: string, text: string, emailType: string) {
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const email = authUser?.user?.email
  if (!email) return
  await admin.functions.invoke('send-email', { body: { to: email, subject, html, text, email_type: emailType } })
}

async function autoRenew(req: Request) {
  if (!sendAdminBearerOk(req)) return json({ ok: false, message: 'Forbidden' }, 403)

  const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const notTooOld = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const retryAfter = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin.from('subscriptions').select('*')
    .eq('is_active', true).eq('auto_renew', true).eq('auto_renew_method', 'card')
    .not('auto_renew_card_id', 'is', null)
    .not('cancel_at_period_end', 'is', true)
    .lte('expires_at', soon).gt('expires_at', notTooOld)
    .lt('auto_renew_fail_count', 3)
    .or(`auto_renew_attempted_at.is.null,auto_renew_attempted_at.lt.${retryAfter}`)
    .limit(50)
  if (error) return json({ ok: false, message: error.message }, 500)

  let renewed = 0, failed = 0
  for (const sub of candidates ?? []) {
    const { data: claimed } = await admin.from('subscriptions')
      .update({ auto_renew_attempted_at: now() }).eq('id', sub.id)
      .or(`auto_renew_attempted_at.is.null,auto_renew_attempted_at.lt.${retryAfter}`)
      .select('id').maybeSingle()
    if (!claimed) continue

    const { data: card } = await admin.from('flutterwave_saved_cards').select('*').eq('id', sub.auto_renew_card_id).maybeSingle()
    if (!card || !card.is_active) {
      await admin.from('subscriptions').update({ auto_renew: false, auto_renew_method: null, auto_renew_last_error: 'no active card on file' }).eq('id', sub.id)
      await notifyOwner(sub.user_id, 'Your QAFRICA plan needs a payment method',
        `<p>Auto-renewal was switched off because the saved card on your ${tierName(sub.tier)} plan is no longer available. Add a card in your dashboard to keep auto-renewal on, or renew manually before it expires.</p>`,
        'Auto-renewal was switched off — the saved card on file is no longer available. Please add a card or renew manually.',
        'subscription_auto_renew_card_missing')
      failed++
      continue
    }

    const result = await chargeSavedCardInternal(sub, card)
    if (result.ok) {
      renewed++
      await admin.from('subscriptions').update({ auto_renew_fail_count: 0, auto_renew_last_error: null }).eq('id', sub.id)
      await notifyOwner(sub.user_id, 'Your QAFRICA plan renewed automatically',
        `<p>Your ${tierName(sub.tier)} plan renewed automatically on the card ending ${card.last4}. No action needed.</p>`,
        `Your ${tierName(sub.tier)} plan renewed automatically on the card ending ${card.last4}.`,
        'subscription_auto_renew_success')
    } else {
      failed++
      const failCount = (sub.auto_renew_fail_count ?? 0) + 1
      const update: Record<string, unknown> = { auto_renew_fail_count: failCount, auto_renew_last_error: result.message ?? 'unknown error' }
      if (failCount >= 3) { update.auto_renew = false; update.auto_renew_method = null }
      await admin.from('subscriptions').update(update).eq('id', sub.id)
      await notifyOwner(sub.user_id, failCount >= 3 ? 'Auto-renewal switched off — action needed' : 'Your card renewal did not go through',
        `<p>We tried to renew your ${tierName(sub.tier)} plan on the card ending ${card.last4} and it did not go through (${result.message ?? 'declined'}).${failCount >= 3 ? ' Auto-renewal has been switched off after repeated attempts — please renew manually or update your card.' : ' We will try again later.'}</p>`,
        `Card renewal failed for your ${tierName(sub.tier)} plan (${result.message ?? 'declined'}).${failCount >= 3 ? ' Auto-renewal is now off.' : ''}`,
        'subscription_auto_renew_failed')
    }
  }
  return json({ ok: true, candidates: (candidates ?? []).length, renewed, failed })
}

// ── card management ──────────────────────────────────────────────────────────────────
async function removeCard(req: Request) {
  const userId = await callerId(req)
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const cardId = String(body.card_id ?? '')

  const { data: card } = await admin.from('flutterwave_saved_cards').select('id, user_id').eq('id', cardId).maybeSingle()
  if (!card || card.user_id !== userId) return json({ ok: false, message: 'Card not found.' }, 404)

  await admin.from('flutterwave_saved_cards').update({ is_active: false, updated_at: now() }).eq('id', cardId)
  await admin.from('subscriptions').update({ auto_renew: false, auto_renew_method: null, auto_renew_card_id: null })
    .eq('auto_renew_card_id', cardId)
  return json({ ok: true })
}

async function setDefaultCard(req: Request) {
  const userId = await callerId(req)
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const cardId = String(body.card_id ?? '')

  const { data: card } = await admin.from('flutterwave_saved_cards').select('id, user_id').eq('id', cardId).eq('is_active', true).maybeSingle()
  if (!card || card.user_id !== userId) return json({ ok: false, message: 'Card not found.' }, 404)

  await admin.from('flutterwave_saved_cards').update({ is_default: false, updated_at: now() }).eq('user_id', userId)
  await admin.from('flutterwave_saved_cards').update({ is_default: true, updated_at: now() }).eq('id', cardId)
  return json({ ok: true })
}

// ── Custom domains ────────────────────────────────────────────────────────────────────
// Same bank-transfer flow as plans, but the row lives in domain_requests. The price is set
// here, never by the browser. Must match DOMAIN_PRICES in src/pages/dashboard/DomainPage.tsx.
const DOMAIN_PRICES = { com: 30000, shop: 12900, store: 12900, otherNew: 12900, connect: 7000 }
function domainPrice(type: 'new' | 'existing', domain: string): number {
  if (type === 'existing') return DOMAIN_PRICES.connect
  const tld = domain.split('.').pop() ?? ''
  if (tld === 'com') return DOMAIN_PRICES.com
  if (tld === 'shop' || tld === 'store') return DOMAIN_PRICES.shop
  return DOMAIN_PRICES.otherNew
}
function cleanDomain(input: string): string {
  return input.toLowerCase().trim().replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/\.$/, '').replace(/^www\./, '')
}
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/
const OPEN_DOMAIN_STATUSES = ['pending', 'processing']

type DomainRow = {
  id: string; user_id: string; store_id: string; domain_name: string; domain_type: string
  status: string; payment_status: string; amount_paid: number; payment_reference: string
  provider_charge_id: string | null; provider_customer_id: string | null; payment_expires_at: string | null
}

async function activateDomain(row: DomainRow, charge: Charge): Promise<{ ok: boolean; message?: string }> {
  if (row.payment_status === 'paid') return { ok: true }
  if (!succeeded(charge)) return { ok: false, message: 'not_paid' }

  const currency = String(charge.currency ?? 'NGN').toUpperCase()
  const paid = Number(charge.amount ?? 0)
  if (currency !== 'NGN' || !(paid + 0.5 >= Number(row.amount_paid))) {
    await admin.from('domain_requests').update({
      payment_status: 'review', provider_charge_id: String(charge.id ?? ''), paid_amount: paid,
      payment_error: `Paid ${paid} ${currency}, domain costs ${row.amount_paid} NGN`, raw_confirm: charge, updated_at: now(),
    }).eq('id', row.id)
    console.error('[flutterwave] domain underpaid', row.payment_reference, paid, currency, row.amount_paid)
    return { ok: false, message: 'underpaid' }
  }

  // Claim it once: a webhook and a status poll can arrive together
  const { data: claimed } = await admin.from('domain_requests').update({
    payment_status: 'paid', status: 'pending', paid_amount: paid, paid_at: now(),
    provider_charge_id: String(charge.id ?? ''), raw_confirm: charge, payment_error: null, updated_at: now(),
  }).eq('id', row.id).in('payment_status', ['pending', 'failed']).select('id').maybeSingle()
  if (!claimed) return { ok: true }

  // Show the domain on the store as pending review (not live until an admin connects it)
  const { data: store } = await admin.from('stores').select('domain_status').eq('id', row.store_id).maybeSingle()
  if (store && store.domain_status !== 'connected') {
    await admin.from('stores').update({ custom_domain: row.domain_name, domain_status: 'pending', domain_paid_amount: Number(row.amount_paid) }).eq('id', row.store_id)
  }

  // Tell the admins (best effort)
  try {
    const { data: admins } = await admin.from('profiles').select('email').eq('role', 'admin')
    const emails = (admins ?? []).map((a: { email?: string }) => a.email).filter(Boolean).slice(0, 5) as string[]
    const html = `<p>A store paid ₦${Number(row.amount_paid).toLocaleString('en-NG')} by Flutterwave to ${row.domain_type === 'new' ? 'register' : 'connect'} <strong>${row.domain_name}</strong>.</p><p>Review it in Admin, Domain requests. Ref ${row.payment_reference}</p>`
    for (const to of emails) {
      await admin.functions.invoke('send-email', { body: { to, subject: `New domain request: ${row.domain_name}`, html } })
    }
  } catch (e) { console.error('[flutterwave] admin domain email failed', (e as Error).message) }
  return { ok: true }
}

async function domainStart(req: Request) {
  const userId = await callerId(req)
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)
  if (!FLW_ID || !FLW_SECRET) return json({ ok: false, message: 'Payments are not set up yet. Contact support.' }, 500)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const type = body.domain_type === 'existing' ? 'existing' : body.domain_type === 'new' ? 'new' : null
  const domain = cleanDomain(String(body.domain ?? ''))
  if (!type) return json({ ok: false, message: 'Choose whether you are buying a new domain or connecting one you own.' }, 400)
  if (!DOMAIN_RE.test(domain)) return json({ ok: false, message: 'Enter a full domain with its ending, like mystore.com.' }, 400)
  if (/qafrica\.store$|netlify\.app$|bolt\.host$/.test(domain)) return json({ ok: false, message: 'That address can’t be used as a custom domain.' }, 400)

  const { data: store } = body.store_id
    ? await admin.from('stores').select('id, owner_id, name, custom_domain, domain_status').eq('id', String(body.store_id)).maybeSingle()
    : await admin.from('stores').select('id, owner_id, name, custom_domain, domain_status').eq('owner_id', userId).order('created_at').limit(1).maybeSingle()
  if (!store || store.owner_id !== userId) return json({ ok: false, message: 'Store not found on your account.' }, 403)

  if (store.domain_status === 'connected') return json({ ok: false, message: `Your store is already live on ${store.custom_domain}. Contact support to change it.` }, 409)
  const { data: open } = await admin.from('domain_requests').select('domain_name, status')
    .eq('store_id', store.id).eq('payment_status', 'paid').in('status', OPEN_DOMAIN_STATUSES).limit(1).maybeSingle()
  if (open) return json({ ok: false, message: `You already have a paid request for ${open.domain_name} being reviewed.` }, 409)

  const { data: taken } = await admin.from('stores').select('id').ilike('custom_domain', domain)
    .eq('domain_status', 'connected').neq('id', store.id).limit(1).maybeSingle()
  if (taken) return json({ ok: false, message: `${domain} is already in use by another store.` }, 409)

  const price = domainPrice(type, domain)

  // Same domain asked again while its account is still open: show the same account
  const { data: recent } = await admin.from('domain_requests')
    .select('payment_reference, amount_paid, payment_account, payment_expires_at')
    .eq('store_id', store.id).eq('domain_name', domain).eq('domain_type', type)
    .eq('status', 'awaiting_payment').eq('payment_status', 'pending')
    .gt('payment_expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const recentAccount = recent ? toAccount(recent.payment_account as Record<string, unknown>, Number(recent.amount_paid)) : null
  if (recent && recentAccount) {
    return json({ ok: true, reference: recent.payment_reference, amount: Number(recent.amount_paid), account: recentAccount, reused: true })
  }

  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const email = authUser?.user?.email ?? profile?.email
  if (!email) return json({ ok: false, message: 'Add an email address to your account first.' }, 400)
  const nameParts = String(profile?.full_name || store.name || 'QAFRICA Seller').trim().split(/\s+/)
  const first = (nameParts[0] || 'QAFRICA').slice(0, 50)
  const last = (nameParts.slice(1).join(' ') || 'Seller').slice(0, 50)

  const reference = `QDOM${Date.now().toString(36)}${randomId(10)}`.toUpperCase()
  const { data: row, error: rowErr } = await admin.from('domain_requests').insert({
    store_id: store.id, user_id: userId, domain_name: domain, domain_type: type,
    status: 'awaiting_payment', payment_status: 'pending', payment_provider: 'flutterwave',
    amount_paid: price, payment_reference: reference, requested_at: now(),
  }).select('id').single()
  if (rowErr) {
    console.error('[flutterwave] could not save domain request', rowErr.message)
    return json({ ok: false, message: 'Could not start the payment. Please try again.' }, 500)
  }

  try {
    const cus = await customerId(email, first, last, userId)
    const r = await flw('POST', '/virtual-accounts', {
      reference, customer_id: cus, amount: price, currency: 'NGN',
      account_type: 'dynamic', expiry: ACCOUNT_MINUTES * 60, narration: 'QAFRICA DOMAIN',
    }, reference)
    const va = r.data?.data as Record<string, unknown> | undefined
    const account = toAccount(va ?? null, price)
    if (!r.ok || !account) {
      console.error('[flutterwave] domain account failed', r.status, JSON.stringify(r.data).slice(0, 500))
      await admin.from('domain_requests').update({ status: 'failed', payment_status: 'failed', provider_customer_id: cus, payment_error: flwError(r.data), updated_at: now() }).eq('id', row.id)
      return json({ ok: false, message: `Payment could not start: ${flwError(r.data)}` }, 502)
    }
    await admin.from('domain_requests').update({
      provider_customer_id: cus, payment_account: va,
      payment_expires_at: account.expires_at ?? new Date(Date.now() + ACCOUNT_MINUTES * 60 * 1000).toISOString(), updated_at: now(),
    }).eq('id', row.id)
    return json({ ok: true, reference, amount: price, account })
  } catch (e) {
    await admin.from('domain_requests').update({ status: 'failed', payment_status: 'failed', payment_error: (e as Error).message, updated_at: now() }).eq('id', row.id)
    return json({ ok: false, message: (e as Error).message }, 502)
  }
}

async function domainStatus(req: Request) {
  const userId = await callerId(req)
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const reference = String(body.reference ?? '')

  const { data: row } = await admin.from('domain_requests').select('*').eq('payment_reference', reference).maybeSingle()
  if (!row || row.user_id !== userId) return json({ ok: false, message: 'Payment not found.' }, 404)

  if (row.payment_provider === 'flutterwave' && ['pending', 'failed'].includes(row.payment_status)) {
    const charge = row.provider_charge_id
      ? await chargeById(row.provider_charge_id)
      : (await chargesByReference(row.payment_reference)).find(succeeded) ?? null
    if (charge && succeeded(charge)) await activateDomain(row as DomainRow, charge)
  }

  const { data: p } = await admin.from('domain_requests').select('status, payment_status, payment_expires_at').eq('id', row.id).single()
  const expired = p?.payment_status === 'pending' && p.payment_expires_at && Date.parse(p.payment_expires_at) < Date.now()
  const status = p?.payment_status === 'paid' ? 'paid' : expired ? 'expired' : p?.payment_status
  return json({ ok: true, reference, status, paid: p?.payment_status === 'paid', request_status: p?.status })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const action = new URL(req.url).searchParams.get('action')
  try {
    if (action === 'start') return await start(req)
    if (action === 'start-card') return await startCard(req)
    if (action === 'card-authorize') return await cardAuthorize(req)
    if (action === 'charge-saved-card') return await chargeSavedCard(req)
    if (action === 'auto-renew') return await autoRenew(req)
    if (action === 'remove-card') return await removeCard(req)
    if (action === 'set-default-card') return await setDefaultCard(req)
    if (action === 'status') return await status(req)
    if (action === 'domain-start') return await domainStart(req)
    if (action === 'domain-status') return await domainStatus(req)
    if (action === 'webhook') return await webhook(req)
    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('[flutterwave] error', (e as Error).message)
    return json({ ok: false, message: (e as Error).message }, 500)
  }
})
