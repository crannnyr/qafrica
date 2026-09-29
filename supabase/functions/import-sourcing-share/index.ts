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
  return error || !data ? null : data
}

async function getShare(supabase: any, token: unknown) {
  if (!token || typeof token !== 'string') return null
  const cleanToken = token.trim()
  if (!cleanToken) return null
  const { data, error } = await supabase
    .from('import_sourcing_share_links')
    .select('token,batch_key')
    .eq('token', cleanToken)
    .maybeSingle()
  return error || !data ? null : data
}

async function getCommitmentRows(supabase: any, batchKey: string) {
  const { data, error } = await supabase.rpc('get_sourcing_commitment_lines', {
    p_batch_key: batchKey,
  })
  if (error) throw error
  return data ?? []
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const url = new URL(req.url)

  // Public read: possession of the share token is the authorization.
  // No Supabase Auth session is required.
  if (req.method === 'GET') {
    const share = await getShare(supabase, url.searchParams.get('token'))
    if (!share) return json({ error: 'Sourcing link not found' }, 404)
    try {
      const rows = await getCommitmentRows(supabase, share.batch_key)
      return json({ batch_key: share.batch_key, rows })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Could not load sourcing workflow' }, 500)
    }
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const action = body.action

  // Share-token actions are intentionally public because the sourcing URL itself
  // is the access credential for the China sourcing team.
  if (action === 'sourcing-commitments' || action === 'commit-sourcing' || action === 'mark-sourcing-bought') {
    const share = await getShare(supabase, body.share_token)
    if (!share) return json({ error: 'Sourcing link not found or invalid' }, 404)

    if (action === 'sourcing-commitments') {
      try {
        const rows = await getCommitmentRows(supabase, share.batch_key)
        return json({ batch_key: share.batch_key, rows })
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Could not load sourcing workflow' }, 500)
      }
    }

    if (!body.allocation_id) return json({ error: 'Missing allocation_id' }, 400)
    const target = action === 'commit-sourcing' ? 'committed' : 'purchased'
    const { data, error } = await supabase.rpc('set_sourcing_allocation_status', {
      p_allocation_id: body.allocation_id,
      p_batch_key: share.batch_key,
      p_status: target,
    })
    if (error) return json({ error: error.message }, 400)
    return json({ success: true, row: data?.[0] ?? data })
  }

  // Link creation remains an admin-only action. It NEVER commits sourcing.
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
    return json({
      success: true,
      token: existing.token,
      url: `${PUBLIC_BASE}/${existing.token}`,
    })
  }

  const { data: created, error } = await supabase
    .from('import_sourcing_share_links')
    .insert({ batch_key: batchKey, created_by: manager.user_id ?? null })
    .select('token')
    .single()

  if (error || !created) {
    return json({ error: error?.message || 'Could not create sourcing link' }, 500)
  }

  return json({
    success: true,
    token: created.token,
    url: `${PUBLIC_BASE}/${created.token}`,
  })
})
