import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}
const PUBLIC_BASE = 'https://qafrica.store/importations/sourcing'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function requireManager(supabase: any, token: unknown) {
  if (!token || typeof token !== 'string') return null
  const { data, error } = await supabase.from('import_admin_sessions').select('token,user_id').eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle()
  return error || !data ? null : data
}

async function getShare(supabase: any, token: unknown) {
  if (!token || typeof token !== 'string') return null
  const { data, error } = await supabase.from('import_sourcing_share_links').select('token,batch_key').eq('token', token.trim()).maybeSingle()
  return error || !data ? null : data
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const token = url.searchParams.get('token')?.trim()
    const share = await getShare(supabase, token)
    if (!share) return json({ error: 'Sourcing link not found' }, 404)
    const { data: rows, error } = await supabase.rpc('get_paid_sourcing_allocations', { p_batch_key: share.batch_key })
    if (error) return json({ error: error.message }, 500)
    const products = (rows ?? []).map((row: any) => ({
      product_id: row.product_id,
      product_name: row.product_name || 'Unnamed product',
      product_image: row.product_image || null,
      source_url: row.source_url || null,
      total_qty: Number(row.total_qty ?? 0),
      customers_count: Number(row.customers_count ?? 0),
      variants: Array.isArray(row.variants) ? row.variants.map((v: any) => ({
        variant_options: v?.variant_options && typeof v.variant_options === 'object' ? v.variant_options : null,
        quantity: Number(v?.quantity ?? 0),
      })) : [],
    }))
    return json({ batch_date: share.batch_key, products })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const action = body.action
  if (action === 'sourcing-commitments' || action === 'commit-sourcing' || action === 'mark-sourcing-bought') {
    const share = await getShare(supabase, body.share_token)
    if (!share) return json({ error: 'Unauthorized sourcing link' }, 401)
    if (action === 'sourcing-commitments') {
      const { data, error } = await supabase.rpc('get_sourcing_commitment_lines', { p_batch_key: share.batch_key })
      if (error) return json({ error: error.message }, 500)
      return json({ batch_key: share.batch_key, rows: data ?? [] })
    }
    if (!body.allocation_id) return json({ error: 'Missing allocation_id' }, 400)
    const target = action === 'commit-sourcing' ? 'committed' : 'purchased'
    const { data, error } = await supabase.rpc('set_sourcing_allocation_status', { p_allocation_id: body.allocation_id, p_batch_key: share.batch_key, p_status: target })
    if (error) return json({ error: error.message }, 400)
    return json({ success: true, row: data?.[0] ?? data })
  }

  const manager = await requireManager(supabase, body.manager_token)
  if (!manager) return json({ error: 'Unauthorized' }, 401)
  const batchKey = typeof body.batch_key === 'string' ? body.batch_key.trim() : ''
  if (!batchKey) return json({ error: 'Missing batch_key' }, 400)

  const { data: existing } = await supabase.from('import_sourcing_share_links').select('token').eq('batch_key', batchKey).order('created_at', { ascending: true }).limit(1).maybeSingle()
  const token = existing?.token
  if (token) {
    const { data: stats, error: statsError } = await supabase.rpc('prepare_paid_sourcing', { p_batch_key: batchKey })
    if (statsError) return json({ error: statsError.message }, 500)
    return json({ success: true, token, url: `${PUBLIC_BASE}/${token}`, sourcing_sync: stats ?? null })
  }

  const { data: created, error } = await supabase.from('import_sourcing_share_links').insert({ batch_key: batchKey, created_by: manager.user_id ?? null }).select('token').single()
  if (error || !created) return json({ error: error?.message || 'Could not create sourcing link' }, 500)
  const { data: stats, error: statsError } = await supabase.rpc('prepare_paid_sourcing', { p_batch_key: batchKey })
  if (statsError) return json({ error: statsError.message }, 500)
  return json({ success: true, token: created.token, url: `${PUBLIC_BASE}/${created.token}`, sourcing_sync: stats ?? null })
})
