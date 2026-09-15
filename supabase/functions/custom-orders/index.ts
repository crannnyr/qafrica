// custom-orders
//
// Custom sourcing requests: a customer submits a list of items they want
// QAFRICA to find (image + description + quantity + estimated budget each,
// no existing catalog listing needed). Admin reviews, attaches a store
// product link per item once sourced, then marks the whole request ready --
// which emails the customer. Kept as its own function, same reasoning as
// import-batch-view: a separate concern that doesn't need to share a
// redeploy with the main order/payment surface in china-import.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DASHBOARD_URL = 'https://qafrica.store/importations/dashboard'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function requireAdmin(supabase: any, token: unknown): Promise<boolean> {
  if (!token || typeof token !== 'string') return false
  const { data, error } = await supabase
    .from('import_admin_sessions')
    .select('token')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return !error && !!data
}

function emailShell(bodyHtml: string) {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
      <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
    </div>${bodyHtml}</div>`
}

function renderTemplate(template: string, tokens: Record<string, string>): string {
  let out = template
  for (const [k, v] of Object.entries(tokens)) out = out.split(`{{${k}}}`).join(v)
  return out.replace(/\{\{[a-z_]+\}\}/g, '')
}

async function queueTemplated(supabase: any, key: string, to: string, tokens: Record<string, string>): Promise<boolean> {
  const { data: tpl } = await supabase.from('import_message_templates').select('subject, body_html').eq('key', key).maybeSingle()
  if (!tpl) return false
  const { error } = await supabase.from('import_notification_queue').insert({
    to_email: to,
    subject: renderTemplate(tpl.subject, tokens),
    html: emailShell(renderTemplate(tpl.body_html, tokens)),
  })
  return !error
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const action = new URL(req.url).searchParams.get('action')
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* optional */ }

  try {
    // ── Customer: submit a new request (a list of items) ──────────────────
    if (action === 'submit-request') {
      const { customer_id, items } = body
      if (!customer_id) return json({ error: 'Login required' }, 401)
      if (!Array.isArray(items) || items.length === 0) return json({ error: 'Add at least one item' }, 400)

      for (const i of items) {
        if (!i.image_url || typeof i.image_url !== 'string') return json({ error: 'Every item needs an image' }, 400)
        if (!i.description || typeof i.description !== 'string' || !i.description.trim()) return json({ error: 'Every item needs a description' }, 400)
        const qty = Number(i.quantity)
        if (!Number.isFinite(qty) || qty <= 0) return json({ error: 'Every item needs a valid quantity' }, 400)
      }

      const { data: request, error: reqErr } = await supabase
        .from('custom_order_requests').insert({ customer_id, status: 'pending' }).select().single()
      if (reqErr) return json({ error: reqErr.message }, 500)

      const rows = items.map((i: any) => ({
        request_id: request.id,
        image_url: i.image_url,
        description: i.description.trim(),
        quantity: Math.round(Number(i.quantity)),
        estimated_budget_ngn: i.estimated_budget_ngn != null && i.estimated_budget_ngn !== '' ? Number(i.estimated_budget_ngn) : null,
      }))
      const { error: itemsErr } = await supabase.from('custom_order_items').insert(rows)
      if (itemsErr) return json({ error: itemsErr.message }, 500)

      return json({ request_id: request.id })
    }

    // ── Customer: view their own requests, newest first, with items ───────
    if (action === 'my-requests') {
      const { customer_id } = body
      if (!customer_id) return json({ error: 'Login required' }, 401)

      const { data: requests, error } = await supabase
        .from('custom_order_requests')
        .select('*, custom_order_items(*)')
        .eq('customer_id', customer_id)
        .order('created_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      return json({ requests: requests ?? [] })
    }

    // ── Admin: list requests (optionally filtered by status) ──────────────
    if (action === 'admin-list-requests') {
      const { manager_token, status } = body
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)

      let query = supabase
        .from('custom_order_requests')
        .select('*, custom_order_items(*), customers(full_name, email, phone)')
        .order('created_at', { ascending: false })
      if (status) query = query.eq('status', status)

      const { data, error } = await query.limit(300)
      if (error) return json({ error: error.message }, 500)

      const requests = (data ?? []).map((r: any) => ({
        ...r,
        customer_name: r.customers?.full_name ?? null,
        customer_email: r.customers?.email ?? null,
        customer_phone: r.customers?.phone ?? null,
        customers: undefined,
      }))
      return json({ requests })
    }

    // ── Admin: attach/update a store product link for one item ────────────
    if (action === 'admin-set-item-link') {
      const { manager_token, item_id, product_url, product_name } = body
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!item_id) return json({ error: 'Missing item_id' }, 400)

      let cleanUrl: string | null = null
      if (product_url && String(product_url).trim()) {
        try {
          const parsed = new URL(String(product_url).trim())
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return json({ error: 'Link must start with https://' }, 400)
          cleanUrl = parsed.toString()
        } catch {
          return json({ error: 'That link is not a valid URL' }, 400)
        }
      }

      const { data: item, error } = await supabase
        .from('custom_order_items')
        .update({ product_url: cleanUrl, product_name: product_name ?? null, updated_at: new Date().toISOString() })
        .eq('id', item_id).select().single()
      if (error) return json({ error: error.message }, 500)

      // Touch the parent request so "in progress" reflects that work has started on it.
      if (item?.request_id) {
        await supabase.from('custom_order_requests')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', item.request_id).eq('status', 'pending')
      }

      return json({ item })
    }

    // ── Admin: mark a request ready — requires every item linked first ────
    if (action === 'admin-mark-ready') {
      const { manager_token, request_id } = body
      if (!(await requireAdmin(supabase, manager_token))) return json({ error: 'Unauthorized' }, 401)
      if (!request_id) return json({ error: 'Missing request_id' }, 400)

      const { data: items } = await supabase.from('custom_order_items').select('id, product_url').eq('request_id', request_id)
      if (!items || items.length === 0) return json({ error: 'This request has no items' }, 400)
      const unlinked = items.filter((i: any) => !i.product_url)
      if (unlinked.length > 0) {
        return json({ error: `${unlinked.length} item${unlinked.length > 1 ? 's' : ''} still need${unlinked.length > 1 ? '' : 's'} a link before this request can be marked ready.` }, 400)
      }

      const now = new Date().toISOString()
      const { data: request, error } = await supabase
        .from('custom_order_requests')
        .update({ status: 'ready', ready_at: now, updated_at: now })
        .eq('id', request_id).select('*, customers(full_name, email)').single()
      if (error) return json({ error: error.message }, 500)

      if (request?.customers?.email) {
        await queueTemplated(supabase, 'custom_order_ready', request.customers.email, {
          customer_name: request.customers.full_name ?? 'there',
          dashboard_link: DASHBOARD_URL,
        })
      }

      return json({ success: true, request })
    }

    return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[custom-orders]', message)
    return json({ error: message }, 500)
  }
})
