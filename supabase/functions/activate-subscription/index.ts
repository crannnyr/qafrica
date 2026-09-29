// activate-subscription
//
// The ONLY way a paid store subscription is created. Replaces the browser inserting its own
// subscription row after Paystack (the old verifyPayment() was a stub that always said "paid",
// and the plan/amount came from sessionStorage).
//
// 1. Caller identity from the access token (never from the body).
// 2. Paystack confirms the transaction: success, NGN, and the reference isn't already used.
// 3. The plan and duration come from the transaction metadata that was set when the payment
//    started; the amount Paystack actually collected must cover that plan's server-side price.
// 4. Subscription is written with the service role; the store must belong to the caller.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const PAYSTACK_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Server-side price list (₦). Must match src/pages/auth/Pricing/constants.ts.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // 1. Who is calling
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ ok: false, message: 'Please sign in again.' }, 401)
  const scoped = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: auth } = await scoped.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) return json({ ok: false, message: 'Please sign in again.' }, 401)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const reference = String(body.reference ?? '').trim()
  if (!/^[A-Za-z0-9_\-.]{6,100}$/.test(reference)) return json({ ok: false, message: 'Missing payment reference.' }, 400)

  // Already activated (e.g. retry, or the webhook got there first)
  const { data: existing } = await admin.from('subscriptions').select('id, user_id, tier, expires_at').eq('payment_reference', reference).maybeSingle()
  if (existing) {
    if (existing.user_id !== userId) return json({ ok: false, message: 'This payment belongs to another account.' }, 409)
    return json({ ok: true, already_processed: true, subscription: existing })
  }

  // 2. Ask Paystack
  if (!PAYSTACK_KEY) return json({ ok: false, message: 'Payments are not configured. Contact support.' }, 500)
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_KEY}` },
  })
  const verify = await res.json().catch(() => null)
  const tx = verify?.data
  if (!res.ok || !verify?.status || tx?.status !== 'success') {
    return json({ ok: false, message: 'We could not confirm this payment. If you were charged, contact support with your reference.' }, 402)
  }
  if (tx.currency !== 'NGN') return json({ ok: false, message: 'Unsupported currency.' }, 400)

  // 3. What was bought, and was it paid for in full
  const meta = (typeof tx.metadata === 'string' ? JSON.parse(tx.metadata || '{}') : tx.metadata) ?? {}
  const tier = String(meta.plan ?? '')
  const isLifetime = meta.is_lifetime === true || meta.duration === 'lifetime'
  const duration: number | 'lifetime' = isLifetime ? 'lifetime' : Number(meta.duration)
  const starterPack = meta.is_starter_pack === true
  const price = expectedPrice(tier, duration, starterPack)
  if (price === null) return json({ ok: false, message: 'Unknown plan on this payment. Contact support.' }, 400)
  const paidNaira = Number(tx.amount) / 100
  if (paidNaira + 0.5 < price) {
    console.error('[activate-subscription] underpaid', { reference, tier, duration, paidNaira, price })
    return json({ ok: false, message: 'The amount paid does not match this plan. Contact support.' }, 402)
  }

  // 4. The store must be the caller's
  const { data: store } = meta.store_id
    ? await admin.from('stores').select('id, owner_id').eq('id', String(meta.store_id)).maybeSingle()
    : await admin.from('stores').select('id, owner_id').eq('owner_id', userId).order('created_at').limit(1).maybeSingle()
  if (!store || store.owner_id !== userId) return json({ ok: false, message: 'Store not found on your account.' }, 403)

  const niches = Array.isArray(meta.niches) ? meta.niches.filter((n: unknown) => typeof n === 'string').slice(0, 50) : []
  const months = isLifetime ? 0 : (duration as number)
  const expiresAt = isLifetime
    ? new Date('2099-12-31T00:00:00Z').toISOString()
    : new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: sub, error: subErr } = await admin.from('subscriptions').insert({
    user_id: userId,
    store_id: store.id,
    tier,
    niches,
    duration_months: months,
    amount_paid: paidNaira,
    payment_reference: reference,
    starts_at: new Date().toISOString(),
    expires_at: expiresAt,
    is_active: true,
    is_trial: false,
    auto_renew: false,
    cancel_at_period_end: false,
    paystack_authorization_code: tx.authorization?.reusable ? tx.authorization.authorization_code : null,
  }).select('id, tier, expires_at').single()
  if (subErr) {
    // A unique/duplicate reference means a parallel call won; treat as done.
    if (String(subErr.message).toLowerCase().includes('duplicate')) return json({ ok: true, already_processed: true })
    console.error('[activate-subscription] insert failed', subErr.message)
    return json({ ok: false, message: 'Payment confirmed but activation failed. Contact support with your reference.' }, 500)
  }

  await admin.from('stores').update({ is_active: true, ...(niches.length ? { niches } : {}) }).eq('id', store.id)

  return json({ ok: true, subscription: sub })
})
