import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}
const PUBLIC_BASE = 'https://qafrica.store/importations/sourcing'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function requireManager(supabase: any, token: unknown) {
  if (!token || typeof token !== 'string') return null
  const { data, error } = await supabase
    .from('import_admin_sessions')
    .select('token,user_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !data) return null
  return data
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const url = new URL(req.url)

  if (req.method === 'GET') {
    const token = url.searchParams.get('token')?.trim()
    if (!token) return json({ error: 'Missing share token' }, 400)

    const { data: share, error: shareError } = await supabase
      .from('import_sourcing_share_links')
      .select('batch_key')
      .eq('token', token)
      .maybeSingle()

    if (shareError || !share) return json({ error: 'Sourcing link not found' }, 404)

    const { data: rows, error } = await supabase.rpc('get_batch_customer_breakdown', {
      p_batch_key: share.batch_key,
    })
    if (error) return json({ error: error.message }, 500)

    const orderIds = Array.from(new Set((rows ?? []).map((row: any) => row.order_id).filter(Boolean)))
    const { data: orderStatuses, error: statusError } = orderIds.length
      ? await supabase.from('china_import_orders').select('id,status').in('id', orderIds)
      : { data: [], error: null }
    if (statusError) return json({ error: statusError.message }, 500)

    const receivedIds = new Set((orderStatuses ?? []).filter((row: any) => row.status === 'received').map((row: any) => row.id))
    const grouped = new Map<string, {
      product_id: string
      product_name: string
      product_image: string | null
      total_qty: number
      variants: Array<{ variant_options: Record<string, string> | null; quantity: number }>
    }>()

    for (const row of (rows ?? [])) {
      if (!row.product_id || !row.customer_id || receivedIds.has(row.order_id)) continue

      const key = String(row.product_id)
      let item = grouped.get(key)
      if (!item) {
        item = {
          product_id: row.product_id,
          product_name: row.product_name || 'Unnamed product',
          product_image: row.product_image || null,
          total_qty: 0,
          variants: [],
        }
        grouped.set(key, item)
      }

      const qty = Number(row.qty ?? 0)
      item.total_qty += qty
      const variantKey = JSON.stringify(row.variant_options ?? null)
      const existing = item.variants.find(v => JSON.stringify(v.variant_options ?? null) === variantKey)
      if (existing) existing.quantity += qty
      else item.variants.push({ variant_options: row.variant_options ?? null, quantity: qty })
    }

    return json({
      batch_date: share.batch_key,
      products: Array.from(grouped.values()).sort((a, b) => a.product_name.localeCompare(b.product_name)),
    })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, any> = {}
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const manager = await requireManager(supabase, body.manager_token)
  if (!manager) return json({ error: 'Unauthorized' }, 401)

  const batchKey = typeof body.batch_key === 'string' ? body.batch_key.trim() : ''
  if (!batchKey) return json({ error: 'Missing batch_key' }, 400)

  const { data: existing } = await supabase
    .from('import_sourcing_share_links')
    .select('token')
    .eq('batch_key', batchKey)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing?.token) {
    return json({ success: true, token: existing.token, url: PUBLIC_BASE + '/' + existing.token })
  }

  const { data: created, error } = await supabase
    .from('import_sourcing_share_links')
    .insert({ batch_key: batchKey, created_by: manager.user_id ?? null })
    .select('token')
    .single()

  if (error || !created) return json({ error: error?.message || 'Could not create sourcing link' }, 500)

  return json({ success: true, token: created.token, url: PUBLIC_BASE + '/' + created.token })
})
