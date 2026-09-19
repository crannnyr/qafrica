/**
 * china-import (v51) — batch lifecycle: ordered -> ordered_and_closed ->
 * shipped_and_closed -> clearance_and_closed -> received. Consolidation and
 * shipping fees are merged into one bill per batch stage; clearance is a
 * second, separate bill at the same stage mechanics. Shipping is never gated
 * on payment; per-order "received" is gated on that customer's clearance bill
 * being paid.
 *
 * v50 (Phase 3): products carry an admin-only 1688 source_url and a ship_only
 * flag. source_url is deliberately absent from the public `products` select —
 * it exposes the supplier and the true landed cost. ship_only forces sea
 * freight at checkout.
 *
 * v51: fixed DASHBOARD_BILLS_URL, which pointed at /dashboard?tab=bills (not
 * a real route) instead of /importations/dashboard.
 *
 * v52: per-item shipping method (each cart item can go flight or sea
 * independently instead of one method for the whole order), address book
 * (import_customer_addresses) and Jumia pickup-station delivery mode.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'

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

const FALLBACK_CNY_TO_USD = 1 / 7.15

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// Admin-only supplier link. Validated as an absolute http(s) URL so a
// malformed paste cannot end up rendered as a link target in the admin UI.
function sanitizeSourceUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

async function getImportPricingSettings(supabase: any) {
  const { data, error } = await supabase
    .from('import_admin_credentials')
    .select('usd_to_ngn_rate, cny_to_usd_rate, sea_rate_ngn_per_cbm, flight_rate_ngn_per_gram, sea_shipping_product_allocation_percent, sea_shipping_customer_percent, air_shipping_credit_enabled')
    .eq('id', 1).single()
  if (error || !data) throw new Error(error?.message ?? 'Pricing settings unavailable')
  return {
    usdToNgn: Number(data.usd_to_ngn_rate),
    cnyToUsd: Number(data.cny_to_usd_rate),
    seaRate: Number(data.sea_rate_ngn_per_cbm),
    airRate: Number(data.flight_rate_ngn_per_gram),
    seaProductPct: Number(data.sea_shipping_product_allocation_percent),
    seaCustomerPct: Number(data.sea_shipping_customer_percent),
    airCreditEnabled: Boolean(data.air_shipping_credit_enabled),
  }
}

function computeImportPricing(
  originalPriceUsd: number,
  markupPercent: number,
  settings: {
    usdToNgn: number
    cnyToUsd: number
    seaRate: number
    airRate: number
    seaProductPct: number
    seaCustomerPct: number
    airCreditEnabled: boolean
  },
  volumeCbm: number,
  weightGrams: number,
) {
  const baseCostNgn = originalPriceUsd * settings.usdToNgn
  const markupAmountNgn = baseCostNgn * (markupPercent / 100)
  const productCostBeforeShipping = baseCostNgn + markupAmountNgn
  const rawSeaShipping = Math.max(volumeCbm, 0) * settings.seaRate
  const seaAllocationNgn = rawSeaShipping * (settings.seaProductPct / 100)
  const seaCustomerNgn = rawSeaShipping * (settings.seaCustomerPct / 100)
  const rawAirShipping = Math.max(weightGrams, 0) * settings.airRate
  const airCustomerNgn = Math.max(rawAirShipping - (settings.airCreditEnabled ? seaAllocationNgn : 0), 0)
  const productPriceNgn = productCostBeforeShipping + seaAllocationNgn
  const productPriceUsd = productPriceNgn / settings.usdToNgn
  const productPriceCny = settings.cnyToUsd > 0 ? productPriceUsd / settings.cnyToUsd : 0

  return {
    baseCostNgn: round2(baseCostNgn),
    markupAmountNgn: round2(markupAmountNgn),
    productCostBeforeShipping: round2(productCostBeforeShipping),
    seaAllocationNgn: round2(seaAllocationNgn),
    seaCustomerNgn: round2(seaCustomerNgn),
    airCustomerNgn: round2(airCustomerNgn),
    productPriceNgn: round2(productPriceNgn),
    productPriceUsd: round2(productPriceUsd),
    productPriceCny: round2(productPriceCny),
  }
}

function generateOrderCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

const ORDER_STATUS_SEQUENCE = ['pending', 'confirmed', 'ordered', 'ordered_and_closed', 'shipped_and_closed', 'clearance_and_closed', 'received']

async function advanceOrderStatus(supabase: any, orderId: string, targetStatus: string) {
  const { data: current } = await supabase.from('china_import_orders').select('status').eq('id', orderId).single()
  if (!current) return
  const curIdx = ORDER_STATUS_SEQUENCE.indexOf(current.status)
  const targetIdx = ORDER_STATUS_SEQUENCE.indexOf(targetStatus)
  if (curIdx !== -1 && targetIdx !== -1 && targetIdx <= curIdx) return
  await supabase.from('china_import_orders').update({ status: targetStatus, updated_at: new Date().toISOString() }).eq('id', orderId)
}

interface VariantGroup {
  id: string
  name: string
  options: string[]
  price_deltas?: Record<string, number>
}

function sanitizeVariants(input: unknown): VariantGroup[] {
  if (!Array.isArray(input)) return []
  const out: VariantGroup[] = []
  for (const g of input) {
    if (!g || typeof g !== 'object') continue
    const name = typeof (g as any).name === 'string' ? (g as any).name.trim() : ''
    const options = Array.isArray((g as any).options)
      ? (g as any).options.filter((o: unknown) => typeof o === 'string' && o.trim().length > 0).map((o: string) => o.trim())
      : []
    if (!name || options.length === 0) continue

    const rawDeltas = (g as any).price_deltas
    let price_deltas: Record<string, number> | undefined
    if (rawDeltas && typeof rawDeltas === 'object') {
      const cleaned: Record<string, number> = {}
      for (const opt of options) {
        const v = Number(rawDeltas[opt])
        if (Number.isFinite(v) && v !== 0) cleaned[opt] = v
      }
      if (Object.keys(cleaned).length > 0) price_deltas = cleaned
    }

    out.push({
      id: typeof (g as any).id === 'string' && (g as any).id ? (g as any).id : crypto.randomUUID(),
      name,
      options,
      ...(price_deltas ? { price_deltas } : {}),
    })
  }
  return out
}

function computeItemPriceNgn(product: { price_ngn: number; variants?: VariantGroup[] }, variantOptions?: Record<string, string> | null): number {
  let price = Number(product.price_ngn ?? 0)
  if (!variantOptions || !product.variants?.length) return price
  for (const group of product.variants) {
    const selected = variantOptions[group.name]
    if (selected == null) continue
    const delta = group.price_deltas?.[selected]
    if (typeof delta === 'number') price += delta
  }
  return round2(price)
}


async function sendOrderConfirmedEmail(supabase: any, order: any) {
  try {
    if (!order?.user_id) return
    const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
    if (!customer?.email) return

    const items = Array.isArray(order.items) ? order.items : []
    const itemsHtml = items.map((i: any) =>
      `<tr>
        <td style="padding:8px 0;color:#374151;font-size:14px;">${i.name}${i.variant_options ? ' — ' + Object.values(i.variant_options).join(', ') : ''} × ${i.quantity}</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;text-align:right;font-weight:600;">₦${Number((i.price_ngn ?? 0) * (i.quantity ?? 1)).toLocaleString()}</td>
      </tr>`
    ).join('')

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
          <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
        </div>
        <h2 style="color:#111827;margin:0 0 8px;">Your order is confirmed! 🎉</h2>
        <p style="color:#6B7280;margin:0 0 20px;">
          Hi ${customer.full_name ?? order.customer_name ?? 'there'}, we've received your payment for order <strong>${order.code}</strong>. We're getting it sourced and moving.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          ${itemsHtml}
          <tr><td colspan="2" style="border-top:1px solid #E5E7EB;padding-top:10px;"></td></tr>
          <tr>
            <td style="padding-top:10px;color:#111827;font-size:14px;font-weight:700;">Total</td>
            <td style="padding-top:10px;color:#F97316;font-size:16px;font-weight:800;text-align:right;">₦${Number(order.total_ngn ?? 0).toLocaleString()}</td>
          </tr>
        </table>
        <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;color:#374151;">
            You can track your order anytime from your dashboard. We'll email you again the moment there's an update.
          </p>
        </div>
        <a href="https://chat.whatsapp.com/DggRK0IeD94F0vyszfhfPW" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
          Join the QAFRICA community →
        </a>
        <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
          Order code: ${order.code}
        </p>
      </div>
    `

    await supabase.functions.invoke('send-email', {
      body: { to: customer.email, subject: `Your QAFRICA order ${order.code} is confirmed 🎉`, html },
    })
  } catch (e) {
    console.warn('[china-import] order confirmation email failed:', e)
  }
}

async function sendToReviewEmail(supabase: any, order: any) {
  try {
    if (!order?.user_id) return
    const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
    if (!customer?.email) return

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
          <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
        </div>
        <h2 style="color:#111827;margin:0 0 8px;">Your order is ready for review ✅</h2>
        <p style="color:#6B7280;margin:0 0 20px;">
          Hi ${customer.full_name ?? order.customer_name ?? 'there'}, the shipping fee for order <strong>${order.code}</strong> has been confirmed — your order is now marked "To Review" on your dashboard.
        </p>
        <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#374151;">
            We'll be in touch with any further updates as your order moves along.
          </p>
        </div>
      </div>
    `
    await supabase.functions.invoke('send-email', {
      body: { to: customer.email, subject: `Your QAFRICA order ${order.code} is ready for review ✅`, html },
    })
  } catch (e) {
    console.warn('[china-import] to_review notification email failed:', e)
  }
}


async function incrementUnitsSold(supabase: any, items: any[]) {
  if (!Array.isArray(items)) return
  for (const item of items) {
    const qty = Number(item?.quantity)
    if (!item?.id || !Number.isFinite(qty) || qty <= 0) continue
    try {
      await supabase.rpc('increment_units_sold', { p_product_id: item.id, p_qty: qty })
    } catch (e) {
      console.warn('[china-import] increment_units_sold failed:', e)
    }
  }
}



const memoryCache = new Map<string, { data: unknown; expires: number }>()

function cacheGet<T>(key: string): T | null {
  const hit = memoryCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) { memoryCache.delete(key); return null }
  return hit.data as T
}
function cacheSet(key: string, data: unknown, ttlMs: number) {
  memoryCache.set(key, { data, expires: Date.now() + ttlMs })
}

function jsonCached(body: unknown, maxAgeSeconds: number) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 4}`,
    },
  })
}

// ── Admin session validation ──────────────────────────────────────────────────────────
async function requireAdmin(supabase: any, token: unknown): Promise<boolean> {
  if (!token || typeof token !== 'string') return false
  const { data, error } = await supabase
    .from('import_admin_sessions')
    .select('token')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !data) return false
  supabase.from('import_admin_sessions').update({ last_used_at: new Date().toISOString() }).eq('token', token).then(() => {})
  return true
}

// ── Image optimization ──────────────────────────────────────────────────────────────────────────────────
const MAX_UPLOAD_WIDTH = 1600
const WEBP_QUALITY = 82

async function optimizeImage(bytes: Uint8Array): Promise<{ bytes: Uint8Array; contentType: string; extension: string }> {
  try {
    const image = await Image.decode(bytes)
    if (image.width > MAX_UPLOAD_WIDTH) {
      const scale = MAX_UPLOAD_WIDTH / image.width
      image.resize(MAX_UPLOAD_WIDTH, Math.round(image.height * scale))
    }
    const encoded = await image.encodeWEBP(WEBP_QUALITY)
    return { bytes: encoded, contentType: 'image/webp', extension: 'webp' }
  } catch (e) {
    console.warn('[china-import] image optimization failed, storing original:', e)
    return { bytes, contentType: 'image/webp', extension: 'webp' }
  }
}

// ── Editable message templates (spec Section 1) ─────────────────────────────────────────
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

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function renderTemplate(template: string, tokens: Record<string, string>): string {
  let out = template
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split(`{{${k}}}`).join(v)
  }
  out = out.replace(/\{\{[a-z_]+\}\}/g, '')
  return out
}

async function getTemplate(supabase: any, key: string) {
  const { data } = await supabase.from('import_message_templates').select('*').eq('key', key).single()
  return data
}

async function sendTemplatedEmail(supabase: any, key: string, to: string, tokens: Record<string, string>): Promise<{ ok: boolean; reason?: string }> {
  const tpl = await getTemplate(supabase, key)
  if (!tpl) return { ok: false, reason: 'template_missing' }
  const subject = renderTemplate(tpl.subject, tokens)
  const html = emailShell(renderTemplate(tpl.body_html, tokens))
  try {
    const res = await supabase.functions.invoke('send-email', {
      body: { to, subject, html, email_type: key, priority: 1 },
    })
    if (res.error) return { ok: false, reason: res.error.message ?? String(res.error) }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? String(e) }
  }
}

async function sendShipmentPaymentDeliveryEstimate(supabase: any, bill: any): Promise<{ ok: boolean; reason?: string }> {
  if (!bill?.id || bill.kind !== 'consolidation_shipping' || bill.status !== 'paid' || !bill.user_id) {
    return { ok: false, reason: 'not_eligible' }
  }

  const { error: initError } = await supabase.rpc('initialize_china_import_delivery_estimate', { p_bill_id: bill.id })
  if (initError) return { ok: false, reason: initError.message }

  const { data: tracked, error: trackedError } = await supabase
    .from('china_import_consolidation_bills')
    .select('id, user_id, order_id, amount_ngn, confirmed_paid_at, delivery_estimate_min_at, delivery_estimate_max_at, delivery_estimate_email_sent_at')
    .eq('id', bill.id)
    .maybeSingle()
  if (trackedError || !tracked) return { ok: false, reason: trackedError?.message ?? 'bill_not_found' }
  if (tracked.delivery_estimate_email_sent_at) return { ok: true }

  const { data: order } = tracked.order_id
    ? await supabase.from('china_import_orders').select('code, shipping_method').eq('id', tracked.order_id).maybeSingle()
    : { data: null }

  const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', tracked.user_id).maybeSingle()
  if (!customer?.email || !tracked.delivery_estimate_min_at || !tracked.delivery_estimate_max_at) {
    return { ok: false, reason: 'missing_customer_or_estimate' }
  }

  const method = order?.shipping_method === 'sea_freight' ? 'Sea Freight' : 'Flight'
  const fmt = new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  })
  const deliveryWindow = `${fmt.format(new Date(tracked.delivery_estimate_min_at))} – ${fmt.format(new Date(tracked.delivery_estimate_max_at))}`

  const sent = await sendTemplatedEmail(supabase, 'shipment_payment_delivery_estimate', customer.email, {
    customer_name: customer.full_name ?? 'there',
    amount_paid: Number(tracked.amount_ngn ?? 0).toLocaleString(),
    order_code: order?.code ?? 'your order',
    shipping_method: method,
    delivery_window: deliveryWindow,
  })
  if (sent.ok) {
    await supabase.from('china_import_consolidation_bills')
      .update({ delivery_estimate_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', bill.id)
      .is('delivery_estimate_email_sent_at', null)
  }
  return sent
}

async function queueTemplatedEmail(supabase: any, key: string, to: string, tokens: Record<string, string>): Promise<boolean> {
  const tpl = await getTemplate(supabase, key)
  if (!tpl) return false
  const subject = renderTemplate(tpl.subject, tokens)
  const html = emailShell(renderTemplate(tpl.body_html, tokens))
  const { error } = await supabase.from('import_notification_queue').insert({ to_email: to, subject, html })
  return !error
}

function lastCallEmail(name: string, dateLabel: string) {
  return {
    subject: 'Last call — order your last set of items now ⏰',
    html: emailShell(`
      <h2 style="color:#111827;margin:0 0 8px;">Last call on this batch ⏰</h2>
      <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
        Hi ${name}, this is your last call for the current batch (open as of <strong>${dateLabel}</strong>).
        We're getting ready to move goods to the consolidation warehouse soon.
      </p>
      <p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
        Order your last set of items now to make sure it ships with this round.
      </p>
      <a href="https://qafrica.store/recommendations" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
        Order now →
      </a>
    `),
  }
}

function personalizeBroadcast(html: string, name: string) {
  return html.split('{{name}}').join(name)
}

// ── Batch lifecycle helpers ──────────────────────────────────────────────────
async function resolveBatchId(supabase: any, batchKey: string): Promise<string | null> {
  const { data: existing } = await supabase.from('import_batches').select('id').eq('opened_at', batchKey).maybeSingle()
  if (existing?.id) return existing.id
  const { data: created, error } = await supabase.from('import_batches').insert({ opened_at: batchKey }).select('id').single()
  if (error || !created) return null
  await supabase.from('china_import_orders').update({ batch_id: created.id }).eq('staged_at', batchKey)
  return created.id
}

const DASHBOARD_BILLS_URL = 'https://qafrica.store/importations/dashboard'

// Line items from close_batch_billing carry shipping_method when they're a
// real order item (even if null, for legacy pre-per-item-shipping orders);
// adjustment lines never carry that key at all -- that's how we tell the
// two apart here. Mirrors the same helper in import-batch-view.
function buildItemsBreakdownHtml(lineItems: any[]): string {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return ''
  const priced = lineItems.filter((l: any) => l && typeof l.amount_ngn === 'number' && l.label)
  const items = priced.filter((l: any) => 'shipping_method' in l)
  const adjustments = priced.filter((l: any) => !('shipping_method' in l))
  if (items.length === 0 && adjustments.length === 0) return ''

  const flight = items.filter((i: any) => i.shipping_method === 'flight')
  const sea = items.filter((i: any) => i.shipping_method === 'sea_freight')
  const other = items.filter((i: any) => i.shipping_method !== 'flight' && i.shipping_method !== 'sea_freight')

  const section = (title: string, rows: any[]) => rows.length === 0 ? '' : `
    <p style="margin:12px 0 4px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">${title}</p>
    <table style="width:100%;border-collapse:collapse;">
      ${rows.map((r: any) => `<tr><td style="padding:4px 0;color:#374151;font-size:13px;">${r.label}</td><td style="padding:4px 0;color:#111827;font-size:13px;text-align:right;">₦${Number(r.amount_ngn).toLocaleString()}</td></tr>`).join('')}
    </table>`

  return `<div style="margin-bottom:16px;">${section('Arriving by air · 20–30 days', flight)}${section('Arriving by sea · 60–90 days', sea)}${section('Items', other)}${section('Adjustments', adjustments)}</div>`
}

// Bills every customer in the batch currently eligible for `kind` (fully
// priced, not already billed, and — for clearance — already shipped) via
// close_batch_billing(p_customer_id=null), and queues an itemized bill
// email for each. Used after a batch-wide default price save, since that
// single save can complete pricing for many customers at once.
async function bulkAutoBillAndNotify(
  supabase: any, batchKey: string, kind: 'consolidation_shipping' | 'clearance',
): Promise<{ billedCount: number; queued: number }> {
  const orderStatusTarget = kind === 'clearance' ? 'clearance_and_closed' : 'ordered_and_closed'
  const timestampColumn = kind === 'clearance' ? 'clearance_closed_at' : 'ordered_closed_at'

  const { data: result, error } = await supabase.rpc('close_batch_billing', {
    p_batch_key: batchKey, p_kind: kind,
    p_order_status_target: orderStatusTarget, p_batch_timestamp_column: timestampColumn,
    p_customer_id: null,
  })
  if (error || result?.error) return { billedCount: 0, queued: 0 } // nobody eligible yet -- not an error condition here

  const templateKey = kind === 'clearance' ? 'clearance_bill' : 'consolidation_shipping_bill'
  let queued = 0
  for (const recip of (result?.recipients ?? [])) {
    const ok = await queueTemplatedEmail(supabase, templateKey, recip.email, {
      customer_name: recip.name ?? 'there',
      amount_due: Number(recip.amount_ngn ?? 0).toLocaleString(),
      pay_link: DASHBOARD_BILLS_URL,
      items_breakdown: buildItemsBreakdownHtml(recip.line_items ?? []),
    })
    if (ok) queued++
  }
  return { billedCount: result?.customers_billed ?? 0, queued }
}

async function fetchAllRows<T>(buildQuery: (from: number, to: number) => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as T[]
    out.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }
  return out
}

async function closeBatchBilling(
  supabase: any,
  batchKey: string,
  billKind: 'consolidation_shipping' | 'clearance',
  orderStatusTarget: string,
  batchTimestampColumn: 'ordered_closed_at' | 'clearance_closed_at',
): Promise<{ error?: string; status?: number; customers_billed?: number; queued?: number; expected_total_ngn?: number }> {
  const { data: existingStatus } = await supabase.from('import_batch_bill_status').select('status').eq('batch_key', batchKey).eq('kind', billKind).maybeSingle()
  if (existingStatus?.status === 'sent') return { error: 'This batch has already been billed and is locked.', status: 409 }

  const { data: itemBills, error: itemErr } = await supabase.from('import_batch_item_bills').select('*').eq('batch_key', batchKey).eq('kind', billKind)
  if (itemErr) return { error: itemErr.message, status: 500 }
  if (!itemBills || itemBills.length === 0) return { error: 'No pricing has been entered for this batch yet.', status: 400 }

  const { data: breakdown, error: breakdownErr } = await supabase.rpc('get_batch_product_breakdown', { p_batch_key: batchKey })
  if (breakdownErr) return { error: breakdownErr.message, status: 500 }

  const priceByProduct = new Map(itemBills.map((b: any) => [b.product_id, Number(b.unit_amount_ngn)]))
  const totalsByCustomer = new Map<string, { customer_id: string; name: string; total: number; lineItems: { label: string; amount_ngn: number }[] }>()
  let expectedTotalNgn = 0
  for (const row of (breakdown ?? [])) {
    const unitPrice = priceByProduct.get(row.product_id)
    if (unitPrice == null || !row.customer_id) continue
    const lineTotal = unitPrice * row.qty
    expectedTotalNgn += lineTotal
    const entry = totalsByCustomer.get(row.customer_id) ?? { customer_id: row.customer_id, name: row.customer_name, total: 0, lineItems: [] }
    entry.total += lineTotal
    entry.lineItems.push({ label: `${row.product_name} × ${row.qty}`, amount_ngn: round2(lineTotal) })
    totalsByCustomer.set(row.customer_id, entry)
  }

  if (totalsByCustomer.size === 0) return { error: 'No matching orders found for the priced items in this batch.', status: 400 }

  const { data: customerEmails } = await supabase.from('customers').select('id, email').in('id', Array.from(totalsByCustomer.keys()))
  const emailMap = new Map((customerEmails ?? []).map((c: any) => [c.id, c.email]))

  const { data: batchOrders } = await supabase.from('china_import_orders').select('id, user_id').eq('staged_at', batchKey)
  const orderIdsByUser = new Map<string, string[]>()
  for (const o of (batchOrders ?? [])) {
    if (!o.user_id) continue
    const list = orderIdsByUser.get(o.user_id) ?? []
    list.push(o.id)
    orderIdsByUser.set(o.user_id, list)
  }

  let queued = 0
  const templateKey = billKind === 'clearance' ? 'clearance_bill' : 'consolidation_shipping_bill'
  const reason = billKind === 'clearance' ? 'Clearance fee (batch)' : 'Consolidation & shipping fee (batch)'
  for (const entry of totalsByCustomer.values()) {
    const orderIdsForCustomer = orderIdsByUser.get(entry.customer_id) ?? []
    const { error: billErr } = await supabase.from('china_import_consolidation_bills').insert({
      user_id: entry.customer_id,
      order_id: orderIdsForCustomer[0] ?? null,
      amount_ngn: round2(entry.total),
      reason,
      kind: billKind,
      line_items: entry.lineItems,
    })
    if (billErr) continue

    const email = emailMap.get(entry.customer_id)
    if (email) {
      const ok = await queueTemplatedEmail(supabase, templateKey, email, {
        customer_name: entry.name ?? 'there',
        amount_due: round2(entry.total).toLocaleString(),
        pay_link: DASHBOARD_BILLS_URL,
      })
      if (ok) queued++
    }
  }

  const allOrderIds = (batchOrders ?? []).map((o: any) => o.id)
  if (allOrderIds.length > 0) {
    await supabase.from('china_import_orders').update({ status: orderStatusTarget, updated_at: new Date().toISOString() }).in('id', allOrderIds)
  }

  const batchId = await resolveBatchId(supabase, batchKey)
  if (batchId) {
    await supabase.from('import_batches').update({ [batchTimestampColumn]: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', batchId)
  }

  await supabase.from('import_batch_bill_status').upsert({
    batch_key: batchKey, kind: billKind, status: 'sent',
    sent_at: new Date().toISOString(),
    recipients_count: totalsByCustomer.size,
  }, { onConflict: 'batch_key,kind' })

  return { customers_billed: totalsByCustomer.size, queued, expected_total_ngn: round2(expectedTotalNgn) }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    if (req.method === 'GET' && action === 'products') {
      const cached = cacheGet<unknown[]>('products')
      if (cached) return jsonCached({ products: cached }, 30)

      // NOTE: source_url is deliberately NOT selected here. It is the 1688
      // supplier link, which exposes both the supplier and the true landed
      // cost. ship_only IS exposed, because the storefront needs it to show
      // the badge and force sea freight at checkout.
      const { data, error } = await supabase
        .from('china_import_products')
        .select('id, name, description, image_url, image_urls, price_cny, price_ngn, price_usd, category, moq, has_variants, variants, delivery_time, ship_only, volume_cbm, weight_grams, sea_shipping_cost_ngn, flight_shipping_cost_ngn, sort_order, units_sold, is_trending, trending_order, created_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) return json({ error: error.message, products: [] }, 500)
      cacheSet('products', data ?? [], 30_000)
      return jsonCached({ products: data ?? [] }, 30)
    }

    if (req.method === 'POST' && action === 'track-order') {
      const { code } = await req.json().catch(() => ({}))
      if (!code || typeof code !== 'string' || !code.trim()) return json({ error: 'Missing order code' }, 400)

      const { data: order, error } = await supabase
        .from('china_import_orders')
        .select('id, code, status, shipping_method, shipped_at, received_at, created_at, items, delivery_mode, pickup_station_name, pickup_station_address')
        .eq('code', code.trim().toUpperCase())
        .maybeSingle()
      if (error) return json({ error: error.message }, 500)
      if (!order) return json({ error: "No order found with that code. Double-check and try again." }, 404)

      // The consolidation/shipping bill is the source of truth for the
      // customer-facing warehouse milestone. Any active bill means the order
      // has entered the billing/warehouse stage; cancelled bills do not.
      const { data: consolidationBill, error: billError } = await supabase
        .from('china_import_consolidation_bills')
        .select('id, status')
        .eq('order_id', order.id)
        .eq('kind', 'consolidation_shipping')
        .not('status', 'eq', 'cancelled')
        .maybeSingle()
      if (billError) return json({ error: billError.message }, 500)

      return json({
        order: {
          ...order,
          consolidation_billed: !!consolidationBill,
          consolidation_bill_status: consolidationBill?.status ?? null,
        },
      })
    }

    if (req.method === 'POST' && action === 'admin-products') {
      const { manager_token } = await req.json().catch(() => ({}))
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      // Admin is the only surface that sees source_url.
      const { data, error } = await supabase
        .from('china_import_products')
        .select('id, name, description, image_url, image_urls, price_cny, price_cny_original, price_ngn, price_usd, cost_ngn, price_input_currency, price_input_amount, category, parent_category, category_id, subcategory_id, markup_percent, markup_amount_ngn, original_price_usd, usd_to_ngn_rate, sea_shipping_allocation_ngn, sea_shipping_customer_ngn, air_shipping_customer_ngn, volume_cbm, weight_grams, sea_shipping_cost_ngn, flight_shipping_cost_ngn, is_active, moq, has_variants, variants, delivery_time, source_url, ship_only, sort_order, units_sold, is_trending, trending_order, trending_source, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) return json({ error: error.message, products: [] }, 500)
      return json({ products: data ?? [] })
    }

    if (req.method === 'GET' && action === 'rates') {
      const settings = await getImportPricingSettings(supabase)
      return json({ rates: { usdToNgn: settings.usdToNgn, cnyToUsd: settings.cnyToUsd } })
    }

    if (req.method === 'POST' && action === 'generate-code') {
      const body = await req.json()
      const { customer_name, customer_whatsapp, delivery_type, items } = body

      if (!customer_name || !customer_whatsapp) return json({ error: 'Missing customer_name or customer_whatsapp' }, 400)
      if (!delivery_type || !['to_qafrica', 'to_me'].includes(delivery_type)) return json({ error: 'Invalid delivery_type' }, 400)
      if (!Array.isArray(items) || items.length === 0) return json({ error: 'No items provided' }, 400)

      const subtotalNgn = items.reduce((s: number, i: any) => s + Number(i.price_ngn ?? 0) * Number(i.quantity ?? 0), 0)
      const jumiaFeeNgn = delivery_type === 'to_qafrica' ? items.reduce((s: number, i: any) => s + 200 * Number(i.quantity ?? 0), 0) : 0
      const totalNgn = subtotalNgn + jumiaFeeNgn

      let lastError: any = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateOrderCode()
        const { error } = await supabase.from('china_import_orders').insert({
          code, customer_name, customer_whatsapp, items, delivery_type,
          subtotal_ngn: subtotalNgn, jumia_fee_ngn: jumiaFeeNgn, shipping_ngn: shippingNgn, prepaid_shipping_ngn: shippingNgn, total_ngn: totalNgn,
          status: 'pending', payment_status: 'unpaid',
        })
        if (!error) return json({ code })
        lastError = error
        if (error.code !== '23505') break
      }
      return json({ error: lastError?.message ?? 'Failed to generate code' }, 500)
    }

    if (req.method === 'POST' && action === 'checkout-init') {
      const body = await req.json()
      const {
        customer_id, customer_name, customer_whatsapp, delivery_type, items, payment_method,
        shipping_method, delivery_address, delivery_latitude, delivery_longitude, location_shared,
        delivery_mode, pickup_station_id, address_id,
      } = body

      if (!customer_id) return json({ error: 'Login required to check out' }, 401)
      if (!customer_name || !customer_whatsapp) return json({ error: 'Missing customer_name or customer_whatsapp' }, 400)
      if (!delivery_type || !['to_qafrica', 'to_me'].includes(delivery_type)) return json({ error: 'Invalid delivery_type' }, 400)
      if (!Array.isArray(items) || items.length === 0) return json({ error: 'No items provided' }, 400)
      if (!payment_method || !['paystack', 'manual'].includes(payment_method)) return json({ error: 'Invalid payment_method' }, 400)

      // ── Per-item shipping method ─────────────────────────────────────────
      // Each cart item carries its own shipping_method now. For backward
      // compatibility with older clients that still send a single top-level
      // shipping_method, that value is used as the default for any item
      // missing one.
      const resolvedDeliveryMode: 'home' | 'pickup_station' =
        delivery_mode === 'pickup_station' ? 'pickup_station' : 'home'

      const itemMethods: string[] = (items as any[]).map((i: any) => i.shipping_method ?? shipping_method)
      if (itemMethods.some(m => !['flight', 'sea_freight'].includes(m))) {
        return json({ error: 'Every item needs a valid shipping method (flight or sea_freight)' }, 400)
      }
      const uniqueMethods = new Set(itemMethods)
      // order-level summary field, kept for every screen that still reads
      // orders.shipping_method directly (tracking page, admin lists). 'mixed'
      // when the cart's items don't all share one method.
      const orderShippingMethodSummary = uniqueMethods.size === 1 ? itemMethods[0] : 'mixed'

      // ── Delivery address / pickup station ────────────────────────────────
      let cleanAddress: Record<string, string> | null = null
      let resolvedAddressId: string | null = null
      let pickupStationSnapshot: { id: string; name: string; address: string } | null = null

      if (delivery_type === 'to_me') {
        if (resolvedDeliveryMode === 'pickup_station') {
          if (!pickup_station_id) return json({ error: 'Missing pickup_station_id' }, 400)
          const { data: station } = await supabase
            .from('pickup_stations').select('id, name, address, is_active').eq('id', pickup_station_id).maybeSingle()
          if (!station || !station.is_active) return json({ error: 'That pickup station is no longer available. Please pick another.' }, 400)
          pickupStationSnapshot = { id: station.id, name: station.name, address: station.address }

          // Still need a name + phone for the courier/warehouse to reach the
          // customer, even though there's no street address to deliver to.
          const a = delivery_address ?? {}
          if (!a.name?.trim() || !a.phone?.trim()) return json({ error: 'Missing delivery address field: name or phone' }, 400)
          cleanAddress = { name: a.name.trim(), phone: a.phone.trim() }
        } else if (address_id) {
          const { data: saved, error: savedErr } = await supabase
            .from('import_customer_addresses').select('*').eq('id', address_id).eq('customer_id', customer_id).maybeSingle()
          if (savedErr || !saved) return json({ error: 'Saved address not found' }, 404)
          resolvedAddressId = saved.id
          cleanAddress = {
            name: saved.name, phone: saved.phone, address_line1: saved.address_line1,
            address_line2: saved.address_line2 ?? '', city: saved.city, state: saved.state,
            landmark: saved.landmark ?? '',
          }
        } else {
          const a = delivery_address ?? {}
          const required = ['name', 'phone', 'address_line1', 'city', 'state']
          for (const field of required) {
            if (!a[field] || typeof a[field] !== 'string' || !a[field].trim()) {
              return json({ error: `Missing delivery address field: ${field}` }, 400)
            }
          }
          cleanAddress = {
            name: a.name.trim(), phone: a.phone.trim(),
            address_line1: a.address_line1.trim(), address_line2: (a.address_line2 ?? '').trim(),
            city: a.city.trim(), state: a.state.trim(), landmark: (a.landmark ?? '').trim(),
          }
        }
      }
      const lat = typeof delivery_latitude === 'number' ? delivery_latitude : null
      const lng = typeof delivery_longitude === 'number' ? delivery_longitude : null

      if (payment_method === 'paystack') {
        let paystackEnabled = cacheGet<boolean>('paystack_enabled')
        if (paystackEnabled === null) {
          const { data: settings } = await supabase
            .from('import_admin_credentials').select('paystack_enabled').eq('id', 1).single()
          paystackEnabled = settings?.paystack_enabled ?? true
          cacheSet('paystack_enabled', paystackEnabled, 10_000)
        }
        if (paystackEnabled === false) {
          return json({ error: 'Paystack is currently unavailable. Please use manual bank transfer.' }, 409)
        }
      }

      if (payment_method === 'manual') {
        let manualEnabled = cacheGet<boolean>('manual_transfer_enabled')
        if (manualEnabled === null) {
          const { data: settings } = await supabase
            .from('import_admin_credentials').select('manual_transfer_enabled').eq('id', 1).single()
          manualEnabled = settings?.manual_transfer_enabled ?? true
          cacheSet('manual_transfer_enabled', manualEnabled, 10_000)
        }
        if (manualEnabled === false) {
          return json({ error: 'Manual bank transfer is currently inactive. Please pay with Paystack.' }, 409)
        }
      }

      const itemIds = [...new Set(items.map((i: any) => i.id).filter(Boolean))]
      const { data: itemProducts, error: itemProductsErr } = await supabase
        .from('china_import_products')
        .select('id, name, price_ngn, variants, ship_only, sea_shipping_customer_ngn, air_shipping_customer_ngn')
        .in('id', itemIds)
      if (itemProductsErr) return json({ error: 'Could not verify item pricing' }, 500)
      const productMap = new Map((itemProducts ?? []).map((p: any) => [p.id, p]))

      // Sea-freight-only products cannot go by air. Checked per item now
      // (previously blocked the whole order if any single item required
      // sea) — enforced server-side as well as in the UI, because the
      // shipping methods arrive from the client and the storefront cache
      // can be up to 30s stale.
      const blockedByShipOnly = (items as any[])
        .filter((i: any) => productMap.get(i.id)?.ship_only && (i.shipping_method ?? shipping_method) === 'flight')
        .map((i: any) => productMap.get(i.id)?.name)
      if (blockedByShipOnly.length > 0) {
        return json({
          error: 'ship_only_requires_sea',
          message: `${blockedByShipOnly.join(', ')} can only be shipped by sea freight. Please switch ${blockedByShipOnly.length > 1 ? 'these items' : 'this item'} to sea freight.`,
          blocked_items: blockedByShipOnly,
        }, 409)
      }

      const pricedItems = items.map((i: any) => {
        const product = productMap.get(i.id)
        if (!product) return null
        const method = i.shipping_method ?? shipping_method
        const price_ngn = computeItemPriceNgn(product, i.variant_options)
        const shippingRateNgn = method === 'flight'
          ? Number(product.air_shipping_customer_ngn ?? 0)
          : Number(product.sea_shipping_customer_ngn ?? 0)
        return {
          ...i,
          price_ngn,
          shipping_method: method,
          shipping_cost_ngn: round2(Math.max(shippingRateNgn, 0)),
        }
      })
      if (pricedItems.some((i: any) => i === null)) return json({ error: 'One or more items in your cart are no longer available' }, 400)

      // Shipping is calculated from the product snapshot stored in Supabase,
      // never from the price/shipping amounts supplied by the browser.
      const shippingSettingsRes = await supabase
        .from('import_admin_credentials')
        .select('charge_shipping_at_checkout, shipping_discount_percent, shipping_discount_min_ngn, bulk_discount_tier1_qty, bulk_discount_tier1_percent, bulk_discount_tier2_qty, bulk_discount_tier2_percent')
        .eq('id', 1).single()
      if (shippingSettingsRes.error) return json({ error: 'Could not load shipping settings' }, 500)
      const shippingSettings = shippingSettingsRes.data

      const subtotalNgn = pricedItems.reduce((s: number, i: any) => s + Number(i.price_ngn ?? 0) * Number(i.quantity ?? 0), 0)
      const cartQty = pricedItems.reduce((s: number, i: any) => s + Number(i.quantity ?? 0), 0)
      const rawShippingNgn = pricedItems.reduce((s: number, i: any) => s + Number(i.shipping_cost_ngn ?? 0) * Number(i.quantity ?? 0), 0)
      const discountActive = rawShippingNgn >= Number(shippingSettings.shipping_discount_min_ngn ?? 1600)
      const effectiveDiscountPercent = discountActive
        ? Math.min(
            Number(shippingSettings.shipping_discount_percent ?? 0)
              + (cartQty >= Number(shippingSettings.bulk_discount_tier1_qty ?? 10) ? Number(shippingSettings.bulk_discount_tier1_percent ?? 5) : 0)
              + (cartQty >= Number(shippingSettings.bulk_discount_tier2_qty ?? 20) ? Number(shippingSettings.bulk_discount_tier2_percent ?? 5) : 0),
            100,
          )
        : 0
      const discountedShippingNgn = discountActive
        ? Math.round(rawShippingNgn * (1 - effectiveDiscountPercent / 100))
        : rawShippingNgn
      const shippingNgn = shippingSettings.charge_shipping_at_checkout ? discountedShippingNgn : 0
      const jumiaFeeNgn = delivery_type === 'to_qafrica' ? pricedItems.reduce((s: number, i: any) => s + 200 * Number(i.quantity ?? 0), 0) : 0
      const totalNgn = subtotalNgn + jumiaFeeNgn + shippingNgn

      const PAYSTACK_MAX_NGN = 50_000
      if (payment_method === 'paystack' && totalNgn > PAYSTACK_MAX_NGN) {
        return json({ error: `Orders over ₦${PAYSTACK_MAX_NGN.toLocaleString()} must be paid via manual bank transfer.` }, 409)
      }

      const itemSignature = (arr: any[]) =>
        arr.map((i: any) => `${i.id}:${i.variant_options ? JSON.stringify(i.variant_options) : ''}:${i.quantity}`).sort().join('|')
      const newSignature = itemSignature(pricedItems)

      const { data: recentPending } = await supabase
        .from('china_import_orders')
        .select('id, code, items, total_ngn, payment_method')
        .eq('user_id', customer_id)
        .in('payment_status', ['unpaid', 'failed'])
        .order('created_at', { ascending: false })
        .limit(3)

      const duplicate = (recentPending ?? []).find((o: any) => {
        if (Number(o.total_ngn) !== totalNgn) return false
        const existingItems = Array.isArray(o.items) ? o.items : []
        return itemSignature(existingItems) === newSignature
      })
      if (duplicate) {
        return json({
          error: 'duplicate_pending_order',
          message: `You already have a pending order (${duplicate.code}) for this exact order — head to your dashboard to complete payment instead of starting a new one.`,
          existing_order_code: duplicate.code,
        }, 409)
      }

      let order: any = null
      let lastError: any = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateOrderCode()
        const { data, error } = await supabase.from('china_import_orders').insert({
          code, customer_name, customer_whatsapp, items: pricedItems, delivery_type,
          subtotal_ngn: subtotalNgn, jumia_fee_ngn: jumiaFeeNgn, total_ngn: totalNgn,
          status: 'pending', user_id: customer_id,
          payment_method, payment_status: 'unpaid',
          shipping_method: orderShippingMethodSummary,
          delivery_address: cleanAddress,
          delivery_latitude: lat, delivery_longitude: lng,
          location_shared: !!location_shared,
          delivery_mode: delivery_type === 'to_me' ? resolvedDeliveryMode : 'home',
          pickup_station_id: pickupStationSnapshot?.id ?? null,
          pickup_station_name: pickupStationSnapshot?.name ?? null,
          pickup_station_address: pickupStationSnapshot?.address ?? null,
          address_id: resolvedAddressId,
        }).select().single()
        if (!error) { order = data; break }
        lastError = error
        if (error.code !== '23505') break
      }
      if (!order) return json({ error: lastError?.message ?? 'Failed to create order' }, 500)

      if (payment_method === 'manual') {
        const { data: settings } = await supabase
          .from('import_admin_credentials')
          .select('bank_account_number, bank_account_name, bank_name')
          .eq('id', 1).single()
        return json({
          order_id: order.id, code: order.code, total_ngn: totalNgn,
          bank: settings ?? null,
        })
      }

      return json({ order_id: order.id, code: order.code, total_ngn: totalNgn })
    }

    if (req.method === 'POST' && action === 'checkout-verify') {
      const { order_id, reference } = await req.json()
      if (!order_id || !reference) return json({ error: 'Missing order_id or reference' }, 400)
      if (!PAYSTACK_SECRET_KEY) return json({ error: 'Payment verification not configured' }, 500)

      const { data: existingOrder } = await supabase
        .from('china_import_orders').select('payment_status, items').eq('id', order_id).single()
      const wasAlreadyPaid = existingOrder?.payment_status === 'paid'

      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      })
      const verifyData = await verifyRes.json()
      const ok = verifyRes.ok && verifyData?.data?.status === 'success'

      const { data: order, error } = await supabase
        .from('china_import_orders')
        .update({
          payment_status: ok ? 'paid' : 'failed',
          payment_reference: reference,
          paid_at: ok ? new Date().toISOString() : null,
        })
        .eq('id', order_id)
        .select().single()

      if (error) return json({ error: error.message }, 500)

      if (ok && !wasAlreadyPaid) {
        await incrementUnitsSold(supabase, order.items)
        await sendOrderConfirmedEmail(supabase, order)
        await advanceOrderStatus(supabase, order_id, 'confirmed')
      }

      return json({ success: ok, order })
    }

    if (req.method === 'POST' && action === 'modal-status') {
      const { viewer_key } = await req.json()
      if (!viewer_key) return json({ error: 'Missing viewer_key' }, 400)
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('china_import_modal_views')
        .select('id').eq('viewer_key', viewer_key).eq('viewed_date', today).maybeSingle()
      return json({ shouldShow: !data })
    }

    if (req.method === 'POST' && action === 'modal-seen') {
      const { viewer_key } = await req.json()
      if (!viewer_key) return json({ error: 'Missing viewer_key' }, 400)
      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('china_import_modal_views')
        .upsert({ viewer_key, viewed_date: today }, { onConflict: 'viewer_key,viewed_date' })
      return json({ success: true })
    }

    if (req.method === 'POST' && action === 'admin-login') {
      const body = await req.json().catch(() => ({}))
      const { email, password } = body
      if (!password) return json({ error: 'Password required' }, 400)

      const { data: creds } = await supabase
        .from('import_admin_credentials')
        .select('failed_attempts, locked_until')
        .eq('id', 1).single()

      if (creds?.locked_until && new Date(creds.locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(creds.locked_until).getTime() - Date.now()) / 60000)
        return json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` }, 429)
      }

      const { data: isValid, error } = await supabase.rpc('verify_import_admin_password', { p_password: password })
      if (error) return json({ error: 'Login check failed' }, 500)

      if (!isValid) {
        const attempts = (creds?.failed_attempts ?? 0) + 1
        const lockout = attempts >= 5
        await supabase.from('import_admin_credentials').update({
          failed_attempts: attempts,
          locked_until: lockout ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
        }).eq('id', 1)
        return json({ error: lockout ? 'Too many failed attempts. Try again in 15 minutes.' : 'Invalid credentials' }, lockout ? 429 : 401)
      }

      await supabase.from('import_admin_credentials').update({ failed_attempts: 0, locked_until: null }).eq('id', 1)

      const { data: session, error: sessionErr } = await supabase
        .from('import_admin_sessions')
        .insert({ expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString() })
        .select('token').single()
      if (sessionErr || !session) return json({ error: 'Login failed — could not create session' }, 500)

      return json({ success: true, token: session.token, manager: { email: email ?? null } })
    }

    if (req.method === 'POST' && action === 'admin-logout') {
      const { manager_token } = await req.json().catch(() => ({}))
      if (manager_token) await supabase.from('import_admin_sessions').delete().eq('token', manager_token)
      return json({ success: true })
    }

    if (req.method === 'GET' && action === 'admin-settings') {
      const { data, error } = await supabase
        .from('import_admin_credentials')
        .select('paystack_enabled, manual_transfer_enabled, bank_account_number, bank_account_name, bank_name, charge_shipping_at_checkout, shipping_discount_percent, shipping_discount_min_ngn, bulk_discount_tier1_qty, bulk_discount_tier1_percent, bulk_discount_tier2_qty, bulk_discount_tier2_percent, paystack_manual_threshold_ngn')
        .eq('id', 1).single()
      if (error) return json({ error: error.message }, 500)
      return json({ settings: data })
    }

    if (req.method === 'POST' && action === 'admin-update-settings') {
      const { manager_token, paystack_enabled, manual_transfer_enabled, bank_account_number, bank_account_name, bank_name } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      const updates: Record<string, unknown> = {}
      if (typeof paystack_enabled === 'boolean') updates.paystack_enabled = paystack_enabled
      if (typeof manual_transfer_enabled === 'boolean') updates.manual_transfer_enabled = manual_transfer_enabled
      if (typeof bank_account_number === 'string') updates.bank_account_number = bank_account_number
      if (typeof bank_account_name === 'string') updates.bank_account_name = bank_account_name
      if (typeof bank_name === 'string') updates.bank_name = bank_name

      const { data, error } = await supabase
        .from('import_admin_credentials').update(updates).eq('id', 1).select().single()
      if (error) return json({ error: error.message }, 500)
      memoryCache.delete('paystack_enabled')
      memoryCache.delete('manual_transfer_enabled')
      return json({ success: true, settings: data })
    }

    // ── Pricing & Shipping settings ───────────────────────────────────────
    // Pricing and shipping settings live in import_admin_credentials so there
    // is one admin-settings source of truth.
    if (req.method === 'GET' && action === 'admin-pricing-settings') {
      const { data, error } = await supabase
        .from('import_admin_credentials')
        .select('usd_to_ngn_rate, cny_to_usd_rate, sea_rate_ngn_per_cbm, flight_rate_ngn_per_gram, sea_shipping_product_allocation_percent, sea_shipping_customer_percent, air_shipping_credit_enabled, updated_at')
        .eq('id', 1).single()
      if (error) return json({ error: error.message }, 500)
      return json({
        settings: {
          usd_to_ngn: Number(data.usd_to_ngn_rate),
          cny_to_usd: Number(data.cny_to_usd_rate),
          sea_rate_ngn_per_cbm: Number(data.sea_rate_ngn_per_cbm),
          air_rate_ngn_per_gram: Number(data.flight_rate_ngn_per_gram),
          sea_product_allocation_percent: Number(data.sea_shipping_product_allocation_percent),
          sea_customer_percent: Number(data.sea_shipping_customer_percent),
          air_credit_enabled: Boolean(data.air_shipping_credit_enabled),
          updated_at: data.updated_at,
        },
      })
    }

    if (req.method === 'POST' && action === 'admin-update-pricing-settings') {
      const {
        manager_token,
        usd_to_ngn,
        cny_to_usd,
        sea_rate_ngn_per_cbm,
        air_rate_ngn_per_gram,
        sea_product_allocation_percent,
        sea_customer_percent,
        air_credit_enabled,
      } = await req.json()

      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      const updates: Record<string, unknown> = {}
      const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0
      const nonNegative = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
      const percent = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100

      if (usd_to_ngn !== undefined) {
        if (!positive(usd_to_ngn)) return json({ error: 'USD → NGN rate must be greater than 0.' }, 400)
        updates.usd_to_ngn_rate = round2(Number(usd_to_ngn))
      }
      if (cny_to_usd !== undefined) {
        if (!positive(cny_to_usd)) return json({ error: 'CNY → USD rate must be greater than 0.' }, 400)
        updates.cny_to_usd_rate = Number(cny_to_usd)
      }
      if (sea_rate_ngn_per_cbm !== undefined) {
        if (!nonNegative(sea_rate_ngn_per_cbm)) return json({ error: 'Sea rate cannot be negative.' }, 400)
        updates.sea_rate_ngn_per_cbm = round2(Number(sea_rate_ngn_per_cbm))
      }
      if (air_rate_ngn_per_gram !== undefined) {
        if (!nonNegative(air_rate_ngn_per_gram)) return json({ error: 'Air rate cannot be negative.' }, 400)
        updates.flight_rate_ngn_per_gram = Number(air_rate_ngn_per_gram)
      }
      if (sea_product_allocation_percent !== undefined) {
        if (!percent(sea_product_allocation_percent)) return json({ error: 'Sea product allocation must be between 0 and 100.' }, 400)
        updates.sea_shipping_product_allocation_percent = Number(sea_product_allocation_percent)
      }
      if (sea_customer_percent !== undefined) {
        if (!percent(sea_customer_percent)) return json({ error: 'Sea customer percentage must be between 0 and 100.' }, 400)
        updates.sea_shipping_customer_percent = Number(sea_customer_percent)
      }
      if (air_credit_enabled !== undefined) {
        if (typeof air_credit_enabled !== 'boolean') return json({ error: 'Air credit setting must be true or false.' }, 400)
        updates.air_shipping_credit_enabled = air_credit_enabled
      }

      if (updates.sea_shipping_product_allocation_percent !== undefined || updates.sea_shipping_customer_percent !== undefined) {
        const { data: current, error: currentErr } = await supabase
          .from('import_admin_credentials')
          .select('sea_shipping_product_allocation_percent, sea_shipping_customer_percent')
          .eq('id', 1).single()
        if (currentErr) return json({ error: currentErr.message }, 500)
        const productPct = Number(updates.sea_shipping_product_allocation_percent ?? current.sea_shipping_product_allocation_percent)
        const customerPct = Number(updates.sea_shipping_customer_percent ?? current.sea_shipping_customer_percent)
        if (Math.abs(productPct + customerPct - 100) > 0.0001) {
          return json({ error: 'Sea product allocation and customer percentage must add up to 100%.' }, 400)
        }
      }

      updates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('import_admin_credentials')
        .update(updates)
        .eq('id', 1)
        .select('usd_to_ngn_rate, cny_to_usd_rate, sea_rate_ngn_per_cbm, flight_rate_ngn_per_gram, sea_shipping_product_allocation_percent, sea_shipping_customer_percent, air_shipping_credit_enabled, updated_at')
        .single()
      if (error) return json({ error: error.message }, 500)

      memoryCache.delete('import_pricing_settings')
      return json({
        success: true,
        settings: {
          usd_to_ngn: Number(data.usd_to_ngn_rate),
          cny_to_usd: Number(data.cny_to_usd_rate),
          sea_rate_ngn_per_cbm: Number(data.sea_rate_ngn_per_cbm),
          air_rate_ngn_per_gram: Number(data.flight_rate_ngn_per_gram),
          sea_product_allocation_percent: Number(data.sea_shipping_product_allocation_percent),
          sea_customer_percent: Number(data.sea_shipping_customer_percent),
          air_credit_enabled: Boolean(data.air_shipping_credit_enabled),
          updated_at: data.updated_at,
        },
      })
    }

    if (req.method === 'POST' && (action === 'add-product' || action === 'update-product')) {
      const body = await req.json()
      const { manager_token, id, name, description, category_id, subcategory_id, image_url, image_urls, moq, has_variants, variants } = body
      const originalPriceUsd = Number(body.original_price_usd)
      const volumeCbm = body.volume_cbm == null || body.volume_cbm === '' ? 0 : Number(body.volume_cbm)
      const weightGrams = body.weight_grams == null || body.weight_grams === '' ? 0 : Number(body.weight_grams)

      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!name || !Number.isFinite(originalPriceUsd) || originalPriceUsd <= 0 || !image_urls?.length) {
        return json({ error: 'Product name, original USD price and at least one image are required' }, 400)
      }
      if (!Number.isFinite(volumeCbm) || volumeCbm < 0 || !Number.isFinite(weightGrams) || weightGrams < 0) {
        return json({ error: 'Volume and weight must be valid non-negative numbers' }, 400)
      }
      if (!category_id || !subcategory_id) return json({ error: 'Category and subcategory are required' }, 400)

      const { data: subcategory, error: subErr } = await supabase
        .from('niche_subcategories')
        .select('id, category_id, niche_id, name, markup_percent')
        .eq('id', subcategory_id)
        .eq('category_id', category_id)
        .maybeSingle()
      if (subErr) return json({ error: subErr.message }, 500)
      if (!subcategory) return json({ error: 'Selected subcategory does not belong to the selected category' }, 400)

      const { data: parentCategory, error: catErr } = await supabase
        .from('niche_categories')
        .select('id, niche_id, name')
        .eq('id', category_id)
        .eq('niche_id', subcategory.niche_id)
        .maybeSingle()
      if (catErr) return json({ error: catErr.message }, 500)
      if (!parentCategory) return json({ error: 'Selected category was not found for this niche' }, 400)

      const pricingSettings = await getImportPricingSettings(supabase)
      const markupPercent = Number(subcategory.markup_percent ?? 0)
      const pricing = computeImportPricing(
        originalPriceUsd,
        markupPercent,
        pricingSettings,
        volumeCbm,
        weightGrams,
      )
      const cleanVariants = sanitizeVariants(variants)

      const sourceUrl = sanitizeSourceUrl(body.source_url)
      if (body.source_url && String(body.source_url).trim() && !sourceUrl) {
        return json({ error: 'The 1688 link is not a valid URL. It should start with https://' }, 400)
      }
      const shipOnly = body.ship_only === true
      const seedSold = Number(body.units_sold)
      const hasSeedSold = Number.isFinite(seedSold) && seedSold >= 0

      const row = {
        name,
        description: description ?? '',
        category: parentCategory.name,
        parent_category: parentCategory.name,
        category_id: parentCategory.id,
        subcategory_id: subcategory.id,
        image_url: image_url || image_urls[0],
        image_urls,
        moq: Number(moq) >= 1 ? Number(moq) : 1,
        price_cny_original: round2(originalPriceUsd / pricingSettings.cnyToUsd),
        price_cny: pricing.productPriceCny,
        price_ngn: pricing.productPriceNgn,
        price_usd: pricing.productPriceUsd,
        cost_ngn: pricing.baseCostNgn,
        price_input_currency: 'usd',
        price_input_amount: originalPriceUsd,
        original_price_usd: round2(originalPriceUsd),
        usd_to_ngn_rate: round2(pricingSettings.usdToNgn),
        markup_percent: round2(markupPercent),
        markup_amount_ngn: pricing.markupAmountNgn,
        volume_cbm: volumeCbm > 0 ? volumeCbm : null,
        weight_grams: weightGrams > 0 ? weightGrams : null,
        sea_shipping_allocation_ngn: pricing.seaAllocationNgn,
        sea_shipping_customer_ngn: pricing.seaCustomerNgn,
        air_shipping_customer_ngn: pricing.airCustomerNgn,
        sea_shipping_cost_ngn: pricing.seaCustomerNgn,
        flight_shipping_cost_ngn: pricing.airCustomerNgn,
        has_variants: !!has_variants && cleanVariants.length > 0,
        variants: cleanVariants,
        source_url: sourceUrl,
        ship_only: shipOnly,
        delivery_time: shipOnly ? 'sea' : 'air',
        ...(hasSeedSold ? { units_sold: Math.round(seedSold) } : {}),
      }

      if (action === 'add-product') {
        const { error } = await supabase.from('china_import_products').insert(row)
        if (error) return json({ error: error.message }, 500)
      } else {
        if (!id) return json({ error: 'Missing product id' }, 400)
        const { error } = await supabase.from('china_import_products').update(row).eq('id', id)
        if (error) return json({ error: error.message }, 500)
      }
      memoryCache.delete('products')
      return json({ success: true, pricing: { ...pricing, markupPercent, originalPriceUsd, usdToNgnRate: pricingSettings.usdToNgn } })
    }

    if (req.method === 'POST' && action === 'delete-product') {
      const { manager_token, id } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!id) return json({ error: 'Missing id' }, 400)
      const { error } = await supabase.from('china_import_products').delete().eq('id', id)
      if (error) return json({ error: error.message }, 500)
      memoryCache.delete('products')
      return json({ success: true })
    }

    if (req.method === 'POST' && action === 'upload-image') {
      const { manager_token, image_base64, extension } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!image_base64) return json({ error: 'Missing image data' }, 400)

      const rawBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
      const optimized = await optimizeImage(rawBytes)
      const path = `china-import/${crypto.randomUUID()}.${optimized.extension}`
      const { error } = await supabase.storage.from('product-images').upload(path, optimized.bytes, {
        contentType: optimized.contentType,
        upsert: false,
      })
      if (error) return json({ error: error.message }, 500)

      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
      return json({ url: pub.publicUrl })
    }

    if (req.method === 'POST' && action === 'load-code') {
      const { code, manager_token } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!code) return json({ error: 'Missing code' }, 400)
      const { data, error } = await supabase.from('china_import_orders').select('*').eq('code', code).single()
      if (error || !data) return json({ error: 'Order not found' }, 404)
      return json({ order: data })
    }

    if (req.method === 'POST' && action === 'update-order') {
      const { manager_token, id, status, shipping_ngn, admin_note, payment_status } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!id) return json({ error: 'Missing order id' }, 400)

      let wasAlreadyPaid = false
      if (payment_status === 'paid') {
        const { data: existing } = await supabase.from('china_import_orders').select('payment_status').eq('id', id).single()
        wasAlreadyPaid = existing?.payment_status === 'paid'
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (status) updates.status = status
      if (typeof shipping_ngn === 'number') updates.shipping_ngn = shipping_ngn
      if (typeof admin_note === 'string') updates.admin_note = admin_note
      if (payment_status) {
        updates.payment_status = payment_status
        if (payment_status === 'paid') updates.paid_at = new Date().toISOString()
      }

      const { data, error } = await supabase.from('china_import_orders').update(updates).eq('id', id).select().single()
      if (error) return json({ error: error.message }, 500)

      if (payment_status === 'paid' && !wasAlreadyPaid) {
        await incrementUnitsSold(supabase, data.items)
        await sendOrderConfirmedEmail(supabase, data)
        if (!status) await advanceOrderStatus(supabase, id, 'confirmed')
      }

      return json({ order: data })
    }

    if (req.method === 'POST' && action === 'all-orders') {
      const { manager_token, date_from, date_to, payment_status, status } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      const buildQuery = (from: number, to: number) => {
        let q = supabase.from('china_import_orders')
          .select('*, customers(email)')
          .order('created_at', { ascending: false })
          .range(from, to)
        if (date_from) q = q.gte('created_at', date_from)
        if (date_to) q = q.lte('created_at', date_to)
        if (payment_status) q = q.eq('payment_status', payment_status)
        if (status) q = q.eq('status', status)
        return q
      }

      let raw: any[]
      try {
        raw = await fetchAllRows(buildQuery)
      } catch (e: any) {
        return json({ error: e?.message ?? 'Failed to fetch orders' }, 500)
      }
      const orders = raw.map((o: any) => ({
        ...o,
        customer_email: o.customers?.email ?? null,
        customers: undefined,
      }))
      return json({ orders })
    }

    if (req.method === 'POST' && action === 'admin-analytics') {
      const { manager_token, date_from, date_to } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      const { data: analyticsJson, error: analyticsErr } = await supabase.rpc('get_import_analytics', {
        p_date_from: date_from ?? null,
        p_date_to: date_to ?? null,
      })
      if (analyticsErr) return json({ error: analyticsErr.message }, 500)

      let customerQuery = supabase.from('customers').select('id', { count: 'exact', head: true })
        .eq('signup_source', 'importation')
      if (date_from) customerQuery = customerQuery.gte('created_at', date_from)
      if (date_to) customerQuery = customerQuery.lte('created_at', date_to)
      const { count: newCustomersCount } = await customerQuery

      return json({
        analytics: {
          ...analyticsJson,
          new_customers_count: newCustomersCount ?? 0,
        },
      })
    }

    if (req.method === 'POST' && action === 'admin-customers') {
      const { manager_token, search } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      const buildCustQuery = (from: number, to: number) => {
        let q = supabase.from('customers')
          .select('id, full_name, email, phone, avatar_url, created_at')
          .eq('signup_source', 'importation')
          .order('created_at', { ascending: false })
          .range(from, to)
        if (search && typeof search === 'string' && search.trim()) {
          const s = search.trim()
          q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`)
        }
        return q
      }
      let customers: any[]
      try {
        customers = await fetchAllRows(buildCustQuery)
      } catch (e: any) {
        return json({ error: e?.message ?? 'Failed to fetch customers' }, 500)
      }

      const ids = (customers ?? []).map((c: any) => c.id)
      let orders: any[] = []
      if (ids.length) {
        try {
          orders = await fetchAllRows((from, to) =>
            supabase.from('china_import_orders').select('user_id, total_ngn, payment_status, status, created_at').in('user_id', ids).range(from, to)
          )
        } catch (e: any) {
          return json({ error: e?.message ?? 'Failed to fetch order stats' }, 500)
        }
      }
      const [{ data: favorites }, { data: failedOrders }] = await Promise.all([
        supabase.from('import_admin_favorite_customers').select('customer_id'),
        ids.length
          ? supabase.from('china_import_failed_orders').select('user_id').in('user_id', ids)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const failedCountMap = new Map<string, number>()
      for (const f of (failedOrders ?? [])) {
        failedCountMap.set(f.user_id, (failedCountMap.get(f.user_id) ?? 0) + 1)
      }

      const favoriteSet = new Set((favorites ?? []).map((f: any) => f.customer_id))
      const orderStatsMap = new Map<string, { order_count: number; total_spent_ngn: number; last_order_at: string | null; awaiting_confirmation: number }>()
      for (const o of (orders ?? [])) {
        const entry = orderStatsMap.get(o.user_id) ?? { order_count: 0, total_spent_ngn: 0, last_order_at: null, awaiting_confirmation: 0 }
        entry.order_count += 1
        if (o.payment_status === 'paid') entry.total_spent_ngn += Number(o.total_ngn ?? 0)
        if (o.payment_status === 'awaiting_confirmation') entry.awaiting_confirmation += 1
        if (!entry.last_order_at || o.created_at > entry.last_order_at) entry.last_order_at = o.created_at
        orderStatsMap.set(o.user_id, entry)
      }

      const result = (customers ?? []).map((c: any) => {
        const stats = orderStatsMap.get(c.id) ?? { order_count: 0, total_spent_ngn: 0, last_order_at: null, awaiting_confirmation: 0 }
        return {
          id: c.id, full_name: c.full_name, email: c.email, phone: c.phone,
          avatar_url: c.avatar_url, joined_at: c.created_at,
          is_favorite: favoriteSet.has(c.id),
          order_count: stats.order_count,
          total_spent_ngn: round2(stats.total_spent_ngn),
          last_order_at: stats.last_order_at,
          awaiting_confirmation_count: stats.awaiting_confirmation,
          failed_order_count: failedCountMap.get(c.id) ?? 0,
        }
      })

      return json({ customers: result })
    }

    if (req.method === 'POST' && action === 'admin-toggle-favorite') {
      const { manager_token, customer_id } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!customer_id) return json({ error: 'Missing customer_id' }, 400)

      const { data: existing } = await supabase
        .from('import_admin_favorite_customers').select('id').eq('customer_id', customer_id).maybeSingle()

      if (existing) {
        const { error } = await supabase.from('import_admin_favorite_customers').delete().eq('customer_id', customer_id)
        if (error) return json({ error: error.message }, 500)
        return json({ is_favorite: false })
      } else {
        const { error } = await supabase.from('import_admin_favorite_customers').insert({ customer_id })
        if (error) return json({ error: error.message }, 500)
        return json({ is_favorite: true })
      }
    }

    if (req.method === 'POST' && action === 'admin-customer-detail') {
      const { manager_token, customer_id } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!customer_id) return json({ error: 'Missing customer_id' }, 400)

      const [{ data: customer, error: custErr }, { data: orders }, { data: bills }, { data: favorite }, { data: failedOrders }] = await Promise.all([
        supabase.from('customers').select('id, full_name, email, phone, avatar_url, created_at').eq('id', customer_id).single(),
        supabase.from('china_import_orders').select('*').eq('user_id', customer_id).order('created_at', { ascending: false }),
        supabase.from('china_import_consolidation_bills').select('*').eq('user_id', customer_id).order('created_at', { ascending: false }),
        supabase.from('import_admin_favorite_customers').select('id').eq('customer_id', customer_id).maybeSingle(),
        supabase.from('china_import_failed_orders').select('*').eq('user_id', customer_id).order('failed_at', { ascending: false }),
      ])
      if (custErr || !customer) return json({ error: 'Customer not found' }, 404)

      return json({
        customer: { ...customer, is_favorite: !!favorite },
        orders: orders ?? [],
        bills: bills ?? [],
        failed_orders: failedOrders ?? [],
      })
    }

    if (req.method === 'POST' && action === 'update-avatar') {
      const { customer_id, avatar_url } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)
      if (typeof avatar_url !== 'string' || !avatar_url) return json({ error: 'Missing avatar_url' }, 400)

      const { data, error } = await supabase
        .from('customers')
        .update({ avatar_url })
        .eq('id', customer_id)
        .select()
        .single()
      if (error) return json({ error: error.message }, 500)
      return json({ customer: data })
    }

    if (req.method === 'POST' && action === 'my-orders') {
      const { customer_id } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)

      const { data, error } = await supabase
        .from('china_import_orders')
        .select('id, code, status, payment_status, payment_method, total_ngn, delivery_type, items, created_at, delivery_mode, pickup_station_id, pickup_station_name, pickup_station_address, shipping_method, delivery_address, restored_at')
        .eq('user_id', customer_id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) return json({ error: error.message }, 500)
      return json({ orders: data ?? [] })
    }

    if (req.method === 'POST' && action === 'my-bills') {
      const { customer_id } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)

      const { data, error } = await supabase
        .from('china_import_consolidation_bills')
        .select('id, order_id, amount_ngn, reason, kind, bank_account_number, bank_name, bank_account_name, status, line_items, created_at')
        .eq('user_id', customer_id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) return json({ error: error.message }, 500)
      return json({ bills: data ?? [] })
    }

    if (req.method === 'POST' && action === 'bill-mark-paid') {
      const { customer_id, bill_id, sender_name, sender_bank_name } = await req.json()
      if (!customer_id || !bill_id) return json({ error: 'Missing customer_id or bill_id' }, 400)
      if (!sender_name || typeof sender_name !== 'string' || !sender_name.trim()) {
        return json({ error: 'Sender name is required so we can match your payment.' }, 400)
      }

      const { data: bill, error: findErr } = await supabase
        .from('china_import_consolidation_bills').select('id, user_id, status').eq('id', bill_id).single()
      if (findErr || !bill) return json({ error: 'Bill not found' }, 404)
      if (bill.user_id !== customer_id) return json({ error: 'Unauthorized' }, 403)
      if (bill.status !== 'pending') return json({ bill }, 200)

      const updates: Record<string, unknown> = {
        status: 'awaiting_confirmation', customer_marked_paid_at: new Date().toISOString(),
        manual_sender_name: sender_name.trim(),
      }
      if (typeof sender_bank_name === 'string' && sender_bank_name.trim()) updates.manual_sender_bank = sender_bank_name.trim()

      const { data, error } = await supabase
        .from('china_import_consolidation_bills')
        .update(updates)
        .eq('id', bill_id).select().single()
      if (error) return json({ error: error.message }, 500)
      return json({ bill: data })
    }

    if (req.method === 'POST' && action === 'admin-create-bill') {
      const { manager_token, user_id, order_id, amount_ngn, reason, kind } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!user_id) return json({ error: 'Missing user_id' }, 400)
      const amount = Number(amount_ngn)
      if (!amount || amount <= 0) return json({ error: 'Invalid amount_ngn' }, 400)
      const billKind = kind === 'clearance' ? 'clearance' : 'consolidation_shipping'
      const defaultReason = billKind === 'clearance' ? 'Clearance fee' : 'Consolidation & shipping fee'

      const { data, error } = await supabase
        .from('china_import_consolidation_bills')
        .insert({
          user_id, order_id: order_id ?? null,
          amount_ngn: amount, reason: reason || defaultReason,
          kind: billKind,
          line_items: [{ label: reason || defaultReason, amount_ngn: amount }],
        })
        .select().single()
      if (error) return json({ error: error.message }, 500)

      const { data: customer } = await supabase.from('customers').select('full_name, email').eq('id', user_id).single()
      if (customer?.email) {
        await sendTemplatedEmail(supabase, billKind === 'clearance' ? 'clearance_bill' : 'consolidation_shipping_bill', customer.email,
          { customer_name: customer?.full_name ?? 'there', amount_due: Number(amount).toLocaleString(), pay_link: DASHBOARD_BILLS_URL })
      }

      return json({ bill: data })
    }

    if (req.method === 'POST' && action === 'admin-all-bills') {
      const { manager_token, status } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      let query = supabase
        .from('china_import_consolidation_bills')
        .select('*, china_import_orders(code)')
        .order('created_at', { ascending: false })
      if (status) query = query.eq('status', status)

      const { data, error } = await query.limit(500)
      if (error) return json({ error: error.message }, 500)
      return json({ bills: data ?? [] })
    }

    if (req.method === 'POST' && action === 'admin-confirm-bill') {
      const { manager_token, bill_id, cancel } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!bill_id) return json({ error: 'Missing bill_id' }, 400)

      const { data: existingBill, error: existingBillError } = await supabase
        .from('china_import_consolidation_bills').select('*').eq('id', bill_id).single()
      if (existingBillError || !existingBill) return json({ error: 'Bill not found' }, 404)

      if (!cancel && existingBill.status === 'paid') {
        if (existingBill.kind === 'consolidation_shipping') {
          await sendShipmentPaymentDeliveryEstimate(supabase, existingBill)
        }
        return json({ bill: existingBill })
      }

      const updates: Record<string, unknown> = cancel
        ? { status: 'cancelled' }
        : { status: 'paid', confirmed_paid_at: new Date().toISOString(), reminder_count: 0 }

      const { data, error } = await supabase
        .from('china_import_consolidation_bills').update(updates).eq('id', bill_id).select().single()
      if (error) return json({ error: error.message }, 500)

      if (!cancel && data?.user_id) {
        if (data.kind === 'consolidation_shipping') {
          await sendShipmentPaymentDeliveryEstimate(supabase, data)
        } else {
          const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', data.user_id).single()
          if (customer?.email) {
            await sendTemplatedEmail(supabase, 'bill_payment_confirmed', customer.email, {
              customer_name: customer.full_name ?? 'there',
              amount_paid: Number(data.amount_ngn ?? 0).toLocaleString(),
            })
          }
        }
      }

      return json({ bill: data })
    }

    if (req.method === 'POST' && action === 'ask-question') {
      const { customer_id, product_id, question } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)
      if (!product_id || !question || !question.trim()) return json({ error: 'Missing product_id or question' }, 400)

      const { data: customer } = await supabase.from('customers').select('full_name, email').eq('id', customer_id).single()

      const { data, error } = await supabase
        .from('china_import_product_questions')
        .insert({
          product_id, user_id: customer_id,
          customer_name: customer?.full_name ?? null,
          customer_email: customer?.email ?? null,
          question: question.trim(),
        })
        .select().single()
      if (error) return json({ error: error.message }, 500)
      return json({ question: data })
    }

    if (req.method === 'POST' && action === 'admin-questions') {
      const { manager_token, status } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      let query = supabase
        .from('china_import_product_questions')
        .select('*, china_import_products(name, image_url)')
        .order('created_at', { ascending: false })
      if (status) query = query.eq('status', status)

      const { data, error } = await query.limit(500)
      if (error) return json({ error: error.message }, 500)
      return json({ questions: data ?? [] })
    }

    if (req.method === 'POST' && action === 'admin-reply-question') {
      const { manager_token, question_id, reply, template } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!question_id || !reply || !reply.trim()) return json({ error: 'Missing question_id or reply' }, 400)

      const { data: q, error: findErr } = await supabase
        .from('china_import_product_questions')
        .select('*, china_import_products(name)')
        .eq('id', question_id).single()
      if (findErr || !q) return json({ error: 'Question not found' }, 404)

      const { data, error } = await supabase
        .from('china_import_product_questions')
        .update({ status: 'answered', admin_reply: reply.trim(), reply_template: template ?? null, replied_at: new Date().toISOString() })
        .eq('id', question_id).select().single()
      if (error) return json({ error: error.message }, 500)

      if (q.customer_email) {
        const productName = q.china_import_products?.name ?? 'your question'
        const html = `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
              <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
            </div>
            <h2 style="color:#111827;margin:0 0 8px;">We answered your question 💬</h2>
            <p style="color:#6B7280;margin:0 0 16px;">
              Hi ${q.customer_name ?? 'there'}, you asked about <strong>${productName}</strong>:
            </p>
            <div style="background:#F9FAFB;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
              <p style="margin:0;font-size:13px;color:#6B7280;font-style:italic;">"${q.question}"</p>
            </div>
            <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${reply.trim()}</p>
            </div>
            <p style="color:#9CA3AF;font-size:12px;margin-top:20px;">
              Have another question? Just ask again from the product page.
            </p>
          </div>
        `
        await supabase.functions.invoke('send-email', {
          body: { to: q.customer_email, subject: `We answered your question about ${productName}`, html },
        }).catch(() => {})
      }

      return json({ question: data })
    }

    if (req.method === 'POST' && action === 'admin-merge-into-batch') {
      const { manager_token, order_ids, target_batch_key } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!Array.isArray(order_ids) || order_ids.length === 0) return json({ error: 'Missing order_ids' }, 400)
      if (!target_batch_key) return json({ error: 'Missing target_batch_key' }, 400)

      const { data: existingOrders } = await supabase.from('china_import_orders').select('id, staged_at').eq('staged_at', target_batch_key).limit(1)
      if (!existingOrders || existingOrders.length === 0) return json({ error: 'Target batch not found.' }, 404)

      const { data: billStatus } = await supabase.from('import_batch_bill_status').select('status').eq('batch_key', target_batch_key).eq('kind', 'consolidation_shipping').maybeSingle()
      if (billStatus?.status === 'sent') {
        return json({ error: 'That batch has already been billed and is locked — merging into it would break its pricing. Pick a different batch, or leave this as its own new batch.' }, 409)
      }

      const batchId = await resolveBatchId(supabase, target_batch_key)
      const { error } = await supabase
        .from('china_import_orders')
        .update({ staged_at: target_batch_key, batch_id: batchId, status: 'ordered', updated_at: new Date().toISOString() })
        .in('id', order_ids)
      if (error) return json({ error: error.message }, 500)

      return json({ success: true, merged: order_ids.length, batch_key: target_batch_key })
    }

    if (req.method === 'POST' && action === 'admin-close-group') {
      const { manager_token, order_ids } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!Array.isArray(order_ids) || order_ids.length === 0) return json({ error: 'Missing order_ids' }, 400)

      const stagedAt = new Date().toISOString()
      const { error } = await supabase
        .from('china_import_orders')
        .update({ staged_at: stagedAt, status: 'ordered', updated_at: new Date().toISOString() })
        .in('id', order_ids)
      if (error) return json({ error: error.message }, 500)

      const { data: newBatch, error: batchErr } = await supabase.from('import_batches').insert({ opened_at: stagedAt }).select('id').single()
      if (batchErr) console.warn('[china-import] failed to create import_batches row:', batchErr.message)
      else await supabase.from('china_import_orders').update({ batch_id: newBatch.id }).in('id', order_ids)

      return json({ success: true, staged_at: stagedAt, count: order_ids.length })
    }

    if (req.method === 'POST' && action === 'admin-send-confirmed-message') {
      const { manager_token, template } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!['consolidation', 'last_call'].includes(template)) return json({ error: 'Invalid template' }, 400)

      const { data: orders, error } = await supabase
        .from('china_import_orders')
        .select('user_id, customer_name')
        .eq('payment_status', 'paid')
        .is('staged_at', null)
      if (error) return json({ error: error.message }, 500)

      const byUser = new Map<string, string>()
      for (const o of (orders ?? [])) {
        if (o.user_id && !byUser.has(o.user_id)) byUser.set(o.user_id, o.customer_name ?? 'there')
      }
      if (byUser.size === 0) return json({ success: true, queued: 0 })

      const userIds = Array.from(byUser.keys())
      const { data: customers } = await supabase
        .from('customers').select('id, email, full_name').in('id', userIds)
      const emailMap = new Map((customers ?? []).map((c: any) => [c.id, { email: c.email, name: c.full_name }]))

      const dateLabel = fmtDate(new Date())
      let queued = 0
      for (const userId of userIds) {
        const c = emailMap.get(userId)
        if (!c?.email) continue
        const name = c.name ?? byUser.get(userId) ?? 'there'
        let ok = false
        if (template === 'consolidation') {
          ok = await queueTemplatedEmail(supabase, 'consolidation_notice', c.email, { customer_name: name, date_label: dateLabel })
        } else {
          const { subject, html } = lastCallEmail(name, dateLabel)
          const { error: qErr } = await supabase.from('import_notification_queue').insert({ to_email: c.email, subject, html })
          ok = !qErr
        }
        if (ok) queued++
      }

      return json({ success: true, queued, recipients: userIds.length })
    }

    if (req.method === 'POST' && action === 'admin-send-shipped-message') {
      const { manager_token, order_ids } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!Array.isArray(order_ids) || order_ids.length === 0) return json({ error: 'Missing order_ids' }, 400)

      const { data: orders, error } = await supabase
        .from('china_import_orders')
        .select('id, user_id, customer_name, created_at, shipping_method, shipped_at')
        .in('id', order_ids)
      if (error) return json({ error: error.message }, 500)

      const eligibleOrders = (orders ?? []).filter((o: any) => !o.shipped_at)
      if (eligibleOrders.length === 0) return json({ success: true, queued: 0, note: 'Every order in this batch was already marked shipped.' })

      const { data: bills } = await supabase
        .from('china_import_consolidation_bills')
        .select('order_id, status')
        .in('order_id', eligibleOrders.map((o: any) => o.id))

      const billsByOrder = new Map<string, string[]>()
      for (const b of (bills ?? [])) {
        if (!b.order_id) continue
        const list = billsByOrder.get(b.order_id) ?? []
        list.push(b.status)
        billsByOrder.set(b.order_id, list)
      }

      const qualifyingOrders = eligibleOrders.filter((o: any) => {
        const statuses = billsByOrder.get(o.id)
        return !!statuses && statuses.length > 0 && statuses.every(s => s === 'paid')
      })
      const skippedUnpaid = eligibleOrders.length - qualifyingOrders.length

      if (qualifyingOrders.length === 0) {
        return json({ success: true, queued: 0, skipped_unpaid: skippedUnpaid, note: 'No orders in this batch are billed and fully paid yet.' })
      }

      const dates = qualifyingOrders.map((o: any) => new Date(o.created_at).getTime())
      const minDate = new Date(Math.min(...dates))
      const maxDate = new Date(Math.max(...dates))
      const rangeLabel = minDate.toDateString() === maxDate.toDateString()
        ? fmtDate(minDate)
        : `between ${fmtDate(minDate)} and ${fmtDate(maxDate)}`

      const byUser = new Map<string, { name: string; orderIds: string[]; shippingMethod: string | null }>()
      for (const o of qualifyingOrders) {
        if (!o.user_id) continue
        const entry = byUser.get(o.user_id) ?? { name: o.customer_name ?? 'there', orderIds: [], shippingMethod: o.shipping_method ?? null }
        entry.orderIds.push(o.id)
        byUser.set(o.user_id, entry)
      }

      const userIds = Array.from(byUser.keys())
      const { data: customers } = await supabase.from('customers').select('id, email, full_name').in('id', userIds)
      const emailMap = new Map((customers ?? []).map((c: any) => [c.id, c.email]))

      let queued = 0
      const now = new Date().toISOString()
      for (const [userId, entry] of byUser.entries()) {
        const email = emailMap.get(userId)
        if (email) {
          const methodLabel = entry.shippingMethod === 'flight' ? ' by air' : entry.shippingMethod === 'sea_freight' ? ' by sea' : ''
          const ok = await queueTemplatedEmail(supabase, 'shipped', email, { customer_name: entry.name, date_label: rangeLabel, shipping_method_label: methodLabel })
          if (ok) queued++
        }
      }

      await supabase.from('china_import_orders').update({ shipped_at: now }).in('id', qualifyingOrders.map((o: any) => o.id))

      return json({ success: true, queued, recipients: userIds.length, skipped_unpaid: skippedUnpaid })
    }

    if (req.method === 'POST' && action === 'admin-broadcast-audience-count') {
      const { manager_token } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      const { count, error } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('signup_source', 'importation')
        .not('email', 'is', null)
      if (error) return json({ error: error.message }, 500)
      return json({ count: count ?? 0 })
    }

    if (req.method === 'POST' && action === 'admin-send-broadcast') {
      const { manager_token, subject, html } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!subject || typeof subject !== 'string' || !subject.trim()) return json({ error: 'Missing subject' }, 400)
      if (!html || typeof html !== 'string' || !html.trim()) return json({ error: 'Missing html body' }, 400)

      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, email, full_name')
        .eq('signup_source', 'importation')
        .not('email', 'is', null)
      if (error) return json({ error: error.message }, 500)

      const recipients = (customers ?? []).filter((c: any) => !!c.email)
      let queued = 0
      for (const c of recipients) {
        const personalizedHtml = emailShell(personalizeBroadcast(html, c.full_name ?? 'there'))
        const personalizedSubject = personalizeBroadcast(subject, c.full_name ?? 'there')
        const { error: qErr } = await supabase.from('import_notification_queue').insert({ to_email: c.email, subject: personalizedSubject, html: personalizedHtml })
        if (!qErr) queued++
      }

      return json({ success: true, queued, recipients: recipients.length })
    }

    if (req.method === 'POST' && action === 'checkout-mark-paid-claim') {
      const { customer_id, order_id, sender_name, sender_bank_name } = await req.json()
      if (!customer_id || !order_id) return json({ error: 'Missing customer_id or order_id' }, 400)
      if (!sender_name || typeof sender_name !== 'string' || !sender_name.trim()) {
        return json({ error: 'Sender name is required so we can match your payment.' }, 400)
      }

      const { data: existing, error: findErr } = await supabase
        .from('china_import_orders').select('id, user_id, payment_method, payment_status').eq('id', order_id).single()
      if (findErr || !existing) return json({ error: 'Order not found' }, 404)
      if (existing.user_id !== customer_id) return json({ error: 'Unauthorized' }, 403)
      if (existing.payment_method !== 'manual') return json({ error: 'This order is not a manual-transfer order' }, 400)
      if (existing.payment_status !== 'unpaid') return json({ order: existing })

      const updates: Record<string, unknown> = {
        payment_status: 'awaiting_confirmation',
        manual_sender_name: sender_name.trim(),
      }
      if (typeof sender_bank_name === 'string' && sender_bank_name.trim()) updates.manual_sender_bank = sender_bank_name.trim()

      const { data, error } = await supabase
        .from('china_import_orders')
        .update(updates)
        .eq('id', order_id).select().single()
      if (error) return json({ error: error.message }, 500)
      return json({ order: data })
    }

    if (req.method === 'POST' && action === 'admin-get-templates') {
      const { manager_token } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      const { data, error } = await supabase.from('import_message_templates').select('*').order('key')
      if (error) return json({ error: error.message }, 500)
      return json({ templates: data ?? [] })
    }

    if (req.method === 'POST' && action === 'admin-update-template') {
      const { manager_token, key, subject, body_html } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!key || !subject || !body_html) return json({ error: 'Missing key, subject, or body_html' }, 400)
      const { data, error } = await supabase
        .from('import_message_templates')
        .update({ subject, body_html, updated_at: new Date().toISOString() })
        .eq('key', key).select().single()
      if (error) return json({ error: error.message }, 500)
      return json({ template: data })
    }

    if (req.method === 'POST' && action === 'process-notification-queue') {
      const { data: pending, error } = await supabase
        .from('import_notification_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(25)
      if (error) return json({ error: error.message }, 500)
      if (!pending || pending.length === 0) return json({ processed: 0 })

      let sent = 0, failed = 0
      for (const row of pending) {
        try {
          const res = await supabase.functions.invoke('send-email', { body: { to: row.to_email, subject: row.subject, html: row.html } })
          if (res.error) {
            await supabase.from('import_notification_queue').update({
              status: row.attempts + 1 >= 3 ? 'failed' : 'pending',
              attempts: row.attempts + 1,
              error: res.error.message ?? String(res.error),
            }).eq('id', row.id)
            failed++
          } else {
            await supabase.from('import_notification_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id)
            sent++
          }
        } catch (e: any) {
          await supabase.from('import_notification_queue').update({
            status: row.attempts + 1 >= 3 ? 'failed' : 'pending',
            attempts: row.attempts + 1,
            error: e?.message ?? String(e),
          }).eq('id', row.id)
          failed++
        }
      }
      return json({ processed: pending.length, sent, failed })
    }

    if (req.method === 'POST' && action === 'admin-batch-item-bills') {
      const { manager_token, batch_key } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!batch_key) return json({ error: 'Missing batch_key' }, 400)
      const [{ data: items }, { data: statuses }] = await Promise.all([
        supabase.from('import_batch_item_bills').select('*').eq('batch_key', batch_key),
        supabase.from('import_batch_bill_status').select('*').eq('batch_key', batch_key),
      ])
      return json({ items: items ?? [], statuses: statuses ?? [] })
    }

    if (req.method === 'POST' && action === 'admin-batch-set-item-price') {
      const { manager_token, batch_key, product_id, product_name, unit_amount_ngn, kind } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!batch_key || !product_id || !product_name || typeof unit_amount_ngn !== 'number') return json({ error: 'Missing fields' }, 400)
      const billKind = kind === 'clearance' ? 'clearance' : 'consolidation_shipping'

      // NOTE: previously checked import_batch_bill_status for a 'sent' row
      // with .maybeSingle() and no customer_id filter — that table is
      // per-customer, so once 2+ customers were billed for this batch+kind
      // that query threw (PostgREST errors on multiple rows for
      // maybeSingle()), silently blocking admin from ever re-pricing a
      // partially-billed batch. Removed: the real protection now lives in
      // get_batch_billing_eligible_customers, which already excludes
      // already-billed customers per-customer when auto-billing below —
      // changing the batch default here only affects customers not yet
      // billed, exactly as intended.
      const { error } = await supabase.from('import_batch_item_bills')
        .upsert({ batch_key, product_id, product_name, unit_amount_ngn, kind: billKind, updated_at: new Date().toISOString() }, { onConflict: 'batch_key,product_id,kind' })
      if (error) return json({ error: error.message }, 500)

      // Setting this batch-wide default price can complete pricing for any
      // number of customers who ordered this product and had everything
      // else already priced — bill everyone now eligible, immediately,
      // with an itemized email each.
      const { billedCount, queued } = await bulkAutoBillAndNotify(supabase, batch_key, billKind)
      return json({ success: true, auto_billed_count: billedCount, emails_queued: queued })
    }

    if (req.method === 'POST' && action === 'admin-batch-toggle-audit') {
      const { manager_token, id } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!id) return json({ error: 'Missing id' }, 400)
      const { data: row } = await supabase.from('import_batch_item_bills').select('audit_status').eq('id', id).single()
      if (!row) return json({ error: 'Not found' }, 404)
      const { data, error } = await supabase.from('import_batch_item_bills').update({ audit_status: !row.audit_status }).eq('id', id).select().single()
      if (error) return json({ error: error.message }, 500)
      return json({ item: data })
    }

    if (req.method === 'POST' && action === 'admin-batch-breakdown') {
      const { manager_token, batch_key } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!batch_key) return json({ error: 'Missing batch_key' }, 400)

      const { data, error } = await supabase.rpc('get_batch_product_breakdown', { p_batch_key: batch_key })
      if (error) return json({ error: error.message }, 500)

      const { data: shippingCounts } = await supabase
        .from('china_import_orders')
        .select('shipping_method')
        .eq('staged_at', batch_key)
      const flightCount = (shippingCounts ?? []).filter((o: any) => o.shipping_method === 'flight').length
      const seaCount = (shippingCounts ?? []).filter((o: any) => o.shipping_method === 'sea_freight').length

      return json({ rows: data ?? [], shipping_kpi: { flight: flightCount, sea_freight: seaCount } })
    }

    if (req.method === 'POST' && action === 'admin-batch-close-ordered') {
      const { manager_token, batch_key } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!batch_key) return json({ error: 'Missing batch_key' }, 400)

      const result = await closeBatchBilling(supabase, batch_key, 'consolidation_shipping', 'ordered_and_closed', 'ordered_closed_at')
      if (result.error) return json({ error: result.error }, result.status ?? 500)
      return json({ success: true, ...result })
    }

    if (req.method === 'POST' && action === 'admin-batch-mark-shipped') {
      const { manager_token, batch_key, shipping_method_final } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!batch_key) return json({ error: 'Missing batch_key' }, 400)

      const { data: billStatus } = await supabase.from('import_batch_bill_status').select('status').eq('batch_key', batch_key).eq('kind', 'consolidation_shipping').maybeSingle()
      if (billStatus?.status !== 'sent') return json({ error: 'Close & bill this batch (consolidation & shipping) before marking it shipped.' }, 400)

      const { data: batchOrders, error: ordersErr } = await supabase
        .from('china_import_orders')
        .select('id, user_id, customer_name, shipping_method')
        .eq('staged_at', batch_key)
      if (ordersErr) return json({ error: ordersErr.message }, 500)
      if (!batchOrders || batchOrders.length === 0) return json({ error: 'No orders found in this batch.' }, 400)

      const orderIds = batchOrders.map((o: any) => o.id)
      const now = new Date().toISOString()
      await supabase.from('china_import_orders').update({ status: 'shipped_and_closed', shipped_at: now, updated_at: now }).in('id', orderIds)

      const batchId = await resolveBatchId(supabase, batch_key)
      if (batchId) {
        await supabase.from('import_batches').update({
          shipped_closed_at: now, updated_at: now,
          ...(shipping_method_final ? { shipping_method_final } : {}),
        }).eq('id', batchId)
      }

      const { data: bills } = await supabase
        .from('china_import_consolidation_bills')
        .select('user_id, status')
        .eq('kind', 'consolidation_shipping')
        .in('user_id', [...new Set(batchOrders.map((o: any) => o.user_id).filter(Boolean))])
      const billStatusByUser = new Map<string, string>()
      for (const b of (bills ?? [])) {
        if (billStatusByUser.get(b.user_id) !== 'paid') billStatusByUser.set(b.user_id, b.status)
      }

      const seenUsers = new Set<string>()
      const methodLabel = shipping_method_final === 'flight' ? ' by air' : shipping_method_final === 'sea_freight' ? ' by sea' : ''
      let paidNotified = 0, heldNotified = 0
      for (const o of batchOrders) {
        if (!o.user_id || seenUsers.has(o.user_id)) continue
        seenUsers.add(o.user_id)
        const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', o.user_id).single()
        if (!customer?.email) continue
        const isPaid = billStatusByUser.get(o.user_id) === 'paid'
        const ok = await queueTemplatedEmail(supabase, isPaid ? 'shipped_paid' : 'shipped_held_unpaid', customer.email, {
          customer_name: customer.full_name ?? o.customer_name ?? 'there',
          shipping_method_label: methodLabel,
        })
        if (ok) { if (isPaid) paidNotified++; else heldNotified++ }
      }

      return json({ success: true, orders_updated: orderIds.length, paid_notified: paidNotified, held_unpaid_notified: heldNotified })
    }

    if (req.method === 'POST' && action === 'admin-batch-close-clearance') {
      const { manager_token, batch_key } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!batch_key) return json({ error: 'Missing batch_key' }, 400)

      const batchId = await resolveBatchId(supabase, batch_key)
      const { data: batchRow } = batchId ? await supabase.from('import_batches').select('shipped_closed_at').eq('id', batchId).single() : { data: null }
      if (!batchRow?.shipped_closed_at) return json({ error: 'This batch must be marked shipped & closed before clearance can be billed.' }, 400)

      const result = await closeBatchBilling(supabase, batch_key, 'clearance', 'clearance_and_closed', 'clearance_closed_at')
      if (result.error) return json({ error: result.error }, result.status ?? 500)
      return json({ success: true, ...result })
    }

    if (req.method === 'POST' && action === 'admin-mark-received') {
      const { manager_token, order_id } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!order_id) return json({ error: 'Missing order_id' }, 400)

      const { data: order, error: orderErr } = await supabase.from('china_import_orders').select('id, status, user_id, code, customer_name').eq('id', order_id).single()
      if (orderErr || !order) return json({ error: 'Order not found' }, 404)
      if (order.status !== 'clearance_and_closed') return json({ error: 'This order must reach clearance & closed before it can be marked received.' }, 400)

      const { data: clearanceBill } = await supabase
        .from('china_import_consolidation_bills')
        .select('status')
        .eq('user_id', order.user_id)
        .eq('kind', 'clearance')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (clearanceBill?.status !== 'paid') return json({ error: "This customer's clearance fee hasn't been confirmed paid yet." }, 400)

      const now = new Date().toISOString()
      const { data: updated, error: updateErr } = await supabase
        .from('china_import_orders')
        .update({ status: 'received', received_at: now, updated_at: now })
        .eq('id', order_id).select().single()
      if (updateErr) return json({ error: updateErr.message }, 500)

      if (order.user_id) {
        const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
        if (customer?.email) {
          await sendTemplatedEmail(supabase, 'order_received', customer.email, {
            customer_name: customer.full_name ?? order.customer_name ?? 'there',
            order_code: order.code,
          })
        }
      }

      return json({ order: updated })
    }

    // Admin per-item shipping override. Only allowed before the batch's
    // consolidation_shipping bill is locked ('sent') — after that, shipping
    // is already priced/committed and changing it would silently break the
    // bill the customer already saw. Matches an item by product_id (+
    // variant_options when present) inside the order's items array.
    if (req.method === 'POST' && action === 'admin-set-item-shipping-method') {
      const { manager_token, order_id, product_id, variant_options, new_method } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!order_id || !product_id) return json({ error: 'Missing order_id or product_id' }, 400)
      if (!['flight', 'sea_freight'].includes(new_method)) return json({ error: 'Invalid new_method' }, 400)

      const { data: order, error: orderErr } = await supabase
        .from('china_import_orders').select('*').eq('id', order_id).single()
      if (orderErr || !order) return json({ error: 'Order not found' }, 404)

      if (order.staged_at) {
        const { data: billStatus } = await supabase
          .from('import_batch_bill_status').select('status')
          .eq('batch_key', order.staged_at).eq('kind', 'consolidation_shipping').maybeSingle()
        if (billStatus?.status === 'sent') {
          return json({ error: 'This batch has already been billed — shipping method can no longer be changed here.' }, 409)
        }
      }

      const { data: product } = await supabase
        .from('china_import_products').select('name, ship_only').eq('id', product_id).maybeSingle()
      if (product?.ship_only && new_method === 'flight') {
        return json({ error: 'This item can only ship by sea freight.' }, 400)
      }

      const items = Array.isArray(order.items) ? order.items : []
      const variantMatch = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
      let matched = false
      const updatedItems = items.map((i: any) => {
        if (i.id === product_id && (variant_options === undefined || variantMatch(i.variant_options, variant_options))) {
          matched = true
          return { ...i, shipping_method: new_method }
        }
        return i
      })
      if (!matched) return json({ error: 'Could not find that item on this order' }, 404)

      const methods = new Set(updatedItems.map((i: any) => i.shipping_method).filter(Boolean))
      const summary = methods.size === 1 ? [...methods][0] : methods.size > 1 ? 'mixed' : order.shipping_method

      const { data: updated, error: updateErr } = await supabase
        .from('china_import_orders')
        .update({ items: updatedItems, shipping_method: summary, updated_at: new Date().toISOString() })
        .eq('id', order_id).select().single()
      if (updateErr) return json({ error: updateErr.message }, 500)

      if (order.user_id) {
        const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
        if (customer?.email) {
          await queueTemplatedEmail(supabase, 'item_shipping_reassigned', customer.email, {
            customer_name: customer.full_name ?? order.customer_name ?? 'there',
            order_code: order.code,
            item_name: product?.name ?? 'your item',
            new_method_label: new_method === 'flight' ? 'air freight' : 'sea freight',
            arrival_window: new_method === 'flight' ? '20–30 days' : '60–90 days',
          })
        }
      }

      return json({ order: updated })
    }

    // Admin per-item variant override — some customers ask for a size/color
    // change after paying. Same "not billed" gate as shipping method, since
    // a variant change can also change price_ngn (price_deltas), which would
    // silently disagree with an already-sent bill otherwise.
    if (req.method === 'POST' && action === 'admin-set-item-variant') {
      const { manager_token, order_id, product_id, old_variant_options, new_variant_options } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!order_id || !product_id || !new_variant_options) return json({ error: 'Missing order_id, product_id, or new_variant_options' }, 400)

      const { data: order, error: orderErr } = await supabase
        .from('china_import_orders').select('*').eq('id', order_id).single()
      if (orderErr || !order) return json({ error: 'Order not found' }, 404)

      if (order.staged_at) {
        const { data: billStatus } = await supabase
          .from('import_batch_bill_status').select('status')
          .eq('batch_key', order.staged_at).eq('kind', 'consolidation_shipping').maybeSingle()
        if (billStatus?.status === 'sent') {
          return json({ error: 'This batch has already been billed — variants can no longer be changed here.' }, 409)
        }
      }

      const { data: product } = await supabase
        .from('china_import_products').select('name, price_ngn, variants, has_variants').eq('id', product_id).maybeSingle()
      if (!product?.has_variants) return json({ error: 'This product has no variants to change.' }, 400)

      const items = Array.isArray(order.items) ? order.items : []
      const variantMatch = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
      let matched = false
      let oldVariantOptions: Record<string, string> | null = null
      const newPrice = computeItemPriceNgn(product, new_variant_options)
      const updatedItems = items.map((i: any) => {
        if (i.id === product_id && (old_variant_options === undefined || variantMatch(i.variant_options, old_variant_options))) {
          matched = true
          oldVariantOptions = i.variant_options ?? null
          return { ...i, variant_options: new_variant_options, price_ngn: newPrice }
        }
        return i
      })
      if (!matched) return json({ error: 'Could not find that item on this order' }, 404)

      const subtotalNgn = updatedItems.reduce((s: number, i: any) => s + Number(i.price_ngn ?? 0) * Number(i.quantity ?? 0), 0)
      const jumiaFeeNgn = order.delivery_type === 'to_qafrica' ? updatedItems.reduce((s: number, i: any) => s + 200 * Number(i.quantity ?? 0), 0) : 0
      const totalNgn = subtotalNgn + jumiaFeeNgn

      const { data: updated, error: updateErr } = await supabase
        .from('china_import_orders')
        .update({ items: updatedItems, subtotal_ngn: subtotalNgn, jumia_fee_ngn: jumiaFeeNgn, total_ngn: totalNgn, updated_at: new Date().toISOString() })
        .eq('id', order_id).select().single()
      if (updateErr) return json({ error: updateErr.message }, 500)

      if (order.user_id) {
        const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', order.user_id).single()
        if (customer?.email) {
          const fmtVariant = (v: Record<string, string> | null) => v && Object.keys(v).length ? Object.values(v).join(', ') : 'no variant selected'
          await queueTemplatedEmail(supabase, 'item_variant_changed', customer.email, {
            customer_name: customer.full_name ?? order.customer_name ?? 'there',
            order_code: order.code,
            item_name: product?.name ?? 'your item',
            old_variant: fmtVariant(oldVariantOptions),
            new_variant: fmtVariant(new_variant_options),
            new_price: `₦${Math.round(newPrice).toLocaleString()}`,
          })
        }
      }

      return json({ order: updated })
    }

    // ── Timed Out Orders (admin) ────────────────────────────────────────────
    // china_import_failed_orders is populated by order-reminders' 24h expiry
    // sweep, which DELETES the original china_import_orders row — only the
    // fields it explicitly copies survive (code, customer_name, user_id,
    // items, total_ngn, delivery_type, payment_method, order_created_at).
    // shipping_method, delivery_address, customer_whatsapp are NOT preserved,
    // which is why a restored order always needs the customer to re-supply
    // shipping info (see 'complete-order-shipping' below and the
    // run-shipping-info-reminders / run-shipping-info-evening-reminders
    // actions in order-reminders).
    if (req.method === 'POST' && action === 'admin-failed-orders') {
      const { manager_token, search } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      let query = supabase
        .from('china_import_failed_orders')
        .select('*, customers(email, phone)')
        .is('restored_at', null)
        .order('failed_at', { ascending: false })
        .limit(500)
      if (search && typeof search === 'string' && search.trim()) {
        const s = search.trim()
        query = query.or(`code.ilike.%${s}%,customer_name.ilike.%${s}%`)
      }
      const { data, error } = await query
      if (error) return json({ error: error.message }, 500)
      return json({
        failed_orders: (data ?? []).map((o: any) => ({ ...o, customer_email: o.customers?.email ?? null, customer_phone: o.customers?.phone ?? null, customers: undefined })),
      })
    }

    if (req.method === 'POST' && action === 'admin-restore-failed-order') {
      const { manager_token, failed_order_id } = await req.json()
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!failed_order_id) return json({ error: 'Missing failed_order_id' }, 400)

      const { data: failed, error: findErr } = await supabase
        .from('china_import_failed_orders').select('*').eq('id', failed_order_id).maybeSingle()
      if (findErr || !failed) return json({ error: 'Timed-out order not found' }, 404)
      if (failed.restored_at) return json({ error: 'This order has already been restored.' }, 409)

      const items = Array.isArray(failed.items) ? failed.items : []
      const subtotalNgn = items.reduce((s: number, i: any) => s + Number(i.price_ngn ?? 0) * Number(i.quantity ?? 0), 0)
      const jumiaFeeNgn = failed.delivery_type === 'to_qafrica' ? items.reduce((s: number, i: any) => s + 200 * Number(i.quantity ?? 0), 0) : 0

      // china_import_orders.customer_whatsapp is NOT NULL, but the failed
      // snapshot never carried it — fall back to the customer's profile
      // phone if they have one, and to a clear placeholder otherwise. The
      // apology email tells them to fill in their delivery details anyway.
      let fallbackWhatsapp = 'Not provided — please update from your dashboard'
      if (failed.user_id) {
        const { data: c } = await supabase.from('customers').select('phone').eq('id', failed.user_id).single()
        if (c?.phone) fallbackWhatsapp = c.phone
      }

      const now = new Date().toISOString()
      const { data: restored, error: insertErr } = await supabase.from('china_import_orders').insert({
        code: failed.code, customer_name: failed.customer_name, customer_whatsapp: fallbackWhatsapp,
        items, delivery_type: failed.delivery_type,
        subtotal_ngn: subtotalNgn, jumia_fee_ngn: jumiaFeeNgn, total_ngn: failed.total_ngn,
        status: 'confirmed', user_id: failed.user_id,
        payment_method: failed.payment_method, payment_status: 'paid', paid_at: now,
        delivery_mode: 'home',
        restored_at: now, restored_from_failed_order_id: failed.id,
        admin_note: `Restored from a timed-out order (originally placed ${failed.order_created_at}). Shipping method and delivery details were lost when it expired — customer has been asked to set them again.`,
      }).select().single()
      if (insertErr) return json({ error: insertErr.message }, 500)

      await supabase.from('china_import_failed_orders')
        .update({ restored_at: now, restored_order_id: restored.id }).eq('id', failed.id)

      await incrementUnitsSold(supabase, items)

      if (failed.user_id) {
        const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', failed.user_id).single()
        if (customer?.email) {
          await sendTemplatedEmail(supabase, 'order_restored_apology', customer.email, {
            customer_name: customer.full_name ?? failed.customer_name ?? 'there',
            order_code: restored.code,
            dashboard_link: DASHBOARD_BILLS_URL,
          })
        }
      }

      return json({ order: restored })
    }

    // Customer sets shipping method (+ delivery address or pickup station)
    // on an order that's missing it — the only route into this today is a
    // restored order, but it's written generically against "any order
    // missing shipping info" rather than gated on restored_at, in case that
    // ever becomes true for another reason.
    if (req.method === 'POST' && action === 'complete-order-shipping') {
      const body = await req.json()
      const { customer_id, order_id, shipping_method, delivery_mode, pickup_station_id, delivery_address, address_id } = body
      if (!customer_id || !order_id) return json({ error: 'Missing customer_id or order_id' }, 400)
      if (!shipping_method || !['flight', 'sea_freight'].includes(shipping_method)) return json({ error: 'Invalid shipping_method' }, 400)

      const { data: order, error: findErr } = await supabase
        .from('china_import_orders').select('*').eq('id', order_id).eq('user_id', customer_id).maybeSingle()
      if (findErr || !order) return json({ error: 'Order not found' }, 404)

      const resolvedDeliveryMode: 'home' | 'pickup_station' = delivery_mode === 'pickup_station' ? 'pickup_station' : 'home'
      let cleanAddress: Record<string, string> | null = null
      let resolvedAddressId: string | null = null
      let pickupStationSnapshot: { id: string; name: string; address: string } | null = null

      if (order.delivery_type === 'to_me') {
        if (resolvedDeliveryMode === 'pickup_station') {
          if (!pickup_station_id) return json({ error: 'Missing pickup_station_id' }, 400)
          const { data: station } = await supabase
            .from('pickup_stations').select('id, name, address, is_active').eq('id', pickup_station_id).maybeSingle()
          if (!station || !station.is_active) return json({ error: 'That pickup station is no longer available. Please pick another.' }, 400)
          pickupStationSnapshot = { id: station.id, name: station.name, address: station.address }
          const a = delivery_address ?? {}
          if (!a.name?.trim() || !a.phone?.trim()) return json({ error: 'Missing delivery address field: name or phone' }, 400)
          cleanAddress = { name: a.name.trim(), phone: a.phone.trim() }
        } else if (address_id) {
          const { data: saved, error: savedErr } = await supabase
            .from('import_customer_addresses').select('*').eq('id', address_id).eq('customer_id', customer_id).maybeSingle()
          if (savedErr || !saved) return json({ error: 'Saved address not found' }, 404)
          resolvedAddressId = saved.id
          cleanAddress = {
            name: saved.name, phone: saved.phone, address_line1: saved.address_line1,
            address_line2: saved.address_line2 ?? '', city: saved.city, state: saved.state,
            landmark: saved.landmark ?? '',
          }
        } else {
          const a = delivery_address ?? {}
          const required = ['name', 'phone', 'address_line1', 'city', 'state']
          for (const field of required) {
            if (!a[field] || typeof a[field] !== 'string' || !a[field].trim()) {
              return json({ error: `Missing delivery address field: ${field}` }, 400)
            }
          }
          cleanAddress = {
            name: a.name.trim(), phone: a.phone.trim(),
            address_line1: a.address_line1.trim(), address_line2: (a.address_line2 ?? '').trim(),
            city: a.city.trim(), state: a.state.trim(), landmark: (a.landmark ?? '').trim(),
          }
        }
      }

      const updatedItems = (Array.isArray(order.items) ? order.items : []).map((i: any) => ({ ...i, shipping_method: i.shipping_method ?? shipping_method }))

      const { data: updated, error: updateErr } = await supabase.from('china_import_orders').update({
        shipping_method, items: updatedItems,
        delivery_mode: order.delivery_type === 'to_me' ? resolvedDeliveryMode : 'home',
        delivery_address: cleanAddress ?? order.delivery_address,
        address_id: resolvedAddressId,
        pickup_station_id: pickupStationSnapshot?.id ?? null,
        pickup_station_name: pickupStationSnapshot?.name ?? null,
        pickup_station_address: pickupStationSnapshot?.address ?? null,
        last_shipping_info_reminder_at: null, // stops further reminders — the completeness check below will exclude it
        updated_at: new Date().toISOString(),
      }).eq('id', order_id).select().single()
      if (updateErr) return json({ error: updateErr.message }, 500)

      return json({ order: updated })
    }

    if (req.method === 'POST' && action === 'bill-pay-verify') {
      const { customer_id, bill_id, reference } = await req.json()
      if (!customer_id || !bill_id || !reference) return json({ error: 'Missing customer_id, bill_id, or reference' }, 400)
      if (!PAYSTACK_SECRET_KEY) return json({ error: 'Payment verification not configured' }, 500)

      const { data: bill, error: findErr } = await supabase
        .from('china_import_consolidation_bills').select('*').eq('id', bill_id).single()
      if (findErr || !bill) return json({ error: 'Bill not found' }, 404)
      if (bill.user_id !== customer_id) return json({ error: 'Unauthorized' }, 403)
      if (bill.status === 'paid') return json({ success: true, bill })

      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      })
      const verifyData = await verifyRes.json()
      const ok = verifyRes.ok && verifyData?.data?.status === 'success'
      if (!ok) return json({ success: false, error: 'Payment could not be verified.' }, 400)

      const { data: updated, error: updateErr } = await supabase
        .from('china_import_consolidation_bills')
        .update({ status: 'paid', confirmed_paid_at: new Date().toISOString(), paystack_reference: reference, reminder_count: 0 })
        .eq('id', bill_id).select().single()
      if (updateErr) return json({ error: updateErr.message }, 500)

      if (updated?.kind === 'consolidation_shipping') {
        await sendShipmentPaymentDeliveryEstimate(supabase, updated)
      } else {
        const { data: customer } = await supabase.from('customers').select('email, full_name').eq('id', customer_id).single()
        if (customer?.email) {
          await sendTemplatedEmail(supabase, 'bill_payment_confirmed', customer.email, {
            customer_name: customer.full_name ?? 'there',
            amount_paid: Number(bill.amount_ngn ?? 0).toLocaleString(),
          })
        }
      }

      return json({ success: true, bill: updated })
    }

    // ── Address book (import customers only) ───────────────────────────────
    if (req.method === 'POST' && action === 'my-addresses') {
      const { customer_id } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)
      const { data, error } = await supabase
        .from('import_customer_addresses')
        .select('*')
        .eq('customer_id', customer_id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      return json({ addresses: data ?? [] })
    }

    if (req.method === 'POST' && action === 'save-address') {
      const body = await req.json()
      const { customer_id, id, label, name, phone, address_line1, address_line2, city, state, landmark, is_default, preferred_pickup_station_id } = body
      if (!customer_id) return json({ error: 'Login required' }, 401)
      const required = { name, phone, address_line1, city, state }
      for (const [field, value] of Object.entries(required)) {
        if (!value || typeof value !== 'string' || !value.trim()) return json({ error: `Missing ${field}` }, 400)
      }

      const row = {
        customer_id,
        label: typeof label === 'string' ? label.trim() || null : null,
        name: name.trim(), phone: phone.trim(),
        address_line1: address_line1.trim(), address_line2: (address_line2 ?? '').trim() || null,
        city: city.trim(), state: state.trim(), landmark: (landmark ?? '').trim() || null,
        is_default: !!is_default,
        preferred_pickup_station_id: preferred_pickup_station_id || null,
        updated_at: new Date().toISOString(),
      }

      // Only one default per customer — clear any existing default first so
      // the partial unique index (customer_id where is_default) never
      // collides with the row we're about to write.
      if (row.is_default) {
        await supabase.from('import_customer_addresses').update({ is_default: false }).eq('customer_id', customer_id).eq('is_default', true)
      }

      if (id) {
        const { data, error } = await supabase
          .from('import_customer_addresses').update(row).eq('id', id).eq('customer_id', customer_id).select().single()
        if (error) return json({ error: error.message }, 500)
        return json({ address: data })
      } else {
        const { data, error } = await supabase
          .from('import_customer_addresses').insert(row).select().single()
        if (error) return json({ error: error.message }, 500)
        return json({ address: data })
      }
    }

    if (req.method === 'POST' && action === 'delete-address') {
      const { customer_id, id } = await req.json()
      if (!customer_id || !id) return json({ error: 'Missing customer_id or id' }, 400)
      const { error } = await supabase
        .from('import_customer_addresses').delete().eq('id', id).eq('customer_id', customer_id)
      if (error) return json({ error: error.message }, 500)
      return json({ success: true })
    }

    // ── Delivery preference (default mode + default pickup station) ────────
    if (req.method === 'POST' && action === 'my-delivery-prefs') {
      const { customer_id } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)
      const { data, error } = await supabase
        .from('customers')
        .select('import_default_delivery_mode, import_default_pickup_station_id, pickup_stations:import_default_pickup_station_id(id, name, address, state)')
        .eq('id', customer_id).single()
      if (error) return json({ error: error.message }, 500)
      return json({
        default_delivery_mode: data.import_default_delivery_mode,
        default_pickup_station: data.pickup_stations ?? null,
      })
    }

    if (req.method === 'POST' && action === 'save-delivery-prefs') {
      const { customer_id, default_delivery_mode, default_pickup_station_id } = await req.json()
      if (!customer_id) return json({ error: 'Login required' }, 401)
      if (!['home', 'pickup_station'].includes(default_delivery_mode)) return json({ error: 'Invalid default_delivery_mode' }, 400)
      if (default_delivery_mode === 'pickup_station' && !default_pickup_station_id) {
        return json({ error: 'Pick a default station first' }, 400)
      }
      const { error } = await supabase
        .from('customers')
        .update({
          import_default_delivery_mode: default_delivery_mode,
          import_default_pickup_station_id: default_delivery_mode === 'pickup_station' ? default_pickup_station_id : null,
        })
        .eq('id', customer_id)
      if (error) return json({ error: error.message }, 500)
      return json({ success: true })
    }

    if (req.method === 'POST' && action === 'set-default-address') {
      const { customer_id, id } = await req.json()
      if (!customer_id || !id) return json({ error: 'Missing customer_id or id' }, 400)
      await supabase.from('import_customer_addresses').update({ is_default: false }).eq('customer_id', customer_id).eq('is_default', true)
      const { data, error } = await supabase
        .from('import_customer_addresses').update({ is_default: true }).eq('id', id).eq('customer_id', customer_id).select().single()
      if (error) return json({ error: error.message }, 500)
      return json({ address: data })
    }

    return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[china-import]', message)
    return json({ error: message }, 500)
  }
})
