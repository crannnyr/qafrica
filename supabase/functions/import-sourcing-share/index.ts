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

    // The public page only displays durable sourcing allocations. It never
    // derives quantities directly from the whole batch or from today's bill
    // state, so a later payment can only add a new allocation.
    const { data: rows, error } = await supabase.rpc('get_paid_sourcing_allocations', {
      p_batch_key: share.batch_key,
    })
    if (error) return json({ error: error.message }, 500)

    const products = (rows ?? []).map((row: any) => ({
      product_id: row.product_id,
      product_name: row.product_name || 'Unnamed product',
      product_image: row.product_image || null,
      source_url: row.source_url || null,
      total_qty: Number(row.total_qty ?? 0),
      customers_count: Number(row.customers_count ?? 0),
      variants: Array.isArray(row.variants)
        ? row.variants.map((v: any) => ({
            variant_options: v?.variant_options && typeof v.variant_options === 'object' ? v.variant_options : null,
            quantity: Number(v?.quantity ?? 0),
          }))
        : [],
    }))

    return json({
      batch_date: share.batch_key,
      products,
    })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, any> = {}
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const manager = await requireManager(supabase, body.manager_token)
  if (!manager) return json({ error: 'Unauthorized' }, 401)

  const batchKey = typeof body.batch_key === 'string' ? body.batch_key.trim() : ''
  if (!batchKey) return json({ error: 'Missing batch_key' }, 400)

  // The existing "Create and copy sourcing link" button is deliberately the
  // release point. Every time an admin opens/shares the link we reconcile paid
  // customers into immutable allocations. This means a late payer is added on
  // the next share refresh, while already released lines cannot be duplicated.
  const { data: prepared, error: prepareError } = await supabase.rpc('prepare_paid_sourcing', {
    p_batch_key: batchKey,
  })
  if (prepareError) return json({ error: prepareError.message }, 500)

  const { data: existing } = await supabase
    .from('import_sourcing_share_links')
    .select('token')
    .eq('batch_key', batchKey)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing?.token) {
    return json({
      success: true,
      token: existing.token,
      url: PUBLIC_BASE + '/' + existing.token,
      sourcing_sync: prepared ?? null,
    })
  }

  const { data: created, error } = await supabase
    .from('import_sourcing_share_links')
    .insert({ batch_key: batchKey, created_by: manager.user_id ?? null })
    .select('token')
    .single()

  if (error || !created) return json({ error: error?.message || 'Could not create sourcing link' }, 500)

  return json({
    success: true,
    token: created.token,
    url: PUBLIC_BASE + '/' + created.token,
    sourcing_sync: prepared ?? null,
  })
})
