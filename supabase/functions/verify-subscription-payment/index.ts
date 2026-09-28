// verify-subscription-payment (used by the dashboard Subscription page for renewals/upgrades)
//
// Hardened 2026-09-28:
//   * the caller must be signed in, and can only activate a plan for themselves
//     (user_id in the body must match the access token)
//   * the amount Paystack actually collected (NGN) must cover the server-side price of the
//     requested tier and duration; the stored amount_paid is what was really paid
// Previously the tier, duration and amount were trusted from the request body, so a small
// payment could be recorded as any plan.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Server-side price list (₦). Must match the pricing and subscription pages.
const MONTHLY: Record<string, number> = { one_niche: 5000, three_niches: 10000, unlimited: 100000 }
const MULTIPLIER: Record<number, number> = { 1: 1, 3: 2.7, 6: 5, 12: 9 }
const LIFETIME: Record<string, number> = { one_niche: 2000000, three_niches: 3800000, unlimited: 10000000 }

function expectedPrice(tier: string, months: number, lifetime: boolean): number | null {
  if (lifetime) return LIFETIME[tier] ?? null
  const base = MONTHLY[tier]
  const mult = MULTIPLIER[months]
  return base && mult ? Math.round(base * mult) : null
}

const fail = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      reference,
      user_id,
      tier,
      duration_months,
      is_lifetime,
      auto_renew,
      auto_renew_method,
      requires_authorization
    } = await req.json()

    if (!reference || !user_id || !tier) {
      throw new Error('Missing required fields')
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    // ── WHO IS CALLING ───────────────────────────────────────────────────────
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    const scoped = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: authData } = await scoped.auth.getUser()
    if (!authData?.user || authData.user.id !== user_id) {
      return fail('Please sign in to the account you are paying for.', 401)
    }

    const lifetime = is_lifetime === true || duration_months === 9999
    const months = lifetime ? 9999 : Number(duration_months)
    const price = expectedPrice(String(tier), months, lifetime)
    if (price === null) return fail('Unknown plan or duration.')

    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''

    // ── IDEMPOTENCY GUARD ────────────────────────────────────────────────────
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id')
      .eq('payment_reference', reference)
      .limit(1)
      .maybeSingle()

    if (existingSub) {
      if (existingSub.user_id !== user_id) return fail('This payment belongs to another account.', 409)
      return new Response(
        JSON.stringify({ success: true, subscription: existingSub, already_processed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Step 1: Verify transaction with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!verifyResponse.ok) {
      throw new Error('Failed to verify transaction with Paystack')
    }

    const verifyData = await verifyResponse.json()

    if (!verifyData.status || verifyData.data.status !== 'success') {
      throw new Error('Payment verification failed or transaction not successful')
    }

    const transactionData = verifyData.data

    // ── PAID IN FULL? ────────────────────────────────────────────────────────
    if (transactionData.currency !== 'NGN') return fail('Unsupported currency.')
    const paidNaira = Number(transactionData.amount) / 100
    if (paidNaira + 0.5 < price) {
      console.error('[verify-subscription-payment] underpaid', { reference, tier, months, paidNaira, price })
      return fail('The amount paid does not match this plan. Contact support.', 402)
    }

    // Step 2: Check if this payment requires card authorization (for auto-renewal)
    if (requires_authorization && auto_renew && !lifetime) {
      if (!transactionData.authorization || transactionData.authorization.channel !== 'card') {
        try {
          const refundResponse = await fetch('https://api.paystack.co/refund', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ transaction: transactionData.id }),
          })
          if (!refundResponse.ok) {
            console.error('Refund failed:', await refundResponse.text())
          }
        } catch (refundErr) {
          console.error('Refund error:', refundErr)
        }

        return fail('Auto-renewal requires card payment. Your payment has been refunded. Please try again and pay with Card only.')
      }

      if (transactionData.authorization.reusable) {
        const { data: existingCard } = await supabaseAdmin
          .from('saved_cards')
          .select('id')
          .eq('user_id', user_id)
          .eq('last4', transactionData.authorization.last4)
          .eq('is_active', true)
          .maybeSingle()

        if (!existingCard) {
          await supabaseAdmin
            .from('saved_cards')
            .insert({
              user_id,
              paystack_authorization_code: transactionData.authorization.authorization_code,
              last4: transactionData.authorization.last4,
              brand: transactionData.authorization.brand || 'card',
              exp_month: transactionData.authorization.exp_month.toString(),
              exp_year: transactionData.authorization.exp_year.toString(),
              is_default: true,
              is_active: true,
            })
        }
      }
    }

    // Get user's store
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('owner_id', user_id)
      .order('created_at')
      .limit(1)
      .maybeSingle()

    if (storeError) {
      console.error('Store fetch error:', storeError)
    }

    const store_id = store?.id || null

    const starts_at = new Date().toISOString()
    let expires_at: string
    if (lifetime) {
      const date = new Date()
      date.setFullYear(date.getFullYear() + 100)
      expires_at = date.toISOString()
    } else {
      const date = new Date()
      date.setMonth(date.getMonth() + months)
      expires_at = date.toISOString()
    }

    // The database trigger `deactivate_old_subscriptions` switches off older plans on INSERT.
    const subscriptionData: Record<string, unknown> = {
      user_id,
      store_id,
      tier,
      niches: [],
      duration_months: months,
      amount_paid: paidNaira,
      is_trial: false,
      starts_at,
      expires_at,
      is_active: true,
      auto_renew: auto_renew || false,
      auto_renew_method: auto_renew ? auto_renew_method : null,
      payment_reference: reference,
      cancel_at_period_end: false,
    }

    if (transactionData.authorization?.authorization_code) {
      subscriptionData.paystack_authorization_code = transactionData.authorization.authorization_code
    }

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single()

    if (subError) {
      console.error('Subscription creation error:', subError)
      throw new Error(`Failed to create subscription: ${subError.message}`)
    }

    await supabaseAdmin
      .from('profiles')
      .update({ onboarding_completed: true, onboarding_step: 4 })
      .eq('id', user_id)

    if (store_id) {
      await supabaseAdmin
        .from('stores')
        .update({ is_active: true })
        .eq('id', store_id)
    }

    return new Response(
      JSON.stringify({ success: true, subscription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error:', error)
    return fail((error as Error).message)
  }
})
