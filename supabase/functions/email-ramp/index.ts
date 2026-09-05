// email-ramp
//
// Daily cron target. Calls email_ramp_tick(), which adjusts each sending
// domain's hourly cap based on the trailing 24h bounce rate measured from
// webhook events:
//
//   < 50 events   -> hold (not enough signal)
//   bounce < 2%   -> double the cap, up to ramp_ceiling
//   bounce 2-5%   -> hold
//   bounce > 5%   -> halve the cap, floor of 50
//
// This is Resend's warm-up guidance ("start near the pre-26-August volume,
// roughly double each day while the delays clear") turned into something that
// runs on its own and, crucially, pulls the cap back down without anyone
// having to notice.
//
// GET returns the current health picture without changing anything.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  // Read-only health check.
  if (req.method === 'GET') {
    const [{ data: health }, { data: throttles }, { data: global }] = await Promise.all([
      supabase.from('email_health_24h').select('*'),
      supabase.from('email_domain_throttle').select('domain, hourly_cap, ramp_ceiling, sent_count, window_start'),
      supabase.from('email_global_settings').select('*').eq('id', 1).maybeSingle(),
    ])
    return json({ health: health ?? [], throttles: throttles ?? [], global: global ?? null })
  }

  try {
    const { data, error } = await supabase.rpc('email_ramp_tick')
    if (error) {
      console.error('[email-ramp] tick failed:', error.message)
      return json({ error: error.message }, 500)
    }
    console.log('[email-ramp] result:', JSON.stringify(data))
    return json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[email-ramp] threw:', message)
    return json({ error: message }, 500)
  }
})
