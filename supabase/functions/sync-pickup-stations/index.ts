// sync-pickup-stations
// Pulls Jumia pickup stations from the Optimal Supabase project and
// upserts them into this project's public.pickup_stations, keyed on
// source_id (Optimal's row id). Safe to re-run — existing rows are
// updated in place, nothing is duplicated. Stations that disappear from
// Optimal (or get is_active=false there) are marked inactive here rather
// than deleted, so historical orders that reference a station keep working.
//
// Invoked manually from ImportAdminPage (admin action) and on a daily
// cron (see the 'sync-jumia-pickup-stations-daily' pg_cron job).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

interface OptimalStation {
  id: string
  name: string
  state: string
  address: string
  landmark: string | null
  latitude: number
  longitude: number
  is_active: boolean
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

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const OPTIMAL_URL = 'https://dpioixansygkjdbphfdj.supabase.co'
  const OPTIMAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaW9peGFuc3lna2pkYnBoZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxNDQsImV4cCI6MjA3OTYwNTE0NH0.-ySc75siLeB2F1Mdsb44zWk7qetX1288DF3hISpMJyg'

  const qafr = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') ?? 'run'

    // Manual trigger from the admin UI requires a session; the cron job
    // hits this with no action param (defaults to 'run') and no auth check,
    // same pattern as the other scheduled functions in this project.
    if (action === 'run-admin') {
      const { manager_token } = await req.json().catch(() => ({}))
      if (!(await requireAdmin(qafr, manager_token))) return json({ error: 'Unauthorized' }, 401)
    }

    const res = await fetch(
      `${OPTIMAL_URL}/rest/v1/pickup_stations?select=id,name,state,address,landmark,latitude,longitude,is_active`,
      { headers: { apikey: OPTIMAL_ANON_KEY, Authorization: `Bearer ${OPTIMAL_ANON_KEY}` } }
    )
    if (!res.ok) {
      const err = await res.text()
      return json({ error: `Optimal fetch failed: ${err}` }, 502)
    }
    const stations: OptimalStation[] = await res.json()
    if (!Array.isArray(stations)) return json({ error: 'Unexpected response shape from Optimal' }, 502)

    const rows = stations.map(s => ({
      source_id: s.id,
      name: s.name,
      state: s.state,
      address: s.address,
      landmark: s.landmark,
      latitude: s.latitude,
      longitude: s.longitude,
      is_active: s.is_active,
      synced_at: new Date().toISOString(),
    }))

    let upserted = 0
    const errors: string[] = []
    const chunkSize = 200
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { error } = await qafr.from('pickup_stations').upsert(chunk, { onConflict: 'source_id' })
      if (error) errors.push(error.message)
      else upserted += chunk.length
    }

    // Stations present here but no longer returned by Optimal at all (fully
    // removed there, not just deactivated) get marked inactive rather than
    // deleted, so past orders referencing them don't break.
    const seenSourceIds = stations.map(s => s.id)
    if (seenSourceIds.length > 0) {
      await qafr.from('pickup_stations')
        .update({ is_active: false, synced_at: new Date().toISOString() })
        .not('source_id', 'in', `(${seenSourceIds.map(id => `"${id}"`).join(',')})`)
        .eq('is_active', true)
    }

    return json({ success: errors.length === 0, fetched: stations.length, upserted, errors })
  } catch (err: any) {
    return json({ error: err?.message ?? 'Unexpected error' }, 500)
  }
})
