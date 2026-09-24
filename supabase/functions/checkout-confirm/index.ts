// Called by the "confirming your payment" page after Nomba redirects back.
// Body: { reference }. Re-checks with Nomba (never trusts the browser), then returns public status.
// Deploy with verify_jwt = false (guests and pay-for-me payers use it).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyAndFinalize } from '../_shared/checkout.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let reference = '';
  try {
    reference = String((await req.json())?.reference ?? '').slice(0, 60);
  } catch { /* fallthrough */ }
  if (!/^QAF-[A-Z0-9-]+$/.test(reference)) return json(400, { error: 'Invalid reference' });

  try {
    await verifyAndFinalize(supabase, reference);
  } catch (e) {
    console.error('confirm failed', e);
    // Fall through: return current status; the webhook / sweep will finish the job
  }
  const { data } = await supabase.rpc('checkout_session_status', { p_reference: reference });
  if (!data) return json(404, { error: 'Not found' });
  return json(200, data);
});
