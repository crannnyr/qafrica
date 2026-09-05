// import-batch-view
//
// Read-only data for the closed-batch admin screens. Split out of
// china-import deliberately: that file is ~1,700 lines and every unrelated
// change forces a full redeploy of the entire order/payment/billing surface.
// This is a small, read-only function with one job.
//
// Auth uses the same import_admin_sessions token as china-import, so there is
// one admin session concept rather than two.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

  if (!(await requireAdmin(supabase, body.manager_token))) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // One row per (customer, product) line in the batch, already carrying the
  // price paid, the 1688 link, and both "others ordered this" counts, so the
  // client does no stitching.
  if (action === 'customer-breakdown') {
    const batchKey = body.batch_key
    if (!batchKey || typeof batchKey !== 'string') return json({ error: 'Missing batch_key' }, 400)

    const { data, error } = await supabase.rpc('get_batch_customer_breakdown', { p_batch_key: batchKey })
    if (error) {
      console.error('[import-batch-view] breakdown failed:', error.message)
      return json({ error: error.message }, 500)
    }
    return json({ rows: data ?? [] })
  }

  return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
})
