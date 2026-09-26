// Seller payout-account change with an emailed code, fully server-side.
// POST { action: 'request', bank_name, account_number, account_name }
// POST { action: 'confirm', code, bank_name, account_number, account_name }
// The code is bound to the exact new account: sha256(code:user:account_number:bank_name).
// Deploy with verify_jwt = true.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
function sixDigits() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}
async function email(to: string, subject: string, html: string) {
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    body: JSON.stringify({ to, subject, html }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await supabase.auth.getUser(token);
  if (!u?.user?.email) return json(401, { error: 'Sign in again' });

  // deno-lint-ignore no-explicit-any
  let b: any;
  try {
    b = await req.json();
  } catch {
    return json(400, { error: 'Invalid request' });
  }
  const bank = String(b?.bank_name ?? '').trim().slice(0, 80);
  const acct = String(b?.account_number ?? '').replace(/\D/g, '');
  const name = String(b?.account_name ?? '').trim().slice(0, 100);
  if (!bank || !/^\d{10}$/.test(acct) || name.length < 3) return json(400, { error: 'Enter the bank, a 10-digit account number and the account name' });

  const { data: w } = await supabase
    .from('wallets')
    .select('id, withdrawal_account_number, bank_change_otp, bank_change_otp_expires_at, bank_change_attempts, updated_at')
    .eq('user_id', u.user.id)
    .maybeSingle();
  if (!w) return json(404, { error: 'Wallet not found' });
  const bind = async (code: string) => sha256(`${code}:${u.user.id}:${acct}:${bank.toLowerCase()}`);

  if (b?.action === 'request') {
    // 60 seconds between codes (expiry is always now + 15 min, so issued_at = expiry - 15 min)
    if (w.bank_change_otp_expires_at) {
      const issuedAt = new Date(w.bank_change_otp_expires_at).getTime() - 15 * 60_000;
      if (Date.now() - issuedAt < 60_000) return json(429, { error: 'Please wait a minute before requesting another code' });
    }
    const code = sixDigits();
    await supabase.from('wallets').update({
      bank_change_otp: await bind(code),
      bank_change_otp_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      bank_change_attempts: 0,
    }).eq('id', w.id);
    await email(u.user.email, 'Your QAFRICA payout account code',
      `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:20px;color:#111"><p>Use this code to change your payout account to <b>${bank} ****${acct.slice(-4)}</b>:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p style="color:#555">It expires in 15 minutes. If you didn't ask for this, don't share the code and change your password now.</p></div>`);
    return json(200, { ok: true, sent_to: u.user.email });
  }

  if (b?.action === 'confirm') {
    const code = String(b?.code ?? '').replace(/\D/g, '');
    if (!w.bank_change_otp || !w.bank_change_otp_expires_at) return json(400, { error: 'Request a new code first' });
    if (new Date(w.bank_change_otp_expires_at).getTime() < Date.now()) return json(400, { error: 'This code has expired. Request a new one.' });
    if ((w.bank_change_attempts ?? 0) >= 5) return json(429, { error: 'Too many wrong attempts. Request a new code.' });
    if ((await bind(code)) !== w.bank_change_otp) {
      await supabase.from('wallets').update({ bank_change_attempts: (w.bank_change_attempts ?? 0) + 1 }).eq('id', w.id);
      return json(400, { error: 'That code is incorrect, or the account details changed after it was sent' });
    }
    const previous = w.withdrawal_account_number;
    await supabase.from('wallets').update({
      withdrawal_bank_name: bank, withdrawal_account_number: acct, withdrawal_account_name: name,
      withdrawal_account_updated_at: new Date().toISOString(),
      bank_change_otp: null, bank_change_otp_expires_at: null, bank_change_attempts: 0, updated_at: new Date().toISOString(),
    }).eq('id', w.id);
    await email(u.user.email, 'Your QAFRICA payout account was changed',
      `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:20px;color:#111"><p>Your payout account is now <b>${bank} ****${acct.slice(-4)}</b>${previous ? ` (was ****${String(previous).slice(-4)})` : ''}.</p><p style="color:#555">If this wasn't you, contact QAFRICA support immediately.</p></div>`).catch(() => {});
    return json(200, { ok: true });
  }
  return json(400, { error: 'Unknown action' });
});
