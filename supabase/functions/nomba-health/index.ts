// Read-only Nomba health check. Runs only if an admin queued a row in payment_health_checks
// within the last 10 minutes. Records which secrets exist (true/false only), whether login works,
// and basic account status. Never stores or returns secret values or BVN.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { NombaError, nombaConfigured, nombaFetch, nombaToken, NOMBA_BASE } from '../_shared/nomba.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async () => {
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: job } = await supabase
    .from('payment_health_checks')
    .select('id')
    .eq('provider', 'nomba')
    .is('ran_at', null)
    .gte('requested_at', since)
    .order('requested_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!job) return json(404, { error: 'no pending check' });

  // deno-lint-ignore no-explicit-any
  const result: Record<string, any> = { base_url: NOMBA_BASE, secrets: nombaConfigured() };
  let ok = false;
  try {
    await nombaToken();
    result.login = 'ok';
    const parent = await nombaFetch('/v1/accounts/parent');
    const d = parent?.data ?? {};
    result.account = { status: d.status ?? null, accountName: d.accountName ?? null, currency: d.currency ?? null, type: d.type ?? null };
    ok = true;
  } catch (e) {
    if (e instanceof NombaError) {
      result.error = { step: result.login ? 'account' : 'login', http: e.status, code: e.code ?? null, description: e.description ?? null };
    } else {
      result.error = { message: String(e) };
    }
  }

  await supabase.from('payment_health_checks').update({ ran_at: new Date().toISOString(), ok, result }).eq('id', job.id);
  return json(200, { ok });
});
