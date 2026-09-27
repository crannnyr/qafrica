// Background safety net (pg_cron every 5 minutes): re-checks recent unpaid sessions with Nomba, so a
// payment still becomes an order if the shopper closed the page and the webhook was missed.
// Deploy with verify_jwt = true (only the cron job's service token can call it).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyAndFinalize } from '../_shared/checkout.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async () => {
  const now = Date.now();
  const { data: sessions } = await supabase
    .from('checkout_sessions')
    .select('reference')
    .eq('status', 'awaiting_payment')
    .not('checkout_link', 'is', null)
    .lt('created_at', new Date(now - 3 * 60_000).toISOString())
    .gt('created_at', new Date(now - 48 * 3600_000).toISOString())
    .order('created_at', { ascending: true })
    .limit(25);

  const results: Record<string, string> = {};
  for (const s of sessions ?? []) {
    try {
      const r = await verifyAndFinalize(supabase, s.reference);
      results[s.reference] = r.status;
    } catch (e) {
      results[s.reference] = `error: ${String(e).slice(0, 80)}`;
    }
  }
  return new Response(JSON.stringify({ checked: (sessions ?? []).length, results }), { headers: { 'Content-Type': 'application/json' } });
});
