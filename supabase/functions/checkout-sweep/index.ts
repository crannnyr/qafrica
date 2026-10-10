// Background safety net (pg_cron every 5 minutes): re-checks recent unpaid sessions with Nomba, so a
// payment still becomes an order if the shopper closed the page and the webhook was missed.
// Deploy with verify_jwt = true (only the cron job's service token can call it).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyAndFinalize } from '../_shared/checkout.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async () => {
  const now = Date.now();
  const cutoff = new Date(now - 3 * 60_000).toISOString();
  const horizon = new Date(now - 48 * 3600_000).toISOString();
  const [legacyResult, marketplaceResult] = await Promise.all([
    supabase.from('checkout_sessions').select('reference, created_at')
      .eq('status', 'awaiting_payment').not('checkout_link', 'is', null)
      .lt('created_at', cutoff).gt('created_at', horizon)
      .order('created_at', { ascending: true }).limit(25),
    supabase.from('marketplace_checkout_sessions').select('reference, created_at')
      .eq('status', 'awaiting_payment').not('checkout_link', 'is', null)
      .lt('created_at', cutoff).gt('created_at', horizon)
      .order('created_at', { ascending: true }).limit(25),
  ]);
  if (legacyResult.error) console.error('legacy checkout sweep query failed', legacyResult.error);
  if (marketplaceResult.error) console.error('marketplace checkout sweep query failed', marketplaceResult.error);
  const sessions = [...(legacyResult.data ?? []), ...(marketplaceResult.data ?? [])]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
